import { Router, type IRouter, type Request, type Response } from "express";
import { db, workoutSessionsTable, workoutHistoryTable, exerciseLibraryTable, dailyCheckInsTable, externalWorkoutsTable } from "@workspace/db";
import { eq, desc, and, gte, ne } from "drizzle-orm";
import { exerciseMap } from "../data/exercises";
import { generateAuditInsight, generateRebalancePlan } from "../services/aiService";
import { aiRateLimit } from "../middlewares/rateLimitMiddleware";

const router: IRouter = Router();

const CANONICAL_MUSCLES = [
  "chest", "back", "shoulders", "quads", "hamstrings",
  "glutes", "biceps", "triceps", "core", "calves",
];

const MUSCLE_NORMALIZATION: Record<string, string> = {
  legs: "quads",
  arms: "biceps",
  hips: "glutes",
  abs: "core",
  abdominals: "core",
  lats: "back",
  traps: "back",
  forearms: "biceps",
  pecs: "chest",
  deltoids: "shoulders",
  delts: "shoulders",
};

function normalizeMuscleName(muscle: string): string {
  const lower = muscle.toLowerCase();
  return MUSCLE_NORMALIZATION[lower] ?? lower;
}

interface SessionSet {
  reps: number;
  weight: string;
  completed: boolean;
}

interface SessionExercise {
  exerciseId: string;
  name: string;
  sets: SessionSet[];
}

function getMuscleGroupsForExerciseId(exerciseId: string): string[] {
  const data = exerciseMap.get(exerciseId);
  if (data) {
    const muscles = [data.primaryMuscle.toLowerCase()];
    for (const sec of data.secondaryMuscles) {
      muscles.push(sec.toLowerCase());
    }
    return [...new Set(muscles)];
  }
  return [];
}

function getMuscleGroupsFromName(name: string): string[] {
  const n = name.toLowerCase();
  if (n.includes("bench") || n.includes("chest") || n.includes("push")) return ["chest"];
  if (n.includes("squat") || n.includes("leg") || n.includes("quad")) return ["quads"];
  if (n.includes("deadlift") || n.includes("row") || n.includes("pull")) return ["back"];
  if (n.includes("shoulder") || n.includes("press") || n.includes("lateral")) return ["shoulders"];
  if (n.includes("curl") || n.includes("bicep")) return ["biceps"];
  if (n.includes("tricep") || n.includes("dip")) return ["triceps"];
  if (n.includes("core") || n.includes("ab") || n.includes("plank")) return ["core"];
  if (n.includes("calf")) return ["calves"];
  if (n.includes("glute") || n.includes("hip")) return ["glutes"];
  if (n.includes("hamstring")) return ["hamstrings"];
  return [];
}

router.get("/audit/alerts", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const userId = req.user.id;

    const historyRecords = await db
      .select({
        exerciseId: workoutHistoryTable.exerciseId,
        consistencyIndex: workoutHistoryTable.consistencyIndex,
        performedAt: workoutHistoryTable.performedAt,
      })
      .from(workoutHistoryTable)
      .where(eq(workoutHistoryTable.userId, userId))
      .orderBy(desc(workoutHistoryTable.performedAt));

    const exerciseLibrary = await db
      .select({ id: exerciseLibraryTable.id, muscleGroup: exerciseLibraryTable.muscleGroup })
      .from(exerciseLibraryTable);

    const exerciseMuscleMap: Record<number, string> = {};
    for (const ex of exerciseLibrary) {
      exerciseMuscleMap[ex.id] = normalizeMuscleName(ex.muscleGroup ?? "");
    }

    const muscleLastTrained: Record<string, { date: Date; consistencyIndex: number | null }> = {};

    for (const record of historyRecords) {
      const muscle = exerciseMuscleMap[record.exerciseId] ?? "";
      if (!muscle) continue;
      if (!muscleLastTrained[muscle] || record.performedAt > muscleLastTrained[muscle].date) {
        muscleLastTrained[muscle] = {
          date: record.performedAt,
          consistencyIndex: record.consistencyIndex,
        };
      }
    }

    const externalWorkouts = await db
      .select()
      .from(externalWorkoutsTable)
      .where(eq(externalWorkoutsTable.userId, userId))
      .orderBy(desc(externalWorkoutsTable.createdAt));

    for (const ew of externalWorkouts) {
      if (ew.workoutType === "rest") continue;
      const groups = (ew.muscleGroups as string[]) ?? [];
      const ewDate = new Date(ew.createdAt);
      for (const mg of groups) {
        const key = normalizeMuscleName(mg);
        if (!muscleLastTrained[key] || ewDate > muscleLastTrained[key].date) {
          muscleLastTrained[key] = { date: ewDate, consistencyIndex: null };
        }
      }
    }

    const now = new Date();
    const alerts: { type: string; priority: number; muscle: string; message: string; daysSince?: number; consistencyIndex?: number }[] = [];

    for (const muscle of CANONICAL_MUSCLES) {
      const info = muscleLastTrained[muscle];
      if (!info) {
        if (historyRecords.length > 0 || externalWorkouts.length > 0) {
          alerts.push({
            type: "neglect",
            priority: 1,
            muscle,
            message: `${muscle.charAt(0).toUpperCase() + muscle.slice(1)} has never been trained`,
          });
        }
        continue;
      }

      const daysSince = Math.floor((now.getTime() - info.date.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSince >= 10) {
        alerts.push({
          type: "neglect",
          priority: 1,
          muscle,
          message: `${muscle.charAt(0).toUpperCase() + muscle.slice(1)} hasn't been trained in ${daysSince} days`,
          daysSince,
        });
      }

      if (info.consistencyIndex !== null && info.consistencyIndex !== undefined && info.consistencyIndex < 0.8) {
        alerts.push({
          type: "consistency",
          priority: 2,
          muscle,
          message: `Form/intensity check needed for ${muscle.charAt(0).toUpperCase() + muscle.slice(1)} (score: ${Math.round(info.consistencyIndex * 100)}%)`,
          consistencyIndex: info.consistencyIndex,
        });
      }
    }

    alerts.sort((a, b) => a.priority - b.priority);

    res.json(alerts);
  } catch (err) {
    console.error("Audit alerts error:", err);
    res.status(500).json({ error: "Failed to get audit alerts" });
  }
});

router.get("/audit/recovery-correlation", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const userId = req.user.id;

    const checkIns = await db
      .select()
      .from(dailyCheckInsTable)
      .where(eq(dailyCheckInsTable.userId, userId))
      .orderBy(desc(dailyCheckInsTable.createdAt))
      .limit(90);

    const sessions = await db
      .select()
      .from(workoutSessionsTable)
      .where(eq(workoutSessionsTable.userId, userId))
      .orderBy(desc(workoutSessionsTable.createdAt))
      .limit(90);

    const checkInByDate: Record<string, typeof checkIns[0]> = {};
    for (const ci of checkIns) {
      checkInByDate[ci.date] = ci;
    }

    const highRecoveryVolumes: number[] = [];
    const lowRecoveryVolumes: number[] = [];

    for (const session of sessions) {
      const dateStr = session.sessionDate;
      const checkIn = checkInByDate[dateStr];
      if (!checkIn) continue;

      const sleepScore = checkIn.sleepScore ?? Math.round((checkIn.sleepQuality / 5) * 100);

      let volume = session.totalVolume ?? 0;
      if (volume === 0) {
        const exercises = (session.exercises as SessionExercise[] | null) ?? [];
        for (const ex of exercises) {
          for (const s of (ex.sets ?? [])) {
            if (s.completed) {
              const weight = parseFloat(s.weight) || 0;
              volume += weight * (s.reps || 0);
            }
          }
        }
      }

      if (volume === 0) {
        volume = (session.totalSetsCompleted ?? 0) * 10;
      }

      if (sleepScore >= 70) {
        highRecoveryVolumes.push(volume);
      } else {
        lowRecoveryVolumes.push(volume);
      }
    }

    const avgHigh = highRecoveryVolumes.length > 0
      ? highRecoveryVolumes.reduce((a, b) => a + b, 0) / highRecoveryVolumes.length
      : 0;
    const avgLow = lowRecoveryVolumes.length > 0
      ? lowRecoveryVolumes.reduce((a, b) => a + b, 0) / lowRecoveryVolumes.length
      : 0;

    let percentageDifference = 0;
    if (avgLow > 0) {
      percentageDifference = Math.round(((avgHigh - avgLow) / avgLow) * 100);
    } else if (avgHigh > 0) {
      percentageDifference = 100;
    }

    res.json({
      highRecoveryCount: highRecoveryVolumes.length,
      lowRecoveryCount: lowRecoveryVolumes.length,
      avgHighVolume: Math.round(avgHigh),
      avgLowVolume: Math.round(avgLow),
      percentageDifference,
      hasEnoughData: highRecoveryVolumes.length >= 5 && lowRecoveryVolumes.length >= 5,
    });
  } catch (err) {
    console.error("Recovery correlation error:", err);
    res.status(500).json({ error: "Failed to compute recovery correlation" });
  }
});

router.get("/audit/volume-stats", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const userId = req.user.id;
    const range = (req.query.range as string) || "1M";

    const now = new Date();
    const cutoff = new Date();
    switch (range) {
      case "1W": cutoff.setDate(now.getDate() - 7); break;
      case "1M": cutoff.setMonth(now.getMonth() - 1); break;
      case "3M": cutoff.setMonth(now.getMonth() - 3); break;
      case "6M": cutoff.setMonth(now.getMonth() - 6); break;
      default: cutoff.setMonth(now.getMonth() - 1);
    }

    const cutoffStr = cutoff.toISOString().split("T")[0];

    const sessions = await db
      .select()
      .from(workoutSessionsTable)
      .where(
        and(
          eq(workoutSessionsTable.userId, userId),
          gte(workoutSessionsTable.sessionDate, cutoffStr)
        )
      )
      .orderBy(desc(workoutSessionsTable.createdAt));

    const externalWkts = await db
      .select()
      .from(externalWorkoutsTable)
      .where(
        and(
          eq(externalWorkoutsTable.userId, userId),
          gte(externalWorkoutsTable.createdAt, cutoff),
          ne(externalWorkoutsTable.source, "in-app")
        )
      )
      .orderBy(desc(externalWorkoutsTable.createdAt));

    const volumeByDate: Record<string, number> = {};
    const muscleSets: Record<string, number> = {};

    for (const session of sessions) {
      const dateKey = session.sessionDate;
      let sessionVolume = session.totalVolume ?? 0;

      const exercises = (session.exercises as SessionExercise[] | null) ?? [];

      if (sessionVolume === 0) {
        for (const ex of exercises) {
          for (const s of (ex.sets ?? [])) {
            if (s.completed) {
              const weight = parseFloat(s.weight) || 0;
              sessionVolume += weight * (s.reps || 0);
            }
          }
        }
      }

      if (sessionVolume === 0) {
        sessionVolume = (session.totalSetsCompleted ?? 0) * 10;
      }

      volumeByDate[dateKey] = (volumeByDate[dateKey] ?? 0) + sessionVolume;

      for (const ex of exercises) {
        const hasCompleted = (ex.sets ?? []).some((s: SessionSet) => s.completed);
        if (!hasCompleted) continue;
        let muscles = getMuscleGroupsForExerciseId(ex.exerciseId);
        if (muscles.length === 0) {
          muscles = getMuscleGroupsFromName(ex.name);
        }
        const completedSets = (ex.sets ?? []).filter((s: SessionSet) => s.completed).length;
        for (const m of muscles) {
          muscleSets[m] = (muscleSets[m] ?? 0) + completedSets;
        }
      }
    }

    for (const ew of externalWkts) {
      if (ew.workoutType === "rest") continue;
      const groups = (ew.muscleGroups as string[]) ?? [];
      for (const mg of groups) {
        const key = mg.toLowerCase();
        muscleSets[key] = (muscleSets[key] ?? 0) + 1;
      }
    }

    const sortedDates = Object.keys(volumeByDate).sort();
    const volumeTimeline = sortedDates.map(d => ({ date: d, volume: Math.round(volumeByDate[d]) }));

    const totalMuscleSets = Object.values(muscleSets).reduce((a, b) => a + b, 0);
    const muscleFocus = Object.entries(muscleSets)
      .map(([muscle, sets]) => ({
        muscle: muscle.charAt(0).toUpperCase() + muscle.slice(1),
        sets,
        percentage: totalMuscleSets > 0 ? Math.round((sets / totalMuscleSets) * 100) : 0,
      }))
      .sort((a, b) => b.sets - a.sets);

    const totalSessions = sessions.length + externalWkts.filter(e => e.workoutType !== "rest").length;
    const totalVolume = Object.values(volumeByDate).reduce((a, b) => a + b, 0);

    res.json({
      range,
      totalSessions,
      totalVolume: Math.round(totalVolume),
      volumeTimeline,
      muscleFocus,
      hasEnoughData: totalSessions >= 3,
    });
  } catch (err) {
    console.error("Volume stats error:", err);
    res.status(500).json({ error: "Failed to compute volume stats" });
  }
});

router.get("/audit/rebalance-plan", aiRateLimit, async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const userId = req.user.id;

    const now = new Date();
    const cutoff = new Date();
    cutoff.setMonth(now.getMonth() - 1);
    const cutoffStr = cutoff.toISOString().split("T")[0];

    const sessions = await db
      .select()
      .from(workoutSessionsTable)
      .where(and(eq(workoutSessionsTable.userId, userId), gte(workoutSessionsTable.sessionDate, cutoffStr)))
      .orderBy(desc(workoutSessionsTable.createdAt));

    const externalWkts = await db
      .select()
      .from(externalWorkoutsTable)
      .where(and(
        eq(externalWorkoutsTable.userId, userId),
        gte(externalWorkoutsTable.createdAt, cutoff),
        ne(externalWorkoutsTable.source, "in-app")
      ))
      .orderBy(desc(externalWorkoutsTable.createdAt));

    const muscleSets: Record<string, number> = {};

    for (const session of sessions) {
      const exercises = (session.exercises as SessionExercise[] | null) ?? [];
      for (const ex of exercises) {
        const hasCompleted = (ex.sets ?? []).some((s: SessionSet) => s.completed);
        if (!hasCompleted) continue;
        let muscles = getMuscleGroupsForExerciseId(ex.exerciseId);
        if (muscles.length === 0) muscles = getMuscleGroupsFromName(ex.name);
        const completedSets = (ex.sets ?? []).filter((s: SessionSet) => s.completed).length;
        for (const m of muscles) {
          muscleSets[m] = (muscleSets[m] ?? 0) + completedSets;
        }
      }
    }

    for (const ew of externalWkts) {
      if (ew.workoutType === "rest") continue;
      const groups = (ew.muscleGroups as string[]) ?? [];
      for (const mg of groups) {
        const key = mg.toLowerCase();
        muscleSets[key] = (muscleSets[key] ?? 0) + 1;
      }
    }

    const totalMuscleSets = Object.values(muscleSets).reduce((a, b) => a + b, 0);
    const muscleFocus = Object.entries(muscleSets)
      .map(([muscle, sets]) => ({
        muscle: muscle.charAt(0).toUpperCase() + muscle.slice(1),
        sets,
        percentage: totalMuscleSets > 0 ? Math.round((sets / totalMuscleSets) * 100) : 0,
      }))
      .sort((a, b) => b.sets - a.sets);

    const historyRecords = await db
      .select({ exerciseId: workoutHistoryTable.exerciseId, consistencyIndex: workoutHistoryTable.consistencyIndex, performedAt: workoutHistoryTable.performedAt })
      .from(workoutHistoryTable)
      .where(eq(workoutHistoryTable.userId, userId))
      .orderBy(desc(workoutHistoryTable.performedAt));

    const exerciseLibrary = await db
      .select({ id: exerciseLibraryTable.id, muscleGroup: exerciseLibraryTable.muscleGroup })
      .from(exerciseLibraryTable);

    const exerciseMuscleMap: Record<number, string> = {};
    for (const ex of exerciseLibrary) {
      exerciseMuscleMap[ex.id] = normalizeMuscleName(ex.muscleGroup ?? "");
    }

    const muscleLastTrained: Record<string, { date: Date; consistencyIndex: number | null }> = {};
    for (const record of historyRecords) {
      const muscle = exerciseMuscleMap[record.exerciseId] ?? "";
      if (!muscle) continue;
      if (!muscleLastTrained[muscle] || record.performedAt > muscleLastTrained[muscle].date) {
        muscleLastTrained[muscle] = { date: record.performedAt, consistencyIndex: record.consistencyIndex };
      }
    }

    const alerts: { type: string; muscle: string; message: string }[] = [];
    for (const muscle of CANONICAL_MUSCLES) {
      const info = muscleLastTrained[muscle];
      if (!info) continue;
      const daysSince = Math.floor((now.getTime() - info.date.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSince >= 10) {
        alerts.push({ type: "neglect", muscle, message: `${muscle} hasn't been trained in ${daysSince} days` });
      }
    }

    const plan = await generateRebalancePlan(muscleFocus, alerts);
    res.json(plan);
  } catch (err) {
    console.error("Rebalance plan error:", err);
    res.status(500).json({ error: "Failed to generate rebalance plan" });
  }
});

router.get("/audit/ai-insight", aiRateLimit, async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const userId = req.user.id;

    const alerts = await (async () => {
      const historyRecords = await db
        .select({
          exerciseId: workoutHistoryTable.exerciseId,
          consistencyIndex: workoutHistoryTable.consistencyIndex,
          performedAt: workoutHistoryTable.performedAt,
        })
        .from(workoutHistoryTable)
        .where(eq(workoutHistoryTable.userId, userId))
        .orderBy(desc(workoutHistoryTable.performedAt));

      const exerciseLibrary = await db
        .select({ id: exerciseLibraryTable.id, muscleGroup: exerciseLibraryTable.muscleGroup })
        .from(exerciseLibraryTable);

      const exerciseMuscleMap: Record<number, string> = {};
      for (const ex of exerciseLibrary) {
        exerciseMuscleMap[ex.id] = normalizeMuscleName(ex.muscleGroup ?? "");
      }

      const muscleLastTrained: Record<string, { date: Date; consistencyIndex: number | null }> = {};
      for (const record of historyRecords) {
        const muscle = exerciseMuscleMap[record.exerciseId] ?? "";
        if (!muscle) continue;
        if (!muscleLastTrained[muscle] || record.performedAt > muscleLastTrained[muscle].date) {
          muscleLastTrained[muscle] = { date: record.performedAt, consistencyIndex: record.consistencyIndex };
        }
      }

      const now = new Date();
      const result: { type: string; muscle: string; message: string; daysSince?: number; consistencyIndex?: number }[] = [];

      for (const muscle of CANONICAL_MUSCLES) {
        const info = muscleLastTrained[muscle];
        if (!info) continue;
        const daysSince = Math.floor((now.getTime() - info.date.getTime()) / (1000 * 60 * 60 * 24));
        if (daysSince >= 10) {
          result.push({ type: "neglect", muscle, message: `${muscle} hasn't been trained in ${daysSince} days`, daysSince });
        }
        if (info.consistencyIndex !== null && info.consistencyIndex !== undefined && info.consistencyIndex < 0.8) {
          result.push({ type: "consistency", muscle, message: `Consistency check needed for ${muscle}`, consistencyIndex: info.consistencyIndex });
        }
      }
      return result;
    })();

    const now = new Date();
    const cutoff = new Date();
    cutoff.setMonth(now.getMonth() - 1);

    const sessions = await db
      .select()
      .from(workoutSessionsTable)
      .where(and(eq(workoutSessionsTable.userId, userId), gte(workoutSessionsTable.sessionDate, cutoff.toISOString().split("T")[0])))
      .orderBy(desc(workoutSessionsTable.createdAt));

    const muscleSets: Record<string, number> = {};
    for (const session of sessions) {
      const exercises = (session.exercises as { exerciseId: string; name: string; sets: { completed: boolean }[] }[] | null) ?? [];
      for (const ex of exercises) {
        const completedSets = (ex.sets ?? []).filter(s => s.completed).length;
        if (completedSets === 0) continue;
        const data = exerciseMap.get(ex.exerciseId);
        const muscle = data?.primaryMuscle.toLowerCase() ?? "";
        if (muscle) muscleSets[muscle] = (muscleSets[muscle] ?? 0) + completedSets;
      }
    }

    const totalSets = Object.values(muscleSets).reduce((a, b) => a + b, 0);
    const muscleFocus = Object.entries(muscleSets).map(([muscle, sets]) => ({
      muscle: muscle.charAt(0).toUpperCase() + muscle.slice(1),
      sets,
      percentage: totalSets > 0 ? Math.round((sets / totalSets) * 100) : 0,
    }));

    const checkIns = await db.select().from(dailyCheckInsTable).where(eq(dailyCheckInsTable.userId, userId)).orderBy(desc(dailyCheckInsTable.createdAt)).limit(30);
    const checkInByDate: Record<string, typeof checkIns[0]> = {};
    for (const ci of checkIns) { checkInByDate[ci.date] = ci; }

    const highVols: number[] = [];
    const lowVols: number[] = [];
    for (const s of sessions) {
      const ci = checkInByDate[s.sessionDate];
      if (!ci) continue;
      const sleepScore = ci.sleepScore ?? Math.round((ci.sleepQuality / 5) * 100);
      const vol = s.totalVolume ?? (s.totalSetsCompleted ?? 0) * 10;
      if (sleepScore >= 70) highVols.push(vol); else lowVols.push(vol);
    }
    const avgHigh = highVols.length > 0 ? highVols.reduce((a, b) => a + b, 0) / highVols.length : 0;
    const avgLow = lowVols.length > 0 ? lowVols.reduce((a, b) => a + b, 0) / lowVols.length : 0;
    const pctDiff = avgLow > 0 ? Math.round(((avgHigh - avgLow) / avgLow) * 100) : (avgHigh > 0 ? 100 : 0);

    const insight = await generateAuditInsight(
      alerts,
      { totalSessions: sessions.length, totalVolume: sessions.reduce((a, s) => a + (s.totalVolume ?? 0), 0), muscleFocus },
      { avgHighVolume: Math.round(avgHigh), avgLowVolume: Math.round(avgLow), percentageDifference: pctDiff, hasEnoughData: highVols.length >= 5 && lowVols.length >= 5 }
    );

    res.json({ insight });
  } catch (err) {
    console.error("AI audit insight error:", err);
    res.json({ insight: "Keep training consistently to unlock deeper performance insights." });
  }
});

export default router;

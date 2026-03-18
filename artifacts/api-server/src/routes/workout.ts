import { Router, type IRouter, type Request, type Response } from "express";
import { db, userProfilesTable, dailyCheckInsTable, workoutSessionsTable, workoutHistoryTable, exerciseLibraryTable, exercisePerformanceTable, exerciseSubstitutionsTable, externalWorkoutsTable } from "@workspace/db";
import { eq, and, desc, inArray, sql, gte } from "drizzle-orm";
import { EXERCISE_LIBRARY, exerciseMap, type ExerciseData } from "../data/exercises";
import { generateAIWorkout, generateAIArchitectWorkout, parseWorkoutDescriptionAI, analyzeWorkoutImageAI } from "../services/aiService";
import { aiRateLimit } from "../middlewares/rateLimitMiddleware";

const router: IRouter = Router();

const GOAL_ALIAS: Record<string, string> = {
  muscle_gain: "muscle gain",
  fat_loss: "fat loss",
  general: "general fitness",
  strength: "strength",
  endurance: "endurance",
};

const EQUIPMENT_ALIAS: Record<string, string> = {
  dumbbells: "dumbbell",
  "pull-up bar": "pull-up bar",
  "resistance bands": "resistance band",
  "cable machine": "cable machine",
  barbell: "barbell",
  bench: "bench",
  "squat rack": "squat rack",
  "leg press": "leg press machine",
  "leg curl": "leg curl machine",
  "leg extension": "leg extension machine",
  kettlebells: "dumbbell",
  "ez bar": "ez bar",
  "ez curl bar": "ez bar",
  "foam roller": "foam roller",
  "weight plates": "barbell",
  "trap bar": "barbell",
  "smith machine": "squat rack",
  "lat pulldown": "cable machine",
  "chest press machine": "bench",
  "rowing machine": "cable machine",
  "dip station": "dip station",
  "gymnastics rings": "pull-up bar",
  "trx / suspension": "resistance band",
  "ab wheel": "bodyweight",
  "plyo box": "bodyweight",
  "battle ropes": "resistance band",
  none: "",
};

const INJURY_MUSCLE_MAP: Record<string, string[]> = {
  "lower back pain": ["back", "core"],
  "lower back": ["back", "core"],
  "back pain": ["back"],
  "knee": ["quads", "hamstrings", "calves", "glutes"],
  "knee pain": ["quads", "hamstrings", "calves", "glutes"],
  "shoulder": ["shoulders", "chest"],
  "shoulder pain": ["shoulders", "chest"],
  "rotator cuff": ["shoulders", "chest"],
  "wrist": ["biceps", "triceps", "chest", "shoulders"],
  "wrist pain": ["biceps", "triceps", "chest", "shoulders"],
  "elbow": ["biceps", "triceps"],
  "elbow pain": ["biceps", "triceps"],
  "ankle": ["calves", "quads"],
  "ankle pain": ["calves", "quads"],
  "hip": ["glutes", "hamstrings", "quads"],
  "hip pain": ["glutes", "hamstrings", "quads"],
  "neck": ["shoulders", "back"],
  "neck pain": ["shoulders", "back"],
};

function normalizeInjuries(injuries: string[]): string[] {
  const result: string[] = [];
  for (const inj of injuries) {
    const lower = inj.toLowerCase().trim();
    const mapped = INJURY_MUSCLE_MAP[lower];
    if (mapped) {
      result.push(...mapped);
    } else {
      for (const [key, muscles] of Object.entries(INJURY_MUSCLE_MAP)) {
        if (lower.includes(key) || key.includes(lower)) {
          result.push(...muscles);
          break;
        }
      }
      const directMap = BODYMAP_MUSCLE_ALIAS[lower];
      if (directMap) result.push(directMap);
      else if (!result.includes(lower)) result.push(lower);
    }
  }
  return [...new Set(result)];
}

const BODYMAP_MUSCLE_ALIAS: Record<string, string> = {
  biceps_l: "biceps",
  biceps_r: "biceps",
  triceps_l: "triceps",
  triceps_r: "triceps",
  quads_l: "quads",
  quads_r: "quads",
  hamstrings_l: "hamstrings",
  hamstrings_r: "hamstrings",
  abs: "core",
  upper_back: "back",
  lower_back: "back",
  lats: "back",
  traps: "shoulders",
  shins: "calves",
};

function normalizeGoal(goal: string | null): string {
  const raw = (goal ?? "general fitness").toLowerCase().trim();
  return GOAL_ALIAS[raw] ?? raw;
}

function normalizeEquipment(items: string[]): string[] {
  return items
    .map(e => {
      const lower = e.toLowerCase().trim();
      const alias = EQUIPMENT_ALIAS[lower];
      return alias !== undefined ? alias : lower;
    })
    .filter(e => e.length > 0);
}

function normalizeMuscle(muscle: string): string {
  const lower = muscle.toLowerCase().trim();
  return BODYMAP_MUSCLE_ALIAS[lower] ?? lower;
}

const MUSCLE_GROUPS_FOR_GOAL: Record<string, string[]> = {
  "muscle gain": ["chest", "back", "quads", "shoulders", "hamstrings", "glutes", "biceps", "triceps"],
  "fat loss": ["quads", "back", "chest", "glutes", "hamstrings", "core", "shoulders"],
  "strength": ["back", "quads", "chest", "shoulders", "hamstrings", "glutes"],
  "endurance": ["quads", "hamstrings", "core", "glutes", "back", "shoulders"],
  "general fitness": ["chest", "back", "quads", "shoulders", "core", "glutes"],
};

function pickPrimaryMuscleGroups(goal: string | null): string[] {
  const key = normalizeGoal(goal);
  return MUSCLE_GROUPS_FOR_GOAL[key] ?? MUSCLE_GROUPS_FOR_GOAL["general fitness"];
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getSetsForDifficulty(skillLevel: string, category: string, energyLevel: number): number {
  let baseSets = 3;
  if (category === "compound") baseSets = skillLevel === "advanced" ? 5 : skillLevel === "intermediate" ? 4 : 3;
  if (category === "accessory") baseSets = skillLevel === "advanced" ? 4 : 3;
  if (category === "core") baseSets = 3;

  if (energyLevel <= 2) baseSets = Math.max(2, baseSets - 1);
  return baseSets;
}

function getRepsForCategory(category: string, goal: string | null): number {
  const g = (goal ?? "general fitness").toLowerCase();
  if (category === "compound") {
    if (g === "strength") return 5;
    if (g === "muscle gain") return 8;
    return 8;
  }
  if (category === "accessory") {
    if (g === "strength") return 8;
    if (g === "muscle gain") return 12;
    return 10;
  }
  if (category === "core") return 15;
  return 10;
}

function getWeightSuggestion(category: string, difficulty: string): string {
  if (category === "warmup" || category === "cooldown") return "BW";
  if (category === "core") {
    if (difficulty === "beginner") return "BW";
    return "Light";
  }
  if (category === "compound") {
    if (difficulty === "beginner") return "Moderate";
    if (difficulty === "intermediate") return "Heavy";
    return "Max Effort";
  }
  if (difficulty === "beginner") return "Light";
  if (difficulty === "intermediate") return "Moderate";
  return "Heavy";
}

interface GeneratedExercise {
  exerciseId: string;
  name: string;
  primaryMuscle: string;
  secondaryMuscles: string[];
  category: string;
  sets: number;
  reps: number;
  weight: string;
  youtubeKeyword: string;
}

router.post("/workout/generate", aiRateLimit, async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
  const userId = req.user.id;

  const [profile] = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, userId));

  const today = new Date().toISOString().split("T")[0];
  const [latestCheckin] = await db
    .select()
    .from(dailyCheckInsTable)
    .where(and(eq(dailyCheckInsTable.userId, userId), eq(dailyCheckInsTable.date, today)));

  const skillLevel = profile?.skillLevel ?? "intermediate";
  const fitnessGoal = normalizeGoal(profile?.fitnessGoal ?? null);
  const userEquipment = normalizeEquipment((profile?.equipment as string[]) ?? []);
  const userInjuries = normalizeInjuries((profile?.injuries as string[]) ?? []);

  const energyLevel = latestCheckin?.energyLevel ?? 3;
  const soreMuscleGroups = (latestCheckin?.soreMuscleGroups as { muscle: string; severity: number }[]) ?? [];

  const highSorenessGroups = [...new Set(soreMuscleGroups.filter(s => s.severity > 7).map(s => normalizeMuscle(s.muscle)))];
  const moderateSorenessGroups = [...new Set(soreMuscleGroups.filter(s => s.severity >= 4 && s.severity <= 7).map(s => normalizeMuscle(s.muscle)))];

  const excludedMuscles = new Set([...highSorenessGroups, ...userInjuries]);

  // Fetch external workouts from last 48h to factor their muscle fatigue into the builder
  const cutoff48h = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const recentExternal = await db.select()
    .from(externalWorkoutsTable)
    .where(and(
      eq(externalWorkoutsTable.userId, userId),
      gte(externalWorkoutsTable.createdAt, cutoff48h),
    ))
    .orderBy(desc(externalWorkoutsTable.createdAt))
    .limit(15);

  const externalWorkoutFatigue = recentExternal
    .filter(e => e.workoutType !== "rest" && e.source !== "in-app" && ((e.muscleGroups as string[]) ?? []).length > 0)
    .map(e => ({
      label: e.label,
      muscleGroups: (e.muscleGroups as string[]) ?? [],
      intensity: e.intensity ?? 5,
      hoursAgo: (Date.now() - e.createdAt.getTime()) / (1000 * 60 * 60),
    }));

  // Very high intensity externals (RPE ≥ 9, within 24h) → treat muscles as fully excluded
  externalWorkoutFatigue
    .filter(e => e.intensity >= 9 && e.hoursAgo < 24)
    .flatMap(e => e.muscleGroups.map(m => normalizeMuscle(m.toLowerCase())))
    .forEach(m => excludedMuscles.add(m));

  // High intensity externals (RPE ≥ 7) → treat muscles as moderately sore (reduce volume)
  const externalModerateGroups = [...new Set(
    externalWorkoutFatigue
      .filter(e => e.intensity >= 7)
      .flatMap(e => e.muscleGroups.map(m => normalizeMuscle(m.toLowerCase())))
  )].filter(m => !excludedMuscles.has(m) && !moderateSorenessGroups.includes(m));
  moderateSorenessGroups.push(...externalModerateGroups);

  function isExerciseAllowed(ex: ExerciseData): boolean {
    if (excludedMuscles.has(ex.primaryMuscle.toLowerCase())) return false;
    const hasEquipment = ex.equipment.every(eq =>
      eq === "bodyweight" || userEquipment.includes(eq.toLowerCase())
    );
    if (!hasEquipment) return false;
    if (skillLevel === "beginner" && ex.difficulty === "advanced") return false;
    return true;
  }

  function applyVolumeReduction(sets: number, muscle: string): number {
    if (moderateSorenessGroups.includes(muscle.toLowerCase())) {
      return Math.max(2, Math.round(sets * 0.8));
    }
    return sets;
  }

  const muscleGroupPriority = pickPrimaryMuscleGroups(fitnessGoal);
  const primaryFocusGroups = muscleGroupPriority.slice(0, 3);

  function pickFromCategory(category: string, count: number, extraFilter?: (e: ExerciseData) => boolean): ExerciseData[] {
    let pool = EXERCISE_LIBRARY.filter(e => e.category === category && isExerciseAllowed(e));
    if (extraFilter) {
      const filtered = pool.filter(extraFilter);
      if (filtered.length > 0) pool = filtered;
    }
    return shuffleArray(pool).slice(0, count);
  }

  const warmups = pickFromCategory("warmup", 3, e =>
    primaryFocusGroups.some(g => e.primaryMuscle.toLowerCase() === g || e.secondaryMuscles.some(s => s.toLowerCase() === g))
  );

  const compounds = pickFromCategory("compound", 3, e =>
    primaryFocusGroups.includes(e.primaryMuscle.toLowerCase())
  );

  const accessories = pickFromCategory("accessory", 3);

  const coreExercises = pickFromCategory("core", 2);

  const cooldowns = pickFromCategory("cooldown", 2);

  function mapToGenerated(exercises: ExerciseData[], cat: string): GeneratedExercise[] {
    return exercises.map(ex => {
      let sets = getSetsForDifficulty(skillLevel, cat, energyLevel);
      sets = applyVolumeReduction(sets, ex.primaryMuscle);
      const reps = getRepsForCategory(cat, fitnessGoal);
      const weight = getWeightSuggestion(cat, ex.difficulty);
      return {
        exerciseId: ex.id,
        name: ex.name,
        primaryMuscle: ex.primaryMuscle,
        secondaryMuscles: ex.secondaryMuscles,
        category: cat,
        sets,
        reps,
        weight,
        youtubeKeyword: ex.youtubeKeyword,
      };
    });
  }

  const fallbackExercises: GeneratedExercise[] = [
    ...mapToGenerated(warmups, "warmup"),
    ...mapToGenerated(compounds, "compound"),
    ...mapToGenerated(accessories, "accessory"),
    ...mapToGenerated(coreExercises, "core"),
    ...mapToGenerated(cooldowns, "cooldown"),
  ];

  const availableForAI = EXERCISE_LIBRARY.filter(e => isExerciseAllowed(e));

  const exerciseNames = availableForAI.map(e => e.name);
  const [perfRecords, substitutionRecords] = await Promise.all([
    db.select().from(exercisePerformanceTable)
      .where(and(
        eq(exercisePerformanceTable.userId, userId),
        inArray(exercisePerformanceTable.exerciseName, exerciseNames.slice(0, 50))
      ))
      .orderBy(desc(exercisePerformanceTable.performedAt)),
    db.select().from(exerciseSubstitutionsTable)
      .where(eq(exerciseSubstitutionsTable.userId, userId))
      .orderBy(desc(exerciseSubstitutionsTable.count))
      .limit(20),
  ]);

  const exerciseHistory: Record<string, { lastSets: number; lastAvgReps: number; lastMaxWeight: number; lastAvgWeight: number; performedAt: Date }> = {};
  for (const r of perfRecords) {
    if (!exerciseHistory[r.exerciseName]) {
      exerciseHistory[r.exerciseName] = {
        lastSets: r.sets,
        lastAvgReps: r.avgReps ?? 0,
        lastMaxWeight: r.maxWeight ?? 0,
        lastAvgWeight: r.avgWeight ?? 0,
        performedAt: r.performedAt,
      };
    }
  }

  try {
    const aiResult = await generateAIWorkout(
      {
        skillLevel,
        fitnessGoal,
        energyLevel,
        sleepQuality: latestCheckin?.sleepQuality ?? 3,
        stressLevel: latestCheckin?.stressLevel ?? 3,
        highSorenessGroups,
        moderateSorenessGroups,
        injuries: userInjuries,
        equipment: userEquipment,
        checkInNotes: latestCheckin?.notes,
        preferredWorkoutDuration: profile?.preferredWorkoutDuration ?? 60,
        exerciseHistory,
        substitutions: substitutionRecords,
        externalWorkoutFatigue,
      },
      availableForAI,
      exerciseMap
    );

    const aiExercises = aiResult.exercises.length >= 3 ? aiResult.exercises : fallbackExercises;

    res.json({
      workoutTitle: aiResult.workoutTitle,
      subtitle: "AI Optimized · Today's Protocol",
      rationale: aiResult.rationale,
      exercises: aiExercises,
      totalSets: aiExercises.reduce((a: number, e: GeneratedExercise) => a + e.sets, 0),
      estimatedMinutes: Math.round(aiExercises.reduce((a: number, e: GeneratedExercise) => a + e.sets * 2.5, 0)),
    });
  } catch (aiErr) {
    console.error("AI workout generation failed, falling back to rule-based:", aiErr);

    const focusMuscleNames = [...new Set(compounds.map(c => c.primaryMuscle))];
    const titleMuscles = focusMuscleNames.slice(0, 2).map(m => m.charAt(0).toUpperCase() + m.slice(1)).join(" & ");
    const workoutTitle = titleMuscles ? `${titleMuscles} Focus` : "Full Body Session";

    let rationale = `Based on your ${fitnessGoal || "general fitness"} goal`;
    if (highSorenessGroups.length > 0) rationale += `, avoiding ${highSorenessGroups.join(", ")} due to high soreness`;
    if (moderateSorenessGroups.length > 0) rationale += `, reduced volume for ${moderateSorenessGroups.join(", ")}`;
    if (energyLevel <= 2) rationale += `, adjusted for lower energy today`;
    rationale += ".";

    res.json({
      workoutTitle,
      subtitle: "AI Optimized · Today's Protocol",
      rationale,
      exercises: fallbackExercises,
      totalSets: fallbackExercises.reduce((a, e) => a + e.sets, 0),
      estimatedMinutes: Math.round(fallbackExercises.reduce((a, e) => a + e.sets * 2.5, 0)),
    });
  }
  } catch (err) {
    console.error("Workout generation error:", err);
    res.status(500).json({ error: "Failed to generate workout" });
  }
});

async function updateStreakOnWorkout(userId: string): Promise<void> {
  try {
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

    const recentSessions = await db
      .select({ sessionDate: workoutSessionsTable.sessionDate })
      .from(workoutSessionsTable)
      .where(eq(workoutSessionsTable.userId, userId))
      .orderBy(desc(workoutSessionsTable.sessionDate))
      .limit(2);

    const dates = recentSessions.map(s => s.sessionDate);
    const hasToday = dates.includes(today);

    const [profile] = await db.select({ streakDays: userProfilesTable.streakDays })
      .from(userProfilesTable)
      .where(eq(userProfilesTable.userId, userId));

    if (!profile) return;
    const currentStreak = profile.streakDays ?? 0;

    if (hasToday) return;

    const hadYesterday = dates.includes(yesterday);
    const newStreak = hadYesterday ? currentStreak + 1 : 1;

    await db.update(userProfilesTable)
      .set({ streakDays: newStreak })
      .where(eq(userProfilesTable.userId, userId));
  } catch (err) {
    console.error("updateStreakOnWorkout error:", err);
  }
}

router.post("/workout/sessions", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const { workoutTitle, durationSeconds, exercises, totalSetsCompleted, postWorkoutFeedback } = req.body;

    if (!workoutTitle || !exercises || !Array.isArray(exercises)) {
      res.status(400).json({ error: "workoutTitle and exercises array are required" });
      return;
    }

    let totalVolume = 0;
    let serverSetsCompleted = 0;
    for (const ex of exercises) {
      for (const s of (ex.sets ?? [])) {
        if (s.completed) {
          serverSetsCompleted++;
          const weight = parseFloat(s.weight) || 0;
          totalVolume += weight * (s.reps || 0);
        }
      }
    }

    const actualSetsCompleted = serverSetsCompleted > 0 ? serverSetsCompleted : (totalSetsCompleted ?? 0);

    let consistencyIndex: number | null = null;
    {
      let weightRatioSum = 0;
      let weightRatioCount = 0;
      for (const ex of exercises) {
        const targetWeight = parseFloat(ex.targetWeight ?? ex.weight ?? "0") || 0;
        for (const s of (ex.sets ?? [])) {
          if (!s.completed) continue;
          const actualWeight = parseFloat(s.weight) || 0;
          if (targetWeight > 0) {
            weightRatioSum += Math.min(1, actualWeight / targetWeight);
          } else if (actualWeight > 0) {
            weightRatioSum += 1;
          }
          weightRatioCount++;
        }
      }
      const weightAdherence = weightRatioCount > 0 ? weightRatioSum / weightRatioCount : 0;

      let restRatioSum = 0;
      let restRatioCount = 0;
      for (const ex of exercises) {
        const targetRest = ex.targetRestSeconds ?? 75;
        const actualRests: number[] = ex.actualRestSeconds ?? [];
        for (const actual of actualRests) {
          if (targetRest > 0 && actual > 0) {
            restRatioSum += Math.min(1, actual / targetRest);
          }
          restRatioCount++;
        }
      }
      const restAdherence = restRatioCount > 0 ? restRatioSum / restRatioCount : 0;

      let fatigueSelfReport = 0;
      if (postWorkoutFeedback) {
        const difficultyScore = postWorkoutFeedback.perceivedDifficulty
          ? Math.min(1, Math.max(0, 1 - Math.abs(postWorkoutFeedback.perceivedDifficulty - 3) / 4))
          : 0;
        const energyScore = postWorkoutFeedback.energyAfter
          ? Math.min(1, postWorkoutFeedback.energyAfter / 5)
          : 0;
        fatigueSelfReport = (difficultyScore + energyScore) / 2;
      }

      consistencyIndex = (weightAdherence + restAdherence + fatigueSelfReport) / 3;
      consistencyIndex = Math.min(1, Math.max(0, consistencyIndex));
      consistencyIndex = Math.round(consistencyIndex * 100) / 100;
    }

    const [session] = await db
      .insert(workoutSessionsTable)
      .values({
        userId: req.user.id,
        workoutTitle,
        durationSeconds: durationSeconds ?? 0,
        exercises,
        totalSetsCompleted: actualSetsCompleted,
        totalVolume,
        consistencyIndex,
        postWorkoutFeedback: postWorkoutFeedback ?? null,
      })
      .returning();

    for (const ex of exercises) {
      const completedSets = (ex.sets ?? []).filter((s: { completed: boolean }) => s.completed);
      if (completedSets.length === 0) continue;

      const exerciseName = (ex.name ?? "").trim();

      const weights = completedSets.map((s: { weight: string }) => parseFloat(s.weight) || 0);
      const repsArr = completedSets.map((s: { reps: number }) => s.reps || 0);
      const avgWt = weights.reduce((a: number, b: number) => a + b, 0) / weights.length;
      const maxWt = Math.max(...weights);
      const avgRepsVal = repsArr.reduce((a: number, b: number) => a + b, 0) / repsArr.length;
      const volTotal = weights.reduce((sum: number, w: number, i: number) => sum + w * (repsArr[i] || 0), 0);

      if (exerciseName) {
        try {
          await db.insert(exercisePerformanceTable).values({
            userId: req.user.id,
            exerciseName,
            sessionId: session.id,
            sets: completedSets.length,
            avgReps: avgRepsVal,
            maxWeight: maxWt,
            avgWeight: avgWt,
            totalVolume: volTotal,
          });
        } catch (perfErr) {
          console.error(`Failed to insert exercise_performance for "${exerciseName}":`, perfErr);
        }
      }

      let dbExerciseId: number | null = null;
      const numericId = parseInt(ex.exerciseId, 10);
      if (!isNaN(numericId) && String(numericId) === ex.exerciseId) {
        dbExerciseId = numericId;
      } else if (exerciseName) {
        const [found] = await db
          .select({ id: exerciseLibraryTable.id })
          .from(exerciseLibraryTable)
          .where(eq(exerciseLibraryTable.name, exerciseName))
          .limit(1);
        if (found) dbExerciseId = found.id;
      }

      if (dbExerciseId !== null) {
        const avgWeight = Math.round(avgWt);
        const avgReps = Math.round(avgRepsVal);
        try {
          await db.insert(workoutHistoryTable).values({
            userId: req.user.id,
            exerciseId: dbExerciseId,
            weight: avgWeight,
            reps: avgReps,
            sets: completedSets.length,
            consistencyIndex,
          });
        } catch (historyErr) {
          console.error(`Failed to insert workout_history for exercise ${dbExerciseId}:`, historyErr);
        }
      }
    }

    await updateStreakOnWorkout(req.user.id);

    res.json(session);
  } catch (err) {
    console.error("Save workout error:", err);
    res.status(500).json({ error: "Failed to save workout" });
  }
});

router.get("/workout/sessions", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const sessions = await db
      .select()
      .from(workoutSessionsTable)
      .where(eq(workoutSessionsTable.userId, req.user.id))
      .orderBy(desc(workoutSessionsTable.createdAt))
      .limit(20);

    res.json(sessions);
  } catch (err) {
    console.error("Get sessions error:", err);
    res.status(500).json({ error: "Failed to get workout sessions" });
  }
});

router.post("/workout/architect-generate", aiRateLimit, async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const userId = req.user.id;
    const { muscleGroups, equipment: selectedEquipment } = req.body as {
      muscleGroups: string[];
      equipment: string[];
    };

    if (!muscleGroups || !Array.isArray(muscleGroups) || muscleGroups.length === 0) {
      res.status(400).json({ error: "muscleGroups array is required" });
      return;
    }

    const [profile] = await db
      .select()
      .from(userProfilesTable)
      .where(eq(userProfilesTable.userId, userId));

    const today = new Date().toISOString().split("T")[0];
    const [latestCheckin] = await db
      .select()
      .from(dailyCheckInsTable)
      .where(and(eq(dailyCheckInsTable.userId, userId), eq(dailyCheckInsTable.date, today)));

    if (!latestCheckin) {
      res.status(400).json({ error: "Daily check-in required before generating a workout" });
      return;
    }

    const skillLevel = profile?.skillLevel ?? "intermediate";
    const userInjuries = normalizeInjuries((profile?.injuries as string[]) ?? []);
    const energyLevel = latestCheckin.energyLevel;
    const soreMuscleGroups = (latestCheckin.soreMuscleGroups as { muscle: string; severity: number }[]) ?? [];

    const highSorenessGroups = [...new Set(soreMuscleGroups.filter(s => s.severity > 7).map(s => normalizeMuscle(s.muscle)))];
    const moderateSorenessGroups = [...new Set(soreMuscleGroups.filter(s => s.severity >= 4 && s.severity <= 7).map(s => normalizeMuscle(s.muscle)))];
    const excludedMuscles = new Set([...highSorenessGroups, ...userInjuries]);
    const requestedGroups = muscleGroups.map(m => normalizeMuscle(m));
    const userEquipment = normalizeEquipment(selectedEquipment ?? []);

    // Fetch external workouts from last 48h to factor their muscle fatigue into the builder
    const archCutoff48h = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const archRecentExternal = await db.select()
      .from(externalWorkoutsTable)
      .where(and(
        eq(externalWorkoutsTable.userId, userId),
        gte(externalWorkoutsTable.createdAt, archCutoff48h),
      ))
      .orderBy(desc(externalWorkoutsTable.createdAt))
      .limit(15);

    const externalWorkoutFatigue = archRecentExternal
      .filter(e => e.workoutType !== "rest" && e.source !== "in-app" && ((e.muscleGroups as string[]) ?? []).length > 0)
      .map(e => ({
        label: e.label,
        muscleGroups: (e.muscleGroups as string[]) ?? [],
        intensity: e.intensity ?? 5,
        hoursAgo: (Date.now() - e.createdAt.getTime()) / (1000 * 60 * 60),
      }));

    // Very high intensity externals (RPE ≥ 9, within 24h) → treat muscles as fully excluded
    externalWorkoutFatigue
      .filter(e => e.intensity >= 9 && e.hoursAgo < 24)
      .flatMap(e => e.muscleGroups.map(m => normalizeMuscle(m.toLowerCase())))
      .forEach(m => excludedMuscles.add(m));

    // High intensity externals (RPE ≥ 7) → treat muscles as moderately sore (reduce volume)
    const archExternalModerateGroups = [...new Set(
      externalWorkoutFatigue
        .filter(e => e.intensity >= 7)
        .flatMap(e => e.muscleGroups.map(m => normalizeMuscle(m.toLowerCase())))
    )].filter(m => !excludedMuscles.has(m) && !moderateSorenessGroups.includes(m));
    moderateSorenessGroups.push(...archExternalModerateGroups);

    function isExerciseAllowed(ex: ExerciseData): boolean {
      if (excludedMuscles.has(ex.primaryMuscle.toLowerCase())) return false;
      const hasEquipment = ex.equipment.every(eq =>
        eq === "bodyweight" || userEquipment.includes(eq.toLowerCase())
      );
      if (!hasEquipment) return false;
      if (skillLevel === "beginner" && ex.difficulty === "advanced") return false;
      return true;
    }

    function applyVolumeReduction(sets: number, muscle: string): number {
      if (moderateSorenessGroups.includes(muscle.toLowerCase())) {
        return Math.max(2, Math.round(sets * 0.8));
      }
      return sets;
    }

    function pickFromCategory(category: string, count: number, extraFilter?: (e: ExerciseData) => boolean): ExerciseData[] {
      let pool = EXERCISE_LIBRARY.filter(e => e.category === category && isExerciseAllowed(e));
      if (extraFilter) {
        const filtered = pool.filter(extraFilter);
        if (filtered.length > 0) pool = filtered;
      }
      return shuffleArray(pool).slice(0, count);
    }

    const warmups = pickFromCategory("warmup", 2, e =>
      requestedGroups.some(g => e.primaryMuscle.toLowerCase() === g || e.secondaryMuscles.some(s => s.toLowerCase() === g))
    );

    const compounds = pickFromCategory("compound", 3, e =>
      requestedGroups.includes(e.primaryMuscle.toLowerCase())
    );

    const accessories = pickFromCategory("accessory", 4, e =>
      requestedGroups.includes(e.primaryMuscle.toLowerCase())
    );

    const coreExercises = requestedGroups.includes("core")
      ? pickFromCategory("core", 2)
      : pickFromCategory("core", 1);

    const cooldowns = pickFromCategory("cooldown", 2);

    const fitnessGoal = normalizeGoal(profile?.fitnessGoal ?? null);

    function mapToGenerated(exercises: ExerciseData[], cat: string): GeneratedExercise[] {
      return exercises.map(ex => {
        let sets = getSetsForDifficulty(skillLevel, cat, energyLevel);
        sets = applyVolumeReduction(sets, ex.primaryMuscle);
        const reps = getRepsForCategory(cat, fitnessGoal);
        const weight = getWeightSuggestion(cat, ex.difficulty);
        return {
          exerciseId: ex.id,
          name: ex.name,
          primaryMuscle: ex.primaryMuscle,
          secondaryMuscles: ex.secondaryMuscles,
          category: cat,
          sets,
          reps,
          weight,
          youtubeKeyword: ex.youtubeKeyword,
        };
      });
    }

    const fallbackExercises: GeneratedExercise[] = [
      ...mapToGenerated(warmups, "warmup"),
      ...mapToGenerated(compounds, "compound"),
      ...mapToGenerated(accessories, "accessory"),
      ...mapToGenerated(coreExercises, "core"),
      ...mapToGenerated(cooldowns, "cooldown"),
    ];

    const availableForAI = EXERCISE_LIBRARY.filter(e => isExerciseAllowed(e));

    const archExerciseNames = availableForAI.map(e => e.name);
    const [archPerfRecords, archSubRecords] = await Promise.all([
      db.select().from(exercisePerformanceTable)
        .where(and(
          eq(exercisePerformanceTable.userId, userId),
          inArray(exercisePerformanceTable.exerciseName, archExerciseNames.slice(0, 50))
        ))
        .orderBy(desc(exercisePerformanceTable.performedAt)),
      db.select().from(exerciseSubstitutionsTable)
        .where(eq(exerciseSubstitutionsTable.userId, userId))
        .orderBy(desc(exerciseSubstitutionsTable.count))
        .limit(20),
    ]);

    const archExerciseHistory: Record<string, { lastSets: number; lastAvgReps: number; lastMaxWeight: number; lastAvgWeight: number; performedAt: Date }> = {};
    for (const r of archPerfRecords) {
      if (!archExerciseHistory[r.exerciseName]) {
        archExerciseHistory[r.exerciseName] = {
          lastSets: r.sets,
          lastAvgReps: r.avgReps ?? 0,
          lastMaxWeight: r.maxWeight ?? 0,
          lastAvgWeight: r.avgWeight ?? 0,
          performedAt: r.performedAt,
        };
      }
    }

    try {
      const aiResult = await generateAIArchitectWorkout(
        {
          skillLevel,
          fitnessGoal,
          energyLevel,
          sleepQuality: latestCheckin.sleepQuality,
          stressLevel: latestCheckin.stressLevel,
          highSorenessGroups,
          moderateSorenessGroups,
          injuries: userInjuries,
          equipment: userEquipment,
          requestedMuscleGroups: requestedGroups,
          preferredWorkoutDuration: profile?.preferredWorkoutDuration ?? 60,
          availableMinutes: (req.body as any).availableMinutes ?? undefined,
          exerciseHistory: archExerciseHistory,
          substitutions: archSubRecords,
          externalWorkoutFatigue,
        },
        availableForAI,
        exerciseMap
      );

      const aiExercises = aiResult.exercises.length >= 3 ? aiResult.exercises : fallbackExercises;

      res.json({
        workoutTitle: aiResult.workoutTitle,
        subtitle: "Custom Architect · AI Optimized",
        rationale: aiResult.rationale,
        exercises: aiExercises,
        totalSets: aiExercises.reduce((a: number, e: GeneratedExercise) => a + e.sets, 0),
        estimatedMinutes: Math.round(aiExercises.reduce((a: number, e: GeneratedExercise) => a + e.sets * 2.5, 0)),
      });
    } catch (aiErr) {
      console.error("AI architect generation failed, falling back to rule-based:", aiErr);

      const focusMuscleNames = requestedGroups.slice(0, 3).map(m => m.charAt(0).toUpperCase() + m.slice(1));
      const workoutTitle = focusMuscleNames.join(" & ") + " Session";
      let rationale = `Custom session targeting ${focusMuscleNames.join(", ").toLowerCase()}`;
      if (highSorenessGroups.length > 0) rationale += `, avoiding ${highSorenessGroups.join(", ")} due to high soreness`;
      if (energyLevel <= 2) rationale += `, adjusted for lower energy today`;
      rationale += ".";

      res.json({
        workoutTitle,
        subtitle: "Custom Architect · AI Optimized",
        rationale,
        exercises: fallbackExercises,
        totalSets: fallbackExercises.reduce((a, e) => a + e.sets, 0),
        estimatedMinutes: Math.round(fallbackExercises.reduce((a, e) => a + e.sets * 2.5, 0)),
      });
    }
  } catch (err) {
    console.error("Architect generate error:", err);
    res.status(500).json({ error: "Failed to generate architect workout" });
  }
});

router.post("/workout/parse-description", aiRateLimit, async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { description } = req.body as { description: string };
  if (!description || typeof description !== "string" || description.trim().length === 0) {
    res.status(400).json({ error: "description is required" });
    return;
  }

  try {
    const result = await parseWorkoutDescriptionAI(description.trim());
    res.json(result);
  } catch (err) {
    console.error("Workout description parse error:", err);
    res.status(500).json({ error: "Failed to parse workout description" });
  }
});

router.post("/workout/analyze-image", aiRateLimit, async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { base64Image, mimeType } = req.body as { base64Image: string; mimeType?: string };
  if (!base64Image || typeof base64Image !== "string") {
    res.status(400).json({ error: "base64Image is required" });
    return;
  }

  try {
    const result = await analyzeWorkoutImageAI(base64Image, mimeType ?? "image/jpeg");
    res.json(result);
  } catch (err) {
    console.error("Workout image analysis error:", err);
    res.status(500).json({ error: "Failed to analyze workout image" });
  }
});

router.post("/exercise/performance", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { exerciseNames } = req.body as { exerciseNames: string[] };
  if (!Array.isArray(exerciseNames) || exerciseNames.length === 0) {
    res.json({});
    return;
  }

  try {
    const records = await db
      .select()
      .from(exercisePerformanceTable)
      .where(
        and(
          eq(exercisePerformanceTable.userId, req.user.id),
          inArray(exercisePerformanceTable.exerciseName, exerciseNames)
        )
      )
      .orderBy(desc(exercisePerformanceTable.performedAt));

    const byName: Record<string, typeof records[0][]> = {};
    for (const r of records) {
      if (!byName[r.exerciseName]) byName[r.exerciseName] = [];
      byName[r.exerciseName].push(r);
    }

    const result: Record<string, { lastSets: number; lastAvgReps: number; lastMaxWeight: number; lastAvgWeight: number; performedAt: Date }> = {};
    for (const [name, recs] of Object.entries(byName)) {
      const latest = recs[0];
      result[name] = {
        lastSets: latest.sets,
        lastAvgReps: latest.avgReps ?? 0,
        lastMaxWeight: latest.maxWeight ?? 0,
        lastAvgWeight: latest.avgWeight ?? 0,
        performedAt: latest.performedAt,
      };
    }

    res.json(result);
  } catch (err) {
    console.error("Exercise performance query error:", err);
    res.status(500).json({ error: "Failed to query exercise performance" });
  }
});

router.post("/exercise/substitution", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { originalName, preferredName } = req.body as { originalName: string; preferredName: string };
  if (!originalName || !preferredName || originalName === preferredName) {
    res.status(400).json({ error: "originalName and preferredName are required and must differ" });
    return;
  }

  try {
    const existing = await db
      .select()
      .from(exerciseSubstitutionsTable)
      .where(
        and(
          eq(exerciseSubstitutionsTable.userId, req.user.id),
          eq(exerciseSubstitutionsTable.originalName, originalName),
          eq(exerciseSubstitutionsTable.preferredName, preferredName)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(exerciseSubstitutionsTable)
        .set({ count: existing[0].count + 1, lastUsedAt: new Date() })
        .where(eq(exerciseSubstitutionsTable.id, existing[0].id))
        .returning();
      res.json(updated);
    } else {
      const [inserted] = await db
        .insert(exerciseSubstitutionsTable)
        .values({ userId: req.user.id, originalName, preferredName })
        .returning();
      res.json(inserted);
    }
  } catch (err) {
    console.error("Exercise substitution error:", err);
    res.status(500).json({ error: "Failed to save substitution" });
  }
});

router.get("/exercise/substitutions", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const subs = await db
      .select()
      .from(exerciseSubstitutionsTable)
      .where(eq(exerciseSubstitutionsTable.userId, req.user.id))
      .orderBy(desc(exerciseSubstitutionsTable.count));

    res.json(subs);
  } catch (err) {
    console.error("Get substitutions error:", err);
    res.status(500).json({ error: "Failed to get substitutions" });
  }
});

router.get("/workout/deload-check", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const userId = req.user.id;

    const recentCheckins = await db
      .select({
        date: dailyCheckInsTable.date,
        energyLevel: dailyCheckInsTable.energyLevel,
        sorenessScore: dailyCheckInsTable.sorenessScore,
        stressLevel: dailyCheckInsTable.stressLevel,
      })
      .from(dailyCheckInsTable)
      .where(eq(dailyCheckInsTable.userId, userId))
      .orderBy(desc(dailyCheckInsTable.date))
      .limit(7);

    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const recentSessions = await db
      .select({
        sessionDate: workoutSessionsTable.sessionDate,
        totalVolume: workoutSessionsTable.totalVolume,
        totalSetsCompleted: workoutSessionsTable.totalSetsCompleted,
      })
      .from(workoutSessionsTable)
      .where(and(
        eq(workoutSessionsTable.userId, userId),
        sql`${workoutSessionsTable.createdAt} > ${sevenDaysAgo}`
      ))
      .orderBy(desc(workoutSessionsTable.sessionDate));

    if (recentCheckins.length < 3) {
      res.json({ recommended: false, reason: null });
      return;
    }

    const recentThree = recentCheckins.slice(0, 3);
    const fatigueScores = recentThree.map(c => {
      const energy = (6 - c.energyLevel) / 5;
      const soreness = (c.sorenessScore - 1) / 4;
      const stress = (c.stressLevel - 1) / 4;
      return Math.round((energy * 0.35 + soreness * 0.4 + stress * 0.25) * 100);
    });

    const avgFatigue = fatigueScores.reduce((a, b) => a + b, 0) / fatigueScores.length;
    const allHighFatigue = fatigueScores.every(f => f >= 65);

    const weeklyVolume = recentSessions.reduce((sum, s) => sum + (s.totalVolume ?? 0), 0);
    const sessionCount = recentSessions.length;

    const recommended = allHighFatigue || (avgFatigue >= 75 && sessionCount >= 4);

    let reason: string | null = null;
    if (recommended) {
      if (allHighFatigue) {
        reason = `Your fatigue has been elevated for ${recentThree.length}+ consecutive days. A lighter session or full rest day will help your body recover and come back stronger.`;
      } else {
        reason = `You've logged ${sessionCount} sessions this week with high cumulative fatigue. Consider a deload day to maximize recovery.`;
      }
    }

    res.json({
      recommended,
      reason,
      avgFatigue: Math.round(avgFatigue),
      weeklyVolume: Math.round(weeklyVolume),
      sessionCount,
    });
  } catch (err) {
    console.error("Deload check error:", err);
    res.status(500).json({ error: "Failed to check deload" });
  }
});

export default router;

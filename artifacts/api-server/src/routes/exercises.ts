import { Router, type IRouter, type Request, type Response } from "express";
import { db, exerciseLibraryTable, workoutHistoryTable, userProfilesTable, userFavoriteExercisesTable } from "@workspace/db";
import { eq, and, ilike, inArray, desc, ne } from "drizzle-orm";
import { generateCoachNote } from "../services/aiService";
import { aiRateLimit } from "../middlewares/rateLimitMiddleware";
import { EXERCISE_LIBRARY } from "../data/exercises";
import { lookupExerciseDescription } from "../data/exerciseDescriptions";

const router: IRouter = Router();

router.get("/exercises", async (req: Request, res: Response) => {
  const { muscle_group, equipment, goal, search } = req.query;

  let query = db.select().from(exerciseLibraryTable).$dynamic();

  const conditions = [];
  if (muscle_group && typeof muscle_group === "string") {
    conditions.push(eq(exerciseLibraryTable.muscleGroup, muscle_group));
  }
  if (equipment && typeof equipment === "string") {
    conditions.push(eq(exerciseLibraryTable.equipment, equipment));
  }
  if (goal && typeof goal === "string") {
    conditions.push(eq(exerciseLibraryTable.goal, goal));
  }
  if (search && typeof search === "string") {
    conditions.push(ilike(exerciseLibraryTable.name, `%${search}%`));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  const exercises = await query;
  res.json(exercises);
});

router.get("/exercises/favorites", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const favs = await db
    .select({ exerciseId: userFavoriteExercisesTable.exerciseId })
    .from(userFavoriteExercisesTable)
    .where(eq(userFavoriteExercisesTable.userId, req.user.id));

  const ids = favs.map((f) => f.exerciseId);
  if (ids.length === 0) {
    res.json([]);
    return;
  }

  const exercises = await db
    .select()
    .from(exerciseLibraryTable)
    .where(inArray(exerciseLibraryTable.id, ids));

  res.json(exercises);
});

const WARMUP_COOLDOWN_KEYWORDS = ["warm", "cool", "stretch", "mobility", "activation", "circles", "swings", "inchworm", "cat", "cow", "pigeon", "child", "hip flexor", "hamstring stretch", "quad stretch", "foam roll", "dynamic", "static"];

function isWarmupCooldownName(name: string): boolean {
  const lower = name.toLowerCase();
  return WARMUP_COOLDOWN_KEYWORDS.some(kw => lower.includes(kw));
}

router.get("/exercises/by-name/:name/alternatives", async (req: Request, res: Response) => {
  const name = decodeURIComponent(req.params.name);
  const excludeParam = typeof req.query.exclude === "string" ? req.query.exclude : "";
  const excludeNames = excludeParam ? excludeParam.split(",").map(n => n.toLowerCase().trim()) : [];

  const [exercise] = await db
    .select()
    .from(exerciseLibraryTable)
    .where(ilike(exerciseLibraryTable.name, name))
    .limit(1);

  let results: typeof exerciseLibraryTable.$inferSelect[] = [];

  if (exercise) {
    results = await db
      .select()
      .from(exerciseLibraryTable)
      .where(
        and(
          eq(exerciseLibraryTable.muscleGroup, exercise.muscleGroup),
          ne(exerciseLibraryTable.id, exercise.id)
        )
      )
      .limit(12);
  } else {
    results = await db
      .select()
      .from(exerciseLibraryTable)
      .where(ilike(exerciseLibraryTable.name, `%${name.split(" ")[0]}%`))
      .limit(12);
  }

  const filtered = excludeNames.length > 0
    ? results.filter(e => !excludeNames.includes(e.name.toLowerCase()))
    : results;

  if (filtered.length > 0) {
    return res.json(
      filtered.slice(0, 8).map(e => ({
        id: String(e.id),
        name: e.name,
        primaryMuscle: (e.primaryMuscles as string[])?.[0] ?? e.muscleGroup,
        secondaryMuscles: (e.secondaryMuscles as string[]) ?? [],
        equipment: [e.equipment],
        category: e.goal,
        difficulty: e.difficulty,
        alternatives: [],
        youtubeKeyword: e.name,
      }))
    );
  }

  const staticEntry = EXERCISE_LIBRARY.find(e => e.name.toLowerCase() === name.toLowerCase());
  const targetCategory = staticEntry?.category ?? (isWarmupCooldownName(name) ? "warmup" : null);
  const targetMuscle = staticEntry?.primaryMuscle ?? null;

  let staticAlts = EXERCISE_LIBRARY.filter(e => {
    if (e.name.toLowerCase() === name.toLowerCase()) return false;
    if (excludeNames.includes(e.name.toLowerCase())) return false;
    if (targetCategory && (targetCategory === "warmup" || targetCategory === "cooldown")) {
      return e.category === "warmup" || e.category === "cooldown";
    }
    if (targetMuscle) return e.primaryMuscle === targetMuscle;
    return e.equipment.includes("bodyweight");
  }).slice(0, 6);

  if (staticAlts.length === 0 && isWarmupCooldownName(name)) {
    staticAlts = EXERCISE_LIBRARY.filter(e =>
      (e.category === "warmup" || e.category === "cooldown") &&
      e.name.toLowerCase() !== name.toLowerCase() &&
      !excludeNames.includes(e.name.toLowerCase())
    ).slice(0, 6);
  }

  if (staticAlts.length === 0) {
    staticAlts = EXERCISE_LIBRARY.filter(e =>
      e.equipment.includes("bodyweight") &&
      e.name.toLowerCase() !== name.toLowerCase() &&
      !excludeNames.includes(e.name.toLowerCase())
    ).slice(0, 6);
  }

  return res.json(
    staticAlts.map((e, i) => ({
      id: `static-${i}`,
      name: e.name,
      primaryMuscle: e.primaryMuscle,
      secondaryMuscles: e.secondaryMuscles,
      equipment: e.equipment,
      category: e.category,
      difficulty: e.difficulty,
      alternatives: [],
      youtubeKeyword: e.youtubeKeyword,
    }))
  );
});

router.get("/exercises/by-name/:name/describe", async (req: Request, res: Response) => {
  const name = decodeURIComponent(req.params.name);
  const staticDesc = lookupExerciseDescription(name);

  let exercise = await db
    .select()
    .from(exerciseLibraryTable)
    .where(ilike(exerciseLibraryTable.name, name))
    .limit(1)
    .then(r => r[0] ?? null);

  if (!exercise) {
    const words = name.split(" ").filter(w => w.length > 3);
    if (words.length > 0) {
      exercise = await db
        .select()
        .from(exerciseLibraryTable)
        .where(ilike(exerciseLibraryTable.name, `%${words[0]}%`))
        .limit(1)
        .then(r => r[0] ?? null);
    }
  }

  if (!exercise) {
    const staticEntry = EXERCISE_LIBRARY.find(e => e.name.toLowerCase() === name.toLowerCase());
    if (staticEntry || staticDesc) {
      const desc = staticDesc;
      return res.json({
        id: 0,
        name: staticEntry?.name ?? name,
        muscleGroup: staticEntry?.primaryMuscle ?? staticDesc?.primaryMuscle ?? "general",
        difficulty: staticEntry?.difficulty ?? staticDesc?.difficulty ?? "beginner",
        equipment: staticEntry?.equipment?.[0] ?? staticDesc?.equipment ?? "bodyweight",
        primaryMuscles: staticEntry ? [staticEntry.primaryMuscle] : [],
        secondaryMuscles: staticEntry?.secondaryMuscles ?? [],
        tertiaryMuscles: [],
        description: desc?.description ?? null,
        instructions: desc?.formCues ?? [],
        commonMistakes: desc?.commonMistakes ?? [],
        youtubeUrl: null,
        youtubeKeyword: staticEntry?.youtubeKeyword ?? desc?.youtubeKeyword ?? name,
      });
    }
    res.status(404).json({ error: "Exercise not found" });
    return;
  }

  const desc = staticDesc;
  res.json({
    id: exercise.id,
    name: exercise.name,
    muscleGroup: exercise.muscleGroup,
    difficulty: exercise.difficulty,
    equipment: exercise.equipment,
    primaryMuscles: (exercise.primaryMuscles as string[]) ?? [],
    secondaryMuscles: (exercise.secondaryMuscles as string[]) ?? [],
    tertiaryMuscles: (exercise.tertiaryMuscles as string[]) ?? [],
    description: desc?.description ?? null,
    instructions: desc?.formCues ?? (exercise.instructions as string[]) ?? [],
    commonMistakes: desc?.commonMistakes ?? (exercise.commonMistakes as string[]) ?? [],
    youtubeUrl: exercise.youtubeUrl,
    youtubeKeyword: desc?.youtubeKeyword ?? exercise.name,
  });
});

router.get("/exercises/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(404).json({ error: "Exercise not found" });
    return;
  }

  const [exercise] = await db
    .select()
    .from(exerciseLibraryTable)
    .where(eq(exerciseLibraryTable.id, id));

  if (!exercise) {
    res.status(404).json({ error: "Exercise not found" });
    return;
  }

  let alternatives: typeof exercise[] = [];
  const altIds = exercise.alternativeIds as number[] | null;
  if (altIds && altIds.length > 0) {
    alternatives = await db
      .select()
      .from(exerciseLibraryTable)
      .where(inArray(exerciseLibraryTable.id, altIds));
  }

  res.json({
    ...exercise,
    alternatives,
  });
});

function computeEstimated1RM(weight: number, reps: number): number {
  return Math.round(weight * (1 + reps / 30));
}

function getRestRecommendation(goal: string): string {
  switch (goal) {
    case "strength":
      return "3-5 minutes between sets for maximum strength recovery";
    case "hypertrophy":
      return "60-90 seconds between sets for optimal muscle growth stimulus";
    default:
      return "2-3 minutes between sets for balanced recovery";
  }
}

router.get("/exercises/:id/history", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const exerciseId = parseInt(req.params.id, 10);
  if (isNaN(exerciseId)) {
    res.status(404).json({ error: "Exercise not found" });
    return;
  }

  const [exercise] = await db
    .select()
    .from(exerciseLibraryTable)
    .where(eq(exerciseLibraryTable.id, exerciseId));

  if (!exercise) {
    res.status(404).json({ error: "Exercise not found" });
    return;
  }

  const history = await db
    .select()
    .from(workoutHistoryTable)
    .where(
      and(
        eq(workoutHistoryTable.userId, req.user.id),
        eq(workoutHistoryTable.exerciseId, exerciseId)
      )
    )
    .orderBy(desc(workoutHistoryTable.performedAt))
    .limit(3);

  const sessions = history.map((h) => {
    const distMeters: number | null = (h as any).distanceMeters ?? null;
    const durSecs: number | null = (h as any).durationSeconds ?? null;
    const longestSet: number | null = (h as any).longestSetDuration ?? null;

    let totalVolume: number;
    if (distMeters != null && distMeters > 0) {
      totalVolume = distMeters;
    } else if (durSecs != null && durSecs > 0) {
      totalVolume = durSecs;
    } else if (h.weight > 0) {
      totalVolume = h.weight * h.reps * h.sets;
    } else {
      totalVolume = h.reps * h.sets;
    }

    // A2: derived pace (m/min) when both distance and duration are available
    let pace: number | null = null;
    if (distMeters != null && distMeters > 0 && durSecs != null && durSecs > 0) {
      pace = Math.round((distMeters / (durSecs / 60)) * 100) / 100;
    }

    return {
      performedAt: h.performedAt.toISOString(),
      totalVolume,
      weight: h.weight,
      reps: h.reps,
      sets: h.sets,
      consistencyIndex: h.consistencyIndex,
      durationSeconds: durSecs,
      distanceMeters: distMeters,
      longestSetDuration: longestSet,
      pace,
      source: (h as any).source ?? "internal",
    };
  });

  let estimated1RM: number | null = null;
  if (history.length > 0) {
    const latest = history[0];
    if (latest.weight > 0 && latest.reps > 0) {
      estimated1RM = computeEstimated1RM(latest.weight, latest.reps);
    }
  }

  let isPlateaued = false;
  if (sessions.length >= 3) {
    const volumes = sessions.map((s) => s.totalVolume);
    isPlateaued = volumes[0] <= volumes[volumes.length - 1];
  }

  const restRecommendation = exercise ? getRestRecommendation(exercise.goal) : null;

  res.json({
    sessions,
    estimated1RM,
    isPlateaued,
    restRecommendation,
  });
});

router.get("/exercises/:id/coach-note", aiRateLimit, async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const exerciseId = parseInt(req.params.id, 10);
  if (isNaN(exerciseId)) {
    res.status(404).json({ error: "Exercise not found" });
    return;
  }

  try {
    const [exercise] = await db
      .select()
      .from(exerciseLibraryTable)
      .where(eq(exerciseLibraryTable.id, exerciseId));

    if (!exercise) {
      res.status(404).json({ error: "Exercise not found" });
      return;
    }

    const [profile] = await db
      .select()
      .from(userProfilesTable)
      .where(eq(userProfilesTable.userId, req.user.id));

    const history = await db
      .select()
      .from(workoutHistoryTable)
      .where(
        and(
          eq(workoutHistoryTable.userId, req.user.id),
          eq(workoutHistoryTable.exerciseId, exerciseId)
        )
      )
      .orderBy(desc(workoutHistoryTable.performedAt))
      .limit(3);

    const coachNote = await generateCoachNote(
      exercise.name,
      exercise.muscleGroup ?? "unknown",
      exercise.difficulty ?? "intermediate",
      {
        skillLevel: profile?.skillLevel ?? undefined,
        fitnessGoal: profile?.fitnessGoal ?? undefined,
        injuries: (profile?.injuries as string[] | null) ?? [],
      },
      history.map(h => ({
        weight: h.weight,
        reps: h.reps,
        sets: h.sets,
        performedAt: h.performedAt.toISOString(),
      }))
    );

    res.json({ coachNote });
  } catch (err) {
    console.error("Coach note generation error:", err);
    res.json({ coachNote: "Focus on controlled movement and proper form throughout each rep." });
  }
});

router.post("/exercises/:id/favorite", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const exerciseId = parseInt(req.params.id, 10);
  if (isNaN(exerciseId)) {
    res.status(400).json({ error: "Invalid exercise ID" });
    return;
  }

  await db
    .insert(userFavoriteExercisesTable)
    .values({ userId: req.user.id, exerciseId })
    .onConflictDoNothing();

  res.json({ favorited: true });
});

router.delete("/exercises/:id/favorite", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const exerciseId = parseInt(req.params.id, 10);
  if (isNaN(exerciseId)) {
    res.status(400).json({ error: "Invalid exercise ID" });
    return;
  }

  await db
    .delete(userFavoriteExercisesTable)
    .where(
      and(
        eq(userFavoriteExercisesTable.userId, req.user.id),
        eq(userFavoriteExercisesTable.exerciseId, exerciseId)
      )
    );

  res.json({ favorited: false });
});

router.post("/exercises/:id/history", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const exerciseId = parseInt(req.params.id, 10);
  if (isNaN(exerciseId)) {
    res.status(400).json({ error: "Invalid exercise ID" });
    return;
  }

  const [exerciseExists] = await db
    .select({ id: exerciseLibraryTable.id })
    .from(exerciseLibraryTable)
    .where(eq(exerciseLibraryTable.id, exerciseId));

  if (!exerciseExists) {
    res.status(404).json({ error: "Exercise not found" });
    return;
  }

  const { weight, reps, sets } = req.body;
  if (
    typeof weight !== "number" || weight < 0 ||
    typeof reps !== "number" || reps < 1 ||
    typeof sets !== "number" || sets < 1
  ) {
    res.status(400).json({ error: "weight (>=0), reps (>=1), and sets (>=1) are required as numbers" });
    return;
  }

  const [entry] = await db
    .insert(workoutHistoryTable)
    .values({
      userId: req.user.id,
      exerciseId,
      weight: Math.round(weight),
      reps: Math.round(reps),
      sets: Math.round(sets),
    })
    .returning();

  res.json(entry);
});

export default router;

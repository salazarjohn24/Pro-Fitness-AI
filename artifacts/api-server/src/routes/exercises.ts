import { Router, type IRouter, type Request, type Response } from "express";
import { db, exerciseLibraryTable, workoutHistoryTable, userProfilesTable, userFavoriteExercisesTable } from "@workspace/db";
import { eq, and, ilike, inArray, desc } from "drizzle-orm";
import { generateCoachNote } from "../services/aiService";
import { aiRateLimit } from "../middlewares/rateLimitMiddleware";

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

  const sessions = history.map((h) => ({
    performedAt: h.performedAt.toISOString(),
    totalVolume: h.weight * h.reps * h.sets,
    weight: h.weight,
    reps: h.reps,
    sets: h.sets,
    consistencyIndex: h.consistencyIndex,
  }));

  let estimated1RM: number | null = null;
  if (history.length > 0) {
    const latest = history[0];
    estimated1RM = computeEstimated1RM(latest.weight, latest.reps);
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

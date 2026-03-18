import { Router, type IRouter, type Request, type Response } from "express";
import { db, externalWorkoutsTable, workoutSessionsTable } from "@workspace/db";
import { desc, eq, and, gte, ne } from "drizzle-orm";

const router: IRouter = Router();

router.post("/workouts/external", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { label, duration, workoutType, source, intensity, muscleGroups, stimulusPoints, workoutDate, movements, isMetcon, metconFormat } = req.body;

  if (!label || !workoutType) {
    res.status(400).json({ error: "Missing required fields: label, workoutType" });
    return;
  }

  const isRest = workoutType === "rest";

  if (isRest) {
    if (duration !== undefined && duration !== 0 && duration !== null) {
      res.status(400).json({ error: "Rest day duration must be 0 or omitted" });
      return;
    }
  } else {
    if (!duration || typeof duration !== "number" || duration < 1 || duration > 600) {
      res.status(400).json({ error: "duration must be a number between 1 and 600" });
      return;
    }
  }

  if (intensity !== undefined && intensity !== null && intensity !== 0) {
    if (typeof intensity !== "number" || intensity < 1 || intensity > 10) {
      res.status(400).json({ error: "intensity must be a number between 1 and 10" });
      return;
    }
  }

  if (muscleGroups !== undefined && muscleGroups !== null) {
    if (!Array.isArray(muscleGroups)) {
      res.status(400).json({ error: "muscleGroups must be an array of strings" });
      return;
    }
  }

  if (stimulusPoints !== undefined && stimulusPoints !== null) {
    if (typeof stimulusPoints !== "number" || stimulusPoints < 0) {
      res.status(400).json({ error: "stimulusPoints must be a non-negative number" });
      return;
    }
  }

  const [workout] = await db
    .insert(externalWorkoutsTable)
    .values({
      userId: req.user.id,
      label,
      duration: isRest ? 0 : duration,
      workoutType,
      source: source ?? "manual",
      intensity: intensity ?? null,
      muscleGroups: muscleGroups ?? [],
      stimulusPoints: stimulusPoints ?? null,
      workoutDate: workoutDate ?? null,
      movements: movements ?? [],
      isMetcon: isMetcon ?? false,
      metconFormat: metconFormat ?? null,
    })
    .returning();

  res.json(workout);
});

router.get("/workouts/external", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const workouts = await db
    .select()
    .from(externalWorkoutsTable)
    .where(eq(externalWorkoutsTable.userId, req.user.id))
    .orderBy(desc(externalWorkoutsTable.createdAt))
    .limit(100);

  res.json(workouts);
});

router.put("/workouts/external/:id", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const workoutId = parseInt(req.params.id, 10);
  if (isNaN(workoutId)) {
    res.status(400).json({ error: "Invalid workout ID" });
    return;
  }

  const { label, duration, workoutType, intensity, muscleGroups, stimulusPoints, workoutDate } = req.body;

  const updateData: Record<string, unknown> = {};
  if (label !== undefined) updateData.label = label;
  if (workoutDate !== undefined) {
    if (workoutDate !== null && (typeof workoutDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(workoutDate))) {
      res.status(400).json({ error: "workoutDate must be a YYYY-MM-DD string" });
      return;
    }
    updateData.workoutDate = workoutDate;
  }
  if (duration !== undefined) {
    if (typeof duration !== "number" || duration < 1 || duration > 600) {
      res.status(400).json({ error: "duration must be a number between 1 and 600" });
      return;
    }
    updateData.duration = duration;
  }
  if (workoutType !== undefined) updateData.workoutType = workoutType;
  if (intensity !== undefined) {
    if (intensity !== null && (typeof intensity !== "number" || intensity < 1 || intensity > 10)) {
      res.status(400).json({ error: "intensity must be a number between 1 and 10" });
      return;
    }
    updateData.intensity = intensity;
  }
  if (muscleGroups !== undefined) {
    if (muscleGroups !== null && !Array.isArray(muscleGroups)) {
      res.status(400).json({ error: "muscleGroups must be an array of strings" });
      return;
    }
    updateData.muscleGroups = muscleGroups;
  }
  if (stimulusPoints !== undefined) updateData.stimulusPoints = stimulusPoints;

  if (Object.keys(updateData).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const [updated] = await db
    .update(externalWorkoutsTable)
    .set(updateData)
    .where(
      and(
        eq(externalWorkoutsTable.id, workoutId),
        eq(externalWorkoutsTable.userId, req.user.id)
      )
    )
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Workout not found" });
    return;
  }

  res.json(updated);
});

router.delete("/workouts/external/:id", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const workoutId = parseInt(req.params.id, 10);
  if (isNaN(workoutId)) {
    res.status(400).json({ error: "Invalid workout ID" });
    return;
  }

  const [deleted] = await db
    .delete(externalWorkoutsTable)
    .where(
      and(
        eq(externalWorkoutsTable.id, workoutId),
        eq(externalWorkoutsTable.userId, req.user.id)
      )
    )
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Workout not found" });
    return;
  }

  res.json({ success: true });
});

router.get("/workouts/history", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const limitDays = parseInt(req.query.days as string) || 90;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - limitDays);

  const [sessions, external] = await Promise.all([
    db.select().from(workoutSessionsTable)
      .where(and(eq(workoutSessionsTable.userId, req.user.id), gte(workoutSessionsTable.createdAt, cutoff)))
      .orderBy(desc(workoutSessionsTable.createdAt))
      .limit(50),
    db.select().from(externalWorkoutsTable)
      .where(and(eq(externalWorkoutsTable.userId, req.user.id), gte(externalWorkoutsTable.createdAt, cutoff)))
      .orderBy(desc(externalWorkoutsTable.createdAt))
      .limit(50),
  ]);

  const unified = [
    ...sessions.map(s => ({
      id: s.id,
      type: "internal" as const,
      label: s.workoutTitle,
      date: s.createdAt.toISOString(),
      durationMinutes: Math.round((s.durationSeconds ?? 0) / 60),
      muscleGroups: Array.from(new Set(
        (s.exercises ?? []).flatMap((e: any) => [e.primaryMuscle, ...(e.secondaryMuscles ?? [])].filter(Boolean))
      )),
      stimulusPoints: null,
      source: "in-app",
      exerciseCount: (s.exercises ?? []).length,
      totalSetsCompleted: s.totalSetsCompleted ?? 0,
      feedback: s.postWorkoutFeedback,
    })),
    ...external.map(e => ({
      id: e.id,
      type: "external" as const,
      label: e.label,
      date: (e.workoutDate ? new Date(e.workoutDate).toISOString() : e.createdAt.toISOString()),
      durationMinutes: e.duration,
      muscleGroups: e.muscleGroups ?? [],
      stimulusPoints: e.stimulusPoints,
      source: e.source ?? "manual",
      exerciseCount: (e.movements ?? []).length,
      totalSetsCompleted: null,
      feedback: null,
      workoutType: e.workoutType,
      intensity: e.intensity,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  res.json(unified);
});

router.get("/workouts/sessions/:id", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const sessionId = parseInt(req.params.id, 10);
  if (isNaN(sessionId)) { res.status(400).json({ error: "Invalid session ID" }); return; }

  const [session] = await db.select().from(workoutSessionsTable)
    .where(and(eq(workoutSessionsTable.id, sessionId), eq(workoutSessionsTable.userId, req.user.id)));

  if (!session) { res.status(404).json({ error: "Session not found" }); return; }

  res.json(session);
});

router.patch("/workouts/sessions/:id/exercises", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const sessionId = parseInt(req.params.id, 10);
  if (isNaN(sessionId)) { res.status(400).json({ error: "Invalid session ID" }); return; }

  const { exercises } = req.body;
  if (!Array.isArray(exercises)) { res.status(400).json({ error: "exercises must be an array" }); return; }

  const [updated] = await db.update(workoutSessionsTable)
    .set({ exercises })
    .where(and(eq(workoutSessionsTable.id, sessionId), eq(workoutSessionsTable.userId, req.user.id)))
    .returning();

  if (!updated) { res.status(404).json({ error: "Session not found" }); return; }

  res.json(updated);
});

router.delete("/workouts/sessions/:id", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const sessionId = parseInt(req.params.id, 10);
  if (isNaN(sessionId)) { res.status(400).json({ error: "Invalid session ID" }); return; }

  const [deleted] = await db.delete(workoutSessionsTable)
    .where(and(eq(workoutSessionsTable.id, sessionId), eq(workoutSessionsTable.userId, req.user.id)))
    .returning();

  if (!deleted) { res.status(404).json({ error: "Session not found" }); return; }

  // Also remove the companion external-workout entry created by the in-app session
  // (workout-session.tsx calls submitExternalWorkout with source:"in-app" when finishing)
  if (deleted.workoutTitle) {
    await db.delete(externalWorkoutsTable)
      .where(and(
        eq(externalWorkoutsTable.userId, req.user.id),
        eq(externalWorkoutsTable.source, "in-app"),
        eq(externalWorkoutsTable.label, deleted.workoutTitle),
      ));
  }

  res.json({ success: true });
});

export default router;

import { Router, type IRouter, type Request, type Response } from "express";
import { db, externalWorkoutsTable } from "@workspace/db";
import { desc, eq, and } from "drizzle-orm";

const router: IRouter = Router();

router.post("/workouts/external", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { label, duration, workoutType, source, intensity, muscleGroups, stimulusPoints } = req.body;

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
    .limit(10);

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

  const { label, duration, workoutType, intensity, muscleGroups, stimulusPoints } = req.body;

  const updateData: Record<string, unknown> = {};
  if (label !== undefined) updateData.label = label;
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

export default router;

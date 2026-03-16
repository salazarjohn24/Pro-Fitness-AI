import { Router, type IRouter, type Request, type Response } from "express";
import { db, externalWorkoutsTable } from "@workspace/db";

const router: IRouter = Router();

router.post("/workouts/external", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { label, duration, workoutType, source } = req.body;

  if (!label || !duration || !workoutType) {
    res.status(400).json({ error: "Missing required fields: label, duration, workoutType" });
    return;
  }

  const [workout] = await db
    .insert(externalWorkoutsTable)
    .values({
      userId: req.user.id,
      label,
      duration,
      workoutType,
      source: source ?? "manual",
    })
    .returning();

  res.json(workout);
});

export default router;

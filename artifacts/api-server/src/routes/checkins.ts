import { Router, type IRouter, type Request, type Response } from "express";
import { db, dailyCheckInsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

router.post("/checkins", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { energyLevel, sleepQuality, stressLevel, sorenessScore, soreMuscleGroups, notes } = req.body;

  if (!energyLevel || !sleepQuality || !stressLevel || !sorenessScore) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const sleepScore = Math.round((sleepQuality / 5) * 100);

  const today = new Date().toISOString().split("T")[0];

  const existing = await db
    .select()
    .from(dailyCheckInsTable)
    .where(and(eq(dailyCheckInsTable.userId, req.user.id), eq(dailyCheckInsTable.date, today)));

  if (existing.length > 0) {
    const [updated] = await db
      .update(dailyCheckInsTable)
      .set({
        energyLevel,
        sleepQuality,
        stressLevel,
        sorenessScore,
        sleepScore,
        soreMuscleGroups: soreMuscleGroups ?? [],
        notes: notes ?? null,
      })
      .where(and(eq(dailyCheckInsTable.userId, req.user.id), eq(dailyCheckInsTable.date, today)))
      .returning();
    res.json(updated);
    return;
  }

  const [checkin] = await db
    .insert(dailyCheckInsTable)
    .values({
      userId: req.user.id,
      date: today,
      energyLevel,
      sleepQuality,
      stressLevel,
      sorenessScore,
      sleepScore,
      soreMuscleGroups: soreMuscleGroups ?? [],
      notes: notes ?? null,
    })
    .returning();

  res.json(checkin);
});

router.get("/checkins/today", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const today = new Date().toISOString().split("T")[0];

  const [checkin] = await db
    .select()
    .from(dailyCheckInsTable)
    .where(and(eq(dailyCheckInsTable.userId, req.user.id), eq(dailyCheckInsTable.date, today)));

  res.json(checkin ?? null);
});

export default router;

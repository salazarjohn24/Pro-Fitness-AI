import { Router, type IRouter, type Request, type Response } from "express";
import { db, userProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/profile", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [profile] = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, req.user.id));

  if (!profile) {
    const [newProfile] = await db
      .insert(userProfilesTable)
      .values({ userId: req.user.id })
      .returning();
    res.json(newProfile);
    return;
  }

  res.json(profile);
});

router.put("/profile", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { streakDays, fitnessGoal, workoutFrequency, dailySyncProgress, checkInCompleted, activityImported, equipment, skillLevel, injuries, onboardingCompleted } = req.body;

  const [updated] = await db
    .insert(userProfilesTable)
    .values({
      userId: req.user.id,
      streakDays,
      fitnessGoal,
      workoutFrequency,
      dailySyncProgress,
      checkInCompleted,
      activityImported,
      equipment,
      skillLevel,
      injuries,
      onboardingCompleted,
    })
    .onConflictDoUpdate({
      target: userProfilesTable.userId,
      set: {
        ...(streakDays !== undefined && { streakDays }),
        ...(fitnessGoal !== undefined && { fitnessGoal }),
        ...(workoutFrequency !== undefined && { workoutFrequency }),
        ...(dailySyncProgress !== undefined && { dailySyncProgress }),
        ...(checkInCompleted !== undefined && { checkInCompleted }),
        ...(activityImported !== undefined && { activityImported }),
        ...(equipment !== undefined && { equipment }),
        ...(skillLevel !== undefined && { skillLevel }),
        ...(injuries !== undefined && { injuries }),
        ...(onboardingCompleted !== undefined && { onboardingCompleted }),
        updatedAt: new Date(),
      },
    })
    .returning();

  res.json(updated);
});

export default router;

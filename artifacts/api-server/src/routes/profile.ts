import { Router, type IRouter, type Request, type Response } from "express";
import { db, userProfilesTable, type InsertUserProfile } from "@workspace/db";
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

  const {
    streakDays, fitnessGoal, workoutFrequency, dailySyncProgress,
    checkInCompleted, activityImported,
    age, weight, height, gender, experienceLevel,
    injuries, injuryNotes, primaryGoal, unitSystem,
    onboardingCompleted, insightDetailLevel, syncPreferences,
    equipment, skillLevel,
  } = req.body;

  const setFields: Partial<InsertUserProfile> = { updatedAt: new Date() };

  if (streakDays !== undefined) setFields.streakDays = streakDays;
  if (fitnessGoal !== undefined) setFields.fitnessGoal = fitnessGoal;
  if (workoutFrequency !== undefined) setFields.workoutFrequency = workoutFrequency;
  if (dailySyncProgress !== undefined) setFields.dailySyncProgress = dailySyncProgress;
  if (checkInCompleted !== undefined) setFields.checkInCompleted = checkInCompleted;
  if (activityImported !== undefined) setFields.activityImported = activityImported;
  if (age !== undefined) setFields.age = age;
  if (weight !== undefined) setFields.weight = weight;
  if (height !== undefined) setFields.height = height;
  if (gender !== undefined) setFields.gender = gender;
  if (experienceLevel !== undefined) setFields.experienceLevel = experienceLevel;
  if (injuries !== undefined) setFields.injuries = injuries;
  if (injuryNotes !== undefined) setFields.injuryNotes = injuryNotes;
  if (primaryGoal !== undefined) setFields.primaryGoal = primaryGoal;
  if (unitSystem !== undefined) setFields.unitSystem = unitSystem;
  if (onboardingCompleted !== undefined) setFields.onboardingCompleted = onboardingCompleted;
  if (insightDetailLevel !== undefined) setFields.insightDetailLevel = insightDetailLevel;
  if (syncPreferences !== undefined) setFields.syncPreferences = syncPreferences;
  if (equipment !== undefined) setFields.equipment = equipment;
  if (skillLevel !== undefined) setFields.skillLevel = skillLevel;

  const [updated] = await db
    .insert(userProfilesTable)
    .values({
      userId: req.user.id,
      ...setFields,
    })
    .onConflictDoUpdate({
      target: userProfilesTable.userId,
      set: setFields,
    })
    .returning();

  res.json(updated);
});

export default router;

import { Router, type IRouter, type Request, type Response } from "express";
import { db, externalWorkoutsTable, workoutSessionsTable } from "@workspace/db";
import { desc, eq, and, gte, ne, inArray } from "drizzle-orm";
import {
  WORKOUT_FORMAT_VALUES,
  validateParserConfidence,
  validateParserWarnings,
  validateWorkoutFormat,
  validateEditedFields,
} from "../lib/parserValidator.js";
import {
  ingestMovementsToVault,
  deleteVaultEntriesForExternalWorkout,
  checkExerciseMatches,
  type RichMovement,
} from "../lib/vaultIngestion.js";
import { isFeatureEnabled } from "../lib/featureFlags.js";

// Movement types that conflict with a declared rest day (A1)
const REST_DAY_CONFLICT_TYPES = new Set(["strength", "bodyweight", "cardio"]);

const router: IRouter = Router();

router.post("/workouts/external", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const {
    label, duration, workoutType, source, intensity, muscleGroups, stimulusPoints,
    workoutDate, movements, isMetcon, metconFormat,
    parserConfidence, parserWarnings, workoutFormat, wasUserEdited, editedFields,
    lastEditedAt, editSource, rawImportText,
  } = req.body;

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

    // A1: REST day + non-recovery movement types → structured 422 warning
    if (Array.isArray(movements) && movements.length > 0) {
      const conflicting = movements.filter(
        (m: { movementType?: string }) => REST_DAY_CONFLICT_TYPES.has(m.movementType ?? "strength")
      );
      if (conflicting.length > 0) {
        res.status(422).json({
          error: `${conflicting.length} movement(s) conflict with a rest day`,
          code: "REST_DAY_MOVEMENT_CONFLICT",
          options: ["keep_rest", "convert_workout"],
        });
        return;
      }
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

  const errConf = validateParserConfidence(parserConfidence);
  if (errConf) { res.status(400).json({ error: errConf }); return; }
  const errWarn = validateParserWarnings(parserWarnings);
  if (errWarn) { res.status(400).json({ error: errWarn }); return; }
  const errFmt = validateWorkoutFormat(workoutFormat);
  if (errFmt) { res.status(400).json({ error: errFmt }); return; }
  const errEf = validateEditedFields(editedFields);
  if (errEf) { res.status(400).json({ error: errEf }); return; }

  const hasMovements = Array.isArray(movements) && movements.length > 0 && !isRest;

  // A5: persist edit-provenance fields
  // A4: flag-gated vault ingestion — wrap INSERT + ingest in a single transaction
  // so a vault failure rolls back the workout row (no committed partial state).
  const vaultEnabled = hasMovements && isFeatureEnabled("external_to_vault_ingestion");

  let workout: typeof externalWorkoutsTable.$inferSelect;
  try {
    workout = await db.transaction(async (tx) => {
      const [inserted] = await tx
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
          parserConfidence: parserConfidence ?? null,
          parserWarnings: parserWarnings ?? [],
          workoutFormat: workoutFormat ?? null,
          wasUserEdited: wasUserEdited ?? false,
          editedFields: editedFields ?? [],
          lastEditedAt: lastEditedAt ? new Date(lastEditedAt) : null,
          editSource: editSource ?? null,
          rawImportText: rawImportText ?? null,
        })
        .returning();

      if (vaultEnabled) {
        await ingestMovementsToVault(
          inserted.id,
          req.user.id,
          movements as RichMovement[],
          workoutDate ?? null,
          tx as unknown as typeof db
        );
      } else if (hasMovements) {
        console.log(`[vault-ingestion] skipped workoutId=${inserted.id} (flag off)`);
      }

      return inserted;
    });
  } catch (err) {
    console.error(`[vault-ingestion] transaction failed — rolling back:`, err);
    res.status(500).json({
      error: "Workout could not be saved — please try again.",
      code: "VAULT_INGESTION_FAILED",
      retryable: true,
    });
    return;
  }

  if (parserConfidence != null) {
    console.log(`[parser-telemetry] workoutId=${workout.id} confidence=${parserConfidence} format=${workoutFormat ?? "null"} warnings=${(parserWarnings ?? []).length} source=${source ?? "manual"}`);
  }

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

  const {
    label, duration, workoutType, intensity, muscleGroups, stimulusPoints, workoutDate,
    parserConfidence, parserWarnings, workoutFormat, wasUserEdited, editedFields, movements,
    lastEditedAt, editSource, rawImportText,
  } = req.body;

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

  if (parserConfidence !== undefined) {
    const e = validateParserConfidence(parserConfidence);
    if (e) { res.status(400).json({ error: e }); return; }
    updateData.parserConfidence = parserConfidence ?? null;
  }
  if (parserWarnings !== undefined) {
    const e = validateParserWarnings(parserWarnings);
    if (e) { res.status(400).json({ error: e }); return; }
    updateData.parserWarnings = parserWarnings ?? [];
  }
  if (workoutFormat !== undefined) {
    const e = validateWorkoutFormat(workoutFormat);
    if (e) { res.status(400).json({ error: e }); return; }
    updateData.workoutFormat = workoutFormat ?? null;
  }
  if (wasUserEdited !== undefined) updateData.wasUserEdited = Boolean(wasUserEdited);
  if (editedFields !== undefined) {
    const e = validateEditedFields(editedFields);
    if (e) { res.status(400).json({ error: e }); return; }
    updateData.editedFields = editedFields ?? [];
  }
  if (movements !== undefined && Array.isArray(movements)) {
    updateData.movements = movements;
  }

  // A5: edit-provenance fields
  if (lastEditedAt !== undefined) {
    updateData.lastEditedAt = lastEditedAt ? new Date(lastEditedAt) : null;
  }
  if (editSource !== undefined) updateData.editSource = editSource ?? null;
  if (rawImportText !== undefined) updateData.rawImportText = rawImportText ?? null;

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

  // A4: gate re-ingestion on feature flag
  if (Array.isArray(movements) && movements.length > 0 && updated.workoutType !== "rest") {
    if (isFeatureEnabled("external_to_vault_ingestion")) {
      deleteVaultEntriesForExternalWorkout(workoutId, req.user.id)
        .then(() => ingestMovementsToVault(workoutId, req.user.id, movements as RichMovement[], updated.workoutDate ?? null))
        .catch((err) => {
          console.error(`[vault-reingestion] externalWorkoutId=${workoutId} error:`, err);
        });
    } else {
      console.log(`[vault-reingestion] skipped workoutId=${workoutId} (flag off)`);
    }
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
      parserConfidence: e.parserConfidence ?? null,
      parserWarnings: e.parserWarnings ?? [],
      workoutFormat: e.workoutFormat ?? null,
      wasUserEdited: e.wasUserEdited ?? false,
      editedFields: e.editedFields ?? [],
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

// ---------------------------------------------------------------------------
// Item 2: Exercise mismatch check — read-only pre-submit lookup
// ---------------------------------------------------------------------------
router.post("/workouts/check-exercise-matches", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { movements } = req.body;
  if (!Array.isArray(movements)) {
    res.status(400).json({ error: "movements must be an array" });
    return;
  }

  const validMovements = movements.filter(
    (m): m is { name: string; movementType?: string } =>
      typeof m === "object" && m !== null && typeof m.name === "string"
  );

  const checks = await checkExerciseMatches(validMovements);
  res.json({ checks });
});

// ---------------------------------------------------------------------------
// POST /workouts/health-import  (Apple Health batch import)
// ---------------------------------------------------------------------------

/**
 * Map an Apple Health activityName to our internal workoutType + a clean
 * display label.  Falls back to ("strength", activityName) for unknown types.
 *
 * Exported for unit testing.
 */
export function mapHKActivity(activityName: string): { workoutType: string; label: string } {
  const map: Record<string, { workoutType: string; label: string }> = {
    TraditionalStrengthTraining:    { workoutType: "strength",  label: "Strength Training" },
    FunctionalStrengthTraining:     { workoutType: "strength",  label: "Functional Strength" },
    CrossTraining:                  { workoutType: "strength",  label: "Cross Training" },
    HighIntensityIntervalTraining:  { workoutType: "strength",  label: "HIIT" },
    CoreTraining:                   { workoutType: "strength",  label: "Core Training" },
    Boxing:                         { workoutType: "strength",  label: "Boxing" },
    Wrestling:                      { workoutType: "strength",  label: "Wrestling" },
    MartialArts:                    { workoutType: "strength",  label: "Martial Arts" },
    Gymnastics:                     { workoutType: "strength",  label: "Gymnastics" },
    Running:                        { workoutType: "cardio",    label: "Running" },
    Cycling:                        { workoutType: "cardio",    label: "Cycling" },
    Swimming:                       { workoutType: "cardio",    label: "Swimming" },
    Walking:                        { workoutType: "cardio",    label: "Walking" },
    Rowing:                         { workoutType: "cardio",    label: "Rowing" },
    Elliptical:                     { workoutType: "cardio",    label: "Elliptical" },
    StairClimbing:                  { workoutType: "cardio",    label: "Stair Climbing" },
    Hiking:                         { workoutType: "cardio",    label: "Hiking" },
    Tennis:                         { workoutType: "cardio",    label: "Tennis" },
    Basketball:                     { workoutType: "cardio",    label: "Basketball" },
    Soccer:                         { workoutType: "cardio",    label: "Soccer" },
    Yoga:                           { workoutType: "recovery",  label: "Yoga" },
    Pilates:                        { workoutType: "recovery",  label: "Pilates" },
    Stretching:                     { workoutType: "recovery",  label: "Stretching" },
    MindAndBody:                    { workoutType: "recovery",  label: "Mind & Body" },
    Other:                          { workoutType: "strength",  label: "Workout" },
  };
  return map[activityName] ?? { workoutType: "strength", label: activityName };
}

interface HKWorkoutPayload {
  id: string;
  activityName: string;
  activityId: number;
  calories: number;
  distance: number;
  /** Duration in seconds */
  duration: number;
  startDate: string;
  endDate: string;
  sourceName: string;
}

/**
 * Batch import Apple Health workouts.
 *
 * Accepts up to 200 SyncWorkout records.  Each workout is keyed by its
 * HealthKit UUID (stored in rawImportText) so re-syncing is idempotent.
 *
 * Response:  { imported: number, skipped: number }
 */
router.post("/workouts/health-import", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { workouts } = req.body as { workouts?: unknown };

  if (!Array.isArray(workouts) || workouts.length === 0) {
    res.json({ imported: 0, skipped: 0 });
    return;
  }

  if (workouts.length > 200) {
    res.status(400).json({ error: "Batch too large. Maximum 200 workouts per import." });
    return;
  }

  try {
    const validWorkouts = (workouts as HKWorkoutPayload[]).filter(
      (w) => typeof w?.id === "string" && w.id.length > 0 && typeof w.activityName === "string"
    );

    if (validWorkouts.length === 0) {
      res.json({ imported: 0, skipped: workouts.length });
      return;
    }

    const hkIds = validWorkouts.map((w) => w.id);

    const existing = await db
      .select({ rawImportText: externalWorkoutsTable.rawImportText })
      .from(externalWorkoutsTable)
      .where(
        and(
          eq(externalWorkoutsTable.userId, req.user.id),
          eq(externalWorkoutsTable.source, "apple_health"),
          inArray(externalWorkoutsTable.rawImportText, hkIds)
        )
      );

    const alreadyImported = new Set(
      existing.map((r) => r.rawImportText).filter((v): v is string => typeof v === "string")
    );

    const toInsert = validWorkouts.filter((w) => !alreadyImported.has(w.id));

    if (toInsert.length === 0) {
      res.json({ imported: 0, skipped: workouts.length });
      return;
    }

    const rows = toInsert.map((w) => {
      const { workoutType, label } = mapHKActivity(w.activityName);
      const durationMinutes = Math.max(1, Math.round(w.duration / 60));
      const workoutDate = typeof w.startDate === "string" ? w.startDate.split("T")[0] : null;
      return {
        userId:          req.user.id,
        label,
        duration:        durationMinutes,
        workoutType,
        source:          "apple_health" as const,
        intensity:       null,
        muscleGroups:    [] as string[],
        stimulusPoints:  null,
        workoutDate:     workoutDate ?? null,
        movements:       [] as unknown[],
        isMetcon:        false,
        metconFormat:    null,
        parserConfidence: null,
        parserWarnings:  [] as string[],
        workoutFormat:   null,
        wasUserEdited:   false,
        editedFields:    [] as string[],
        lastEditedAt:    null,
        editSource:      null,
        rawImportText:   w.id,
      };
    });

    await db.insert(externalWorkoutsTable).values(rows);

    console.log(
      `[health-import] userId=${req.user.id} imported=${rows.length} skipped=${workouts.length - rows.length}`
    );

    res.json({ imported: rows.length, skipped: workouts.length - rows.length });
  } catch (err) {
    console.error("[health-import] error:", err);
    res.status(500).json({ error: "Failed to import Apple Health workouts" });
  }
});

export default router;

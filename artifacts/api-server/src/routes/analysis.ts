/**
 * analysis.ts — Steps 6–8 presentation integration routes.
 *
 * Three endpoints that run the scoring stack against stored workout data and
 * return structured results for the mobile presentation layer.
 *
 * GET /api/workouts/sessions/:id/analysis          (Step 6 — in-app sessions)
 *   Runs scoreWorkout() on a stored session's exercises.
 *   Returns WorkoutScoreResult (JSON-serialisable).
 *
 * GET /api/workouts/external/:id/analysis          (Step 8 — external workouts)
 *   Adapts external workout movements via externalWorkoutAdapter and runs
 *   scoreWorkout() when eligible.
 *   Returns WorkoutScoreResult + importedDataNote, or 422 when ineligible.
 *
 * GET /api/training/history-analysis               (Step 6 — rolling window)
 *   Runs scoreHistory() + generateInsights() over the user's sessions in the
 *   last N days (default 30).
 *   Returns { rollup, insights }
 *
 * SCOPE: Presentation bridge only. No DB writes. All scoring is pure and
 * stateless. No readiness/recovery/fatigue logic.
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { db, workoutSessionsTable, externalWorkoutsTable } from "@workspace/db";
import { eq, and, gte } from "drizzle-orm";
import { scoreWorkout } from "../lib/workoutVector.js";
import { scoreHistory } from "../lib/historyAggregation.js";
import { generateInsights } from "../lib/historyInsights.js";
import { parseWeightToKg } from "../lib/weightParser.js";
import { adaptExternalWorkout, importedDataNote } from "../lib/externalWorkoutAdapter.js";
import type { PerformedMovementInput, PerformedWorkoutInput } from "../lib/workoutScoringTypes.js";
import type { HistoricalWorkoutInput } from "../lib/historyScoringTypes.js";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Helpers — internal sessions
// ---------------------------------------------------------------------------

/**
 * Convert an in-app session exercise entry into an array of
 * PerformedMovementInput (one per completed set).
 */
function sessionExerciseToMovements(
  exercise: {
    name: string;
    sets: { reps: number; weight: string; completed: boolean }[];
  }
): PerformedMovementInput[] {
  const completedSets = (exercise.sets ?? []).filter((s) => s.completed);
  if (completedSets.length === 0) {
    return [{ name: exercise.name }];
  }
  return completedSets.map((s) => ({
    name: exercise.name,
    reps: s.reps > 0 ? s.reps : undefined,
    loadKg: parseWeightToKg(s.weight) > 0 ? parseWeightToKg(s.weight) : undefined,
  }));
}

/**
 * Build a PerformedWorkoutInput from a raw session row's exercises JSON blob.
 */
function buildWorkoutInput(sessionRow: {
  workoutTitle?: string | null;
  exercises?: unknown;
}): PerformedWorkoutInput {
  const rawExercises = (sessionRow.exercises ?? []) as Array<{
    name: string;
    sets: { reps: number; weight: string; completed: boolean }[];
  }>;
  const movements = rawExercises.flatMap(sessionExerciseToMovements);
  return {
    movements,
    workoutName: sessionRow.workoutTitle ?? undefined,
    workoutType: "strength",
  };
}

// ---------------------------------------------------------------------------
// GET /api/workouts/sessions/:id/analysis  (Step 6 — unchanged)
// ---------------------------------------------------------------------------

router.get("/workouts/sessions/:id/analysis", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const sessionId = parseInt(req.params.id, 10);
  if (isNaN(sessionId)) {
    res.status(400).json({ error: "Invalid session ID" });
    return;
  }

  try {
    const [session] = await db
      .select()
      .from(workoutSessionsTable)
      .where(
        and(
          eq(workoutSessionsTable.id, sessionId),
          eq(workoutSessionsTable.userId, req.user.id)
        )
      );

    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    const input = buildWorkoutInput(session);
    const result = scoreWorkout(input);

    res.json(result);
  } catch (err) {
    console.error("Session analysis error:", err);
    res.status(500).json({ error: "Analysis failed" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/workouts/external/:id/analysis  (Step 8 — new)
// ---------------------------------------------------------------------------

/**
 * External workout analysis endpoint.
 *
 * Adapts the external workout data via externalWorkoutAdapter and runs the
 * same Step 3–5 scoring stack as the internal sessions endpoint.
 *
 * Response:
 *   200  — { ...WorkoutScoreResult, importedDataNote: string | null }
 *   422  — { eligible: false, reason: string }   (ineligible to score)
 *   404  — workout not found or not owned by user
 *   401  — not authenticated
 */
router.get("/workouts/external/:id/analysis", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const workoutId = parseInt(req.params.id, 10);
  if (isNaN(workoutId)) {
    res.status(400).json({ error: "Invalid workout ID" });
    return;
  }

  try {
    const [workout] = await db
      .select()
      .from(externalWorkoutsTable)
      .where(
        and(
          eq(externalWorkoutsTable.id, workoutId),
          eq(externalWorkoutsTable.userId, req.user.id)
        )
      );

    if (!workout) {
      res.status(404).json({ error: "Workout not found" });
      return;
    }

    const { input, quality } = adaptExternalWorkout(workout);

    if (!quality.isEligible) {
      res.status(422).json({
        eligible: false,
        reason: quality.ineligibleReason ?? "Not enough data to score this workout.",
      });
      return;
    }

    const result = scoreWorkout(input);
    const dataNote = importedDataNote(quality);

    res.json({ ...result, importedDataNote: dataNote });
  } catch (err) {
    console.error("External workout analysis error:", err);
    res.status(500).json({ error: "Analysis failed" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/training/history-analysis  (Step 6 — updated to use adapter)
// ---------------------------------------------------------------------------

router.get("/training/history-analysis", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const days = Math.min(Math.max(parseInt(req.query.days as string) || 30, 1), 90);
  const rangeLabel = (req.query.rangeLabel as string) || `past ${days} days`;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  try {
    const [sessions, externalWorkouts] = await Promise.all([
      db
        .select()
        .from(workoutSessionsTable)
        .where(
          and(
            eq(workoutSessionsTable.userId, req.user.id),
            gte(workoutSessionsTable.createdAt, cutoff)
          )
        ),
      db
        .select()
        .from(externalWorkoutsTable)
        .where(
          and(
            eq(externalWorkoutsTable.userId, req.user.id),
            gte(externalWorkoutsTable.createdAt, cutoff)
          )
        ),
    ]);

    const historicalInputs: HistoricalWorkoutInput[] = [
      ...sessions.map((s) => ({
        workoutResult: scoreWorkout(buildWorkoutInput(s)),
        performedAt: s.createdAt,
      })),
      ...externalWorkouts
        .flatMap((e) => {
          const { input, quality } = adaptExternalWorkout(e);
          if (!quality.isEligible) return [];
          return [{
            workoutResult: scoreWorkout(input),
            performedAt:   e.workoutDate ? new Date(e.workoutDate as string) : e.createdAt,
          }];
        }),
    ];

    const rollup = scoreHistory(historicalInputs);
    const insights = generateInsights(rollup, { rangeLabel });

    res.json({ rollup, insights });
  } catch (err) {
    console.error("History analysis error:", err);
    res.status(500).json({ error: "Analysis failed" });
  }
});

export default router;

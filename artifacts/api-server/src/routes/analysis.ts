/**
 * analysis.ts — Step 6 presentation integration routes.
 *
 * Two endpoints that run the scoring stack against stored session data and
 * return structured results for the mobile presentation layer.
 *
 * GET /api/workouts/sessions/:id/analysis
 *   Runs Step 3 scoreWorkout() on a stored session's exercises.
 *   Returns WorkoutScoreResult (JSON-serialisable).
 *
 * GET /api/training/history-analysis?days=N&rangeLabel=...
 *   Runs Step 4 scoreHistory() + Step 5 generateInsights() over the
 *   user's sessions in the last N days (default 30).
 *   Returns { rollup: HistoricalRollupResult, insights: InsightGenerationResult }
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
import type { PerformedMovementInput, PerformedWorkoutInput } from "../lib/workoutScoringTypes.js";
import type { HistoricalWorkoutInput } from "../lib/historyScoringTypes.js";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Helpers
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

/**
 * Build a PerformedWorkoutInput from an external workout's movements JSON blob.
 */
function buildExternalWorkoutInput(externalRow: {
  label?: string | null;
  workoutType?: string | null;
  movements?: unknown;
  duration?: number | null;
  stimulusPoints?: number | null;
}): PerformedWorkoutInput {
  type ExternalMovement = {
    name: string;
    movementType?: string;
    volume?: string;
    setRows?: Array<{
      reps?: number;
      weight?: string;
      durationSeconds?: number;
      distance?: number;
      calories?: number;
    }>;
  };

  const rawMovements = (externalRow.movements ?? []) as ExternalMovement[];

  const movements: PerformedMovementInput[] = rawMovements.flatMap((m) => {
    const rows = m.setRows ?? [];
    if (rows.length === 0) {
      return [{ name: m.name }];
    }
    return rows.map((r) => ({
      name: m.name,
      reps: r.reps != null && r.reps > 0 ? r.reps : undefined,
      loadKg:
        r.weight != null && parseWeightToKg(r.weight) > 0
          ? parseWeightToKg(r.weight)
          : undefined,
      distanceM: r.distance != null && r.distance > 0 ? r.distance : undefined,
      calories: r.calories != null && r.calories > 0 ? r.calories : undefined,
    }));
  });

  return {
    movements,
    workoutName: externalRow.label ?? undefined,
    workoutType: externalRow.workoutType ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// GET /api/workouts/sessions/:id/analysis
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
// GET /api/training/history-analysis
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
        .filter((e) => {
          const movements = (e.movements ?? []) as unknown[];
          return e.workoutType !== "rest" && movements.length > 0;
        })
        .map((e) => ({
          workoutResult: scoreWorkout(buildExternalWorkoutInput(e)),
          performedAt: e.workoutDate ? new Date(e.workoutDate) : e.createdAt,
        })),
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

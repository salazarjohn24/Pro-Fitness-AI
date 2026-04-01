/**
 * workoutVector.ts — Step 3 workout-level aggregation engine.
 *
 * Main export: `scoreWorkout(input: PerformedWorkoutInput): WorkoutScoreResult`
 *
 * Aggregation pipeline:
 *   1. Call scoreMovement() for each movement in input.movements
 *   2. Sum muscle vectors additively across all movements
 *   3. Accumulate pattern vector (pattern → Σ rawScore)
 *   4. Compute workout stimulus vector as rawScore-weighted average
 *   5. Generate ranked summary via workoutSummary.ts
 *   6. Build metadata (scored/fallback counts, total rawScore)
 *   7. Return WorkoutScoreResult
 *
 * AGGREGATION PRINCIPLES
 * ----------------------
 * - Additive muscle scores: volume compounds across movements.
 *   Two movements both loading "quads" → quads gets both scores summed.
 * - Weighted stimulus average: a high-exposure movement (rawScore=4.0)
 *   contributes 4× more to the aggregate stimulus than a low-exposure one
 *   (rawScore=1.0). This reflects that more work = more stimulus signal.
 * - Pattern vector is raw sum (not normalised): it shows absolute exposure
 *   by pattern, not relative balance. Normalisation is a consumer concern.
 * - Fallback movements contribute a zero muscle vector but do count toward
 *   totalRawScore via their exposure (method="unknown", rawScore=0.1).
 * - Empty input is safe: returns all-zero vectors with empty metadata.
 *
 * SCOPE: Step 3 only. No historical rollups. No fatigue/recovery. No
 * prescribed/performed delta. No UI concerns.
 */

import { scoreMovement } from "./muscleVector";
import { generateWorkoutSummary } from "./workoutSummary";
import {
  sumVectors,
  weightedAverageStimulusVectors,
  roundVector,
} from "./vectorMath";
import type { PerformedWorkoutInput, WorkoutScoreResult } from "./workoutScoringTypes";
import type { StimulusVector } from "./movementScoringTypes";

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Score a complete performed workout.
 *
 * @param input - Workout with one or more movement entries
 * @returns WorkoutScoreResult with aggregate vectors, ranked summary, and metadata
 */
export function scoreWorkout(input: PerformedWorkoutInput): WorkoutScoreResult {
  // Handle empty workout safely
  if (input.movements.length === 0) {
    const emptySummary = generateWorkoutSummary({}, {}, neutralStimulus());
    return {
      workoutName: input.workoutName,
      workoutType: input.workoutType,
      movementResults: [],
      muscleVector: {},
      patternVector: {},
      stimulusVector: neutralStimulus(),
      summary: emptySummary,
      metadata: {
        totalMovements: 0,
        scoredMovements: 0,
        fallbackMovements: 0,
        fallbackMovementNames: [],
        totalRawScore: 0,
      },
    };
  }

  // ── 1. Score each movement ────────────────────────────────────────────────
  const movementResults = input.movements.map((m) => scoreMovement(m));

  // ── 2. Aggregate muscle vectors (additive sum) ────────────────────────────
  const muscleVector = roundVector(
    sumVectors(movementResults.map((r) => r.muscleVector as Record<string, number>))
  );

  // ── 3. Accumulate pattern vector (pattern → Σ rawScore) ───────────────────
  const patternVector: Record<string, number> = {};
  for (const result of movementResults) {
    if (result.profile !== null) {
      const pattern = result.profile.pattern;
      patternVector[pattern] = (patternVector[pattern] ?? 0) + result.exposure.rawScore;
    }
  }
  // Round pattern scores to 3 dp
  for (const key of Object.keys(patternVector)) {
    patternVector[key] = Number(patternVector[key].toFixed(3));
  }

  // ── 4. Weighted-average stimulus vector ───────────────────────────────────
  const stimulusVectors: StimulusVector[] = movementResults.map((r) => r.stimulusVector);
  const rawScoreWeights: number[] = movementResults.map((r) => r.exposure.rawScore);
  const stimulusVector = weightedAverageStimulusVectors(stimulusVectors, rawScoreWeights);

  // ── 5. Generate ranked summary ────────────────────────────────────────────
  const summary = generateWorkoutSummary(muscleVector, patternVector, stimulusVector);

  // ── 6. Build metadata ─────────────────────────────────────────────────────
  const fallbackResults = movementResults.filter((r) => r.fallbackUsed);
  const totalRawScore = movementResults.reduce(
    (sum, r) => sum + r.exposure.rawScore,
    0
  );

  const metadata = {
    totalMovements: movementResults.length,
    scoredMovements: movementResults.length - fallbackResults.length,
    fallbackMovements: fallbackResults.length,
    fallbackMovementNames: fallbackResults.map((r) => r.movementName),
    totalRawScore: Number(totalRawScore.toFixed(3)),
  };

  // ── 7. Assemble and return ────────────────────────────────────────────────
  return {
    workoutName: input.workoutName,
    workoutType: input.workoutType,
    movementResults,
    muscleVector,
    patternVector,
    stimulusVector,
    summary,
    metadata,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function neutralStimulus(): StimulusVector {
  return { strength: 0, hypertrophy: 0, muscular_endurance: 0, power: 0, conditioning: 0 };
}

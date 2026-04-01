/**
 * workoutScoringTypes.ts — Step 3 shared types for workout-level aggregation.
 *
 * Sits on top of Step 2 types. Each type here is either:
 *   - a workout-level input/result, or
 *   - an aggregate of Step 2 per-movement results
 *
 * SCOPE: Step 3 only.
 * Not included here: historical rollups, fatigue/recovery, readiness,
 * prescribed/performed delta. Those are explicitly Step 4+.
 */

import type { PerformedMovementInput, MovementScoreResult, StimulusVector } from "./movementScoringTypes";

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

/**
 * A full performed workout containing one or more movement entries.
 * The movements array is the only required field.
 */
export interface PerformedWorkoutInput {
  /** Ordered list of movements performed (order is preserved in output). */
  movements: PerformedMovementInput[];
  /** Optional human label, e.g. "Fran", "Tuesday AMRAP". */
  workoutName?: string;
  /** Optional structural format, e.g. "for_time", "amrap", "emom", "rft", "strength". */
  workoutType?: string;
}

// ---------------------------------------------------------------------------
// Ranked entry (used in summary)
// ---------------------------------------------------------------------------

/** A single muscle or pattern with its aggregate score and rank position. */
export interface RankedEntry {
  key: string;
  score: number;
  rank: number;
}

// ---------------------------------------------------------------------------
// Aggregated vectors
// ---------------------------------------------------------------------------

/**
 * Summed per-muscle scores across all movements in the workout.
 *
 * Each value is the arithmetic sum of individual MovementScoreResult muscle
 * scores. Higher = more aggregate stimulus for that muscle group.
 * Not normalised — absolute values grow with workout volume.
 */
export type WorkoutMuscleVector = Record<string, number>;

/**
 * Per-pattern cumulative rawScore exposure across the workout.
 *
 * Pattern key → sum of rawScores for every movement sharing that pattern.
 * Useful for understanding the structural balance of the session
 * (e.g. "more squat and vertical_pull than horizontal_push").
 */
export type WorkoutPatternVector = Record<string, number>;

/**
 * Workout-level stimulus tendencies.
 *
 * Computed as a rawScore-weighted average of each movement's StimulusVector.
 * Heavier-exposure movements (higher rawScore) contribute proportionally more
 * to the aggregate. All values remain in [0.0, 1.0].
 */
export type WorkoutStimulusVector = StimulusVector;

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

/**
 * Human-usable ranked view of workout output.
 * Derived entirely from the aggregate vectors — no additional heuristics.
 */
export interface WorkoutSummary {
  /** Top muscles by aggregate score. Length ≤ topN (default 5). */
  topMuscles: RankedEntry[];
  /** Top movement patterns by cumulative exposure. Length ≤ topN. */
  topPatterns: RankedEntry[];
  /** The single stimulus dimension with the highest aggregate value. */
  dominantStimulus: keyof WorkoutStimulusVector;
  /**
   * All stimulus dimensions above STIMULUS_PRESENCE_THRESHOLD (0.40),
   * sorted descending by value.
   */
  presentStimuli: Array<{ stimulus: keyof WorkoutStimulusVector; value: number }>;
}

// ---------------------------------------------------------------------------
// Aggregation metadata
// ---------------------------------------------------------------------------

/** Accounting data that travels with the result for explainability. */
export interface WorkoutAggregationMetadata {
  /** Total movement entries provided (including duplicates). */
  totalMovements: number;
  /** Movements that resolved to a Step 1 profile (not fallback). */
  scoredMovements: number;
  /** Movements where fallbackUsed=true (Step 1 profile not found). */
  fallbackMovements: number;
  /** Original names of fallback movements — for logging / debugging. */
  fallbackMovementNames: string[];
  /**
   * Sum of all movement rawScores. A workout-level "volume load proxy".
   * Not normalised. Useful for comparing workouts at the same structural type.
   */
  totalRawScore: number;
}

// ---------------------------------------------------------------------------
// Workout score result
// ---------------------------------------------------------------------------

/**
 * Full result from scoring a complete workout.
 *
 * Contains both the summary-friendly ranked view and the raw aggregate vectors,
 * plus every individual movement result for traceability.
 */
export interface WorkoutScoreResult {
  workoutName?: string;
  workoutType?: string;
  /** Per-movement results, in input order. Preserved for explainability. */
  movementResults: MovementScoreResult[];
  /** Summed muscle scores across all movements. */
  muscleVector: WorkoutMuscleVector;
  /** Per-pattern cumulative rawScore exposure. */
  patternVector: WorkoutPatternVector;
  /** RawScore-weighted average stimulus across all movements. */
  stimulusVector: WorkoutStimulusVector;
  /** Ranked summary view derived from the aggregate vectors. */
  summary: WorkoutSummary;
  /** Aggregation accounting metadata. */
  metadata: WorkoutAggregationMetadata;
}

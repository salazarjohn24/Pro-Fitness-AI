/**
 * historyScoringTypes.ts — Step 4 shared types for cross-workout historical rollups.
 *
 * Sits on top of Step 3 (WorkoutScoreResult). Every type here is either:
 *   - an input descriptor for a historical collection of scored workouts
 *   - an aggregate output across multiple workouts in a time range
 *
 * SCOPE: Step 4 only.
 * Not included here: readiness/recovery/fatigue, prescribed/performed delta,
 * personalized recommendations, body-map rendering. Those are Step 5+.
 */

import type { WorkoutScoreResult } from "./workoutScoringTypes";
import type { StimulusVector } from "./movementScoringTypes";
import type { RankedEntry } from "./workoutScoringTypes";

// Re-export so consumers have one import location for ranked entries
export type { RankedEntry };

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

/**
 * A single workout entry in the historical collection.
 * Wraps the Step 3 WorkoutScoreResult with the timestamp it was performed.
 */
export interface HistoricalWorkoutInput {
  /** Fully scored workout result from Step 3 scoreWorkout(). */
  workoutResult: WorkoutScoreResult;
  /** When the workout was performed. Used for date range filtering and recency weighting. */
  performedAt: Date;
}

// ---------------------------------------------------------------------------
// Time range
// ---------------------------------------------------------------------------

/**
 * Named time range presets relative to a reference date (typically now).
 * "all" means no date filter — include every workout in the collection.
 */
export type TimeRangePreset =
  | "week"    // 0–7 days ago
  | "month"   // 0–30 days ago
  | "quarter" // 0–90 days ago
  | "year"    // 0–365 days ago
  | "all";    // no filter

/** Custom date range (inclusive on both ends). */
export interface CustomTimeRange {
  start: Date;
  end: Date;
}

// ---------------------------------------------------------------------------
// Recency weighting
// ---------------------------------------------------------------------------

/**
 * A muscle/pattern/stimulus vector whose values have been scaled by a recency
 * weight. Structurally identical to a plain Record<string, number> — the name
 * communicates intent to callers.
 */
export type RecencyWeightedVector = Record<string, number>;

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

/**
 * High-level ranked and comparative summary derived from the aggregate vectors.
 *
 * "underrepresented" means lowest cumulative score relative to others in the
 * selected range. It does NOT imply a universal physiological deficit.
 *
 * "recentlyElevated" / "recentlyReduced" compare recency rank to cumulative
 * rank. A muscle is "elevated" if it ranks higher in the recency view than in
 * the cumulative view, suggesting recent training emphasis.
 */
export interface HistorySummary {
  /** Top muscles by cumulative score in the range. */
  topMusclesCumulative: RankedEntry[];
  /** Top patterns by cumulative exposure in the range. */
  topPatternsCumulative: RankedEntry[];
  /** Top muscles by recency-weighted score. */
  topMusclesRecent: RankedEntry[];
  /** Top patterns by recency-weighted exposure. */
  topPatternsRecent: RankedEntry[];
  /**
   * Muscles with the lowest cumulative scores in the range (ascending order).
   * Length ≤ topN. Useful as a "what has been neglected" view.
   */
  underrepresentedMuscles: RankedEntry[];
  /**
   * Patterns with the lowest cumulative exposures in the range (ascending).
   */
  underrepresentedPatterns: RankedEntry[];
  /** Stimulus dimension with the highest cumulative weighted value. */
  dominantStimulusCumulative: keyof StimulusVector;
  /** Stimulus dimension with the highest recency-weighted value. */
  dominantStimulusRecent: keyof StimulusVector;
  /**
   * Muscle keys whose recency rank is higher (better) than their cumulative rank.
   * Indicates recent training emphasis on these muscles.
   */
  recentlyElevated: string[];
  /**
   * Muscle keys whose recency rank is lower (worse) than their cumulative rank.
   * Indicates these muscles were trained earlier but not recently.
   */
  recentlyReduced: string[];
}

// ---------------------------------------------------------------------------
// Aggregation metadata
// ---------------------------------------------------------------------------

/** Accounting information for the historical rollup. */
export interface HistoryAggregationMetadata {
  /** Total workouts in the input collection (before date filter). */
  totalWorkouts: number;
  /** Workouts within the selected date range (after filter). */
  filteredWorkouts: number;
  /** Start of the effective date range (null for "all" with empty collection). */
  dateRangeStart: Date | null;
  /** End of the effective date range / reference date. */
  dateRangeEnd: Date | null;
  /** Oldest performedAt date in the filtered set (null if empty). */
  oldestWorkout: Date | null;
  /** Newest performedAt date in the filtered set (null if empty). */
  newestWorkout: Date | null;
  /** Sum of fallbackMovements across all filtered workouts. */
  totalFallbackMovements: number;
  /** Number of filtered workouts that contained at least one fallback movement. */
  workoutsWithFallback: number;
}

// ---------------------------------------------------------------------------
// Full result
// ---------------------------------------------------------------------------

/**
 * Complete historical rollup result.
 *
 * Provides both cumulative (plain sum) and recency-weighted views of muscle,
 * pattern, and stimulus data across the selected time range.
 *
 * Consumers should use cumulative for "what has been trained overall" and
 * recency for "what has been trained lately".
 */
export interface HistoricalRollupResult {
  /** Plain sum of all workout muscleVectors in the date range. */
  cumulativeMuscleVector: Record<string, number>;
  /** Plain sum of all workout patternVectors in the date range. */
  cumulativePatternVector: Record<string, number>;
  /**
   * TotalRawScore-weighted average of workout stimulusVectors in the range.
   * High-volume workouts contribute proportionally more.
   */
  cumulativeStimulusVector: StimulusVector;

  /**
   * Sum of workout muscleVectors, each scaled by its recency weight.
   * Recent workouts contribute more than older ones.
   */
  recencyMuscleVector: RecencyWeightedVector;
  /** Sum of workout patternVectors, each scaled by its recency weight. */
  recencyPatternVector: RecencyWeightedVector;
  /**
   * Recency-weight × totalRawScore weighted average of workout stimulusVectors.
   * Recent, high-volume workouts dominate.
   */
  recencyStimulusVector: StimulusVector;

  /** Ranked summaries and comparative emphasis views. */
  summary: HistorySummary;
  /** Accounting metadata for the rollup. */
  metadata: HistoryAggregationMetadata;
}

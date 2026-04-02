/**
 * historyAggregation.ts — Step 4 cross-workout historical rollup engine.
 *
 * Main export: `scoreHistory(workouts, options) → HistoricalRollupResult`
 *
 * Aggregation pipeline:
 *   1. Filter workouts to the selected date range (via timeRange.ts)
 *   2. For each filtered workout, compute its daysAgo and recency weight
 *   3. Sum muscle/pattern vectors cumulatively (plain additive sum)
 *   4. Sum recency-weighted muscle/pattern vectors
 *   5. Compute cumulative stimulus vector as totalRawScore-weighted average
 *   6. Compute recency stimulus vector as (recencyWeight × totalRawScore)-weighted average
 *   7. Generate HistorySummary (via historySummary.ts)
 *   8. Build HistoryAggregationMetadata
 *   9. Return HistoricalRollupResult
 *
 * AGGREGATION PRINCIPLES
 * ----------------------
 * - Cumulative = plain arithmetic sum. Growing with volume is expected.
 * - Recency = sum with day-bucket decay multiplier. Older workouts fade.
 * - Stimulus aggregation uses totalRawScore weighting so high-volume workouts
 *   proportionally influence the aggregate stimulus direction.
 * - Empty input and filtered-to-empty both return safe zero-state results.
 * - All operations are deterministic for identical input + referenceDate.
 *
 * SCOPE: Step 4 only. No readiness. No recovery. No recommendations.
 */

import { filterByTimeRange, daysAgo, getPresetStart } from "./timeRange";
import { getRecencyWeight, applyRecencyWeight } from "./recencyWeighting";
import { sumVectors, weightedAverageStimulusVectors, roundVector } from "./vectorMath";
import { generateHistorySummary } from "./historySummary";
import type {
  HistoricalWorkoutInput,
  HistoricalRollupResult,
  HistoryAggregationMetadata,
  TimeRangePreset,
  CustomTimeRange,
} from "./historyScoringTypes";
import type { StimulusVector } from "./movementScoringTypes";

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface ScoreHistoryOptions {
  /**
   * Date range to include. Accepts a named preset or a custom {start, end}.
   * Defaults to "all" (no filter).
   */
  dateRange?: TimeRangePreset | CustomTimeRange;
  /**
   * Reference "now" — all daysAgo / preset calculations are relative to this.
   * Injectable for deterministic testing. Defaults to new Date().
   */
  referenceDate?: Date;
  /**
   * Number of entries per ranked list in the summary.
   * Defaults to 5.
   */
  topN?: number;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Compute a historical rollup across multiple scored workouts.
 *
 * @param workouts - Collection of HistoricalWorkoutInput (any order, any size)
 * @param options  - Date range, reference date, topN
 * @returns HistoricalRollupResult with cumulative + recency vectors and summary
 */
export function scoreHistory(
  workouts: HistoricalWorkoutInput[],
  options: ScoreHistoryOptions = {}
): HistoricalRollupResult {
  const { dateRange = "all", referenceDate = new Date(), topN = 5 } = options;

  // ── 1. Filter ─────────────────────────────────────────────────────────────
  const filtered = filterByTimeRange(workouts, dateRange, referenceDate);

  // ── 2 + 3 + 4. Iterate and accumulate ────────────────────────────────────
  // Cumulative accumulator (plain additive sum vectors)
  const cumulativeMuscleVectors: Array<Record<string, number>> = [];
  const cumulativePatternVectors: Array<Record<string, number>> = [];
  const cumulativeStimulusVecs: StimulusVector[] = [];
  const cumulativeStimulusWeights: number[] = [];

  // Recency accumulator
  const recencyMuscleVectors: Array<Record<string, number>> = [];
  const recencyPatternVectors: Array<Record<string, number>> = [];
  const recencyStimulusVecs: StimulusVector[] = [];
  const recencyStimulusWeights: number[] = [];

  // Metadata accumulators
  let totalFallbackMovements = 0;
  let workoutsWithFallback = 0;

  for (const entry of filtered) {
    const { workoutResult, performedAt } = entry;
    const days = daysAgo(performedAt, referenceDate);
    const rw = getRecencyWeight(days);
    const totalRawScore = workoutResult.metadata.totalRawScore;

    // Cumulative muscle/pattern (plain — no weighting)
    cumulativeMuscleVectors.push(workoutResult.muscleVector as Record<string, number>);
    cumulativePatternVectors.push(workoutResult.patternVector as Record<string, number>);

    // Cumulative stimulus (weighted by totalRawScore)
    cumulativeStimulusVecs.push(workoutResult.stimulusVector);
    cumulativeStimulusWeights.push(totalRawScore);

    // Recency muscle/pattern (scaled by recency weight before summing)
    recencyMuscleVectors.push(
      applyRecencyWeight(workoutResult.muscleVector as Record<string, number>, rw)
    );
    recencyPatternVectors.push(
      applyRecencyWeight(workoutResult.patternVector as Record<string, number>, rw)
    );

    // Recency stimulus (weighted by recencyWeight × totalRawScore)
    recencyStimulusVecs.push(workoutResult.stimulusVector);
    recencyStimulusWeights.push(rw * totalRawScore);

    // Metadata
    const fb = workoutResult.metadata.fallbackMovements;
    totalFallbackMovements += fb;
    if (fb > 0) workoutsWithFallback++;
  }

  // ── 5. Compute aggregate vectors ──────────────────────────────────────────
  const cumulativeMuscleVector = roundVector(sumVectors(cumulativeMuscleVectors));
  const cumulativePatternVector = roundVector(sumVectors(cumulativePatternVectors));
  const cumulativeStimulusVector = weightedAverageStimulusVectors(
    cumulativeStimulusVecs,
    cumulativeStimulusWeights
  );

  const recencyMuscleVector = roundVector(sumVectors(recencyMuscleVectors));
  const recencyPatternVector = roundVector(sumVectors(recencyPatternVectors));
  const recencyStimulusVector = weightedAverageStimulusVectors(
    recencyStimulusVecs,
    recencyStimulusWeights
  );

  // ── 6. Build metadata ─────────────────────────────────────────────────────
  const oldestEntry = filtered.length > 0 ? filtered[0] : null;
  const newestEntry = filtered.length > 0 ? filtered[filtered.length - 1] : null;

  let rangeStart: Date | null = null;
  if (dateRange === "all") {
    rangeStart = oldestEntry?.performedAt ?? null;
  } else if (typeof dateRange === "string") {
    rangeStart = getPresetStart(dateRange as TimeRangePreset, referenceDate);
  } else {
    rangeStart = (dateRange as CustomTimeRange).start;
  }

  const metadata: HistoryAggregationMetadata = {
    totalWorkouts: workouts.length,
    filteredWorkouts: filtered.length,
    dateRangeStart: rangeStart,
    dateRangeEnd: filtered.length > 0 ? referenceDate : null,
    oldestWorkout: oldestEntry?.performedAt ?? null,
    newestWorkout: newestEntry?.performedAt ?? null,
    totalFallbackMovements,
    workoutsWithFallback,
  };

  // ── 7. Generate summary ───────────────────────────────────────────────────
  const summary = generateHistorySummary(
    cumulativeMuscleVector,
    cumulativePatternVector,
    cumulativeStimulusVector,
    recencyMuscleVector,
    recencyPatternVector,
    recencyStimulusVector,
    topN
  );

  // ── 8. Return ─────────────────────────────────────────────────────────────
  return {
    cumulativeMuscleVector,
    cumulativePatternVector,
    cumulativeStimulusVector,
    recencyMuscleVector,
    recencyPatternVector,
    recencyStimulusVector,
    summary,
    metadata,
  };
}

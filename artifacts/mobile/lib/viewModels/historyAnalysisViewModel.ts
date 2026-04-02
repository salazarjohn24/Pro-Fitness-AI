/**
 * historyAnalysisViewModel.ts — Steps 6–9 presentation model for training history.
 *
 * Transforms the combined output of Step 4 (HistoricalRollupResult) and
 * Step 5 (InsightGenerationResult) into a UI-ready display model for the
 * history summary surface.
 *
 * Input:  { rollup, insights } from GET /api/training/history-analysis
 * Output: HistoryAnalysisDisplayModel (ready for RN components)
 *
 * Design rules:
 *   - Pure functions — no React, no network calls.
 *   - Handle null / empty / sparse states gracefully.
 *   - Insight cards are ordered by severity descending (as delivered by the API).
 *   - Muscle/pattern labels go through trainingDisplay.ts.
 *   - No new prescriptive language introduced here.
 *   - dataConfidence surfaces the fallback-workout ratio as a single signal
 *     for trust-level decisions (parallel to workoutAnalysisViewModel.ts).
 */

import { muscleLabel, patternLabel, stimulusLabel, severityTier } from "../formatters/trainingDisplay";

// ---------------------------------------------------------------------------
// Quality thresholds — exported so tests can import them directly
// ---------------------------------------------------------------------------

/**
 * Minimum workout count for the history overview to have enough data to
 * draw meaningful inferences (e.g. trend arrows, insight comparisons).
 */
export const HISTORY_MIN_WORKOUTS_FOR_DATA = 2;

/**
 * Fallback-workout ratio at or above which a strong history quality note is shown.
 */
export const HISTORY_QUALITY_NOTE_HIGH_THRESHOLD = 0.5;

/**
 * Fallback-workout ratio at or above which a moderate history quality note is shown.
 */
export const HISTORY_QUALITY_NOTE_LOW_THRESHOLD = 0.25;

// ---------------------------------------------------------------------------
// Input mirror types (JSON shape from API)
// ---------------------------------------------------------------------------

export interface RankedEntryJSON {
  key: string;
  score: number;
  rank: number;
}

export interface RecentlyShiftedEntry {
  key: string;
  cumulativeRank: number;
  recentRank: number;
  rankDelta: number;
}

export interface HistoricalRollupResultJSON {
  cumulativeMuscleVector: Record<string, number>;
  cumulativePatternVector: Record<string, number>;
  cumulativeStimulusVector: Record<string, number>;
  recencyMuscleVector: Record<string, number>;
  recencyPatternVector: Record<string, number>;
  summary: {
    topMusclesCumulative: RankedEntryJSON[];
    topPatternsCumulative: RankedEntryJSON[];
    topMusclesRecent: RankedEntryJSON[];
    topPatternsRecent: RankedEntryJSON[];
    underrepresentedMuscles: RankedEntryJSON[];
    underrepresentedPatterns: RankedEntryJSON[];
    dominantStimulusCumulative: string;
    dominantStimulusRecent: string;
    recentlyElevated: RecentlyShiftedEntry[];
    recentlyReduced: RecentlyShiftedEntry[];
  };
  metadata: {
    filteredWorkouts: number;
    totalWorkouts: number;
    workoutsWithFallback: number;
    totalFallbackMovements: number;
    oldestWorkoutDate: string | null;
    newestWorkoutDate: string | null;
  };
}

export interface InsightJSON {
  type: string;
  severity: "info" | "low" | "moderate" | "high";
  subject: string;
  text: string;
  evidence?: string;
}

export interface InsightSummaryJSON {
  headline: string;
  observations: string[];
}

export interface InsightGenerationResultJSON {
  insights: InsightJSON[];
  summary: InsightSummaryJSON;
  rangeLabel: string;
  workoutCount: number;
}

// ---------------------------------------------------------------------------
// Output model
// ---------------------------------------------------------------------------

export interface MuscleSummaryRow {
  key: string;
  label: string;
  isElevatedRecently: boolean;
  isReducedRecently: boolean;
}

export interface PatternSummaryRow {
  key: string;
  label: string;
}

export interface InsightCard {
  type: string;
  severity: InsightJSON["severity"];
  severityTier: "neutral" | "soft" | "medium" | "strong";
  subject: string;
  text: string;
  evidence?: string;
}

export interface RecentShiftRow {
  key: string;
  label: string;
  direction: "elevated" | "reduced";
  rankDelta: number;
}

/**
 * Confidence in the history analysis result.
 *
 * "high"   — Few or no workouts used fallback patterns (<25% of workouts).
 * "medium" — Some workouts used fallback patterns (≥25% and <50%).
 * "low"    — Most workouts used fallback patterns (≥50%).
 */
export type HistoryDataConfidence = "high" | "medium" | "low";

export interface HistoryAnalysisDisplayModel {
  headline: string;
  rangeLabel: string;
  workoutCount: number;
  /**
   * True when there are enough workouts to make inferences meaningful.
   * Set by the HISTORY_MIN_WORKOUTS_FOR_DATA threshold.
   */
  hasEnoughData: boolean;
  /** Single-signal quality tier for trust-level UI decisions. */
  dataConfidence: HistoryDataConfidence;

  topMuscles: MuscleSummaryRow[];
  topPatterns: PatternSummaryRow[];
  dominantStimulus: string;

  recentShifts: RecentShiftRow[];

  insightCards: InsightCard[];
  dataQualityNote: string | null;
  summaryObservations: string[];
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

export const EMPTY_HISTORY_ANALYSIS: HistoryAnalysisDisplayModel = {
  headline: "No workout data for this range",
  rangeLabel: "",
  workoutCount: 0,
  hasEnoughData: false,
  dataConfidence: "high",
  topMuscles: [],
  topPatterns: [],
  dominantStimulus: "—",
  recentShifts: [],
  insightCards: [],
  dataQualityNote: null,
  summaryObservations: [],
};

// ---------------------------------------------------------------------------
// Main transform
// ---------------------------------------------------------------------------

/**
 * Build a HistoryAnalysisDisplayModel from the combined API response.
 * Safe for null / undefined input — returns EMPTY_HISTORY_ANALYSIS.
 */
export function buildHistoryAnalysisViewModel(
  rollup: HistoricalRollupResultJSON | null | undefined,
  insights: InsightGenerationResultJSON | null | undefined
): HistoryAnalysisDisplayModel {
  if (!rollup || !insights) return { ...EMPTY_HISTORY_ANALYSIS };

  const { summary, metadata } = rollup;
  const workoutCount = insights.workoutCount ?? metadata.filteredWorkouts;

  if (workoutCount === 0) {
    return {
      ...EMPTY_HISTORY_ANALYSIS,
      headline: insights.summary.headline,
      rangeLabel: insights.rangeLabel,
    };
  }

  const elevatedKeys = new Set(summary.recentlyElevated.map((e) => e.key));
  const reducedKeys  = new Set(summary.recentlyReduced.map((e) => e.key));

  const topMuscles: MuscleSummaryRow[] = summary.topMusclesCumulative.map((m) => ({
    key:               m.key,
    label:             muscleLabel(m.key),
    isElevatedRecently: elevatedKeys.has(m.key),
    isReducedRecently:  reducedKeys.has(m.key),
  }));

  const topPatterns: PatternSummaryRow[] = summary.topPatternsCumulative.map((p) => ({
    key:   p.key,
    label: patternLabel(p.key),
  }));

  const recentShifts: RecentShiftRow[] = [
    ...summary.recentlyElevated.map((e): RecentShiftRow => ({
      key:       e.key,
      label:     muscleLabel(e.key),
      direction: "elevated",
      rankDelta: Math.abs(e.rankDelta),
    })),
    ...summary.recentlyReduced.map((e): RecentShiftRow => ({
      key:       e.key,
      label:     muscleLabel(e.key),
      direction: "reduced",
      rankDelta: Math.abs(e.rankDelta),
    })),
  ].sort((a, b) => b.rankDelta - a.rankDelta);

  const allInsightCards: InsightCard[] = insights.insights.map((ins) => ({
    type:          ins.type,
    severity:      ins.severity,
    severityTier:  severityTier(ins.severity),
    subject:       ins.subject,
    text:          ins.text,
    evidence:      ins.evidence,
  }));

  const dataQualityCard = allInsightCards.find((c) => c.type === "data_quality_note");
  const dataQualityNote = dataQualityCard?.text ?? buildDataQualityNote(metadata);
  const insightCards = allInsightCards.filter((c) => c.type !== "data_quality_note");
  const dataConfidence = computeDataConfidence(metadata);

  return {
    headline:   insights.summary.headline,
    rangeLabel: insights.rangeLabel,
    workoutCount,
    hasEnoughData: workoutCount >= HISTORY_MIN_WORKOUTS_FOR_DATA,
    dataConfidence,

    topMuscles,
    topPatterns,
    dominantStimulus: stimulusLabel(summary.dominantStimulusCumulative),

    recentShifts,

    insightCards,
    dataQualityNote,
    summaryObservations: insights.summary.observations,
  };
}

// ---------------------------------------------------------------------------
// Data confidence
// ---------------------------------------------------------------------------

function computeDataConfidence(
  metadata: HistoricalRollupResultJSON["metadata"]
): HistoryDataConfidence {
  if (metadata.filteredWorkouts === 0) return "high"; // vacuously; empty state guards this
  if (metadata.workoutsWithFallback === 0) return "high";
  const rate = metadata.workoutsWithFallback / metadata.filteredWorkouts;
  if (rate >= HISTORY_QUALITY_NOTE_HIGH_THRESHOLD) return "low";
  return "medium";
}

// ---------------------------------------------------------------------------
// Inline data quality note (fallback when no card emitted)
// ---------------------------------------------------------------------------

/**
 * Produce a data-quality note when the fallback-workout ratio warrants it.
 *
 * Uses "generic patterns" rather than "not recognised" to avoid
 * implying that users need to do something to fix it.
 */
function buildDataQualityNote(
  metadata: HistoricalRollupResultJSON["metadata"]
): string | null {
  if (metadata.totalFallbackMovements === 0) return null;
  const rate = metadata.filteredWorkouts > 0
    ? metadata.workoutsWithFallback / metadata.filteredWorkouts
    : 0;
  if (rate >= HISTORY_QUALITY_NOTE_HIGH_THRESHOLD) {
    return "Many movements in this range used generic patterns — muscle trends may be estimated.";
  }
  if (rate >= HISTORY_QUALITY_NOTE_LOW_THRESHOLD) {
    return "Some movements in this range used generic patterns — muscle detail may be approximate.";
  }
  return null;
}

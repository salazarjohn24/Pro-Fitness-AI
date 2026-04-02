/**
 * historyAnalysisViewModel.ts — Step 6 presentation model for training history.
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
 */

import { muscleLabel, patternLabel, stimulusLabel, severityTier } from "../formatters/trainingDisplay";

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

export interface HistoryAnalysisDisplayModel {
  headline: string;
  rangeLabel: string;
  workoutCount: number;
  hasEnoughData: boolean;

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

  return {
    headline:   insights.summary.headline,
    rangeLabel: insights.rangeLabel,
    workoutCount,
    hasEnoughData: workoutCount >= 2,

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
// Inline data quality note (fallback when no card emitted)
// ---------------------------------------------------------------------------

function buildDataQualityNote(
  metadata: HistoricalRollupResultJSON["metadata"]
): string | null {
  if (metadata.totalFallbackMovements === 0) return null;
  const rate = metadata.filteredWorkouts > 0
    ? metadata.workoutsWithFallback / metadata.filteredWorkouts
    : 0;
  if (rate >= 0.5) {
    return "A high proportion of movements in this range weren't recognised — muscle detail may be limited.";
  }
  if (rate >= 0.25) {
    return "Some movements weren't recognised — full muscle detail may not be available.";
  }
  return null;
}

/**
 * workoutAnalysisViewModel.ts — Steps 6–9 presentation model for a single workout.
 *
 * Transforms a WorkoutScoreResult (Step 3 output) into a UI-ready display
 * model. All scoring concerns stay in the backend — this file only formats
 * and labels existing outputs.
 *
 * Input:  WorkoutScoreResult (from GET /api/workouts/sessions/:id/analysis
 *                             or  GET /api/workouts/external/:id/analysis)
 * Output: WorkoutAnalysisDisplayModel (ready for RN components)
 *
 * Design rules:
 *   - Pure functions only — no React, no network calls.
 *   - Handle null / empty / low-data states without throwing.
 *   - All display text sourced from trainingDisplay.ts formatters.
 *   - No prescriptive language introduced here.
 *   - analysisConfidence is derived from the fallback ratio and gives the
 *     screen a single signal for trust-level decisions.
 *   - Coexistence rule: when hasAnalysis=true, the screen must not show
 *     duplicate coarse fields (e.g. stimulusPoints) that contradict the
 *     premium stimulus chip. See workout-detail.tsx comment block.
 */

import { muscleLabel, patternLabel, stimulusLabel, roundScore } from "../formatters/trainingDisplay";

// ---------------------------------------------------------------------------
// Quality thresholds — exported so tests can import them directly
// ---------------------------------------------------------------------------

/**
 * Fallback ratio at or above which a strong quality note is shown (≥50% fallback).
 */
export const QUALITY_NOTE_HIGH_THRESHOLD = 0.5;

/**
 * Fallback ratio at or above which a moderate quality note is shown (≥20% fallback).
 */
export const QUALITY_NOTE_LOW_THRESHOLD = 0.2;

// ---------------------------------------------------------------------------
// Input mirror types (matching api-server's WorkoutScoreResult JSON shape)
// These are intentionally loose so the mobile app doesn't need to import
// from the api-server package directly.
// ---------------------------------------------------------------------------

export interface RankedEntry {
  key: string;
  score: number;
  rank: number;
}

export interface WorkoutScoreResultJSON {
  workoutName?: string;
  workoutType?: string;
  muscleVector: Record<string, number>;
  patternVector: Record<string, number>;
  stimulusVector: Record<string, number>;
  summary: {
    topMuscles: RankedEntry[];
    topPatterns: RankedEntry[];
    dominantStimulus: string;
    presentStimuli: { stimulus: string; value: number }[];
  };
  metadata: {
    totalMovements: number;
    scoredMovements: number;
    fallbackMovements: number;
    fallbackMovementNames: string[];
    totalRawScore: number;
  };
}

// ---------------------------------------------------------------------------
// Output model
// ---------------------------------------------------------------------------

export interface WorkoutMuscleRow {
  key: string;
  label: string;
  score: number;
  rank: number;
}

export interface WorkoutPatternRow {
  key: string;
  label: string;
  score: number;
  rank: number;
}

export interface WorkoutStimulusRow {
  key: string;
  label: string;
  value: number;
  dominant: boolean;
}

export interface WorkoutAnalysisSection {
  title: string;
  items: string[];
}

/**
 * Confidence in the analysis result.
 *
 * "high"   — All movements were recognised (0% fallback).
 * "medium" — Some movements used generic patterns (>0% and <50% fallback).
 * "low"    — Most or all movements used generic patterns (≥50% fallback).
 *
 * Only meaningful when hasAnalysis=true.
 */
export type AnalysisConfidence = "high" | "medium" | "low";

export interface WorkoutAnalysisDisplayModel {
  headline: string;
  topMuscles: WorkoutMuscleRow[];
  topPatterns: WorkoutPatternRow[];
  dominantStimulus: WorkoutStimulusRow;
  presentStimuli: WorkoutStimulusRow[];
  dataQualityNote: string | null;
  movementCount: number;
  scoredCount: number;
  fallbackCount: number;
  /** Single-signal quality tier for trust-level UI decisions. */
  analysisConfidence: AnalysisConfidence;
  hasAnalysis: boolean;
  sections: WorkoutAnalysisSection[];
}

// ---------------------------------------------------------------------------
// State for low / empty data
// ---------------------------------------------------------------------------

export const EMPTY_WORKOUT_ANALYSIS: WorkoutAnalysisDisplayModel = {
  headline: "No workout data to analyse",
  topMuscles: [],
  topPatterns: [],
  dominantStimulus: { key: "", label: "—", value: 0, dominant: true },
  presentStimuli: [],
  dataQualityNote: null,
  movementCount: 0,
  scoredCount: 0,
  fallbackCount: 0,
  analysisConfidence: "high",
  hasAnalysis: false,
  sections: [],
};

// ---------------------------------------------------------------------------
// Main transform
// ---------------------------------------------------------------------------

/**
 * Build a WorkoutAnalysisDisplayModel from a raw API response.
 * Safe for null / undefined input — returns EMPTY_WORKOUT_ANALYSIS.
 */
export function buildWorkoutAnalysisViewModel(
  result: WorkoutScoreResultJSON | null | undefined
): WorkoutAnalysisDisplayModel {
  if (!result) return { ...EMPTY_WORKOUT_ANALYSIS };

  const { summary, metadata } = result;

  if (metadata.totalMovements === 0) return { ...EMPTY_WORKOUT_ANALYSIS };

  const topMuscles: WorkoutMuscleRow[] = summary.topMuscles.map((m) => ({
    key:   m.key,
    label: muscleLabel(m.key),
    score: roundScore(m.score),
    rank:  m.rank,
  }));

  const topPatterns: WorkoutPatternRow[] = summary.topPatterns.map((p) => ({
    key:   p.key,
    label: patternLabel(p.key),
    score: roundScore(p.score),
    rank:  p.rank,
  }));

  const presentStimuli: WorkoutStimulusRow[] = summary.presentStimuli.map((s) => ({
    key:      s.stimulus,
    label:    stimulusLabel(s.stimulus),
    value:    roundScore(s.value),
    dominant: s.stimulus === summary.dominantStimulus,
  }));

  const dominantKey  = summary.dominantStimulus;
  const dominantRow  = presentStimuli.find((s) => s.key === dominantKey) ?? {
    key:     dominantKey,
    label:   stimulusLabel(dominantKey),
    value:   roundScore(result.stimulusVector[dominantKey] ?? 0),
    dominant: true,
  };

  const headline = buildWorkoutHeadline(topPatterns, dominantRow, metadata.totalMovements, presentStimuli.length > 0);
  const dataQualityNote = buildDataQualityNote(metadata);
  const confidence = computeAnalysisConfidence(metadata);
  const sections = buildSections(topMuscles, topPatterns, dominantRow);

  return {
    headline,
    topMuscles,
    topPatterns,
    dominantStimulus: dominantRow,
    presentStimuli,
    dataQualityNote,
    movementCount: metadata.totalMovements,
    scoredCount:   metadata.scoredMovements,
    fallbackCount: metadata.fallbackMovements,
    analysisConfidence: confidence,
    hasAnalysis: true,
    sections,
  };
}

// ---------------------------------------------------------------------------
// Headline
// ---------------------------------------------------------------------------

function buildWorkoutHeadline(
  patterns: WorkoutPatternRow[],
  stimulus: WorkoutStimulusRow,
  totalMovements: number,
  hasPresentStimuli: boolean
): string {
  if (totalMovements === 0) return "No workout data to analyse";

  const topPattern = patterns[0];
  const patternPart = topPattern ? topPattern.label : null;
  const stimPart    = (stimulus.key && hasPresentStimuli) ? `${stimulus.label}-forward` : null;

  if (patternPart && stimPart) return `${patternPart} · ${stimPart}`;
  if (patternPart) return patternPart;
  if (stimPart)    return stimPart;
  return "Mixed session";
}

// ---------------------------------------------------------------------------
// Analysis confidence
// ---------------------------------------------------------------------------

/**
 * Derive a confidence level from the fallback ratio.
 *
 * Thresholds use the exported constants above so tests can assert them
 * without hardcoding magic numbers.
 */
function computeAnalysisConfidence(
  metadata: WorkoutScoreResultJSON["metadata"]
): AnalysisConfidence {
  if (metadata.totalMovements === 0) return "high"; // vacuously, but hasAnalysis=false guards this
  if (metadata.fallbackMovements === 0) return "high";
  const rate = metadata.fallbackMovements / metadata.totalMovements;
  if (rate >= QUALITY_NOTE_HIGH_THRESHOLD) return "low";
  return "medium";
}

// ---------------------------------------------------------------------------
// Data quality note
// ---------------------------------------------------------------------------

/**
 * Produce a data-quality note when the fallback ratio warrants it.
 *
 * Uses "generic patterns" rather than "not in the library" to avoid
 * implying that users need to add exercises somewhere.
 */
function buildDataQualityNote(metadata: WorkoutScoreResultJSON["metadata"]): string | null {
  if (metadata.fallbackMovements === 0) return null;

  const rate = metadata.totalMovements > 0
    ? metadata.fallbackMovements / metadata.totalMovements
    : 0;

  const fb    = metadata.fallbackMovements;
  const total = metadata.totalMovements;
  const unit  = total === 1 ? "movement" : "movements";

  if (rate >= QUALITY_NOTE_HIGH_THRESHOLD) {
    return `${fb} of ${total} ${unit} used generic patterns — muscle targets are estimated.`;
  }
  if (rate >= QUALITY_NOTE_LOW_THRESHOLD) {
    return `Some movements used generic patterns — muscle detail may be approximate.`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Sections (card-ready groupings)
// ---------------------------------------------------------------------------

function buildSections(
  muscles: WorkoutMuscleRow[],
  patterns: WorkoutPatternRow[],
  stimulus: WorkoutStimulusRow
): WorkoutAnalysisSection[] {
  const sections: WorkoutAnalysisSection[] = [];

  if (muscles.length > 0) {
    sections.push({
      title: "Muscles emphasised",
      items: muscles.slice(0, 5).map((m) => m.label),
    });
  }

  if (patterns.length > 0) {
    sections.push({
      title: "Movement patterns",
      items: patterns.slice(0, 4).map((p) => p.label),
    });
  }

  if (stimulus.key) {
    sections.push({
      title: "Training stimulus",
      items: [stimulus.label],
    });
  }

  return sections;
}

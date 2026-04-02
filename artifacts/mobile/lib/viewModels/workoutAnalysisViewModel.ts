/**
 * workoutAnalysisViewModel.ts — Step 6 presentation model for a single workout.
 *
 * Transforms a WorkoutScoreResult (Step 3 output) into a UI-ready display
 * model. All scoring concerns stay in the backend — this file only formats
 * and labels existing outputs.
 *
 * Input:  WorkoutScoreResult (from GET /api/workouts/sessions/:id/analysis)
 * Output: WorkoutAnalysisDisplayModel (ready for RN components)
 *
 * Design rules:
 *   - Pure functions only — no React, no network calls.
 *   - Handle null / empty / low-data states without throwing.
 *   - All display text sourced from trainingDisplay.ts formatters.
 *   - No prescriptive language introduced here.
 */

import { muscleLabel, patternLabel, stimulusLabel, roundScore } from "../formatters/trainingDisplay";

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
// Data quality note
// ---------------------------------------------------------------------------

function buildDataQualityNote(metadata: WorkoutScoreResultJSON["metadata"]): string | null {
  if (metadata.fallbackMovements === 0) return null;

  const rate = metadata.totalMovements > 0
    ? metadata.fallbackMovements / metadata.totalMovements
    : 0;

  if (rate >= 0.5) {
    return `${metadata.fallbackMovements} of ${metadata.totalMovements} movement${metadata.totalMovements !== 1 ? "s" : ""} weren't in the library — muscle detail may be limited.`;
  }
  if (rate >= 0.2) {
    return `Some movements weren't recognised — full muscle breakdown may not be available.`;
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

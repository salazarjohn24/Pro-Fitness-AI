/**
 * appleHealthActivityViewModel.ts
 *
 * Transforms an ActivityBasedAnalysisResult (from the Apple Health activity
 * analysis endpoint) into a WorkoutAnalysisDisplayModel for rendering in the
 * existing WorkoutAnalysisPanel component.
 *
 * Design rules:
 *   - Pure functions — no React, no network calls.
 *   - Reuses WorkoutAnalysisDisplayModel so WorkoutAnalysisPanel renders it
 *     without modification.
 *   - Muscle emphasis areas use broad keys (lower_body, full_body, …) which
 *     gracefully humanize via muscleLabel().
 *   - Confidence is always "medium" or "low" — never "high" for activity-only.
 *   - Trust note from the server appears as dataQualityNote (existing note slot).
 *
 * @see appleHealthActivityAnalysis.ts (server-side mapping)
 * @see workoutAnalysisViewModel.ts    (parallel full-analysis VM)
 */

import { muscleLabel, patternLabel, stimulusLabel, roundScore } from "../formatters/trainingDisplay";
import type {
  WorkoutAnalysisDisplayModel,
  WorkoutMuscleRow,
  WorkoutPatternRow,
  WorkoutStimulusRow,
  WorkoutAnalysisSection,
  AnalysisConfidence,
} from "./workoutAnalysisViewModel";

// ---------------------------------------------------------------------------
// Input type — mirrors the server ActivityBasedAnalysisResult shape
// ---------------------------------------------------------------------------

export interface ActivityHintPayload {
  dominantPattern: string;
  muscleEmphasisAreas: string[];
  stimulusBias: string;
  confidenceTier: "medium" | "low";
  trustNote: string;
}

export interface ActivitySummaryPayload {
  label: string;
  durationMinutes: number;
  workoutType: string;
  source: string;
  workoutDate: string | null;
}

/**
 * The response shape returned by the analysis route for Apple Health workouts.
 * Carried through the mobile hook as-is.
 */
export interface ActivityBasedAnalysisResult {
  analysisKind: "activity-based";
  activityHint: ActivityHintPayload;
  activitySummary: ActivitySummaryPayload;
}

// ---------------------------------------------------------------------------
// Type guard
// ---------------------------------------------------------------------------

/**
 * Returns true when the value is an ActivityBasedAnalysisResult.
 * Used in workout-detail.tsx to branch between movement-based and
 * activity-based analysis VMs.
 */
export function isActivityBasedAnalysis(
  data: unknown
): data is ActivityBasedAnalysisResult {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as Record<string, unknown>)["analysisKind"] === "activity-based"
  );
}

// ---------------------------------------------------------------------------
// Synthetic score weights for emphasis areas
// ---------------------------------------------------------------------------

/**
 * Assign descending synthetic scores to ordered emphasis areas.
 * Primary area = 1.0; each subsequent area decays by 0.2 (min 0.2).
 */
function syntheticScore(index: number): number {
  return Math.max(0.2, roundScore(1.0 - index * 0.2));
}

// ---------------------------------------------------------------------------
// Headline builder
// ---------------------------------------------------------------------------

function buildActivityHeadline(
  dominantPattern: string,
  stimulusBias: string
): string {
  const patternPart  = patternLabel(dominantPattern);
  const stimulusPart = stimulusLabel(stimulusBias);
  if (patternPart && stimulusPart) {
    return `${patternPart} · ${stimulusPart}-forward`;
  }
  return patternPart || "Activity-based estimate";
}

// ---------------------------------------------------------------------------
// Main transform
// ---------------------------------------------------------------------------

/**
 * Build a WorkoutAnalysisDisplayModel from an ActivityBasedAnalysisResult.
 *
 * The resulting model is compatible with WorkoutAnalysisPanel.  Key
 * differences from a movement-based model:
 *   - movementCount / scoredCount / fallbackCount are all 0 (no movement data).
 *   - hasAnalysis is true (this IS a useful analysis, just activity-level).
 *   - analysisConfidence is always "low" or "medium" (never "high").
 *   - dataQualityNote carries the trust note from the server.
 *   - topMuscles use broad area keys, not specific muscle keys.
 *
 * Exported for unit testing.
 */
export function buildAppleHealthActivityViewModel(
  result: ActivityBasedAnalysisResult
): WorkoutAnalysisDisplayModel {
  const { activityHint: hint } = result;

  // --- Muscle rows (broad areas, synthetic scores) ---
  const topMuscles: WorkoutMuscleRow[] = hint.muscleEmphasisAreas.map(
    (key, idx) => ({
      key,
      label: muscleLabel(key),
      score: syntheticScore(idx),
      rank:  idx + 1,
    })
  );

  // --- Pattern rows ---
  const topPatterns: WorkoutPatternRow[] = [
    {
      key:   hint.dominantPattern,
      label: patternLabel(hint.dominantPattern),
      score: 1.0,
      rank:  1,
    },
  ];

  // --- Stimulus ---
  const dominantStimulus: WorkoutStimulusRow = {
    key:      hint.stimulusBias,
    label:    stimulusLabel(hint.stimulusBias),
    value:    1.0,
    dominant: true,
  };
  const presentStimuli: WorkoutStimulusRow[] = [dominantStimulus];

  // --- Headline ---
  const headline = buildActivityHeadline(hint.dominantPattern, hint.stimulusBias);

  // --- Confidence ---
  const analysisConfidence: AnalysisConfidence = hint.confidenceTier;

  // --- Sections ---
  const sections: WorkoutAnalysisSection[] = [];
  if (topMuscles.length > 0) {
    sections.push({
      title: "Estimated muscle areas",
      items: topMuscles.map((m) => m.label),
    });
  }
  sections.push({
    title: "Movement pattern",
    items: topPatterns.map((p) => p.label),
  });
  sections.push({
    title: "Training stimulus",
    items: [dominantStimulus.label],
  });

  return {
    headline,
    topMuscles,
    topPatterns,
    dominantStimulus,
    presentStimuli,
    dataQualityNote: hint.trustNote,
    movementCount:    0,
    scoredCount:      0,
    fallbackCount:    0,
    analysisConfidence,
    hasAnalysis:      true,
    sections,
  };
}

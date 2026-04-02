/**
 * insightText.ts — Step 5 safe, human-readable text generation.
 *
 * Pure text-generation module. Takes an InsightType + subject + optional
 * context and returns a sentence that is:
 *   - relative ("has been elevated"), never absolute ("is overtrained")
 *   - descriptive, never prescriptive ("should train X more")
 *   - conservative when data is weak
 *
 * DESIGN PRINCIPLES
 * -----------------
 * - No physiology claims (no "fatigued", "recovered", "overtrained")
 * - No future recommendations ("should", "needs to", "must")
 * - Always scoped to "the selected range" or "relative to other muscles"
 * - All functions return plain strings — no JSX, no markdown
 *
 * SCOPE: Step 5 only.
 */

import type { InsightType } from "./insightTypes";

// ---------------------------------------------------------------------------
// Display name maps
// ---------------------------------------------------------------------------

const MUSCLE_DISPLAY: Record<string, string> = {
  quads:           "Quadriceps",
  hamstrings:      "Hamstrings",
  glutes:          "Glutes",
  calves:          "Calves",
  hip_flexors:     "Hip flexors",
  adductors:       "Adductors",
  upper_back_lats: "Upper back / lats",
  lower_back:      "Lower back",
  chest:           "Chest",
  shoulders:       "Shoulders",
  triceps:         "Triceps",
  biceps:          "Biceps",
  forearms:        "Forearms",
  core:            "Core",
  traps:           "Traps",
};

const PATTERN_DISPLAY: Record<string, string> = {
  squat:            "squat-pattern",
  hinge:            "hinge-pattern",
  vertical_push:    "vertical pushing",
  horizontal_push:  "horizontal pushing",
  vertical_pull:    "vertical pulling",
  horizontal_pull:  "horizontal pulling",
  olympic_lift:     "olympic lifting",
  jump:             "jumping / plyometric",
  cyclical:         "cyclical / conditioning",
  core_bracing:     "core bracing",
  gymnastics:       "gymnastics",
  carry:            "loaded carry",
};

const STIMULUS_DISPLAY: Record<string, string> = {
  strength:           "strength",
  hypertrophy:        "hypertrophy",
  muscular_endurance: "muscular endurance",
  power:              "power",
  conditioning:       "conditioning",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function muscleDisplay(key: string): string {
  return MUSCLE_DISPLAY[key] ?? key.replace(/_/g, " ");
}

export function patternDisplay(key: string): string {
  return PATTERN_DISPLAY[key] ?? key.replace(/_/g, " ");
}

export function stimulusDisplay(key: string): string {
  return STIMULUS_DISPLAY[key] ?? key.replace(/_/g, " ");
}

// ---------------------------------------------------------------------------
// Text templates
// ---------------------------------------------------------------------------

/**
 * Generate the user-facing sentence for a given InsightType and subject.
 *
 * @param type    - The insight category
 * @param subject - The primary entity (muscle key, pattern key, stimulus key, or compound)
 * @param context - Optional additional string interpolated into some templates
 */
export function insightText(
  type: InsightType,
  subject: string,
  context?: string
): string {
  switch (type) {
    case "recently_elevated_muscle":
      return `${muscleDisplay(subject)} loading has been elevated recently relative to the selected range.`;

    case "recently_reduced_muscle":
      return `${muscleDisplay(subject)} loading has been less prominent recently compared to the overall period.`;

    case "underrepresented_muscle":
      return `${muscleDisplay(subject)} loading has been less emphasized relative to other muscle groups in this timeframe.`;

    case "underrepresented_pattern":
      return `${patternDisplay(subject)} has received less exposure than most other movement patterns in this period.`;

    case "dominant_pattern_bias":
      return `Training has leaned toward ${patternDisplay(subject)} work over this range.`;

    case "dominant_stimulus_bias":
      return `The selected range shows a ${stimulusDisplay(subject)}-forward training emphasis.`;

    case "balance_observation":
      // `subject` carries the compound label; `context` optionally refines it
      return subject; // balance text is pre-composed in historyInsights.ts

    case "data_quality_note":
      if (context === "high") {
        return "A high proportion of movements were unrecognised — muscle data may be significantly incomplete for this range.";
      }
      return "Some movements were unrecognised — muscle data may be partially incomplete for this range.";

    default:
      return subject;
  }
}

// ---------------------------------------------------------------------------
// Headline and observation generators
// ---------------------------------------------------------------------------

/**
 * Generate a one-sentence headline characterising the training period.
 *
 * Uses the dominant pattern and stimulus from the rollup summary. Falls back
 * gracefully when data is sparse.
 */
export function generateHeadline(
  dominantPattern: string | null,
  dominantStimulus: string | null,
  workoutCount: number,
  rangeLabel: string
): string {
  if (workoutCount === 0) {
    return `No workout data found for the ${rangeLabel}.`;
  }
  if (workoutCount === 1) {
    return `Only one workout recorded in the ${rangeLabel} — observations reflect that session only.`;
  }
  if (dominantPattern && dominantStimulus) {
    const pName = patternDisplay(dominantPattern);
    const sName = stimulusDisplay(dominantStimulus);
    return `Over the ${rangeLabel}, training leaned toward ${pName} movements with a ${sName}-forward emphasis.`;
  }
  if (dominantPattern) {
    return `Over the ${rangeLabel}, training leaned toward ${patternDisplay(dominantPattern)} movements.`;
  }
  if (dominantStimulus) {
    return `Training over the ${rangeLabel} showed a ${stimulusDisplay(dominantStimulus)}-forward emphasis.`;
  }
  return `${workoutCount} workout${workoutCount !== 1 ? "s" : ""} recorded in the ${rangeLabel}.`;
}

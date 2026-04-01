/**
 * workoutSummary.ts — Ranked summary generation from aggregate workout vectors.
 *
 * Pure module: takes the three aggregate vectors produced by workoutVector.ts
 * and returns a WorkoutSummary with:
 *   - topMuscles:      top N muscles ranked by aggregate score
 *   - topPatterns:     top N patterns ranked by cumulative rawScore
 *   - dominantStimulus: the single highest stimulus dimension
 *   - presentStimuli:  all stimulus dimensions above threshold, ranked
 *
 * DESIGN PRINCIPLES
 * -----------------
 * - No physiology heuristics here — only ranking and filtering of vectors
 *   that were already computed with domain knowledge in Step 2.
 * - DEFAULT_TOP_N = 5 balances readability with completeness.
 * - STIMULUS_PRESENCE_THRESHOLD = 0.40: a stimulus value must be 0.40+ to
 *   count as meaningfully "present" in the workout. Below that it's background
 *   noise from the weighted average.
 * - All outputs are deterministic for the same input (alpha tie-breaks).
 *
 * SCOPE: Step 3 only. No historical context. No fatigue signals.
 */

import { rankEntries, dominantStimulusKey } from "./vectorMath";
import type { WorkoutMuscleVector, WorkoutPatternVector, WorkoutSummary } from "./workoutScoringTypes";
import type { StimulusVector } from "./movementScoringTypes";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_TOP_N = 5;

/**
 * A stimulus dimension must score at or above this threshold to be listed
 * in `presentStimuli`. Values below 0.40 are considered incidental.
 */
export const STIMULUS_PRESENCE_THRESHOLD = 0.40;

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Generate the human-usable ranked summary from aggregate workout vectors.
 *
 * @param muscleVector   - Summed muscle scores from workoutVector.ts
 * @param patternVector  - Per-pattern cumulative rawScore from workoutVector.ts
 * @param stimulusVector - RawScore-weighted average stimulus from workoutVector.ts
 * @param topN           - Max entries per ranked list (default: DEFAULT_TOP_N)
 */
export function generateWorkoutSummary(
  muscleVector: WorkoutMuscleVector,
  patternVector: WorkoutPatternVector,
  stimulusVector: StimulusVector,
  topN = DEFAULT_TOP_N
): WorkoutSummary {
  // ── 1. Rank muscles ───────────────────────────────────────────────────────
  const topMuscles = rankEntries(muscleVector, topN);

  // ── 2. Rank patterns ──────────────────────────────────────────────────────
  const topPatterns = rankEntries(patternVector, topN);

  // ── 3. Dominant stimulus ──────────────────────────────────────────────────
  const dominantStimulus = dominantStimulusKey(stimulusVector);

  // ── 4. Present stimuli (above threshold, ranked descending) ───────────────
  const allStimulusKeys: Array<keyof StimulusVector> = [
    "strength", "hypertrophy", "muscular_endurance", "power", "conditioning",
  ];

  const presentStimuli = allStimulusKeys
    .filter((key) => stimulusVector[key] >= STIMULUS_PRESENCE_THRESHOLD)
    .map((key) => ({ stimulus: key, value: stimulusVector[key] }))
    .sort((a, b) => {
      if (b.value !== a.value) return b.value - a.value;
      return a.stimulus.localeCompare(b.stimulus); // alpha tie-break
    });

  return {
    topMuscles,
    topPatterns,
    dominantStimulus,
    presentStimuli,
  };
}

/**
 * appleHealthActivityAnalysis.ts
 *
 * Maps Apple Health activity metadata into structured analysis hints for
 * workouts that contain activity-level data only (no individual exercises).
 *
 * Design rules:
 *   - Pure functions — no DB access, no side effects.
 *   - Conservative: broad muscle-area estimates, not movement-level precision.
 *   - Honest: confidence tiers and trust notes always reflect data limitations.
 *   - Reuses existing muscle/pattern/stimulus key vocabulary where possible.
 *
 * Conceptual debt from kingstinct/react-native-healthkit audit:
 *   - kingstinct uses a richer HKWorkoutActivityType enum; we work from the
 *     display label produced by mapHKActivity() (e.g. "Running", "HIIT").
 *   - When anchor-based incremental sync is added, activityId can be stored
 *     and used directly here for a more precise mapping.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The dominant movement pattern category inferred from the Apple Health
 * activity type.  Aligns with the existing patternLabel keys where possible.
 */
export type DominantPattern =
  | "cyclical"    // Running, Cycling, Rowing, Walking, Hiking, Elliptical, …
  | "strength"    // Strength Training, Core Training, Gymnastics
  | "mixed_modal" // HIIT, Cross Training, Functional Strength
  | "mobility"    // Yoga, Pilates, Stretching, Mind & Body
  | "sport";      // Tennis, Basketball, Soccer, Boxing, Martial Arts

/**
 * The dominant training stimulus category inferred from the activity type.
 * Uses keys present in the existing STIMULUS_LABEL map where possible.
 */
export type StimulusBias =
  | "conditioning"   // Cyclical cardio, HIIT
  | "strength"       // Strength Training
  | "flexibility"    // Recovery/mobility sessions
  | "mixed";         // CrossTraining, FunctionalStrength, sport

/**
 * Confidence in the analysis estimate.
 *
 * "medium" — Structured, predictable activity (e.g. Running) where muscle use
 *            is reasonably inferred from activity type.
 * "low"    — Variable-effort activity (e.g. Strength Training, HIIT, sport)
 *            where muscle recruitment is unpredictable without exercise detail.
 */
export type ActivityConfidenceTier = "medium" | "low";

/**
 * Structured analysis hints derived from Apple Health activity metadata.
 * Returned for workouts imported from Apple Health with no movement detail.
 */
export interface ActivityAnalysisHint {
  /**
   * The dominant movement pattern category.
   * Aligns with existing patternLabel keys (cyclical, strength, …).
   */
  dominantPattern: DominantPattern;
  /**
   * Ordered list of broad muscle emphasis areas.
   * Uses specific muscle keys where the activity strongly predicts use
   * (e.g. quads, glutes for Running), falling back to area pseudo-keys
   * (lower_body, upper_body, full_body) for high-variance activities.
   */
  muscleEmphasisAreas: string[];
  /**
   * The dominant stimulus bias.
   * Uses stimulus keys from the existing STIMULUS_LABEL vocabulary.
   */
  stimulusBias: StimulusBias;
  /**
   * Confidence tier for the entire estimate.
   */
  confidenceTier: ActivityConfidenceTier;
  /**
   * Human-readable trust note to be surfaced in the UI.
   * Accurately describes the data source and its limitations.
   */
  trustNote: string;
}

// ---------------------------------------------------------------------------
// Trust note templates
// ---------------------------------------------------------------------------

const NOTES = {
  medium_cyclical:
    "Estimated from Apple Health activity data — muscle emphasis reflects typical " +
    "patterns for this activity type (moderate confidence for structured cardio).",
  low_strength:
    "Estimated from Apple Health activity type only — individual exercises were not " +
    "recorded. Muscle estimates are broad and may not reflect your actual session.",
  low_mixed:
    "Estimated from Apple Health activity type only — this activity involves variable " +
    "movement patterns. Muscle estimates are broad.",
  low_mobility:
    "Recorded as a recovery or mobility session in Apple Health. " +
    "No movement-level data was captured.",
  low_sport:
    "Estimated from Apple Health activity type only — sport sessions involve varied " +
    "movement patterns. Muscle estimates are broad.",
} as const;

// ---------------------------------------------------------------------------
// Activity hint table
// ---------------------------------------------------------------------------

interface HintDef {
  dominantPattern: DominantPattern;
  muscleEmphasisAreas: string[];
  stimulusBias: StimulusBias;
  confidenceTier: ActivityConfidenceTier;
  trustNote: string;
}

/**
 * Keyed by the display label produced by mapHKActivity() in workouts.ts.
 * Unknown labels fall back to the workoutType-level defaults below.
 */
const LABEL_HINT_MAP: Record<string, HintDef> = {
  // Cardio — cyclical, medium confidence
  "Running": {
    dominantPattern:    "cyclical",
    muscleEmphasisAreas: ["quads", "hamstrings", "glutes", "calves"],
    stimulusBias:       "conditioning",
    confidenceTier:     "medium",
    trustNote:          NOTES.medium_cyclical,
  },
  "Cycling": {
    dominantPattern:    "cyclical",
    muscleEmphasisAreas: ["quads", "glutes", "calves"],
    stimulusBias:       "conditioning",
    confidenceTier:     "medium",
    trustNote:          NOTES.medium_cyclical,
  },
  "Rowing": {
    dominantPattern:    "cyclical",
    muscleEmphasisAreas: ["upper_back_lats", "quads", "hamstrings"],
    stimulusBias:       "conditioning",
    confidenceTier:     "medium",
    trustNote:          NOTES.medium_cyclical,
  },
  "Swimming": {
    dominantPattern:    "cyclical",
    muscleEmphasisAreas: ["upper_back_lats", "shoulders", "core"],
    stimulusBias:       "conditioning",
    confidenceTier:     "medium",
    trustNote:          NOTES.medium_cyclical,
  },
  "Hiking": {
    dominantPattern:    "cyclical",
    muscleEmphasisAreas: ["quads", "hamstrings", "glutes", "calves"],
    stimulusBias:       "conditioning",
    confidenceTier:     "medium",
    trustNote:          NOTES.medium_cyclical,
  },
  "Elliptical": {
    dominantPattern:    "cyclical",
    muscleEmphasisAreas: ["quads", "glutes", "calves"],
    stimulusBias:       "conditioning",
    confidenceTier:     "medium",
    trustNote:          NOTES.medium_cyclical,
  },
  "Stair Climbing": {
    dominantPattern:    "cyclical",
    muscleEmphasisAreas: ["quads", "glutes", "calves"],
    stimulusBias:       "conditioning",
    confidenceTier:     "medium",
    trustNote:          NOTES.medium_cyclical,
  },
  // Walking: cyclical but low-intensity → medium on muscle prediction, low on stimulus
  "Walking": {
    dominantPattern:    "cyclical",
    muscleEmphasisAreas: ["quads", "hamstrings", "glutes", "calves"],
    stimulusBias:       "conditioning",
    confidenceTier:     "medium",
    trustNote:          NOTES.medium_cyclical,
  },

  // Strength — low confidence (variable exercise selection)
  "Strength Training": {
    dominantPattern:    "strength",
    muscleEmphasisAreas: ["full_body"],
    stimulusBias:       "strength",
    confidenceTier:     "low",
    trustNote:          NOTES.low_strength,
  },
  "Functional Strength": {
    dominantPattern:    "strength",
    muscleEmphasisAreas: ["full_body"],
    stimulusBias:       "mixed",
    confidenceTier:     "low",
    trustNote:          NOTES.low_strength,
  },
  "Core Training": {
    dominantPattern:    "strength",
    muscleEmphasisAreas: ["core", "lower_back"],
    stimulusBias:       "strength",
    confidenceTier:     "low",
    trustNote:          NOTES.low_strength,
  },
  "Gymnastics": {
    dominantPattern:    "strength",
    muscleEmphasisAreas: ["upper_body", "core"],
    stimulusBias:       "strength",
    confidenceTier:     "low",
    trustNote:          NOTES.low_strength,
  },

  // Mixed modal — low confidence
  "HIIT": {
    dominantPattern:    "mixed_modal",
    muscleEmphasisAreas: ["full_body"],
    stimulusBias:       "conditioning",
    confidenceTier:     "low",
    trustNote:          NOTES.low_mixed,
  },
  "Cross Training": {
    dominantPattern:    "mixed_modal",
    muscleEmphasisAreas: ["full_body"],
    stimulusBias:       "mixed",
    confidenceTier:     "low",
    trustNote:          NOTES.low_mixed,
  },

  // Sport — low confidence
  "Tennis": {
    dominantPattern:    "sport",
    muscleEmphasisAreas: ["upper_body", "lower_body"],
    stimulusBias:       "conditioning",
    confidenceTier:     "low",
    trustNote:          NOTES.low_sport,
  },
  "Basketball": {
    dominantPattern:    "sport",
    muscleEmphasisAreas: ["lower_body", "upper_body"],
    stimulusBias:       "conditioning",
    confidenceTier:     "low",
    trustNote:          NOTES.low_sport,
  },
  "Soccer": {
    dominantPattern:    "sport",
    muscleEmphasisAreas: ["lower_body", "core"],
    stimulusBias:       "conditioning",
    confidenceTier:     "low",
    trustNote:          NOTES.low_sport,
  },
  "Boxing": {
    dominantPattern:    "sport",
    muscleEmphasisAreas: ["upper_body", "core"],
    stimulusBias:       "mixed",
    confidenceTier:     "low",
    trustNote:          NOTES.low_sport,
  },
  "Wrestling": {
    dominantPattern:    "sport",
    muscleEmphasisAreas: ["full_body"],
    stimulusBias:       "mixed",
    confidenceTier:     "low",
    trustNote:          NOTES.low_sport,
  },
  "Martial Arts": {
    dominantPattern:    "sport",
    muscleEmphasisAreas: ["full_body"],
    stimulusBias:       "mixed",
    confidenceTier:     "low",
    trustNote:          NOTES.low_sport,
  },

  // Recovery / mobility — low confidence
  "Yoga": {
    dominantPattern:    "mobility",
    muscleEmphasisAreas: ["full_body"],
    stimulusBias:       "flexibility",
    confidenceTier:     "low",
    trustNote:          NOTES.low_mobility,
  },
  "Pilates": {
    dominantPattern:    "mobility",
    muscleEmphasisAreas: ["core", "lower_body"],
    stimulusBias:       "flexibility",
    confidenceTier:     "low",
    trustNote:          NOTES.low_mobility,
  },
  "Stretching": {
    dominantPattern:    "mobility",
    muscleEmphasisAreas: ["full_body"],
    stimulusBias:       "flexibility",
    confidenceTier:     "low",
    trustNote:          NOTES.low_mobility,
  },
  "Mind & Body": {
    dominantPattern:    "mobility",
    muscleEmphasisAreas: ["full_body"],
    stimulusBias:       "flexibility",
    confidenceTier:     "low",
    trustNote:          NOTES.low_mobility,
  },
};

// ---------------------------------------------------------------------------
// workoutType-level fallbacks (when label is unknown)
// ---------------------------------------------------------------------------

const WORKOUTTYPE_FALLBACK: Record<string, HintDef> = {
  cardio: {
    dominantPattern:    "cyclical",
    muscleEmphasisAreas: ["lower_body"],
    stimulusBias:       "conditioning",
    confidenceTier:     "low",
    trustNote:          NOTES.low_mixed,
  },
  strength: {
    dominantPattern:    "strength",
    muscleEmphasisAreas: ["full_body"],
    stimulusBias:       "strength",
    confidenceTier:     "low",
    trustNote:          NOTES.low_strength,
  },
  recovery: {
    dominantPattern:    "mobility",
    muscleEmphasisAreas: ["full_body"],
    stimulusBias:       "flexibility",
    confidenceTier:     "low",
    trustNote:          NOTES.low_mobility,
  },
};

const ULTIMATE_FALLBACK: HintDef = {
  dominantPattern:    "strength",
  muscleEmphasisAreas: ["full_body"],
  stimulusBias:       "mixed",
  confidenceTier:     "low",
  trustNote:          NOTES.low_mixed,
};

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Derive an ActivityAnalysisHint from Apple Health workout metadata.
 *
 * @param label        Display label as stored (from mapHKActivity).
 * @param workoutType  Mapped workout type ("strength" | "cardio" | "recovery").
 * @param _durationMinutes  Available for future duration-adjusted hints.
 *
 * Exported for unit testing.
 */
export function analyzeAppleHealthActivity(
  label: string,
  workoutType: string,
  _durationMinutes: number
): ActivityAnalysisHint {
  return (
    LABEL_HINT_MAP[label] ??
    WORKOUTTYPE_FALLBACK[workoutType] ??
    ULTIMATE_FALLBACK
  );
}

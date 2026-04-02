/**
 * trainingDisplay.ts — Centralized display formatting for training data.
 *
 * All label maps and formatting utilities that convert backend scoring keys
 * into user-facing strings. Used by both view models and any component that
 * needs to display muscle, pattern, or stimulus names.
 *
 * Rules:
 *   - All functions are pure (no side effects, no React imports).
 *   - Fallback to a humanized key (underscores → spaces) for unknown keys.
 *   - No prescriptive or medical language.
 *   - Score rounding is done here, not in components.
 */

// ---------------------------------------------------------------------------
// Muscle display names (matches Step 1 profile keys)
// ---------------------------------------------------------------------------

const MUSCLE_LABEL: Record<string, string> = {
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
  neck:            "Neck",
  tibialis:        "Tibialis",
};

/**
 * Human-readable label for a muscle key.
 * Returns a humanized fallback (underscores → spaces) for unknown keys.
 */
export function muscleLabel(key: string): string {
  return MUSCLE_LABEL[key] ?? key.replace(/_/g, " ");
}

// ---------------------------------------------------------------------------
// Pattern display names
// ---------------------------------------------------------------------------

const PATTERN_LABEL: Record<string, string> = {
  squat:            "Squat",
  hinge:            "Hinge",
  horizontal_push:  "Horizontal push",
  horizontal_pull:  "Horizontal pull",
  vertical_push:    "Vertical push",
  vertical_pull:    "Vertical pull",
  carry:            "Carry",
  core:             "Core",
  cyclical:         "Cyclical / conditioning",
  single_leg:       "Single-leg",
  accessory:        "Accessory",
};

/**
 * Human-readable label for a movement pattern key.
 */
export function patternLabel(key: string): string {
  return PATTERN_LABEL[key] ?? key.replace(/_/g, " ");
}

// ---------------------------------------------------------------------------
// Stimulus display names
// ---------------------------------------------------------------------------

const STIMULUS_LABEL: Record<string, string> = {
  strength:          "Strength",
  power:             "Power",
  muscular_endurance: "Muscular endurance",
  conditioning:      "Conditioning",
  endurance:         "Endurance",
  flexibility:       "Flexibility",
  stability:         "Stability",
};

/**
 * Human-readable label for a stimulus key.
 */
export function stimulusLabel(key: string): string {
  return STIMULUS_LABEL[key] ?? key.replace(/_/g, " ");
}

// ---------------------------------------------------------------------------
// Score rounding
// ---------------------------------------------------------------------------

/**
 * Round a raw scoring value to a fixed number of decimal places.
 * Default: 2 decimal places.
 */
export function roundScore(value: number, decimals = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Format a score as a percentage string (e.g. 0.72 → "72%").
 */
export function formatScorePct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

// ---------------------------------------------------------------------------
// Insight severity → display tone
// ---------------------------------------------------------------------------

type InsightSeverity = "info" | "low" | "moderate" | "high";

/**
 * Maps insight severity to a simple emphasis tier for UI theming.
 * Components can use this to pick colour tokens.
 */
export function severityTier(severity: InsightSeverity): "neutral" | "soft" | "medium" | "strong" {
  switch (severity) {
    case "info":     return "neutral";
    case "low":      return "soft";
    case "moderate": return "medium";
    case "high":     return "strong";
  }
}

// ---------------------------------------------------------------------------
// Null-safe display helpers
// ---------------------------------------------------------------------------

/**
 * Returns a non-empty display string or a fallback placeholder.
 * Safe to use in JSX text nodes.
 */
export function displayOrFallback(value: string | null | undefined, fallback = "—"): string {
  return (value?.trim() ?? "") === "" ? fallback : value!.trim();
}

/**
 * Return "No data" for an empty array, or undefined to let the caller decide.
 */
export function emptyStateLabel(items: unknown[]): string | null {
  return items.length === 0 ? "No data" : null;
}

/**
 * bodyMapViewModel.ts — Step 10: body-map / muscle-emphasis visualization.
 *
 * Transforms a raw muscle vector (Record<string, number>) into a UI-ready
 * display model for the MuscleEmphasisMap component. Works for:
 *   - Single workout analysis   (mode: "workout")
 *   - Historical cumulative     (mode: "cumulative")
 *   - Historical recent window  (mode: "recent")
 *
 * Design rules:
 *   - Pure functions only — no React, no side effects.
 *   - Normalization is always relative to the highest-scoring muscle in the
 *     current view. Scores are never shown as absolute values.
 *   - Empty/null vectors produce hasData=false — callers should hide the map.
 *   - Muscles are ordered by score descending; top BODY_MAP_MAX_ROWS are shown.
 *   - Region grouping is computed in parallel for callers that want a 2×2
 *     region grid instead of (or in addition to) the flat bar list.
 *   - hasLowData should be set when the upstream analysisConfidence / dataConfidence
 *     is "low" so that the component can display an appropriate qualifier.
 */

import { muscleLabel } from "../formatters/trainingDisplay";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type BodyMapMode = "workout" | "cumulative" | "recent";

/**
 * Relative emphasis tier derived from normalizedScore.
 *
 * "none"   — score is 0 (muscle not activated in this view)
 * "low"    — normalizedScore < 0.33
 * "medium" — 0.33 ≤ normalizedScore < 0.67
 * "high"   — normalizedScore ≥ 0.67
 */
export type EmphasisTier = "none" | "low" | "medium" | "high";

/**
 * Region key for the four high-level body regions.
 */
export type BodyRegionKey = "push" | "pull" | "core" | "lower";

export interface BodyMapMuscleRow {
  key: string;
  label: string;
  rawScore: number;
  /** 0–1, relative to the highest-scoring muscle in the current view. */
  normalizedScore: number;
  emphasisTier: EmphasisTier;
  /** 1-based rank by score (1 = highest). */
  rank: number;
}

export interface BodyMapRegion {
  key: BodyRegionKey;
  label: string;
  /** All active muscles in this region, ordered by score desc. */
  muscles: BodyMapMuscleRow[];
  /** Highest rawScore within this region (0 if no active muscles). */
  regionTopScore: number;
}

export interface BodyMapDisplayModel {
  mode: BodyMapMode;
  /** Top BODY_MAP_MAX_ROWS muscles ordered by score desc. */
  rows: BodyMapMuscleRow[];
  /** Four regions (push / pull / core / lower), always present for layout. */
  regions: BodyMapRegion[];
  /** True when at least one muscle has score > 0. */
  hasData: boolean;
  /** True when upstream confidence is "low" — triggers a qualifier in the UI. */
  hasLowData: boolean;
  /** Human-readable context: "This workout", "Past 30 days", etc. */
  sourceLabel: string;
}

// ---------------------------------------------------------------------------
// Constants — exported for tests
// ---------------------------------------------------------------------------

/** Maximum muscle rows shown in the bar-chart view. */
export const BODY_MAP_MAX_ROWS = 8;

/** normalizedScore threshold below which a muscle is "low" emphasis. */
export const EMPHASIS_LOW_THRESHOLD = 0.33;

/** normalizedScore threshold at or above which a muscle is "high" emphasis. */
export const EMPHASIS_HIGH_THRESHOLD = 0.67;

// ---------------------------------------------------------------------------
// Muscle → region mapping
// ---------------------------------------------------------------------------

const MUSCLE_REGION_MAP: Record<string, BodyRegionKey> = {
  chest:           "push",
  shoulders:       "push",
  triceps:         "push",
  upper_back_lats: "pull",
  biceps:          "pull",
  forearms:        "pull",
  neck:            "pull",
  core:            "core",
  lower_back:      "core",
  glutes:          "lower",
  quads:           "lower",
  hamstrings:      "lower",
  calves:          "lower",
  hip_flexors:     "lower",
  adductors:       "lower",
  tibialis:        "lower",
};

const REGION_LABELS: Record<BodyRegionKey, string> = {
  push:  "Push",
  pull:  "Pull",
  core:  "Core",
  lower: "Lower",
};

const REGION_ORDER: BodyRegionKey[] = ["push", "pull", "core", "lower"];

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

export const EMPTY_BODY_MAP: BodyMapDisplayModel = {
  mode:         "workout",
  rows:         [],
  regions:      REGION_ORDER.map((key) => ({
    key,
    label:          REGION_LABELS[key],
    muscles:        [],
    regionTopScore: 0,
  })),
  hasData:      false,
  hasLowData:   false,
  sourceLabel:  "",
};

// ---------------------------------------------------------------------------
// Main transform
// ---------------------------------------------------------------------------

/**
 * Build a BodyMapDisplayModel from a raw muscle vector.
 *
 * @param muscleVector  Record of muscle key → raw score (any non-negative number).
 *                      Null / undefined → returns EMPTY_BODY_MAP with provided options.
 * @param options       { mode, sourceLabel, hasLowData? }
 */
export function buildBodyMapViewModel(
  muscleVector: Record<string, number> | null | undefined,
  options: {
    mode: BodyMapMode;
    sourceLabel: string;
    hasLowData?: boolean;
  }
): BodyMapDisplayModel {
  const { mode, sourceLabel, hasLowData = false } = options;

  if (!muscleVector) {
    return { ...EMPTY_BODY_MAP, mode, sourceLabel, hasLowData };
  }

  const scored = Object.entries(muscleVector)
    .filter(([, score]) => typeof score === "number" && score > 0)
    .sort(([, a], [, b]) => b - a);

  if (scored.length === 0) {
    return { ...EMPTY_BODY_MAP, mode, sourceLabel, hasLowData };
  }

  const maxScore = scored[0][1];

  // Build all rows (needed for full region coverage, not just top N)
  const allRows: BodyMapMuscleRow[] = scored.map(([key, score], i) => {
    const normalizedScore = score / maxScore;
    return {
      key,
      label:          muscleLabel(key),
      rawScore:       score,
      normalizedScore,
      emphasisTier:   computeEmphasisTier(normalizedScore),
      rank:           i + 1,
    };
  });

  // Top N for the bar chart
  const rows = allRows.slice(0, BODY_MAP_MAX_ROWS);

  // Region grouping (all muscles, not capped at BODY_MAP_MAX_ROWS)
  const regionBuckets = new Map<BodyRegionKey, BodyMapMuscleRow[]>(
    REGION_ORDER.map((k) => [k, []])
  );

  for (const row of allRows) {
    const regionKey = MUSCLE_REGION_MAP[row.key];
    if (regionKey) regionBuckets.get(regionKey)?.push(row);
  }

  const regions: BodyMapRegion[] = REGION_ORDER.map((key) => {
    const muscles = regionBuckets.get(key) ?? [];
    return {
      key,
      label:          REGION_LABELS[key],
      muscles,
      regionTopScore: muscles.length > 0 ? muscles[0].rawScore : 0,
    };
  });

  return { mode, rows, regions, hasData: true, hasLowData, sourceLabel };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeEmphasisTier(normalizedScore: number): EmphasisTier {
  if (normalizedScore <= 0)                       return "none";
  if (normalizedScore < EMPHASIS_LOW_THRESHOLD)   return "low";
  if (normalizedScore < EMPHASIS_HIGH_THRESHOLD)  return "medium";
  return "high";
}

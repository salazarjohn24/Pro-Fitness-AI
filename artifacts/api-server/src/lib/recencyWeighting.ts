/**
 * recencyWeighting.ts — Step 4 V1 recency weighting model.
 *
 * Encapsulates a simple, explainable day-bucket decay model. Older workouts
 * contribute less to the recency-weighted vectors. The model is intentionally
 * heuristic and conservative — it does NOT claim to model physiological
 * adaptation, supercompensation, or fatigue.
 *
 * V1 BUCKET MODEL (from spec)
 * ---------------------------
 *   0–2 days ago  → 1.00  (very recent — full weight)
 *   3–7 days ago  → 0.80  (this week)
 *   8–14 days ago → 0.55  (last fortnight)
 *   15–30 days ago→ 0.30  (this month)
 *   31–90 days ago→ 0.15  (this quarter)
 *   older         → 0.08  (background historical)
 *
 * The weight is applied multiplicatively to a workout's raw vector values
 * before summing into the recency aggregate. The result is NOT normalised —
 * raw values grow with volume, just at a decay-discounted rate.
 *
 * SCOPE: Step 4 only. No fatigue modelling. No adaptation curves.
 */

// ---------------------------------------------------------------------------
// Decay table
// ---------------------------------------------------------------------------

/**
 * Ordered decay buckets. Each entry defines [minDaysAgo, maxDaysAgo, weight].
 * Checked top-to-bottom; first matching bucket wins.
 */
const DECAY_BUCKETS: ReadonlyArray<readonly [number, number, number]> = [
  [0,   2,  1.00],
  [3,   7,  0.80],
  [8,  14,  0.55],
  [15, 30,  0.30],
  [31, 90,  0.15],
] as const;

/** Weight applied when daysAgo > 90 (outside all explicit buckets). */
const FLOOR_WEIGHT = 0.08;

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

/**
 * Return the recency weight for a workout that was performed `days` days ago.
 *
 * @param days - Non-negative integer; 0 = today, 7 = one week ago, etc.
 * @returns    - A weight in [FLOOR_WEIGHT, 1.00] (inclusive)
 */
export function getRecencyWeight(days: number): number {
  const d = Math.max(0, Math.floor(days)); // normalise — no negative days
  for (const [minD, maxD, weight] of DECAY_BUCKETS) {
    if (d >= minD && d <= maxD) return weight;
  }
  return FLOOR_WEIGHT;
}

/**
 * Apply a scalar weight to every value in a Record<string, number>.
 * Returns a fresh object — the original is not mutated.
 *
 * @param vector - Input vector
 * @param weight - Scalar multiplier (typically a recency weight in (0, 1])
 * @param dp     - Decimal places to round to (default 4)
 */
export function applyRecencyWeight(
  vector: Record<string, number>,
  weight: number,
  dp = 4
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(vector)) {
    result[key] = Number((value * weight).toFixed(dp));
  }
  return result;
}

/**
 * Apply a scalar weight to a StimulusVector-shaped object (five named keys).
 * Returns a fresh object — the original is not mutated.
 */
export function applyRecencyWeightToStimulus<
  T extends Record<string, number>
>(stimulus: T, weight: number): T {
  const result = {} as T;
  for (const key of Object.keys(stimulus) as Array<keyof T>) {
    (result as Record<string, number>)[key as string] = Number(
      ((stimulus[key] as number) * weight).toFixed(4)
    );
  }
  return result;
}

// ---------------------------------------------------------------------------
// Bucket boundary helpers (exported for testing / display)
// ---------------------------------------------------------------------------

/** Human-readable label for each bucket. */
export const BUCKET_LABELS: ReadonlyArray<string> = [
  "0–2 days (1.00)",
  "3–7 days (0.80)",
  "8–14 days (0.55)",
  "15–30 days (0.30)",
  "31–90 days (0.15)",
  ">90 days (0.08)",
];

/**
 * Return the label string describing which bucket a given day count falls into.
 * Useful for debugging and transparent logging.
 */
export function bucketLabel(days: number): string {
  const d = Math.max(0, Math.floor(days));
  for (let i = 0; i < DECAY_BUCKETS.length; i++) {
    const [minD, maxD] = DECAY_BUCKETS[i];
    if (d >= minD && d <= maxD) return BUCKET_LABELS[i];
  }
  return BUCKET_LABELS[BUCKET_LABELS.length - 1];
}

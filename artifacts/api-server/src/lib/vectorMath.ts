/**
 * vectorMath.ts — Pure vector utility helpers for Step 3 workout aggregation.
 *
 * All functions here are pure (no side effects, no imports from app code).
 * They operate on Record<string, number> maps and plain StimulusVector-shaped
 * objects. Exported for unit-testability and re-use in workoutVector.ts and
 * workoutSummary.ts.
 *
 * SCOPE: Step 3 only. No physiology logic. No profile lookups.
 */

import type { StimulusVector } from "./movementScoringTypes";
import type { RankedEntry } from "./workoutScoringTypes";

// ---------------------------------------------------------------------------
// Scalar vector operations
// ---------------------------------------------------------------------------

/**
 * Sum an array of Record<string, number> maps into a single map.
 * Missing keys are treated as 0. Returns a fresh object.
 *
 * @example
 * sumVectors([{quads: 1.5, glutes: 0.8}, {quads: 2.0, core: 0.5}])
 * // → {quads: 3.5, glutes: 0.8, core: 0.5}
 */
export function sumVectors(
  vectors: Array<Record<string, number>>
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const vec of vectors) {
    for (const [key, value] of Object.entries(vec)) {
      result[key] = (result[key] ?? 0) + value;
    }
  }
  return result;
}

/**
 * Compute a weighted average of an array of StimulusVectors.
 * Each vector is weighted by the corresponding weight value.
 * If all weights are 0 (edge case), returns the equal-weight average.
 *
 * Output values are clamped to [0.0, 1.0] and rounded to 2 d.p.
 */
export function weightedAverageStimulusVectors(
  vectors: StimulusVector[],
  weights: number[]
): StimulusVector {
  if (vectors.length === 0) {
    return { strength: 0, hypertrophy: 0, muscular_endurance: 0, power: 0, conditioning: 0 };
  }

  const totalWeight = weights.reduce((s, w) => s + w, 0);
  // Fall back to equal weights if all rawScores are 0
  const effectiveWeights = totalWeight > 0 ? weights : vectors.map(() => 1);
  const effectiveTotal = totalWeight > 0 ? totalWeight : vectors.length;

  const keys: Array<keyof StimulusVector> = [
    "strength", "hypertrophy", "muscular_endurance", "power", "conditioning",
  ];

  const result = {} as StimulusVector;
  for (const key of keys) {
    let sum = 0;
    for (let i = 0; i < vectors.length; i++) {
      sum += vectors[i][key] * effectiveWeights[i];
    }
    result[key] = Number(clamp(sum / effectiveTotal, 0, 1).toFixed(2));
  }
  return result;
}

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

/**
 * Rank entries from a Record<string, number> map, highest score first.
 * Returns at most topN entries. Ties are broken alphabetically by key
 * for deterministic output.
 *
 * @param vector - The map to rank
 * @param topN   - Maximum number of entries to return (default: all)
 */
export function rankEntries(
  vector: Record<string, number>,
  topN?: number
): RankedEntry[] {
  const sorted = Object.entries(vector)
    .filter(([, score]) => score > 0)
    .sort(([keyA, scoreA], [keyB, scoreB]) => {
      if (scoreB !== scoreA) return scoreB - scoreA; // descending score
      return keyA.localeCompare(keyB);               // alpha tie-break
    });

  const limited = topN != null ? sorted.slice(0, topN) : sorted;

  return limited.map(([key, score], index) => ({
    key,
    score: Number(score.toFixed(3)),
    rank: index + 1,
  }));
}

/**
 * Find the key with the highest value in a StimulusVector.
 * Ties are broken alphabetically for determinism.
 */
export function dominantStimulusKey(
  sv: StimulusVector
): keyof StimulusVector {
  const keys: Array<keyof StimulusVector> = [
    "strength", "hypertrophy", "muscular_endurance", "power", "conditioning",
  ];
  return keys.reduce((best, key) => {
    if (sv[key] > sv[best]) return key;
    if (sv[key] === sv[best]) return key < best ? key : best; // alpha tie-break
    return best;
  });
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/** Clamp a number to [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Round all values in a Record<string, number> to dp decimal places.
 * Returns a fresh object.
 */
export function roundVector(
  vector: Record<string, number>,
  dp = 3
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(vector)) {
    result[key] = Number(value.toFixed(dp));
  }
  return result;
}

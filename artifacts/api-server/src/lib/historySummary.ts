/**
 * historySummary.ts — Step 4 historical summary generation.
 *
 * Pure module: takes cumulative and recency-weighted aggregate vectors and
 * returns a HistorySummary with:
 *   - topMusclesCumulative / topMusclesRecent
 *   - topPatternsCumulative / topPatternsRecent
 *   - underrepresentedMuscles / underrepresentedPatterns (ascending rank)
 *   - dominantStimulusCumulative / dominantStimulusRecent
 *   - recentlyElevated / recentlyReduced (rank comparison)
 *
 * TERMINOLOGY NOTES
 * -----------------
 * "underrepresented" = lowest cumulative scores within the selected range.
 * This is always relative to what was trained in that window — it does NOT
 * imply a universal physiological deficit or training imbalance.
 *
 * "recentlyElevated" = muscles whose recency rank is HIGHER (closer to #1)
 * than their cumulative rank. Indicates recent training emphasis.
 *
 * "recentlyReduced" = muscles whose recency rank is LOWER than their
 * cumulative rank. Suggests earlier training, not recent.
 *
 * SCOPE: Step 4 only. No physiology judgements. No universal ideals.
 */

import { rankEntries, dominantStimulusKey } from "./vectorMath";
import type { HistorySummary } from "./historyScoringTypes";
import type { StimulusVector } from "./movementScoringTypes";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_TOP_N = 5;

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Generate the historical summary from cumulative and recency aggregate vectors.
 *
 * @param cumulativeMuscle   - Plain-sum muscle vector across the date range
 * @param cumulativePattern  - Plain-sum pattern vector across the date range
 * @param cumulativeStimulus - Weighted-average stimulus across the date range
 * @param recencyMuscle      - Recency-weighted muscle vector
 * @param recencyPattern     - Recency-weighted pattern vector
 * @param recencyStimulus    - Recency-weighted stimulus vector
 * @param topN               - Max entries per ranked list (default: DEFAULT_TOP_N)
 */
export function generateHistorySummary(
  cumulativeMuscle: Record<string, number>,
  cumulativePattern: Record<string, number>,
  cumulativeStimulus: StimulusVector,
  recencyMuscle: Record<string, number>,
  recencyPattern: Record<string, number>,
  recencyStimulus: StimulusVector,
  topN = DEFAULT_TOP_N
): HistorySummary {
  // ── 1. Ranked cumulative ──────────────────────────────────────────────────
  const topMusclesCumulative    = rankEntries(cumulativeMuscle, topN);
  const topPatternsCumulative   = rankEntries(cumulativePattern, topN);

  // ── 2. Ranked recency ────────────────────────────────────────────────────
  const topMusclesRecent  = rankEntries(recencyMuscle, topN);
  const topPatternsRecent = rankEntries(recencyPattern, topN);

  // ── 3. Underrepresented (ascending — fewest/lowest cumulative score) ──────
  // Rank all entries ascending (invert score for sort) then take topN
  const underrepresentedMuscles   = rankAscending(cumulativeMuscle, topN);
  const underrepresentedPatterns  = rankAscending(cumulativePattern, topN);

  // ── 4. Dominant stimulus ──────────────────────────────────────────────────
  const dominantStimulusCumulative = dominantStimulusKey(cumulativeStimulus);
  const dominantStimulusRecent     = dominantStimulusKey(recencyStimulus);

  // ── 5. Rank comparison: elevated / reduced ────────────────────────────────
  const { recentlyElevated, recentlyReduced } = computeRankShifts(
    cumulativeMuscle,
    recencyMuscle,
    topN
  );

  return {
    topMusclesCumulative,
    topPatternsCumulative,
    topMusclesRecent,
    topPatternsRecent,
    underrepresentedMuscles,
    underrepresentedPatterns,
    dominantStimulusCumulative,
    dominantStimulusRecent,
    recentlyElevated,
    recentlyReduced,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Rank entries ascending by score (lowest first).
 * Returns at most topN entries. Only includes muscles with score > 0.
 * Ties broken alphabetically for determinism.
 */
function rankAscending(
  vector: Record<string, number>,
  topN: number
): Array<{ key: string; score: number; rank: number }> {
  const sorted = Object.entries(vector)
    .filter(([, score]) => score > 0)
    .sort(([keyA, scoreA], [keyB, scoreB]) => {
      if (scoreA !== scoreB) return scoreA - scoreB; // ascending
      return keyA.localeCompare(keyB);
    });

  return sorted.slice(0, topN).map(([key, score], index) => ({
    key,
    score: Number(score.toFixed(3)),
    rank: index + 1,
  }));
}

/**
 * Compare cumulative rank vs recency rank for all muscles present in both.
 *
 * "Elevated" = recency rank position < cumulative rank position
 *   (e.g., #2 recency vs #5 cumulative → elevated: moved up 3 spots)
 * "Reduced"  = recency rank position > cumulative rank position
 *
 * Only considers muscles present in BOTH vectors (score > 0 in both).
 * Only reports muscles in top topN×2 positions to avoid noise from tiny scores.
 */
function computeRankShifts(
  cumulativeMuscle: Record<string, number>,
  recencyMuscle: Record<string, number>,
  topN: number
): { recentlyElevated: string[]; recentlyReduced: string[] } {
  const window = topN * 2; // broader window to catch meaningful shifts
  const cumRanked  = rankEntries(cumulativeMuscle, window);
  const recRanked  = rankEntries(recencyMuscle,    window);

  // Build rank maps (key → rank number)
  const cumRankMap  = new Map(cumRanked.map((e) => [e.key, e.rank]));
  const recRankMap  = new Map(recRanked.map((e) => [e.key, e.rank]));

  // Only muscles present in both maps
  const sharedKeys = [...cumRankMap.keys()].filter((k) => recRankMap.has(k));

  const elevated: string[] = [];
  const reduced: string[]  = [];

  for (const key of sharedKeys) {
    const cumRank = cumRankMap.get(key)!;
    const recRank = recRankMap.get(key)!;
    if (recRank < cumRank) elevated.push(key); // lower rank number = better
    if (recRank > cumRank) reduced.push(key);
  }

  // Sort alphabetically for determinism
  return {
    recentlyElevated: elevated.sort(),
    recentlyReduced: reduced.sort(),
  };
}

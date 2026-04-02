/**
 * insightRules.ts — Step 5 insight detection thresholds and pattern groupings.
 *
 * Pure constants and classification helpers. No text generation here (that
 * lives in insightText.ts). No entry-point logic (that lives in historyInsights.ts).
 *
 * Centralising thresholds here makes them easy to tune without touching
 * detection or text logic.
 *
 * SCOPE: Step 5 only. No physiology. No prescriptions.
 */

import type { MovementPattern } from "./movementProfiles";

// ---------------------------------------------------------------------------
// Volume / count thresholds
// ---------------------------------------------------------------------------

/** Maximum recently-elevated muscle insights to emit (prevents noise). */
export const ELEVATED_MAX_MUSCLES = 3;

/** Maximum recently-reduced muscle insights to emit. */
export const REDUCED_MAX_MUSCLES = 3;

/** Maximum underrepresented-muscle insights to emit. */
export const UNDERREPRESENTED_MUSCLE_MAX = 2;

/** Maximum underrepresented-pattern insights to emit. */
export const UNDERREPRESENTED_PATTERN_MAX = 2;

/**
 * Minimum filtered workout count before emitting balance observations.
 * With < 3 workouts there is too little data for a balance claim.
 */
export const BALANCE_MIN_WORKOUTS = 3;

/**
 * Minimum filtered workout count before emitting dominant-bias insights.
 * With 1 workout the "dominant" signal is just that one session.
 */
export const DOMINANT_MIN_WORKOUTS = 2;

// ---------------------------------------------------------------------------
// Balance detection thresholds
// ---------------------------------------------------------------------------

/**
 * Ratio at which one side of a push/pull or upper/lower comparison is
 * considered meaningfully more represented than the other.
 * e.g. pull_score > push_score × 1.5 → "pull-dominant observation"
 */
export const BALANCE_RATIO_THRESHOLD = 1.5;

/**
 * Minimum absolute score for a pattern group to participate in a balance
 * observation. Avoids "push vs pull" noise when neither has meaningful load.
 */
export const BALANCE_MIN_ABSOLUTE_SCORE = 0.5;

// ---------------------------------------------------------------------------
// Data quality thresholds
// ---------------------------------------------------------------------------

/**
 * Fallback movement rate at or above which a "high" data quality note is emitted.
 * e.g. 0.5 = 50%+ of total tracked movements were unrecognised.
 */
export const DATA_QUALITY_HIGH_RATE = 0.50;

/**
 * Fallback movement rate at or above which a "moderate" data quality note is emitted.
 */
export const DATA_QUALITY_MODERATE_RATE = 0.25;

/**
 * Minimum total tracked fallback movements before data quality notes are meaningful.
 * 3 unrecognised movements is enough to warrant a note.
 */
export const DATA_QUALITY_MIN_MOVEMENTS = 3;

// ---------------------------------------------------------------------------
// Pattern groupings for balance observations
// ---------------------------------------------------------------------------

/**
 * Movement patterns classified as upper-body pushing.
 */
export const PUSH_PATTERNS: ReadonlySet<MovementPattern> = new Set<MovementPattern>([
  "horizontal_push",
  "vertical_push",
]);

/**
 * Movement patterns classified as upper-body pulling.
 */
export const PULL_PATTERNS: ReadonlySet<MovementPattern> = new Set<MovementPattern>([
  "horizontal_pull",
  "vertical_pull",
]);

/**
 * Movement patterns classified as lower-body / compound leg-dominant.
 */
export const LOWER_PATTERNS: ReadonlySet<MovementPattern> = new Set<MovementPattern>([
  "squat",
  "hinge",
  "jump",
]);

/**
 * Movement patterns classified as cyclical / metabolic conditioning.
 */
export const CYCLICAL_PATTERNS: ReadonlySet<MovementPattern> = new Set<MovementPattern>([
  "cyclical",
]);

// ---------------------------------------------------------------------------
// Pattern group score helper
// ---------------------------------------------------------------------------

/**
 * Sum the cumulative patternVector scores for all patterns in a given set.
 */
export function sumPatternGroup(
  patternVector: Record<string, number>,
  group: ReadonlySet<MovementPattern>
): number {
  let total = 0;
  for (const pattern of group) {
    total += patternVector[pattern as string] ?? 0;
  }
  return total;
}

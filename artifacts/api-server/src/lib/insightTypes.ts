/**
 * insightTypes.ts — Step 5 shared types for the training insight layer.
 *
 * Sits on top of Step 4 (HistoricalRollupResult). No physiology judgements,
 * no prescriptions, no readiness/recovery signals — just structured
 * observations derived from the historical vectors.
 *
 * SCOPE: Step 5 only.
 * Not included: readiness/recovery/fatigue scoring, workout recommendations,
 * programming prescriptions, prescribed/performed delta, body-map rendering.
 * Those are explicitly Step 6+.
 */

import type { StimulusVector } from "./movementScoringTypes";

// ---------------------------------------------------------------------------
// Insight classification
// ---------------------------------------------------------------------------

/**
 * V1 insight categories.
 *
 * All observations are descriptive ("has been elevated") — never prescriptive
 * ("should be trained more"). Category names encode type, not urgency.
 */
export type InsightType =
  | "recently_elevated_muscle"   // muscle ranks higher in recency than cumulative
  | "recently_reduced_muscle"    // muscle ranks lower in recency than cumulative
  | "underrepresented_muscle"    // muscle has a low cumulative score in the range
  | "underrepresented_pattern"   // pattern has low cumulative exposure in the range
  | "dominant_pattern_bias"      // pattern with highest cumulative exposure
  | "dominant_stimulus_bias"     // stimulus dimension dominating the range
  | "balance_observation"        // comparative observation (push/pull, upper/lower, etc.)
  | "data_quality_note";         // elevated fallback rate may affect data completeness

/**
 * Signal strength of an insight.
 *
 * Used for ordering and display emphasis — NOT as a severity score
 * in the medical or urgency sense. "high" = strong signal in the data,
 * "info" = neutral background observation.
 */
export type InsightSeverity = "info" | "low" | "moderate" | "high";

// ---------------------------------------------------------------------------
// Single insight
// ---------------------------------------------------------------------------

/**
 * One structured insight derived from a HistoricalRollupResult.
 *
 * `subject` is the primary entity the insight is about (muscle key, pattern
 * key, stimulus key, or a compound label for balance observations).
 *
 * `text` is the user-facing sentence — always relative, never prescriptive.
 *
 * `evidence` is an optional one-line technical note for debugging/traceability.
 */
export interface HistoryInsight {
  type: InsightType;
  severity: InsightSeverity;
  /** Primary entity: muscle key, pattern key, stimulus key, or compound label. */
  subject: string;
  /** Human-readable observation sentence. Safe, relative language only. */
  text: string;
  /** Optional technical rationale. Not shown to end users by default. */
  evidence?: string;
}

// ---------------------------------------------------------------------------
// Insight summary
// ---------------------------------------------------------------------------

/**
 * A condensed narrative view of the insight set.
 *
 * `headline` is one sentence describing the overall character of the range.
 * `observations` are 2–4 bullet-style sentences distilled from the top insights.
 */
export interface InsightSummary {
  /** One-sentence characterisation of the training period. */
  headline: string;
  /** 2–4 notable observations from the insight set. */
  observations: string[];
}

// ---------------------------------------------------------------------------
// Full result
// ---------------------------------------------------------------------------

/**
 * Complete insight generation result.
 *
 * `insights` is the full ranked list (high → low severity, then by type).
 * `summary` is the narrative condensation.
 * `rangeLabel` is a human label for the time period (e.g. "past 30 days").
 */
export interface InsightGenerationResult {
  insights: HistoryInsight[];
  summary: InsightSummary;
  /** Descriptive label of the selected time range. */
  rangeLabel: string;
  /** Number of workouts in the rollup that produced these insights. */
  workoutCount: number;
}

// ---------------------------------------------------------------------------
// Convenience re-exports (so consumers import from one place)
// ---------------------------------------------------------------------------

export type { StimulusVector };

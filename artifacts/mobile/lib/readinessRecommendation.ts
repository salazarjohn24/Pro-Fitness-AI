/**
 * readinessRecommendation.ts
 *
 * Pure utility for building the "Today's Training Adjustment" card.
 * All tunable values are exported constants — no magic numbers in components.
 *
 * Design rules:
 *   - Zero React / React Native imports — functions are pure TS, fully testable in vitest.
 *   - Telemetry prop builders live here so components never construct event payloads inline.
 *   - AsyncStorage key format is date-scoped so a previous day's choice is never replayed.
 */

// ---------------------------------------------------------------------------
// Configurable constants
// ---------------------------------------------------------------------------

/** Volume reduction % applied to AI-generated workout when deload is recommended. */
export const DELOAD_VOLUME_REDUCTION_PCT = 40;

/** Intensity (RPE / weight %) reduction % applied when deload is recommended. */
export const DELOAD_INTENSITY_REDUCTION_PCT = 20;

/** AsyncStorage key prefix — scoped to today's date so old choices never replay. */
export const RECOMMENDATION_STORAGE_KEY_PREFIX = "recommendation_outcome_";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DeloadCheckData {
  recommended: boolean;
  reason: string | null;
  avgFatigue: number;
  weeklyVolume: number;
  sessionCount: number;
  internalSessionCount?: number;
  externalSessionCount?: number;
}

export interface AdjustmentCard {
  title: string;
  reasonText: string;
  adjustmentSummary: string;
  volumeReductionPct: number;
  intensityReductionPct: number;
  helperText: string;
}

export type RecommendationOutcome = "accepted" | "overridden" | null;

// ---------------------------------------------------------------------------
// Card builder
// ---------------------------------------------------------------------------

/**
 * Builds the display data for the adjustment card from a deload-check response.
 * Always returns a fully-populated object — caller does not need to handle nulls.
 */
export function buildAdjustmentCard(data: DeloadCheckData): AdjustmentCard {
  const reasonText =
    data.reason ??
    "Your recent training load and recovery data suggest a lighter session today.";

  return {
    title: "Today's Training Adjustment",
    reasonText,
    adjustmentSummary: `Volume −${DELOAD_VOLUME_REDUCTION_PCT}% · Intensity −${DELOAD_INTENSITY_REDUCTION_PCT}%`,
    volumeReductionPct: DELOAD_VOLUME_REDUCTION_PCT,
    intensityReductionPct: DELOAD_INTENSITY_REDUCTION_PCT,
    helperText: "You're always in control. We'll learn from your choice.",
  };
}

/**
 * Gate: true only when the card should be rendered.
 * Both `recommended` AND a non-null `reason` must be present.
 */
export function shouldShowAdjustmentCard(
  data: DeloadCheckData | undefined
): boolean {
  return !!(data?.recommended && data.reason);
}

/**
 * Returns today's date in YYYY-MM-DD format (local time) for AsyncStorage keying.
 */
export function todayDateKey(): string {
  return new Date().toLocaleDateString("en-CA");
}

/**
 * Full AsyncStorage key for today's recommendation outcome.
 */
export function recommendationStorageKey(dateKey?: string): string {
  return `${RECOMMENDATION_STORAGE_KEY_PREFIX}${dateKey ?? todayDateKey()}`;
}

// ---------------------------------------------------------------------------
// Telemetry prop builders — keep analytics concerns out of components
// ---------------------------------------------------------------------------

export function buildRecommendationShownProps(data: DeloadCheckData) {
  return {
    avg_fatigue: data.avgFatigue,
    session_count: data.sessionCount,
    internal_session_count: data.internalSessionCount ?? 0,
    external_session_count: data.externalSessionCount ?? 0,
    weekly_volume: data.weeklyVolume,
    volume_reduction_pct: DELOAD_VOLUME_REDUCTION_PCT,
    intensity_reduction_pct: DELOAD_INTENSITY_REDUCTION_PCT,
  };
}

export function buildRecommendationAcceptedProps(data: DeloadCheckData) {
  return {
    avg_fatigue: data.avgFatigue,
    session_count: data.sessionCount,
    volume_reduction_pct: DELOAD_VOLUME_REDUCTION_PCT,
    intensity_reduction_pct: DELOAD_INTENSITY_REDUCTION_PCT,
  };
}

export function buildRecommendationOverriddenProps(data: DeloadCheckData) {
  return {
    avg_fatigue: data.avgFatigue,
    session_count: data.sessionCount,
    volume_reduction_pct: DELOAD_VOLUME_REDUCTION_PCT,
    intensity_reduction_pct: DELOAD_INTENSITY_REDUCTION_PCT,
  };
}

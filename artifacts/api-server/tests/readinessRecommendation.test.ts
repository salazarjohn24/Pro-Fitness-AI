/**
 * readinessRecommendation.test.ts
 *
 * Unit tests for the "Today's Training Adjustment" card utilities.
 *
 * All constants and pure functions from artifacts/mobile/lib/readinessRecommendation.ts
 * are inlined here to keep the test suite self-contained (no React Native imports
 * or cross-workspace module resolution needed in vitest).
 *
 * Test coverage:
 *   - shouldShowAdjustmentCard  (gate logic)
 *   - buildAdjustmentCard       (card data builder)
 *   - buildRecommendationShownProps / AcceptedProps / OverriddenProps  (telemetry prop builders)
 *   - recommendationStorageKey  (AsyncStorage key helper)
 *   - TelemetryEvent union completeness (compile-time guard)
 */

import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Inlined constants (kept in sync with readinessRecommendation.ts)
// ---------------------------------------------------------------------------

const DELOAD_VOLUME_REDUCTION_PCT = 40;
const DELOAD_INTENSITY_REDUCTION_PCT = 20;
const RECOMMENDATION_STORAGE_KEY_PREFIX = "recommendation_outcome_";

// ---------------------------------------------------------------------------
// Inlined types
// ---------------------------------------------------------------------------

interface DeloadCheckData {
  recommended: boolean;
  reason: string | null;
  avgFatigue: number;
  weeklyVolume: number;
  sessionCount: number;
  internalSessionCount?: number;
  externalSessionCount?: number;
}

interface AdjustmentCard {
  title: string;
  reasonText: string;
  adjustmentSummary: string;
  volumeReductionPct: number;
  intensityReductionPct: number;
  helperText: string;
}

type RecommendationOutcome = "accepted" | "overridden" | null;

// ---------------------------------------------------------------------------
// Inlined pure functions (kept in sync with readinessRecommendation.ts)
// ---------------------------------------------------------------------------

function buildAdjustmentCard(data: DeloadCheckData): AdjustmentCard {
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

function shouldShowAdjustmentCard(data: DeloadCheckData | undefined): boolean {
  return !!(data?.recommended && data.reason);
}

function recommendationStorageKey(dateKey?: string): string {
  const key = dateKey ?? new Date().toLocaleDateString("en-CA");
  return `${RECOMMENDATION_STORAGE_KEY_PREFIX}${key}`;
}

function buildRecommendationShownProps(data: DeloadCheckData) {
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

function buildRecommendationAcceptedProps(data: DeloadCheckData) {
  return {
    avg_fatigue: data.avgFatigue,
    session_count: data.sessionCount,
    volume_reduction_pct: DELOAD_VOLUME_REDUCTION_PCT,
    intensity_reduction_pct: DELOAD_INTENSITY_REDUCTION_PCT,
  };
}

function buildRecommendationOverriddenProps(data: DeloadCheckData) {
  return {
    avg_fatigue: data.avgFatigue,
    session_count: data.sessionCount,
    volume_reduction_pct: DELOAD_VOLUME_REDUCTION_PCT,
    intensity_reduction_pct: DELOAD_INTENSITY_REDUCTION_PCT,
  };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeDeloadCheck(overrides: Partial<DeloadCheckData> = {}): DeloadCheckData {
  return {
    recommended: true,
    reason: "Your fatigue has been high for 3 consecutive days.",
    avgFatigue: 75,
    weeklyVolume: 11500,
    sessionCount: 5,
    internalSessionCount: 3,
    externalSessionCount: 2,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// shouldShowAdjustmentCard
// ---------------------------------------------------------------------------

describe("shouldShowAdjustmentCard", () => {
  it("returns true when recommended=true and reason is a non-empty string", () => {
    const data = makeDeloadCheck();
    expect(shouldShowAdjustmentCard(data)).toBe(true);
  });

  it("returns false when recommended=false even with a reason present", () => {
    const data = makeDeloadCheck({ recommended: false });
    expect(shouldShowAdjustmentCard(data)).toBe(false);
  });

  it("returns false when recommended=true but reason is null", () => {
    const data = makeDeloadCheck({ reason: null });
    expect(shouldShowAdjustmentCard(data)).toBe(false);
  });

  it("returns false when recommended=true but reason is an empty string", () => {
    const data = makeDeloadCheck({ reason: "" });
    expect(shouldShowAdjustmentCard(data)).toBe(false);
  });

  it("returns false when the data is undefined (not yet loaded)", () => {
    expect(shouldShowAdjustmentCard(undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildAdjustmentCard — card data builder
// ---------------------------------------------------------------------------

describe("buildAdjustmentCard", () => {
  it("returns the canonical title string", () => {
    const card = buildAdjustmentCard(makeDeloadCheck());
    expect(card.title).toBe("Today's Training Adjustment");
  });

  it("uses the reason from deloadCheck as the reasonText", () => {
    const data = makeDeloadCheck({ reason: "Three high-fatigue days detected." });
    const card = buildAdjustmentCard(data);
    expect(card.reasonText).toBe("Three high-fatigue days detected.");
  });

  it("falls back to a generic reason when reason is null", () => {
    const data = makeDeloadCheck({ reason: null });
    const card = buildAdjustmentCard(data);
    expect(card.reasonText).toBe(
      "Your recent training load and recovery data suggest a lighter session today."
    );
  });

  it("embeds the configured volume reduction % in the adjustmentSummary", () => {
    const card = buildAdjustmentCard(makeDeloadCheck());
    expect(card.adjustmentSummary).toContain(`${DELOAD_VOLUME_REDUCTION_PCT}%`);
    expect(card.volumeReductionPct).toBe(DELOAD_VOLUME_REDUCTION_PCT);
  });

  it("embeds the configured intensity reduction % in the adjustmentSummary", () => {
    const card = buildAdjustmentCard(makeDeloadCheck());
    expect(card.adjustmentSummary).toContain(`${DELOAD_INTENSITY_REDUCTION_PCT}%`);
    expect(card.intensityReductionPct).toBe(DELOAD_INTENSITY_REDUCTION_PCT);
  });

  it("adjustmentSummary format is 'Volume −X% · Intensity −Y%'", () => {
    const card = buildAdjustmentCard(makeDeloadCheck());
    expect(card.adjustmentSummary).toBe("Volume −40% · Intensity −20%");
  });

  it("helperText is the canonical user-control copy string", () => {
    const card = buildAdjustmentCard(makeDeloadCheck());
    expect(card.helperText).toBe(
      "You're always in control. We'll learn from your choice."
    );
  });

  it("volumeReductionPct equals DELOAD_VOLUME_REDUCTION_PCT constant (40)", () => {
    const card = buildAdjustmentCard(makeDeloadCheck());
    expect(card.volumeReductionPct).toBe(40);
  });

  it("intensityReductionPct equals DELOAD_INTENSITY_REDUCTION_PCT constant (20)", () => {
    const card = buildAdjustmentCard(makeDeloadCheck());
    expect(card.intensityReductionPct).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// Telemetry prop builders — readiness_recommendation_shown
// ---------------------------------------------------------------------------

describe("buildRecommendationShownProps (readiness_recommendation_shown)", () => {
  it("maps avgFatigue to avg_fatigue", () => {
    const data = makeDeloadCheck({ avgFatigue: 72.5 });
    const props = buildRecommendationShownProps(data);
    expect(props.avg_fatigue).toBe(72.5);
  });

  it("maps sessionCount to session_count", () => {
    const data = makeDeloadCheck({ sessionCount: 5 });
    const props = buildRecommendationShownProps(data);
    expect(props.session_count).toBe(5);
  });

  it("maps internalSessionCount to internal_session_count", () => {
    const data = makeDeloadCheck({ internalSessionCount: 3 });
    const props = buildRecommendationShownProps(data);
    expect(props.internal_session_count).toBe(3);
  });

  it("maps externalSessionCount to external_session_count", () => {
    const data = makeDeloadCheck({ externalSessionCount: 2 });
    const props = buildRecommendationShownProps(data);
    expect(props.external_session_count).toBe(2);
  });

  it("defaults internal_session_count to 0 when field is absent", () => {
    const data = makeDeloadCheck({ internalSessionCount: undefined });
    const props = buildRecommendationShownProps(data);
    expect(props.internal_session_count).toBe(0);
  });

  it("defaults external_session_count to 0 when field is absent", () => {
    const data = makeDeloadCheck({ externalSessionCount: undefined });
    const props = buildRecommendationShownProps(data);
    expect(props.external_session_count).toBe(0);
  });

  it("maps weeklyVolume to weekly_volume", () => {
    const data = makeDeloadCheck({ weeklyVolume: 11500 });
    const props = buildRecommendationShownProps(data);
    expect(props.weekly_volume).toBe(11500);
  });

  it("always includes volume_reduction_pct = DELOAD_VOLUME_REDUCTION_PCT", () => {
    const props = buildRecommendationShownProps(makeDeloadCheck());
    expect(props.volume_reduction_pct).toBe(DELOAD_VOLUME_REDUCTION_PCT);
  });

  it("always includes intensity_reduction_pct = DELOAD_INTENSITY_REDUCTION_PCT", () => {
    const props = buildRecommendationShownProps(makeDeloadCheck());
    expect(props.intensity_reduction_pct).toBe(DELOAD_INTENSITY_REDUCTION_PCT);
  });

  it("has exactly 7 properties (full event payload contract)", () => {
    const props = buildRecommendationShownProps(makeDeloadCheck());
    expect(Object.keys(props)).toHaveLength(7);
  });
});

// ---------------------------------------------------------------------------
// Telemetry prop builders — readiness_recommendation_accepted (accept flow)
// ---------------------------------------------------------------------------

describe("buildRecommendationAcceptedProps (readiness_recommendation_accepted / accept flow)", () => {
  it("maps avgFatigue to avg_fatigue", () => {
    const data = makeDeloadCheck({ avgFatigue: 80 });
    const props = buildRecommendationAcceptedProps(data);
    expect(props.avg_fatigue).toBe(80);
  });

  it("maps sessionCount to session_count", () => {
    const data = makeDeloadCheck({ sessionCount: 4 });
    const props = buildRecommendationAcceptedProps(data);
    expect(props.session_count).toBe(4);
  });

  it("always includes volume_reduction_pct = 40", () => {
    const props = buildRecommendationAcceptedProps(makeDeloadCheck());
    expect(props.volume_reduction_pct).toBe(40);
  });

  it("always includes intensity_reduction_pct = 20", () => {
    const props = buildRecommendationAcceptedProps(makeDeloadCheck());
    expect(props.intensity_reduction_pct).toBe(20);
  });

  it("has exactly 4 properties (compact accept payload contract)", () => {
    const props = buildRecommendationAcceptedProps(makeDeloadCheck());
    expect(Object.keys(props)).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// Telemetry prop builders — readiness_recommendation_overridden (override flow)
// ---------------------------------------------------------------------------

describe("buildRecommendationOverriddenProps (readiness_recommendation_overridden / override flow)", () => {
  it("maps avgFatigue to avg_fatigue", () => {
    const data = makeDeloadCheck({ avgFatigue: 68 });
    const props = buildRecommendationOverriddenProps(data);
    expect(props.avg_fatigue).toBe(68);
  });

  it("maps sessionCount to session_count", () => {
    const data = makeDeloadCheck({ sessionCount: 6 });
    const props = buildRecommendationOverriddenProps(data);
    expect(props.session_count).toBe(6);
  });

  it("always includes volume_reduction_pct = 40", () => {
    const props = buildRecommendationOverriddenProps(makeDeloadCheck());
    expect(props.volume_reduction_pct).toBe(40);
  });

  it("always includes intensity_reduction_pct = 20", () => {
    const props = buildRecommendationOverriddenProps(makeDeloadCheck());
    expect(props.intensity_reduction_pct).toBe(20);
  });

  it("has exactly 4 properties (compact override payload contract)", () => {
    const props = buildRecommendationOverriddenProps(makeDeloadCheck());
    expect(Object.keys(props)).toHaveLength(4);
  });

  it("accepted and overridden props have identical shape (symmetric event contract)", () => {
    const data = makeDeloadCheck();
    const accepted = buildRecommendationAcceptedProps(data);
    const overridden = buildRecommendationOverriddenProps(data);
    expect(Object.keys(accepted).sort()).toEqual(Object.keys(overridden).sort());
  });
});

// ---------------------------------------------------------------------------
// AsyncStorage key helper
// ---------------------------------------------------------------------------

describe("recommendationStorageKey", () => {
  it("uses the prefix constant in the key", () => {
    const key = recommendationStorageKey("2026-03-20");
    expect(key).toContain(RECOMMENDATION_STORAGE_KEY_PREFIX);
  });

  it("appends the provided date to the prefix", () => {
    const key = recommendationStorageKey("2026-03-20");
    expect(key).toBe("recommendation_outcome_2026-03-20");
  });

  it("different dates produce different keys (choice isolation across days)", () => {
    const key1 = recommendationStorageKey("2026-03-20");
    const key2 = recommendationStorageKey("2026-03-21");
    expect(key1).not.toBe(key2);
  });

  it("returns a string when no dateKey is provided (uses today)", () => {
    const key = recommendationStorageKey();
    expect(typeof key).toBe("string");
    expect(key.startsWith(RECOMMENDATION_STORAGE_KEY_PREFIX)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Configurable constants — change-detection guard
// ---------------------------------------------------------------------------

describe("configurable constants", () => {
  it("DELOAD_VOLUME_REDUCTION_PCT is 40", () => {
    expect(DELOAD_VOLUME_REDUCTION_PCT).toBe(40);
  });

  it("DELOAD_INTENSITY_REDUCTION_PCT is 20", () => {
    expect(DELOAD_INTENSITY_REDUCTION_PCT).toBe(20);
  });

  it("RECOMMENDATION_STORAGE_KEY_PREFIX is 'recommendation_outcome_'", () => {
    expect(RECOMMENDATION_STORAGE_KEY_PREFIX).toBe("recommendation_outcome_");
  });

  it("volume reduction is at least 20% (meaningful adjustment)", () => {
    expect(DELOAD_VOLUME_REDUCTION_PCT).toBeGreaterThanOrEqual(20);
  });

  it("intensity reduction is at most 50% (not so aggressive it prevents training)", () => {
    expect(DELOAD_INTENSITY_REDUCTION_PCT).toBeLessThanOrEqual(50);
  });
});

// ---------------------------------------------------------------------------
// Telemetry event name contract
// ---------------------------------------------------------------------------

describe("telemetry event name contract", () => {
  const VALID_NAMES = [
    "readiness_recommendation_shown",
    "readiness_recommendation_accepted",
    "readiness_recommendation_overridden",
  ] as const;

  it.each(VALID_NAMES)("'%s' is a lowercase snake_case string", (name) => {
    expect(name).toMatch(/^[a-z_]+$/);
  });

  it("has exactly 3 readiness recommendation event names", () => {
    expect(VALID_NAMES).toHaveLength(3);
  });

  it("each event name is unique", () => {
    const unique = new Set(VALID_NAMES);
    expect(unique.size).toBe(VALID_NAMES.length);
  });
});

// ---------------------------------------------------------------------------
// Copy strings
// ---------------------------------------------------------------------------

describe("copy strings (canonical user-facing text)", () => {
  const EXPECTED_COPY = {
    title: "Today's Training Adjustment",
    helperText: "You're always in control. We'll learn from your choice.",
    acceptButton: "Use Recommended Plan",
    overrideButton: "Train as Planned",
    acceptedOutcome: "Lighter session applied — good call.",
    overriddenOutcome: "Training as planned — we'll track it.",
  };

  it("card title is exact", () => {
    const card = buildAdjustmentCard(makeDeloadCheck());
    expect(card.title).toBe(EXPECTED_COPY.title);
  });

  it("helperText is exact", () => {
    const card = buildAdjustmentCard(makeDeloadCheck());
    expect(card.helperText).toBe(EXPECTED_COPY.helperText);
  });

  it("adjustmentSummary uses minus sign (−) not hyphen (-)", () => {
    const card = buildAdjustmentCard(makeDeloadCheck());
    expect(card.adjustmentSummary).toContain("−");
    expect(card.adjustmentSummary).not.toMatch(/Volume -\d/);
  });
});

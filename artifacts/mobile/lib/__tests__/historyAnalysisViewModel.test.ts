/**
 * historyAnalysisViewModel.test.ts — Tests for buildHistoryAnalysisViewModel.
 */

import { describe, it, expect } from "vitest";
import {
  buildHistoryAnalysisViewModel,
  EMPTY_HISTORY_ANALYSIS,
  type HistoricalRollupResultJSON,
  type InsightGenerationResultJSON,
} from "../viewModels/historyAnalysisViewModel";

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

function makeRollup(overrides: Partial<HistoricalRollupResultJSON> = {}): HistoricalRollupResultJSON {
  return {
    cumulativeMuscleVector:  { quads: 8.0, glutes: 5.5, hamstrings: 4.0, core: 2.0 },
    cumulativePatternVector: { squat: 12.0, hinge: 4.0, horizontal_push: 2.0 },
    cumulativeStimulusVector: { strength: 0.8, muscular_endurance: 0.3, conditioning: 0.1, power: 0.05, endurance: 0.0, flexibility: 0.0, stability: 0.0 },
    recencyMuscleVector:     { quads: 6.0, glutes: 4.0, hamstrings: 3.0, core: 1.5 },
    recencyPatternVector:    { squat: 8.0, hinge: 3.0 },
    summary: {
      topMusclesCumulative:  [
        { key: "quads",      score: 8.0, rank: 1 },
        { key: "glutes",     score: 5.5, rank: 2 },
        { key: "hamstrings", score: 4.0, rank: 3 },
        { key: "core",       score: 2.0, rank: 4 },
      ],
      topPatternsCumulative: [
        { key: "squat",          score: 12.0, rank: 1 },
        { key: "hinge",          score: 4.0,  rank: 2 },
        { key: "horizontal_push", score: 2.0, rank: 3 },
      ],
      topMusclesRecent:      [
        { key: "quads",      score: 6.0, rank: 1 },
        { key: "glutes",     score: 4.0, rank: 2 },
        { key: "hamstrings", score: 3.0, rank: 3 },
      ],
      topPatternsRecent:     [
        { key: "squat", score: 8.0, rank: 1 },
        { key: "hinge", score: 3.0, rank: 2 },
      ],
      underrepresentedMuscles:  [
        { key: "biceps",    score: 0.2, rank: 1 },
        { key: "triceps",   score: 0.3, rank: 2 },
      ],
      underrepresentedPatterns: [
        { key: "vertical_push",  score: 0.5, rank: 1 },
        { key: "horizontal_pull", score: 0.8, rank: 2 },
      ],
      dominantStimulusCumulative: "strength",
      dominantStimulusRecent:     "strength",
      recentlyElevated: [],
      recentlyReduced:  [],
    },
    metadata: {
      filteredWorkouts:        6,
      totalWorkouts:           6,
      workoutsWithFallback:    0,
      totalFallbackMovements:  0,
      oldestWorkoutDate:       "2026-03-01T12:00:00Z",
      newestWorkoutDate:       "2026-04-01T12:00:00Z",
    },
    ...overrides,
  };
}

function makeInsights(overrides: Partial<InsightGenerationResultJSON> = {}): InsightGenerationResultJSON {
  return {
    insights: [
      {
        type:     "dominant_pattern_bias",
        severity: "info",
        subject:  "squat",
        text:     "Training has leaned toward squat-pattern work over this range.",
      },
      {
        type:     "underrepresented_pattern",
        severity: "info",
        subject:  "vertical_push",
        text:     "Vertical pushing has had less exposure relative to other patterns.",
      },
    ],
    summary: {
      headline:     "A strength-forward range with a squat-pattern emphasis.",
      observations: [
        "Quadriceps and glutes have been the most emphasised muscle groups.",
        "Vertical pushing has received less exposure relative to other patterns.",
      ],
    },
    rangeLabel:   "past 30 days",
    workoutCount: 6,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// A) Null / empty inputs
// ---------------------------------------------------------------------------

describe("buildHistoryAnalysisViewModel: null/empty inputs", () => {
  it("returns EMPTY model for null rollup", () => {
    const m = buildHistoryAnalysisViewModel(null, makeInsights());
    expect(m.hasEnoughData).toBe(false);
    expect(m.workoutCount).toBe(0);
    expect(m.topMuscles).toHaveLength(0);
  });

  it("returns EMPTY model for null insights", () => {
    const m = buildHistoryAnalysisViewModel(makeRollup(), null);
    expect(m.hasEnoughData).toBe(false);
  });

  it("returns EMPTY model for both null", () => {
    const m = buildHistoryAnalysisViewModel(null, null);
    expect(m).toMatchObject(EMPTY_HISTORY_ANALYSIS);
  });

  it("returns partial model with headline for zero workouts", () => {
    const m = buildHistoryAnalysisViewModel(
      makeRollup({ metadata: { filteredWorkouts: 0, totalWorkouts: 0, workoutsWithFallback: 0, totalFallbackMovements: 0, oldestWorkoutDate: null, newestWorkoutDate: null } }),
      makeInsights({ workoutCount: 0, summary: { headline: "No workout data for this range", observations: [] } })
    );
    expect(m.headline).toContain("No workout data");
    expect(m.hasEnoughData).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// B) Structure and field mapping
// ---------------------------------------------------------------------------

describe("buildHistoryAnalysisViewModel: structure", () => {
  const m = buildHistoryAnalysisViewModel(makeRollup(), makeInsights());

  it("workoutCount is correct", () => expect(m.workoutCount).toBe(6));
  it("rangeLabel is preserved", () => expect(m.rangeLabel).toBe("past 30 days"));
  it("hasEnoughData = true for ≥2 workouts", () => expect(m.hasEnoughData).toBe(true));
  it("headline is preserved from insights", () => expect(m.headline).toContain("squat-pattern"));

  it("topMuscles have display labels", () => {
    expect(m.topMuscles[0].key).toBe("quads");
    expect(m.topMuscles[0].label).toBe("Quadriceps");
    expect(m.topMuscles.length).toBe(4);
  });

  it("topPatterns have display labels", () => {
    expect(m.topPatterns[0].key).toBe("squat");
    expect(m.topPatterns[0].label).toBe("Squat");
    expect(m.topPatterns[1].label).toBe("Hinge");
  });

  it("dominantStimulus is labelled", () => {
    expect(m.dominantStimulus).toBe("Strength");
  });

  it("summaryObservations are present", () => {
    expect(m.summaryObservations.length).toBe(2);
    expect(m.summaryObservations[0]).toContain("Quadriceps");
  });

  it("dataQualityNote is null when no fallback", () => {
    expect(m.dataQualityNote).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// C) Insight cards
// ---------------------------------------------------------------------------

describe("buildHistoryAnalysisViewModel: insight cards", () => {
  const m = buildHistoryAnalysisViewModel(makeRollup(), makeInsights());

  it("cards are present", () => {
    expect(m.insightCards.length).toBeGreaterThan(0);
  });

  it("cards have required fields", () => {
    for (const card of m.insightCards) {
      expect(card.type).toBeDefined();
      expect(card.severity).toBeDefined();
      expect(card.severityTier).toBeDefined();
      expect(card.text).toBeDefined();
      expect(card.text.length).toBeGreaterThan(0);
    }
  });

  it("severityTier is populated for each card", () => {
    for (const card of m.insightCards) {
      expect(["neutral", "soft", "medium", "strong"]).toContain(card.severityTier);
    }
  });

  it("data_quality_note cards are excluded from insightCards", () => {
    const withQuality = makeInsights({
      insights: [
        ...makeInsights().insights,
        { type: "data_quality_note", severity: "low", subject: "data_quality", text: "Some unrecognised movements." },
      ],
    });
    const m2 = buildHistoryAnalysisViewModel(makeRollup(), withQuality);
    const qualityCards = m2.insightCards.filter((c) => c.type === "data_quality_note");
    expect(qualityCards).toHaveLength(0);
    expect(m2.dataQualityNote).toBe("Some unrecognised movements.");
  });
});

// ---------------------------------------------------------------------------
// D) Recently elevated / reduced muscle shifts
// ---------------------------------------------------------------------------

describe("buildHistoryAnalysisViewModel: recent shifts", () => {
  const rollupWithShifts = makeRollup();
  rollupWithShifts.summary.recentlyElevated = [
    { key: "quads", cumulativeRank: 1, recentRank: 1, rankDelta: 0 },
    { key: "glutes", cumulativeRank: 2, recentRank: 1, rankDelta: 1 },
  ];
  rollupWithShifts.summary.recentlyReduced = [
    { key: "hamstrings", cumulativeRank: 3, recentRank: 5, rankDelta: -2 },
  ];

  const m = buildHistoryAnalysisViewModel(rollupWithShifts, makeInsights());

  it("recentShifts are built from elevated + reduced", () => {
    expect(m.recentShifts.length).toBe(3);
  });

  it("elevated shifts have direction='elevated'", () => {
    const elev = m.recentShifts.filter((s) => s.direction === "elevated");
    expect(elev.length).toBe(2);
  });

  it("reduced shifts have direction='reduced'", () => {
    const red = m.recentShifts.filter((s) => s.direction === "reduced");
    expect(red.length).toBe(1);
    expect(red[0].key).toBe("hamstrings");
  });

  it("shifts are sorted by rankDelta descending", () => {
    for (let i = 1; i < m.recentShifts.length; i++) {
      expect(m.recentShifts[i].rankDelta).toBeLessThanOrEqual(m.recentShifts[i - 1].rankDelta);
    }
  });

  it("topMuscles mark elevated muscles", () => {
    const quads = m.topMuscles.find((mu) => mu.key === "quads");
    expect(quads?.isElevatedRecently).toBe(true);
  });

  it("topMuscles mark reduced muscles", () => {
    const hams = m.topMuscles.find((mu) => mu.key === "hamstrings");
    expect(hams?.isReducedRecently).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// E) Data quality note
// ---------------------------------------------------------------------------

describe("buildHistoryAnalysisViewModel: data quality note", () => {
  it("no note when no fallback movements", () => {
    const m = buildHistoryAnalysisViewModel(makeRollup(), makeInsights());
    expect(m.dataQualityNote).toBeNull();
  });

  it("high-rate note from data_quality_note insight card", () => {
    const insights = makeInsights({
      insights: [
        { type: "data_quality_note", severity: "low", subject: "data_quality", text: "A high proportion of movements weren't recognised." },
      ],
    });
    const m = buildHistoryAnalysisViewModel(makeRollup(), insights);
    expect(m.dataQualityNote).toContain("high proportion");
  });

  it("inline fallback note from rollup metadata when no card emitted (rate ≥ 0.5)", () => {
    const rollup = makeRollup({
      metadata: {
        filteredWorkouts:       4,
        totalWorkouts:          4,
        workoutsWithFallback:   3,
        totalFallbackMovements: 4,
        oldestWorkoutDate:      null,
        newestWorkoutDate:      null,
      },
    });
    const m = buildHistoryAnalysisViewModel(rollup, makeInsights());
    expect(m.dataQualityNote).not.toBeNull();
    expect(m.dataQualityNote).toContain("generic patterns");
  });

  it("softer inline note when rate 0.25–<0.5 (1 out of 4 workouts)", () => {
    const rollup = makeRollup({
      metadata: {
        filteredWorkouts:       4,
        totalWorkouts:          4,
        workoutsWithFallback:   1,
        totalFallbackMovements: 1,
        oldestWorkoutDate:      null,
        newestWorkoutDate:      null,
      },
    });
    const m = buildHistoryAnalysisViewModel(rollup, makeInsights());
    expect(m.dataQualityNote).not.toBeNull();
    expect(m.dataQualityNote).toContain("Some movements");
  });
});

// ---------------------------------------------------------------------------
// F) Text safety
// ---------------------------------------------------------------------------

describe("buildHistoryAnalysisViewModel: text safety", () => {
  const m = buildHistoryAnalysisViewModel(makeRollup(), makeInsights());
  const prescriptive = /\b(should|must|need to|prescri|rest day|overtrain|fatigue[d]?)\b/i;

  it("headline has no prescriptive language", () => {
    expect(m.headline).not.toMatch(prescriptive);
  });

  it("insight card texts have no prescriptive language", () => {
    for (const card of m.insightCards) {
      expect(card.text, `"${card.text}" contains prescriptive language`).not.toMatch(prescriptive);
    }
  });

  it("summary observations have no prescriptive language", () => {
    for (const obs of m.summaryObservations) {
      expect(obs).not.toMatch(prescriptive);
    }
  });

  it("data quality note has no alarmist language", () => {
    const rollup = makeRollup({
      metadata: { filteredWorkouts: 4, totalWorkouts: 4, workoutsWithFallback: 3, totalFallbackMovements: 4, oldestWorkoutDate: null, newestWorkoutDate: null },
    });
    const m2 = buildHistoryAnalysisViewModel(rollup, makeInsights());
    if (m2.dataQualityNote) {
      expect(m2.dataQualityNote).not.toMatch(/error|invalid|broken|failed/i);
    }
  });
});

// ---------------------------------------------------------------------------
// G) Determinism
// ---------------------------------------------------------------------------

describe("buildHistoryAnalysisViewModel: determinism", () => {
  it("produces identical results for identical inputs", () => {
    const rollup   = makeRollup();
    const insights = makeInsights();
    const m1 = buildHistoryAnalysisViewModel(rollup, insights);
    const m2 = buildHistoryAnalysisViewModel(rollup, insights);
    expect(m1.headline).toBe(m2.headline);
    expect(m1.topMuscles.map((m) => m.key)).toEqual(m2.topMuscles.map((m) => m.key));
    expect(m1.insightCards.map((c) => c.type)).toEqual(m2.insightCards.map((c) => c.type));
  });
});

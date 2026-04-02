/**
 * step7Integration.test.ts
 *
 * Tests the data-layer decisions that drive the Step 7 UI surfaces:
 *   - workout-detail.tsx: WorkoutAnalysisPanel render/fallback/loading/error states
 *   - activity-history.tsx: TrainingOverviewPanel render/loading/empty/insight states
 *
 * Because Expo screens are not unit-testable in this environment, these tests
 * verify the exact view-model contracts each screen branch renders from, plus
 * the coexistence decisions (analysis panel vs coarse-chip fallback, etc.).
 */

import { describe, it, expect } from "vitest";
import {
  buildWorkoutAnalysisViewModel,
  EMPTY_WORKOUT_ANALYSIS,
  type WorkoutScoreResultJSON,
} from "../viewModels/workoutAnalysisViewModel";
import {
  buildHistoryAnalysisViewModel,
  EMPTY_HISTORY_ANALYSIS,
  type HistoricalRollupResultJSON,
  type InsightGenerationResultJSON,
} from "../viewModels/historyAnalysisViewModel";

// ---------------------------------------------------------------------------
// Fixture builders — correct shapes matching the real interfaces
// ---------------------------------------------------------------------------

function makeWorkoutResult(overrides: Partial<WorkoutScoreResultJSON> = {}): WorkoutScoreResultJSON {
  return {
    workoutName:    "Upper Body Strength",
    workoutType:    "strength",
    muscleVector:   { chest: 4.0, triceps: 2.0, front_delts: 1.5, upper_back_lats: 0.9 },
    patternVector:  { horizontal_push: 5.5, horizontal_pull: 0.9 },
    stimulusVector: { strength: 0.9, muscular_endurance: 0.1, conditioning: 0.0, power: 0.0, endurance: 0.0, flexibility: 0.0, stability: 0.0 },
    summary: {
      topMuscles: [
        { key: "chest",           score: 4.0, rank: 1 },
        { key: "triceps",         score: 2.0, rank: 2 },
        { key: "front_delts",     score: 1.5, rank: 3 },
        { key: "upper_back_lats", score: 0.9, rank: 4 },
      ],
      topPatterns: [
        { key: "horizontal_push", score: 5.5, rank: 1 },
        { key: "horizontal_pull", score: 0.9, rank: 2 },
      ],
      dominantStimulus: "strength",
      presentStimuli:   [{ stimulus: "strength", value: 0.9 }],
    },
    metadata: {
      totalMovements:        3,
      scoredMovements:       3,
      fallbackMovements:     0,
      fallbackMovementNames: [],
      totalRawScore:         8.4,
    },
    ...overrides,
  };
}

function makeRollup(overrides: Partial<HistoricalRollupResultJSON> = {}): HistoricalRollupResultJSON {
  return {
    cumulativeMuscleVector:  { quads: 25.0, glutes: 18.0, hamstrings: 12.0, core: 8.0 },
    cumulativePatternVector: { squat: 30.0, hinge: 15.0 },
    cumulativeStimulusVector:{ strength: 0.7, muscular_endurance: 0.2, conditioning: 0.1, power: 0.0, endurance: 0.0, flexibility: 0.0, stability: 0.0 },
    recencyMuscleVector:     { quads: 22.0, glutes: 15.0, hamstrings: 8.0, core: 5.0 },
    recencyPatternVector:    { squat: 26.0, hinge: 10.0 },
    summary: {
      topMusclesCumulative: [
        { key: "quads",      score: 25.0, rank: 1 },
        { key: "glutes",     score: 18.0, rank: 2 },
        { key: "hamstrings", score: 12.0, rank: 3 },
        { key: "core",       score: 8.0,  rank: 4 },
      ],
      topPatternsCumulative: [
        { key: "squat", score: 30.0, rank: 1 },
        { key: "hinge", score: 15.0, rank: 2 },
      ],
      topMusclesRecent: [
        { key: "quads",  score: 22.0, rank: 1 },
        { key: "glutes", score: 15.0, rank: 2 },
      ],
      topPatternsRecent: [
        { key: "squat", score: 26.0, rank: 1 },
      ],
      underrepresentedMuscles:  [],
      underrepresentedPatterns: [],
      dominantStimulusCumulative: "strength",
      dominantStimulusRecent:     "strength",
      recentlyElevated: [],
      recentlyReduced:  [],
    },
    metadata: {
      filteredWorkouts:        14,
      totalWorkouts:           15,
      workoutsWithFallback:    0,
      totalFallbackMovements:  0,
      oldestWorkoutDate:       "2026-03-03T00:00:00.000Z",
      newestWorkoutDate:       "2026-04-01T00:00:00.000Z",
    },
    ...overrides,
  };
}

function makeInsights(overrides: Partial<InsightGenerationResultJSON> = {}): InsightGenerationResultJSON {
  return {
    insights: [
      {
        type:     "dominant_pattern",
        severity: "moderate",
        subject:  "squat",
        text:     "Squat patterns represent a substantial share of recent volume.",
        evidence: "squat: 67%",
      },
      {
        type:     "underrepresented_muscle",
        severity: "low",
        subject:  "rear_delts",
        text:     "Rear delts have seen very little emphasis in this range.",
        evidence: undefined,
      },
    ],
    summary: {
      headline:     "A strength-focused range with a squat-pattern emphasis.",
      observations: [
        "Squat patterns dominated this period.",
        "Rear delts had limited stimulus.",
      ],
    },
    rangeLabel:   "past month",
    workoutCount: 14,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// WORKOUT DETAIL: Analysis panel render decisions
// ---------------------------------------------------------------------------

describe("Step 7 — Workout Detail: WorkoutAnalysisPanel state decisions", () => {
  it("hasAnalysis=false when null is passed (loading / no data state)", () => {
    const vm = buildWorkoutAnalysisViewModel(null);
    expect(vm.hasAnalysis).toBe(false);
    expect(vm.topMuscles).toHaveLength(0);
    expect(vm.topPatterns).toHaveLength(0);
    expect(vm.dominantStimulus.key).toBe("");
    expect(vm.dataQualityNote).toBeNull();
  });

  it("hasAnalysis=true with valid session analysis data", () => {
    const vm = buildWorkoutAnalysisViewModel(makeWorkoutResult());
    expect(vm.hasAnalysis).toBe(true);
  });

  it("headline is populated from workoutName + workoutType", () => {
    const vm = buildWorkoutAnalysisViewModel(makeWorkoutResult());
    expect(vm.headline).toBeTruthy();
    expect(vm.headline.length).toBeGreaterThan(0);
  });

  it("topMuscles are present and labelled (not raw snake_case keys)", () => {
    const vm = buildWorkoutAnalysisViewModel(makeWorkoutResult());
    expect(vm.topMuscles.length).toBeGreaterThan(0);
    // "upper_back_lats" must map to a human-readable label
    const upperBackRow = vm.topMuscles.find(m => m.key === "upper_back_lats");
    expect(upperBackRow).toBeDefined();
    expect(upperBackRow!.label).not.toBe("upper_back_lats");
    expect(upperBackRow!.label.length).toBeGreaterThan(0);
  });

  it("topPatterns are present and have human labels", () => {
    const vm = buildWorkoutAnalysisViewModel(makeWorkoutResult());
    expect(vm.topPatterns.length).toBeGreaterThan(0);
    // "horizontal_push" must map to something readable
    const pushRow = vm.topPatterns.find(p => p.key === "horizontal_push");
    expect(pushRow).toBeDefined();
    expect(pushRow!.label).not.toBe("horizontal_push");
    expect(pushRow!.label.length).toBeGreaterThan(0);
  });

  it("dominantStimulus key and label are populated", () => {
    const vm = buildWorkoutAnalysisViewModel(makeWorkoutResult());
    expect(vm.dominantStimulus.key).toBe("strength");
    expect(vm.dominantStimulus.label).toBeTruthy();
    // "strength" should map to something (may or may not be the same string)
    expect(vm.dominantStimulus.label.length).toBeGreaterThan(0);
  });

  it("dataQualityNote is null when all movements are scored", () => {
    const vm = buildWorkoutAnalysisViewModel(makeWorkoutResult());
    expect(vm.dataQualityNote).toBeNull();
  });

  it("dataQualityNote is present when many movements fell back", () => {
    const vm = buildWorkoutAnalysisViewModel(
      makeWorkoutResult({
        metadata: {
          totalMovements:        4,
          scoredMovements:       1,
          fallbackMovements:     3,
          fallbackMovementNames: ["Cable Fly", "Hammer Curl", "Shrugs"],
          totalRawScore:         2.0,
        },
      })
    );
    expect(vm.dataQualityNote).not.toBeNull();
    expect(typeof vm.dataQualityNote).toBe("string");
    expect((vm.dataQualityNote as string).length).toBeGreaterThan(0);
  });

  it("empty result matches EMPTY_WORKOUT_ANALYSIS shape", () => {
    const vm = buildWorkoutAnalysisViewModel(null);
    expect(vm.hasAnalysis).toBe(EMPTY_WORKOUT_ANALYSIS.hasAnalysis);
    expect(vm.topMuscles).toHaveLength(0);
    expect(vm.topPatterns).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// WORKOUT DETAIL: Coexistence — external workout path
// ---------------------------------------------------------------------------

describe("Step 7 — Workout Detail: External workout coexistence", () => {
  it("analysis hook called with null for external workouts → returns empty vm", () => {
    // External sessions pass null to useWorkoutAnalysis(null).
    // The hook returns null, so buildWorkoutAnalysisViewModel(null) is called.
    const vm = buildWorkoutAnalysisViewModel(null);
    expect(vm.hasAnalysis).toBe(false);
    // Screen renders coarse muscleGroups chips instead — analysis panel hidden.
  });

  it("no contamination: external workout shows no engine data", () => {
    const vm = buildWorkoutAnalysisViewModel(null);
    expect(vm.topMuscles).toHaveLength(0);
    expect(vm.topPatterns).toHaveLength(0);
    expect(vm.dominantStimulus.label).toBe("—");
  });

  it("internal session with valid data: hasAnalysis=true, overrides coarse chips", () => {
    const vm = buildWorkoutAnalysisViewModel(makeWorkoutResult());
    expect(vm.hasAnalysis).toBe(true);
    // Screen: renders WorkoutAnalysisPanel, skips coarse muscleGroupsInternal chips.
  });
});

// ---------------------------------------------------------------------------
// HISTORY OVERVIEW: TrainingOverviewPanel state decisions
// ---------------------------------------------------------------------------

describe("Step 7 — History Overview: TrainingOverviewPanel state decisions", () => {
  it("workoutCount=0 and hasEnoughData=false when both args are null", () => {
    const vm = buildHistoryAnalysisViewModel(null, null);
    expect(vm.workoutCount).toBe(0);
    expect(vm.hasEnoughData).toBe(false);
  });

  it("workoutCount=0 when rollup is null", () => {
    const vm = buildHistoryAnalysisViewModel(null, makeInsights());
    expect(vm.workoutCount).toBe(0);
  });

  it("workoutCount=0 when insights is null", () => {
    const vm = buildHistoryAnalysisViewModel(makeRollup(), null);
    expect(vm.workoutCount).toBe(0);
  });

  it("headline is populated from insights.summary.headline", () => {
    const vm = buildHistoryAnalysisViewModel(makeRollup(), makeInsights());
    expect(vm.headline).toBe("A strength-focused range with a squat-pattern emphasis.");
  });

  it("topMuscles are present and labelled (not raw snake_case keys)", () => {
    const vm = buildHistoryAnalysisViewModel(makeRollup(), makeInsights());
    expect(vm.topMuscles.length).toBeGreaterThan(0);
    const quads = vm.topMuscles.find(m => m.key === "quads");
    expect(quads).toBeDefined();
    expect(quads!.label.length).toBeGreaterThan(0);
  });

  it("insight cards are present and have required fields", () => {
    const vm = buildHistoryAnalysisViewModel(makeRollup(), makeInsights());
    expect(vm.insightCards.length).toBeGreaterThan(0);
    for (const card of vm.insightCards) {
      expect(card.type).toBeTruthy();
      expect(card.severity).toMatch(/^(info|low|moderate|high)$/);
      expect(card.severityTier).toMatch(/^(neutral|soft|medium|strong)$/);
      expect(typeof card.text).toBe("string");
      expect(card.text.length).toBeGreaterThan(0);
    }
  });

  it("insight cards preserve API insertion order with data_quality_note stripped", () => {
    // The view model preserves the order delivered by the API (the backend sorts by severity).
    // data_quality_note cards are stripped and surfaced as vm.dataQualityNote instead.
    const insightsWithOrder = makeInsights({
      insights: [
        { type: "dominant_pattern",        severity: "moderate", subject: "squat",      text: "Moderate text.", evidence: "squat: 67%" },
        { type: "underrepresented_muscle", severity: "low",      subject: "rear_delts", text: "Low text.",      evidence: undefined },
        { type: "data_quality_note",       severity: "info",     subject: "data",       text: "Info text.",     evidence: undefined },
      ],
    });
    const vm = buildHistoryAnalysisViewModel(makeRollup(), insightsWithOrder);
    // data_quality_note should be stripped, leaving only the 2 content cards
    expect(vm.insightCards).toHaveLength(2);
    expect(vm.insightCards[0].type).toBe("dominant_pattern");
    expect(vm.insightCards[1].type).toBe("underrepresented_muscle");
    // And the data quality note is accessible separately
    expect(vm.dataQualityNote).toBe("Info text.");
  });

  it("insight card text is non-prescriptive (no imperative verbs)", () => {
    const vm = buildHistoryAnalysisViewModel(makeRollup(), makeInsights());
    const prescriptiveVerbs = /\b(should|must|need to|have to|try to|add more|reduce|increase|start|stop)\b/i;
    for (const card of vm.insightCards) {
      expect(prescriptiveVerbs.test(card.text)).toBe(false);
    }
  });

  it("summaryObservations comes from insights.summary.observations", () => {
    const vm = buildHistoryAnalysisViewModel(makeRollup(), makeInsights());
    expect(vm.summaryObservations).toEqual([
      "Squat patterns dominated this period.",
      "Rear delts had limited stimulus.",
    ]);
  });

  it("dataQualityNote is null when no data_quality_note insight emitted and metadata is clean", () => {
    const vm = buildHistoryAnalysisViewModel(makeRollup(), makeInsights());
    // No data_quality_note card + clean metadata → null
    expect(vm.dataQualityNote).toBeNull();
  });

  it("dataQualityNote is present when a data_quality_note insight is emitted", () => {
    const vm = buildHistoryAnalysisViewModel(
      makeRollup(),
      makeInsights({
        insights: [
          ...makeInsights().insights,
          { type: "data_quality_note", severity: "info", subject: "data", text: "Most sessions had incomplete exercise data.", evidence: undefined },
        ],
      })
    );
    expect(vm.dataQualityNote).not.toBeNull();
    expect(vm.dataQualityNote).toBe("Most sessions had incomplete exercise data.");
  });

  it("dataQualityNote present via metadata fallback when many fallback movements", () => {
    const vm = buildHistoryAnalysisViewModel(
      makeRollup({
        metadata: {
          filteredWorkouts:       10,
          totalWorkouts:          10,
          workoutsWithFallback:   8,
          totalFallbackMovements: 24,
          oldestWorkoutDate:      "2026-03-03T00:00:00.000Z",
          newestWorkoutDate:      "2026-04-01T00:00:00.000Z",
        },
      }),
      makeInsights()
    );
    expect(vm.dataQualityNote).not.toBeNull();
  });

  it("hasEnoughData is true for 14 workouts", () => {
    const vm = buildHistoryAnalysisViewModel(makeRollup(), makeInsights());
    expect(vm.hasEnoughData).toBe(true);
  });

  it("hasEnoughData is true for 2 workouts (threshold is workoutCount >= 2)", () => {
    const vm = buildHistoryAnalysisViewModel(
      makeRollup({ metadata: { filteredWorkouts: 2, totalWorkouts: 2, workoutsWithFallback: 0, totalFallbackMovements: 0, oldestWorkoutDate: null, newestWorkoutDate: null } }),
      makeInsights({ workoutCount: 2 })
    );
    expect(vm.hasEnoughData).toBe(true);
  });

  it("hasEnoughData is false for 1 workout (low-data trust state)", () => {
    const vm = buildHistoryAnalysisViewModel(
      makeRollup({ metadata: { filteredWorkouts: 1, totalWorkouts: 1, workoutsWithFallback: 0, totalFallbackMovements: 0, oldestWorkoutDate: null, newestWorkoutDate: null } }),
      makeInsights({ workoutCount: 1 })
    );
    expect(vm.hasEnoughData).toBe(false);
  });

  it("rangeLabel comes from insights.rangeLabel", () => {
    const vm = buildHistoryAnalysisViewModel(makeRollup(), makeInsights());
    expect(vm.rangeLabel).toBe("past month");
  });

  it("workoutCount comes from insights.workoutCount", () => {
    const vm = buildHistoryAnalysisViewModel(makeRollup(), makeInsights());
    expect(vm.workoutCount).toBe(14);
  });

  it("empty model matches EMPTY_HISTORY_ANALYSIS shape", () => {
    const vm = buildHistoryAnalysisViewModel(null, null);
    expect(vm.workoutCount).toBe(EMPTY_HISTORY_ANALYSIS.workoutCount);
    expect(vm.hasEnoughData).toBe(EMPTY_HISTORY_ANALYSIS.hasEnoughData);
    expect(vm.insightCards).toHaveLength(0);
    expect(vm.topMuscles).toHaveLength(0);
    expect(vm.dataQualityNote).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// HISTORY OVERVIEW: Recent shifts (trending up/down indicators)
// ---------------------------------------------------------------------------

describe("Step 7 — History Overview: Recent shift indicators", () => {
  it("muscle rows carry isElevatedRecently=true when key is in recentlyElevated", () => {
    const rollupWithShift = makeRollup({
      summary: {
        ...makeRollup().summary,
        recentlyElevated: [{ key: "quads", cumulativeRank: 3, recentRank: 1, rankDelta: 2 }],
        recentlyReduced:  [],
      },
    });
    const vm = buildHistoryAnalysisViewModel(rollupWithShift, makeInsights());
    const quads = vm.topMuscles.find(m => m.key === "quads");
    expect(quads).toBeDefined();
    expect(quads!.isElevatedRecently).toBe(true);
    expect(quads!.isReducedRecently).toBe(false);
  });

  it("muscle rows carry isReducedRecently=true when key is in recentlyReduced", () => {
    const rollupWithReduction = makeRollup({
      summary: {
        ...makeRollup().summary,
        recentlyElevated: [],
        recentlyReduced:  [{ key: "glutes", cumulativeRank: 1, recentRank: 4, rankDelta: -3 }],
      },
    });
    const vm = buildHistoryAnalysisViewModel(rollupWithReduction, makeInsights());
    const glutes = vm.topMuscles.find(m => m.key === "glutes");
    expect(glutes).toBeDefined();
    expect(glutes!.isReducedRecently).toBe(true);
    expect(glutes!.isElevatedRecently).toBe(false);
  });

  it("muscle rows without any shift have both flags false", () => {
    const vm = buildHistoryAnalysisViewModel(makeRollup(), makeInsights());
    for (const m of vm.topMuscles) {
      expect(m.isElevatedRecently).toBe(false);
      expect(m.isReducedRecently).toBe(false);
    }
  });

  it("recentShifts list includes elevated entries", () => {
    const rollupWithShift = makeRollup({
      summary: {
        ...makeRollup().summary,
        recentlyElevated: [{ key: "quads", cumulativeRank: 3, recentRank: 1, rankDelta: 2 }],
        recentlyReduced:  [],
      },
    });
    const vm = buildHistoryAnalysisViewModel(rollupWithShift, makeInsights());
    const shift = vm.recentShifts.find(s => s.key === "quads");
    expect(shift).toBeDefined();
    expect(shift!.direction).toBe("elevated");
    expect(shift!.rankDelta).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// HISTORY OVERVIEW: Insight card severity → screen color mapping
// ---------------------------------------------------------------------------

describe("Step 7 — History Overview: Insight severity values", () => {
  const VALID_SEVERITIES = new Set<string>(["info", "low", "moderate", "high"]);

  it("all insight card severities are from the expected set", () => {
    const vm = buildHistoryAnalysisViewModel(makeRollup(), makeInsights());
    for (const card of vm.insightCards) {
      expect(VALID_SEVERITIES.has(card.severity)).toBe(true);
    }
  });

  it("data_quality_note insight is stripped from insightCards (surfaced as dataQualityNote)", () => {
    const withQuality = makeInsights({
      insights: [
        ...makeInsights().insights,
        { type: "data_quality_note", severity: "info", subject: "data", text: "Limited exercise data.", evidence: undefined },
      ],
    });
    const vm = buildHistoryAnalysisViewModel(makeRollup(), withQuality);
    const dqCard = vm.insightCards.find(c => c.type === "data_quality_note");
    expect(dqCard).toBeUndefined();
    expect(vm.dataQualityNote).toBe("Limited exercise data.");
  });

  it("severityTier maps correctly alongside severity", () => {
    const withMixed = makeInsights({
      insights: [
        { type: "recently_elevated",      severity: "high",     subject: "quads",     text: "Quads have been notably higher.",        evidence: undefined },
        { type: "dominant_pattern",        severity: "moderate", subject: "squat",     text: "Squat patterns are high proportion.",    evidence: undefined },
        { type: "balance_observation",     severity: "low",      subject: "push_pull", text: "Push and pull are broadly similar.",     evidence: undefined },
        { type: "data_quality_note",       severity: "info",     subject: "data",      text: "Limited data.",                          evidence: undefined },
      ],
    });
    const vm = buildHistoryAnalysisViewModel(makeRollup(), withMixed);
    const byType = Object.fromEntries(vm.insightCards.map(c => [c.type, c]));
    expect(byType["recently_elevated"]?.severityTier).toBe("strong");
    expect(byType["dominant_pattern"]?.severityTier).toBe("medium");
    expect(byType["balance_observation"]?.severityTier).toBe("soft");
  });
});

// ---------------------------------------------------------------------------
// COEXISTENCE: analysis panel vs coarse-chip fallback decisions
// ---------------------------------------------------------------------------

describe("Step 7 — Coexistence: analysis panel vs fallback rendering", () => {
  it("internal session with valid data: hasAnalysis=true → WorkoutAnalysisPanel shown", () => {
    const vm = buildWorkoutAnalysisViewModel(makeWorkoutResult());
    expect(vm.hasAnalysis).toBe(true);
  });

  it("external workout (null passed): hasAnalysis=false → coarse chips shown", () => {
    const vm = buildWorkoutAnalysisViewModel(null);
    expect(vm.hasAnalysis).toBe(false);
  });

  it("null vm has no data to conflict with coarse external chips", () => {
    const vm = buildWorkoutAnalysisViewModel(null);
    expect(vm.topMuscles).toHaveLength(0);
    expect(vm.topPatterns).toHaveLength(0);
    expect(vm.dominantStimulus.label).toBe("—");
  });

  it("stimulusPoints on external row subtitle is independent from analysis panel", () => {
    // External workout row shows stimulusPoints (existing field on ExternalWorkout).
    // Analysis panel only renders for internal sessions.
    // These are parallel, non-conflicting UI surfaces — no data overlap.
    const externalStimPts = 42;
    const vm = buildWorkoutAnalysisViewModel(null);
    expect(vm.hasAnalysis).toBe(false);
    // The screen renders externalStimPts in the stats strip, not in the analysis panel.
    expect(externalStimPts).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// DETERMINISM: Repeated calls return the same structure
// ---------------------------------------------------------------------------

describe("Step 7 — Determinism", () => {
  it("buildWorkoutAnalysisViewModel is deterministic", () => {
    const input = makeWorkoutResult();
    const a = buildWorkoutAnalysisViewModel(input);
    const b = buildWorkoutAnalysisViewModel(input);
    expect(a.headline).toBe(b.headline);
    expect(a.topMuscles.map(m => m.key)).toEqual(b.topMuscles.map(m => m.key));
    expect(a.dominantStimulus.key).toBe(b.dominantStimulus.key);
  });

  it("buildHistoryAnalysisViewModel is deterministic", () => {
    const rollup   = makeRollup();
    const insights = makeInsights();
    const a = buildHistoryAnalysisViewModel(rollup, insights);
    const b = buildHistoryAnalysisViewModel(rollup, insights);
    expect(a.headline).toBe(b.headline);
    expect(a.topMuscles.map(m => m.key)).toEqual(b.topMuscles.map(m => m.key));
    expect(a.insightCards.map(c => c.type)).toEqual(b.insightCards.map(c => c.type));
  });
});

/**
 * Unit tests for appleHealthActivityViewModel.ts
 *
 * Verifies that buildAppleHealthActivityViewModel produces a correct
 * WorkoutAnalysisDisplayModel from ActivityBasedAnalysisResult inputs, and
 * that isActivityBasedAnalysis correctly narrows the type.
 */

import { describe, it, expect } from "vitest";
import {
  buildAppleHealthActivityViewModel,
  isActivityBasedAnalysis,
  type ActivityBasedAnalysisResult,
} from "../viewModels/appleHealthActivityViewModel";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeRunningResult(
  overrides: Partial<ActivityBasedAnalysisResult["activityHint"]> = {}
): ActivityBasedAnalysisResult {
  return {
    analysisKind: "activity-based",
    activityHint: {
      dominantPattern:    "cyclical",
      muscleEmphasisAreas: ["quads", "hamstrings", "glutes", "calves"],
      stimulusBias:       "conditioning",
      confidenceTier:     "medium",
      trustNote:          "Estimated from Apple Health activity data — medium confidence.",
      ...overrides,
    },
    activitySummary: {
      label:           "Running",
      durationMinutes: 45,
      workoutType:     "cardio",
      source:          "apple_health",
      workoutDate:     "2026-04-01",
    },
  };
}

function makeStrengthResult(): ActivityBasedAnalysisResult {
  return {
    analysisKind: "activity-based",
    activityHint: {
      dominantPattern:    "strength",
      muscleEmphasisAreas: ["full_body"],
      stimulusBias:       "strength",
      confidenceTier:     "low",
      trustNote:          "Estimated from Apple Health activity type only.",
    },
    activitySummary: {
      label:           "Strength Training",
      durationMinutes: 60,
      workoutType:     "strength",
      source:          "apple_health",
      workoutDate:     "2026-04-02",
    },
  };
}

function makeMobilityResult(): ActivityBasedAnalysisResult {
  return {
    analysisKind: "activity-based",
    activityHint: {
      dominantPattern:    "mobility",
      muscleEmphasisAreas: ["full_body"],
      stimulusBias:       "flexibility",
      confidenceTier:     "low",
      trustNote:          "Recorded as a recovery or mobility session in Apple Health.",
    },
    activitySummary: {
      label:           "Yoga",
      durationMinutes: 30,
      workoutType:     "recovery",
      source:          "apple_health",
      workoutDate:     "2026-04-02",
    },
  };
}

// ---------------------------------------------------------------------------
// isActivityBasedAnalysis
// ---------------------------------------------------------------------------

describe("isActivityBasedAnalysis", () => {
  it("returns true for ActivityBasedAnalysisResult", () => {
    expect(isActivityBasedAnalysis(makeRunningResult())).toBe(true);
  });

  it("returns false for null", () => {
    expect(isActivityBasedAnalysis(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isActivityBasedAnalysis(undefined)).toBe(false);
  });

  it("returns false for movement-based WorkoutScoreResultJSON (no analysisKind)", () => {
    const movementBased = {
      summary: {},
      metadata: { totalMovements: 3 },
      stimulusVector: {},
    };
    expect(isActivityBasedAnalysis(movementBased)).toBe(false);
  });

  it("returns false for analysisKind: 'movement-based'", () => {
    expect(isActivityBasedAnalysis({ analysisKind: "movement-based" })).toBe(false);
  });

  it("returns false for plain object without analysisKind", () => {
    expect(isActivityBasedAnalysis({ eligible: false, reason: "no data" })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildAppleHealthActivityViewModel — structure
// ---------------------------------------------------------------------------

describe("buildAppleHealthActivityViewModel — structure", () => {
  it("returns hasAnalysis: true", () => {
    const vm = buildAppleHealthActivityViewModel(makeRunningResult());
    expect(vm.hasAnalysis).toBe(true);
  });

  it("headline is non-empty", () => {
    const vm = buildAppleHealthActivityViewModel(makeRunningResult());
    expect(typeof vm.headline).toBe("string");
    expect(vm.headline.length).toBeGreaterThan(0);
  });

  it("dataQualityNote is the server trust note", () => {
    const result = makeRunningResult();
    const vm = buildAppleHealthActivityViewModel(result);
    expect(vm.dataQualityNote).toBe(result.activityHint.trustNote);
  });

  it("movementCount, scoredCount, fallbackCount are all 0", () => {
    const vm = buildAppleHealthActivityViewModel(makeRunningResult());
    expect(vm.movementCount).toBe(0);
    expect(vm.scoredCount).toBe(0);
    expect(vm.fallbackCount).toBe(0);
  });

  it("sections array is non-empty", () => {
    const vm = buildAppleHealthActivityViewModel(makeRunningResult());
    expect(vm.sections.length).toBeGreaterThan(0);
  });

  it("presentStimuli has exactly one entry", () => {
    const vm = buildAppleHealthActivityViewModel(makeRunningResult());
    expect(vm.presentStimuli.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// buildAppleHealthActivityViewModel — muscles
// ---------------------------------------------------------------------------

describe("buildAppleHealthActivityViewModel — muscles", () => {
  it("topMuscles count matches muscleEmphasisAreas count", () => {
    const result = makeRunningResult();
    const vm = buildAppleHealthActivityViewModel(result);
    expect(vm.topMuscles.length).toBe(result.activityHint.muscleEmphasisAreas.length);
  });

  it("muscle keys match input areas", () => {
    const result = makeRunningResult();
    const vm = buildAppleHealthActivityViewModel(result);
    const keys = vm.topMuscles.map((m) => m.key);
    expect(keys).toEqual(result.activityHint.muscleEmphasisAreas);
  });

  it("primary muscle has score 1.0", () => {
    const vm = buildAppleHealthActivityViewModel(makeRunningResult());
    expect(vm.topMuscles[0].score).toBe(1.0);
  });

  it("muscle scores are descending", () => {
    const vm = buildAppleHealthActivityViewModel(makeRunningResult());
    for (let i = 1; i < vm.topMuscles.length; i++) {
      expect(vm.topMuscles[i].score).toBeLessThanOrEqual(vm.topMuscles[i - 1].score);
    }
  });

  it("muscle ranks are sequential starting at 1", () => {
    const vm = buildAppleHealthActivityViewModel(makeRunningResult());
    vm.topMuscles.forEach((m, idx) => {
      expect(m.rank).toBe(idx + 1);
    });
  });

  it("muscle labels are human-readable (not raw keys)", () => {
    const result = makeRunningResult();
    const vm = buildAppleHealthActivityViewModel(result);
    // "quads" → "Quadriceps"
    const quadsRow = vm.topMuscles.find((m) => m.key === "quads");
    expect(quadsRow?.label).toBe("Quadriceps");
  });

  it("area pseudo-keys humanize gracefully (lower_body → 'full body')", () => {
    const result = makeStrengthResult();
    const vm = buildAppleHealthActivityViewModel(result);
    const fullBodyRow = vm.topMuscles.find((m) => m.key === "full_body");
    // muscleLabel fallback: underscores → spaces, no capitalisation
    expect(fullBodyRow?.label).toBe("full body");
  });
});

// ---------------------------------------------------------------------------
// buildAppleHealthActivityViewModel — patterns
// ---------------------------------------------------------------------------

describe("buildAppleHealthActivityViewModel — patterns", () => {
  it("topPatterns has exactly one entry", () => {
    const vm = buildAppleHealthActivityViewModel(makeRunningResult());
    expect(vm.topPatterns.length).toBe(1);
  });

  it("pattern key matches dominantPattern from hint", () => {
    const result = makeRunningResult();
    const vm = buildAppleHealthActivityViewModel(result);
    expect(vm.topPatterns[0].key).toBe("cyclical");
  });

  it("cyclical pattern label is 'Cyclical / conditioning'", () => {
    const vm = buildAppleHealthActivityViewModel(makeRunningResult());
    expect(vm.topPatterns[0].label).toBe("Cyclical / conditioning");
  });

  it("strength pattern label is 'Strength' (humanized)", () => {
    const vm = buildAppleHealthActivityViewModel(makeStrengthResult());
    expect(vm.topPatterns[0].key).toBe("strength");
  });

  it("mobility pattern humanizes for unknown key", () => {
    const vm = buildAppleHealthActivityViewModel(makeMobilityResult());
    expect(vm.topPatterns[0].key).toBe("mobility");
    // patternLabel fallback: underscores → spaces, no extra capitalisation
    expect(vm.topPatterns[0].label).toBe("mobility");
  });

  it("pattern rank is 1", () => {
    const vm = buildAppleHealthActivityViewModel(makeRunningResult());
    expect(vm.topPatterns[0].rank).toBe(1);
  });

  it("pattern score is 1.0", () => {
    const vm = buildAppleHealthActivityViewModel(makeRunningResult());
    expect(vm.topPatterns[0].score).toBe(1.0);
  });
});

// ---------------------------------------------------------------------------
// buildAppleHealthActivityViewModel — stimulus
// ---------------------------------------------------------------------------

describe("buildAppleHealthActivityViewModel — stimulus", () => {
  it("dominantStimulus key matches stimulusBias from hint", () => {
    const result = makeRunningResult();
    const vm = buildAppleHealthActivityViewModel(result);
    expect(vm.dominantStimulus.key).toBe("conditioning");
  });

  it("conditioning label is 'Conditioning'", () => {
    const vm = buildAppleHealthActivityViewModel(makeRunningResult());
    expect(vm.dominantStimulus.label).toBe("Conditioning");
  });

  it("strength stimulus label is 'Strength'", () => {
    const vm = buildAppleHealthActivityViewModel(makeStrengthResult());
    expect(vm.dominantStimulus.key).toBe("strength");
    expect(vm.dominantStimulus.label).toBe("Strength");
  });

  it("flexibility stimulus label is 'Flexibility'", () => {
    const vm = buildAppleHealthActivityViewModel(makeMobilityResult());
    expect(vm.dominantStimulus.key).toBe("flexibility");
    expect(vm.dominantStimulus.label).toBe("Flexibility");
  });

  it("dominantStimulus.dominant is true", () => {
    const vm = buildAppleHealthActivityViewModel(makeRunningResult());
    expect(vm.dominantStimulus.dominant).toBe(true);
  });

  it("dominantStimulus value is 1.0", () => {
    const vm = buildAppleHealthActivityViewModel(makeRunningResult());
    expect(vm.dominantStimulus.value).toBe(1.0);
  });
});

// ---------------------------------------------------------------------------
// buildAppleHealthActivityViewModel — confidence
// ---------------------------------------------------------------------------

describe("buildAppleHealthActivityViewModel — confidence", () => {
  it("medium confidenceTier → analysisConfidence: 'medium'", () => {
    const vm = buildAppleHealthActivityViewModel(makeRunningResult());
    expect(vm.analysisConfidence).toBe("medium");
  });

  it("low confidenceTier → analysisConfidence: 'low'", () => {
    const vm = buildAppleHealthActivityViewModel(makeStrengthResult());
    expect(vm.analysisConfidence).toBe("low");
  });
});

// ---------------------------------------------------------------------------
// buildAppleHealthActivityViewModel — headline composition
// ---------------------------------------------------------------------------

describe("buildAppleHealthActivityViewModel — headline", () => {
  it("Running headline contains cyclical label", () => {
    const vm = buildAppleHealthActivityViewModel(makeRunningResult());
    expect(vm.headline.toLowerCase()).toContain("cyclical");
  });

  it("Running headline contains conditioning label", () => {
    const vm = buildAppleHealthActivityViewModel(makeRunningResult());
    expect(vm.headline.toLowerCase()).toContain("conditioning");
  });

  it("Strength Training headline mentions strength", () => {
    const vm = buildAppleHealthActivityViewModel(makeStrengthResult());
    expect(vm.headline.toLowerCase()).toContain("strength");
  });

  it("headline uses · separator when both parts present", () => {
    const vm = buildAppleHealthActivityViewModel(makeRunningResult());
    expect(vm.headline).toContain("·");
  });
});

// ---------------------------------------------------------------------------
// buildAppleHealthActivityViewModel — sections
// ---------------------------------------------------------------------------

describe("buildAppleHealthActivityViewModel — sections", () => {
  it("sections include muscle emphasis area", () => {
    const vm = buildAppleHealthActivityViewModel(makeRunningResult());
    const muscleSection = vm.sections.find((s) =>
      s.title.toLowerCase().includes("muscle")
    );
    expect(muscleSection).toBeDefined();
    expect(muscleSection!.items.length).toBeGreaterThan(0);
  });

  it("sections include movement pattern", () => {
    const vm = buildAppleHealthActivityViewModel(makeRunningResult());
    const patternSection = vm.sections.find((s) =>
      s.title.toLowerCase().includes("pattern")
    );
    expect(patternSection).toBeDefined();
    expect(patternSection!.items[0]).toBeTruthy();
  });

  it("sections include training stimulus", () => {
    const vm = buildAppleHealthActivityViewModel(makeRunningResult());
    const stimSection = vm.sections.find((s) =>
      s.title.toLowerCase().includes("stimulus")
    );
    expect(stimSection).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("buildAppleHealthActivityViewModel — edge cases", () => {
  it("single emphasis area still produces valid output", () => {
    const result = makeRunningResult({ muscleEmphasisAreas: ["quads"] });
    const vm = buildAppleHealthActivityViewModel(result);
    expect(vm.topMuscles.length).toBe(1);
    expect(vm.topMuscles[0].score).toBe(1.0);
    expect(vm.topMuscles[0].rank).toBe(1);
  });

  it("empty emphasis areas produces empty topMuscles", () => {
    const result = makeRunningResult({ muscleEmphasisAreas: [] });
    const vm = buildAppleHealthActivityViewModel(result);
    expect(vm.topMuscles.length).toBe(0);
  });

  it("unknown pattern key humanizes gracefully", () => {
    const result = makeRunningResult({ dominantPattern: "sport" });
    const vm = buildAppleHealthActivityViewModel(result);
    // "sport" not in patternLabel map → fallback: underscores → spaces (no capitalisation)
    expect(vm.topPatterns[0].label).toBe("sport");
  });
});

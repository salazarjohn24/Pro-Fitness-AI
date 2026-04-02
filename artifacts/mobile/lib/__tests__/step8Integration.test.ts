/**
 * step8Integration.test.ts — Step 8 mobile integration tests.
 *
 * Tests the data-layer decisions that drive the Step 8 UI surfaces:
 *   - workout-detail.tsx external branch: WorkoutAnalysisPanel when eligible,
 *     coarse muscle chips when ineligible, importedDataNote rendering decision.
 *   - Hook response interpretation: null (422/404) vs WorkoutScoreResultJSON.
 *   - importedDataNote surface rule: shown when hasSetData=false AND
 *     dataQualityNote is absent.
 *
 * Because Expo screens are not unit-testable in this environment, these tests
 * verify the exact view-model contracts the external branch renders from.
 */

import { describe, it, expect } from "vitest";
import {
  buildWorkoutAnalysisViewModel,
  EMPTY_WORKOUT_ANALYSIS,
  type WorkoutScoreResultJSON,
} from "../viewModels/workoutAnalysisViewModel";
import type { ExternalWorkoutAnalysisResult } from "../../hooks/useExternalWorkoutAnalysis";

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

function makeWorkoutResult(
  overrides: Partial<WorkoutScoreResultJSON> = {}
): WorkoutScoreResultJSON {
  return {
    workoutName:    "External Session",
    workoutType:    "strength",
    muscleVector:   { quads: 3.5, glutes: 2.0, hamstrings: 1.2 },
    patternVector:  { squat: 4.5, hinge: 1.2 },
    stimulusVector: {
      strength: 0.8, muscular_endurance: 0.2, conditioning: 0.0,
      power: 0.0, endurance: 0.0, flexibility: 0.0, stability: 0.0,
    },
    summary: {
      topMuscles: [
        { key: "quads",      score: 3.5, rank: 1 },
        { key: "glutes",     score: 2.0, rank: 2 },
        { key: "hamstrings", score: 1.2, rank: 3 },
      ],
      topPatterns: [
        { key: "squat", score: 4.5, rank: 1 },
        { key: "hinge", score: 1.2, rank: 2 },
      ],
      dominantStimulus: "strength",
      presentStimuli:   [{ stimulus: "strength", value: 0.8 }],
    },
    metadata: {
      totalMovements:        3,
      scoredMovements:       3,
      fallbackMovements:     0,
      fallbackMovementNames: [],
      totalRawScore:         6.7,
    },
    ...overrides,
  };
}

function makeExternalAnalysis(
  overrides: Partial<WorkoutScoreResultJSON> = {},
  importedDataNote: string | null = null
): ExternalWorkoutAnalysisResult {
  return {
    ...makeWorkoutResult(overrides),
    importedDataNote,
  };
}

// ---------------------------------------------------------------------------
// External branch rendering decisions — panel vs coarse chips
// ---------------------------------------------------------------------------

describe("workout-detail external branch: analysis panel vs coarse chips", () => {
  it("shows analysis panel when extAnalysisVm.hasAnalysis is true", () => {
    const vm = buildWorkoutAnalysisViewModel(makeExternalAnalysis());
    expect(vm.hasAnalysis).toBe(true);
    // Screen renders WorkoutAnalysisPanel (not coarse chips)
  });

  it("falls back to coarse chips when hook returns null (ineligible)", () => {
    const vm = buildWorkoutAnalysisViewModel(null);
    expect(vm.hasAnalysis).toBe(false);
    // Screen renders coarse muscleGroups chips (or nothing if none)
  });

  it("EMPTY_WORKOUT_ANALYSIS.hasAnalysis is false", () => {
    expect(EMPTY_WORKOUT_ANALYSIS.hasAnalysis).toBe(false);
  });

  it("analysis panel has meaningful headline from result", () => {
    const vm = buildWorkoutAnalysisViewModel(makeExternalAnalysis());
    expect(vm.hasAnalysis).toBe(true);
    expect(vm.headline.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Import note surface logic
// ---------------------------------------------------------------------------

describe("importedDataNote surface rule", () => {
  it("shows import note when importedDataNote present and no dataQualityNote", () => {
    const vm = buildWorkoutAnalysisViewModel(
      makeExternalAnalysis({}, "Scored from movement names only — set-level data was not captured.")
    );
    // vm.dataQualityNote is null (all movements recognized)
    expect(vm.dataQualityNote).toBeNull();
    // Screen logic: importNote shown when importedDataNote != null AND dataQualityNote == null
    const importNote = "Scored from movement names only — set-level data was not captured.";
    const shouldShow = importNote != null && vm.dataQualityNote == null;
    expect(shouldShow).toBe(true);
  });

  it("hides import note when importedDataNote is null (set data was present)", () => {
    const vm = buildWorkoutAnalysisViewModel(makeExternalAnalysis({}, null));
    expect(vm.dataQualityNote).toBeNull();
    // Screen logic: importNote not shown when importedDataNote is null
    const importNote: string | null = null;
    const shouldShow = importNote != null && vm.dataQualityNote == null;
    expect(shouldShow).toBe(false);
  });

  it("hides import note when dataQualityNote already covers data quality", () => {
    // High fallback ratio → dataQualityNote generated by view model
    const vm = buildWorkoutAnalysisViewModel(
      makeExternalAnalysis({
        metadata: {
          totalMovements:        3,
          scoredMovements:       3,
          fallbackMovements:     3,       // all fallback → quality note triggered
          fallbackMovementNames: ["A", "B", "C"],
          totalRawScore:         1.5,
        },
      }, "Scored from movement names only — set-level data was not captured.")
    );
    // vm.dataQualityNote should be non-null (all fallback)
    expect(vm.dataQualityNote).not.toBeNull();
    // Screen logic: importNote hidden when dataQualityNote covers quality
    const importNote = "Scored from movement names only — set-level data was not captured.";
    const shouldShow = importNote != null && vm.dataQualityNote == null;
    expect(shouldShow).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Analysis quality via view model (same engine used for internal + external)
// ---------------------------------------------------------------------------

describe("external analysis quality tiers via view model", () => {
  it("full-quality: all movements recognized, set data present", () => {
    const vm = buildWorkoutAnalysisViewModel(makeExternalAnalysis({
      metadata: {
        totalMovements:        3,
        scoredMovements:       3,
        fallbackMovements:     0,
        fallbackMovementNames: [],
        totalRawScore:         6.7,
      },
    }, null));
    expect(vm.hasAnalysis).toBe(true);
    expect(vm.dataQualityNote).toBeNull(); // no quality degradation note
  });

  it("partial-quality: some movements unrecognized", () => {
    const vm = buildWorkoutAnalysisViewModel(makeExternalAnalysis({
      metadata: {
        totalMovements:        4,
        scoredMovements:       4,
        fallbackMovements:     2,
        fallbackMovementNames: ["Movement A", "Movement B"],
        totalRawScore:         4.0,
      },
    }, null));
    expect(vm.hasAnalysis).toBe(true);
    // 50% fallback — quality note expected
    expect(vm.dataQualityNote).not.toBeNull();
    expect(vm.dataQualityNote).toMatch(/movement/i);
  });

  it("all-fallback: all movements unrecognized, still has analysis (scored from defaults)", () => {
    const vm = buildWorkoutAnalysisViewModel(makeExternalAnalysis({
      metadata: {
        totalMovements:        3,
        scoredMovements:       3,
        fallbackMovements:     3,
        fallbackMovementNames: ["Foo", "Bar", "Baz"],
        totalRawScore:         2.1,
      },
    }, "Scored from movement names only."));
    expect(vm.hasAnalysis).toBe(true);
    expect(vm.dataQualityNote).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Hook null semantics (simulates 422/404 from backend)
// ---------------------------------------------------------------------------

describe("useExternalWorkoutAnalysis null semantics", () => {
  it("null hook result produces empty vm with hasAnalysis=false", () => {
    const vm = buildWorkoutAnalysisViewModel(null);
    expect(vm.hasAnalysis).toBe(false);
    expect(vm.headline).toBeTruthy(); // has a default headline
    expect(vm.topMuscles).toHaveLength(0);
    expect(vm.topPatterns).toHaveLength(0);
  });

  it("non-null hook result produces populated vm", () => {
    const vm = buildWorkoutAnalysisViewModel(makeExternalAnalysis());
    expect(vm.hasAnalysis).toBe(true);
    expect(vm.topMuscles.length).toBeGreaterThan(0);
    expect(vm.topPatterns.length).toBeGreaterThan(0);
  });

  it("importedDataNote type is string | null on the hook result", () => {
    const result: ExternalWorkoutAnalysisResult = makeExternalAnalysis(
      {},
      "Scored from movement names only."
    );
    expect(result.importedDataNote).toBe("Scored from movement names only.");

    const noNote: ExternalWorkoutAnalysisResult = makeExternalAnalysis({}, null);
    expect(noNote.importedDataNote).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Unification: external and internal analysis panels use the same view model
// ---------------------------------------------------------------------------

describe("Step 8 unification: same view model for internal and external", () => {
  it("buildWorkoutAnalysisViewModel accepts ExternalWorkoutAnalysisResult (extends WorkoutScoreResultJSON)", () => {
    const external = makeExternalAnalysis();
    const vm = buildWorkoutAnalysisViewModel(external);
    expect(vm.hasAnalysis).toBe(true);
  });

  it("view model output shape is identical for internal and external analysis", () => {
    const internal = makeWorkoutResult();
    const external  = makeExternalAnalysis();

    const vmInternal = buildWorkoutAnalysisViewModel(internal);
    const vmExternal = buildWorkoutAnalysisViewModel(external);

    // Both should expose the same fields
    expect(Object.keys(vmInternal).sort()).toEqual(Object.keys(vmExternal).sort());
  });

  it("headline, muscles, patterns, stimulus all populate from external result", () => {
    const vm = buildWorkoutAnalysisViewModel(makeExternalAnalysis());
    expect(vm.headline).toBeTruthy();
    expect(vm.topMuscles.length).toBeGreaterThan(0);
    expect(vm.topPatterns.length).toBeGreaterThan(0);
    expect(vm.dominantStimulus.key).toBeTruthy();
  });
});

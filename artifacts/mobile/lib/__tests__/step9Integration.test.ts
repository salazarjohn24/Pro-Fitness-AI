/**
 * step9Integration.test.ts — Step 9 MVP hardening tests.
 *
 * Covers:
 *   - analysisConfidence computation (high/medium/low) and thresholds
 *   - Updated dataQualityNote wording (Step 9 change: "generic patterns")
 *   - stimulusPoints coexistence rule (suppressed when hasAnalysis=true)
 *   - importNote deduplication rule (suppressed when dataQualityNote present)
 *   - dataConfidence in history view model
 *   - HISTORY_MIN_WORKOUTS_FOR_DATA threshold
 *   - History dataQualityNote wording
 *   - Contract stability: new fields don't break existing shape
 *   - Note precedence determinism
 */

import { describe, it, expect } from "vitest";
import {
  buildWorkoutAnalysisViewModel,
  EMPTY_WORKOUT_ANALYSIS,
  QUALITY_NOTE_HIGH_THRESHOLD,
  QUALITY_NOTE_LOW_THRESHOLD,
  type WorkoutScoreResultJSON,
  type AnalysisConfidence,
} from "../viewModels/workoutAnalysisViewModel";
import {
  buildHistoryAnalysisViewModel,
  EMPTY_HISTORY_ANALYSIS,
  HISTORY_MIN_WORKOUTS_FOR_DATA,
  HISTORY_QUALITY_NOTE_HIGH_THRESHOLD,
  HISTORY_QUALITY_NOTE_LOW_THRESHOLD,
  type HistoricalRollupResultJSON,
  type InsightGenerationResultJSON,
  type HistoryDataConfidence,
} from "../viewModels/historyAnalysisViewModel";

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

function makeMetadata(
  total: number,
  fallback: number
): WorkoutScoreResultJSON["metadata"] {
  return {
    totalMovements:        total,
    scoredMovements:       total,
    fallbackMovements:     fallback,
    fallbackMovementNames: Array.from({ length: fallback }, (_, i) => `Movement ${i + 1}`),
    totalRawScore:         total * 2.0,
  };
}

function makeResult(
  total: number,
  fallback: number,
  overrides: Partial<WorkoutScoreResultJSON> = {}
): WorkoutScoreResultJSON {
  return {
    workoutName:    "Test Workout",
    workoutType:    "strength",
    muscleVector:   { quads: 3.0, glutes: 1.5 },
    patternVector:  { squat: 4.5 },
    stimulusVector: { strength: 0.9, muscular_endurance: 0.1, conditioning: 0.0, power: 0.0, endurance: 0.0, flexibility: 0.0, stability: 0.0 },
    summary: {
      topMuscles: [
        { key: "quads",  score: 3.0, rank: 1 },
        { key: "glutes", score: 1.5, rank: 2 },
      ],
      topPatterns: [{ key: "squat", score: 4.5, rank: 1 }],
      dominantStimulus: "strength",
      presentStimuli:   [{ stimulus: "strength", value: 0.9 }],
    },
    metadata: makeMetadata(total, fallback),
    ...overrides,
  };
}

function makeHistoryMeta(
  filteredWorkouts: number,
  workoutsWithFallback: number
): HistoricalRollupResultJSON["metadata"] {
  return {
    filteredWorkouts,
    totalWorkouts:        filteredWorkouts,
    workoutsWithFallback,
    totalFallbackMovements: workoutsWithFallback * 2,
    oldestWorkoutDate:    null,
    newestWorkoutDate:    null,
  };
}

function makeRollup(
  filteredWorkouts: number,
  workoutsWithFallback: number
): HistoricalRollupResultJSON {
  return {
    cumulativeMuscleVector:  { quads: 25.0, glutes: 18.0 },
    cumulativePatternVector: { squat: 30.0 },
    cumulativeStimulusVector: { strength: 0.7, muscular_endurance: 0.2, conditioning: 0.1, power: 0.0, endurance: 0.0, flexibility: 0.0, stability: 0.0 },
    recencyMuscleVector:     { quads: 22.0, glutes: 15.0 },
    recencyPatternVector:    { squat: 26.0 },
    summary: {
      topMusclesCumulative: [
        { key: "quads",  score: 25.0, rank: 1 },
        { key: "glutes", score: 18.0, rank: 2 },
      ],
      topPatternsCumulative: [{ key: "squat", score: 30.0, rank: 1 }],
      topMusclesRecent:      [{ key: "quads", score: 22.0, rank: 1 }],
      topPatternsRecent:     [{ key: "squat", score: 26.0, rank: 1 }],
      underrepresentedMuscles: [],
      underrepresentedPatterns: [],
      dominantStimulusCumulative: "strength",
      dominantStimulusRecent:     "strength",
      recentlyElevated: [],
      recentlyReduced:  [],
    },
    metadata: makeHistoryMeta(filteredWorkouts, workoutsWithFallback),
  };
}

function makeInsights(workoutCount: number): InsightGenerationResultJSON {
  return {
    insights: [],
    summary:  { headline: "Strength-focused range", observations: ["Consistent squat emphasis"] },
    rangeLabel: "past 30 days",
    workoutCount,
  };
}

// ---------------------------------------------------------------------------
// Exported threshold constants
// ---------------------------------------------------------------------------

describe("workoutAnalysisViewModel — exported thresholds", () => {
  it("QUALITY_NOTE_HIGH_THRESHOLD is defined and between 0 and 1", () => {
    expect(QUALITY_NOTE_HIGH_THRESHOLD).toBeGreaterThan(0);
    expect(QUALITY_NOTE_HIGH_THRESHOLD).toBeLessThanOrEqual(1);
  });

  it("QUALITY_NOTE_LOW_THRESHOLD is less than QUALITY_NOTE_HIGH_THRESHOLD", () => {
    expect(QUALITY_NOTE_LOW_THRESHOLD).toBeLessThan(QUALITY_NOTE_HIGH_THRESHOLD);
  });

  it("HISTORY_MIN_WORKOUTS_FOR_DATA is a positive integer", () => {
    expect(HISTORY_MIN_WORKOUTS_FOR_DATA).toBeGreaterThan(0);
    expect(Number.isInteger(HISTORY_MIN_WORKOUTS_FOR_DATA)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// analysisConfidence — computation
// ---------------------------------------------------------------------------

describe("workoutAnalysisViewModel — analysisConfidence", () => {
  it("high when no fallback movements", () => {
    const vm = buildWorkoutAnalysisViewModel(makeResult(5, 0));
    expect(vm.analysisConfidence).toBe<AnalysisConfidence>("high");
  });

  it("medium when some fallback (below high threshold)", () => {
    // 1/5 = 20% — below 50% high threshold, above 0%
    const vm = buildWorkoutAnalysisViewModel(makeResult(5, 1));
    expect(vm.analysisConfidence).toBe<AnalysisConfidence>("medium");
  });

  it("low when at or above high threshold", () => {
    // 3/5 = 60% — above 50% threshold
    const vm = buildWorkoutAnalysisViewModel(makeResult(5, 3));
    expect(vm.analysisConfidence).toBe<AnalysisConfidence>("low");
  });

  it("low when ALL movements are fallback (100%)", () => {
    const vm = buildWorkoutAnalysisViewModel(makeResult(4, 4));
    expect(vm.analysisConfidence).toBe<AnalysisConfidence>("low");
  });

  it("EMPTY_WORKOUT_ANALYSIS defaults to 'high' (vacuously, hasAnalysis=false)", () => {
    expect(EMPTY_WORKOUT_ANALYSIS.analysisConfidence).toBe("high");
    expect(EMPTY_WORKOUT_ANALYSIS.hasAnalysis).toBe(false);
  });

  it("confidence is 'high' at exactly the boundary (0 fallback)", () => {
    const vm = buildWorkoutAnalysisViewModel(makeResult(3, 0));
    expect(vm.analysisConfidence).toBe("high");
  });

  it("confidence boundary: exactly 50% fallback → 'low'", () => {
    // 2/4 = 50% = exactly QUALITY_NOTE_HIGH_THRESHOLD
    const vm = buildWorkoutAnalysisViewModel(makeResult(4, 2));
    expect(vm.analysisConfidence).toBe("low");
  });
});

// ---------------------------------------------------------------------------
// dataQualityNote — wording (Step 9 update: "generic patterns")
// ---------------------------------------------------------------------------

describe("workoutAnalysisViewModel — dataQualityNote wording", () => {
  it("no note when no fallback", () => {
    const vm = buildWorkoutAnalysisViewModel(makeResult(5, 0));
    expect(vm.dataQualityNote).toBeNull();
  });

  it("no note when fallback ratio below low threshold", () => {
    // 1/10 = 10% — below 20% threshold
    const vm = buildWorkoutAnalysisViewModel(makeResult(10, 1));
    expect(vm.dataQualityNote).toBeNull();
  });

  it("moderate note uses 'generic patterns' language (≥20% fallback)", () => {
    // 2/5 = 40% — above 20%, below 50%
    const vm = buildWorkoutAnalysisViewModel(makeResult(5, 2));
    expect(vm.dataQualityNote).not.toBeNull();
    expect(vm.dataQualityNote).toMatch(/generic patterns/i);
  });

  it("strong note uses 'generic patterns' language (≥50% fallback)", () => {
    // 3/5 = 60%
    const vm = buildWorkoutAnalysisViewModel(makeResult(5, 3));
    expect(vm.dataQualityNote).not.toBeNull();
    expect(vm.dataQualityNote).toMatch(/generic patterns/i);
  });

  it("strong note includes movement count", () => {
    const vm = buildWorkoutAnalysisViewModel(makeResult(5, 3));
    expect(vm.dataQualityNote).toMatch(/3/);
    expect(vm.dataQualityNote).toMatch(/5/);
  });

  it("moderate note does NOT include specific movement count", () => {
    // Moderate note is general ("some movements")
    const vm = buildWorkoutAnalysisViewModel(makeResult(5, 2));
    expect(vm.dataQualityNote).toMatch(/some movements/i);
  });

  it("note does NOT say 'library' (old confusing wording removed)", () => {
    const vm = buildWorkoutAnalysisViewModel(makeResult(5, 3));
    expect(vm.dataQualityNote).not.toMatch(/library/i);
  });

  it("note does NOT say 'weren't recognised' (old wording removed)", () => {
    const vm = buildWorkoutAnalysisViewModel(makeResult(5, 3));
    expect(vm.dataQualityNote).not.toMatch(/weren't recognised/i);
  });

  it("singular unit 'movement' when total=1", () => {
    const vm = buildWorkoutAnalysisViewModel(makeResult(1, 1));
    // 1/1 = 100% → strong note
    expect(vm.dataQualityNote).toMatch(/\bmovement\b/);
    expect(vm.dataQualityNote).not.toMatch(/\bmovements\b/);
  });
});

// ---------------------------------------------------------------------------
// importNote deduplication rule
// ---------------------------------------------------------------------------

describe("importNote deduplication rule (screen logic)", () => {
  it("importNote shown when importedDataNote present AND dataQualityNote null", () => {
    const vm = buildWorkoutAnalysisViewModel(makeResult(3, 0)); // no fallback → no quality note
    const importedDataNote = "Scored from movement names only.";
    // Screen rule: show when importedDataNote != null AND vm.dataQualityNote == null
    const shouldShow = importedDataNote != null && vm.dataQualityNote == null;
    expect(shouldShow).toBe(true);
  });

  it("importNote suppressed when dataQualityNote is present", () => {
    const vm = buildWorkoutAnalysisViewModel(makeResult(5, 3)); // 60% fallback → quality note
    const importedDataNote = "Scored from movement names only.";
    const shouldShow = importedDataNote != null && vm.dataQualityNote == null;
    expect(shouldShow).toBe(false);
    expect(vm.dataQualityNote).not.toBeNull(); // confirm quality note is present
  });

  it("importNote not shown when importedDataNote is null (set data was captured)", () => {
    const vm = buildWorkoutAnalysisViewModel(makeResult(3, 0));
    const importedDataNote: string | null = null;
    const shouldShow = importedDataNote != null && vm.dataQualityNote == null;
    expect(shouldShow).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// stimulusPoints coexistence rule
// ---------------------------------------------------------------------------

describe("stimulusPoints coexistence rule (screen logic)", () => {
  it("stimulusPoints shown when hasAnalysis=false (coarse fallback mode)", () => {
    // When extAnalysisVm.hasAnalysis is false, stimulusPoints should show
    const vm = buildWorkoutAnalysisViewModel(null); // no analysis → empty vm
    const stimulusPoints = 42;
    const shouldShow = stimulusPoints != null && !vm.hasAnalysis;
    expect(shouldShow).toBe(true);
  });

  it("stimulusPoints suppressed when hasAnalysis=true (premium panel active)", () => {
    const vm = buildWorkoutAnalysisViewModel(makeResult(3, 0));
    const stimulusPoints = 42;
    const shouldShow = stimulusPoints != null && !vm.hasAnalysis;
    expect(shouldShow).toBe(false);
    expect(vm.hasAnalysis).toBe(true); // confirm premium panel is active
  });

  it("stimulusPoints not shown when null regardless of analysis state", () => {
    const vm = buildWorkoutAnalysisViewModel(null);
    const stimulusPoints: number | null = null;
    const shouldShow = stimulusPoints != null && !vm.hasAnalysis;
    expect(shouldShow).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// History view model — dataConfidence and thresholds
// ---------------------------------------------------------------------------

describe("historyAnalysisViewModel — dataConfidence", () => {
  it("high when no fallback workouts", () => {
    const vm = buildHistoryAnalysisViewModel(makeRollup(5, 0), makeInsights(5));
    expect(vm.dataConfidence).toBe<HistoryDataConfidence>("high");
  });

  it("medium when some fallback workouts (below high threshold)", () => {
    // 1/5 = 20% — below 50%
    const vm = buildHistoryAnalysisViewModel(makeRollup(5, 1), makeInsights(5));
    expect(vm.dataConfidence).toBe<HistoryDataConfidence>("medium");
  });

  it("low when at or above high threshold (50%)", () => {
    // 3/5 = 60%
    const vm = buildHistoryAnalysisViewModel(makeRollup(5, 3), makeInsights(5));
    expect(vm.dataConfidence).toBe<HistoryDataConfidence>("low");
  });

  it("EMPTY_HISTORY_ANALYSIS.dataConfidence defaults to 'high'", () => {
    expect(EMPTY_HISTORY_ANALYSIS.dataConfidence).toBe("high");
  });
});

// ---------------------------------------------------------------------------
// History view model — hasEnoughData threshold
// ---------------------------------------------------------------------------

describe("historyAnalysisViewModel — hasEnoughData", () => {
  it("false when workoutCount < HISTORY_MIN_WORKOUTS_FOR_DATA", () => {
    const count = HISTORY_MIN_WORKOUTS_FOR_DATA - 1;
    const vm = buildHistoryAnalysisViewModel(makeRollup(count, 0), makeInsights(count));
    expect(vm.hasEnoughData).toBe(false);
  });

  it("true when workoutCount >= HISTORY_MIN_WORKOUTS_FOR_DATA", () => {
    const count = HISTORY_MIN_WORKOUTS_FOR_DATA;
    const vm = buildHistoryAnalysisViewModel(makeRollup(count, 0), makeInsights(count));
    expect(vm.hasEnoughData).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// History dataQualityNote — wording (Step 9 update)
// ---------------------------------------------------------------------------

describe("historyAnalysisViewModel — dataQualityNote wording", () => {
  it("no note when totalFallbackMovements=0", () => {
    // makeHistoryMeta will set totalFallbackMovements = 0 when workoutsWithFallback=0
    const rollup = { ...makeRollup(5, 0) };
    rollup.metadata = { ...rollup.metadata, totalFallbackMovements: 0 };
    const vm = buildHistoryAnalysisViewModel(rollup, makeInsights(5));
    expect(vm.dataQualityNote).toBeNull();
  });

  it("moderate note uses 'generic patterns' language", () => {
    // 2/5 = 40% — above 25%, below 50%
    const vm = buildHistoryAnalysisViewModel(makeRollup(5, 2), makeInsights(5));
    expect(vm.dataQualityNote).not.toBeNull();
    expect(vm.dataQualityNote).toMatch(/generic patterns/i);
  });

  it("strong note uses 'generic patterns' language", () => {
    // 4/5 = 80% — above 50%
    const vm = buildHistoryAnalysisViewModel(makeRollup(5, 4), makeInsights(5));
    expect(vm.dataQualityNote).not.toBeNull();
    expect(vm.dataQualityNote).toMatch(/generic patterns/i);
  });

  it("notes do NOT say 'weren't recognised' (old wording)", () => {
    const vm = buildHistoryAnalysisViewModel(makeRollup(5, 4), makeInsights(5));
    expect(vm.dataQualityNote).not.toMatch(/weren't recognised/i);
  });
});

// ---------------------------------------------------------------------------
// Contract stability — new fields don't break existing shape
// ---------------------------------------------------------------------------

describe("Step 9 contract stability", () => {
  it("WorkoutAnalysisDisplayModel has analysisConfidence field", () => {
    const vm = buildWorkoutAnalysisViewModel(makeResult(3, 0));
    expect("analysisConfidence" in vm).toBe(true);
  });

  it("WorkoutAnalysisDisplayModel has all pre-Step-9 fields", () => {
    const vm = buildWorkoutAnalysisViewModel(makeResult(3, 0));
    expect("headline"         in vm).toBe(true);
    expect("topMuscles"       in vm).toBe(true);
    expect("topPatterns"      in vm).toBe(true);
    expect("dominantStimulus" in vm).toBe(true);
    expect("presentStimuli"   in vm).toBe(true);
    expect("dataQualityNote"  in vm).toBe(true);
    expect("movementCount"    in vm).toBe(true);
    expect("scoredCount"      in vm).toBe(true);
    expect("fallbackCount"    in vm).toBe(true);
    expect("hasAnalysis"      in vm).toBe(true);
    expect("sections"         in vm).toBe(true);
  });

  it("HistoryAnalysisDisplayModel has dataConfidence field", () => {
    const vm = buildHistoryAnalysisViewModel(makeRollup(3, 0), makeInsights(3));
    expect("dataConfidence" in vm).toBe(true);
  });

  it("HistoryAnalysisDisplayModel has all pre-Step-9 fields", () => {
    const vm = buildHistoryAnalysisViewModel(makeRollup(3, 0), makeInsights(3));
    expect("headline"            in vm).toBe(true);
    expect("rangeLabel"          in vm).toBe(true);
    expect("workoutCount"        in vm).toBe(true);
    expect("hasEnoughData"       in vm).toBe(true);
    expect("topMuscles"          in vm).toBe(true);
    expect("topPatterns"         in vm).toBe(true);
    expect("dominantStimulus"    in vm).toBe(true);
    expect("recentShifts"        in vm).toBe(true);
    expect("insightCards"        in vm).toBe(true);
    expect("dataQualityNote"     in vm).toBe(true);
    expect("summaryObservations" in vm).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Determinism — same input always yields same output
// ---------------------------------------------------------------------------

describe("Step 9 determinism", () => {
  it("analysisConfidence is deterministic for same metadata", () => {
    const a = buildWorkoutAnalysisViewModel(makeResult(5, 2));
    const b = buildWorkoutAnalysisViewModel(makeResult(5, 2));
    expect(a.analysisConfidence).toBe(b.analysisConfidence);
  });

  it("dataQualityNote is deterministic for same metadata", () => {
    const a = buildWorkoutAnalysisViewModel(makeResult(5, 3));
    const b = buildWorkoutAnalysisViewModel(makeResult(5, 3));
    expect(a.dataQualityNote).toBe(b.dataQualityNote);
  });

  it("dataConfidence is deterministic for same rollup metadata", () => {
    const a = buildHistoryAnalysisViewModel(makeRollup(5, 3), makeInsights(5));
    const b = buildHistoryAnalysisViewModel(makeRollup(5, 3), makeInsights(5));
    expect(a.dataConfidence).toBe(b.dataConfidence);
  });
});

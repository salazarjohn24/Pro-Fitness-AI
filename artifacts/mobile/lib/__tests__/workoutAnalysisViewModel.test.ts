/**
 * workoutAnalysisViewModel.test.ts — Tests for buildWorkoutAnalysisViewModel.
 */

import { describe, it, expect } from "vitest";
import {
  buildWorkoutAnalysisViewModel,
  EMPTY_WORKOUT_ANALYSIS,
  type WorkoutScoreResultJSON,
} from "../viewModels/workoutAnalysisViewModel";

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

function makeResult(overrides: Partial<WorkoutScoreResultJSON> = {}): WorkoutScoreResultJSON {
  return {
    workoutName: "Test workout",
    workoutType: "strength",
    muscleVector: { quads: 3.2, glutes: 2.1, hamstrings: 1.5, core: 0.8, upper_back_lats: 0.6 },
    patternVector: { squat: 4.0, hinge: 1.5 },
    stimulusVector: { strength: 0.85, muscular_endurance: 0.3, conditioning: 0.1, power: 0.05, endurance: 0.0, flexibility: 0.0, stability: 0.0 },
    summary: {
      topMuscles: [
        { key: "quads",           score: 3.2, rank: 1 },
        { key: "glutes",          score: 2.1, rank: 2 },
        { key: "hamstrings",      score: 1.5, rank: 3 },
        { key: "core",            score: 0.8, rank: 4 },
        { key: "upper_back_lats", score: 0.6, rank: 5 },
      ],
      topPatterns: [
        { key: "squat", score: 4.0, rank: 1 },
        { key: "hinge", score: 1.5, rank: 2 },
      ],
      dominantStimulus: "strength",
      presentStimuli: [
        { stimulus: "strength",          value: 0.85 },
        { stimulus: "muscular_endurance", value: 0.3 },
      ],
    },
    metadata: {
      totalMovements:   4,
      scoredMovements:  4,
      fallbackMovements: 0,
      fallbackMovementNames: [],
      totalRawScore:    12.5,
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// A) Null / empty inputs
// ---------------------------------------------------------------------------

describe("buildWorkoutAnalysisViewModel: null/empty inputs", () => {
  it("returns EMPTY model for null", () => {
    const m = buildWorkoutAnalysisViewModel(null);
    expect(m.hasAnalysis).toBe(false);
    expect(m.topMuscles).toHaveLength(0);
    expect(m.topPatterns).toHaveLength(0);
    expect(m.headline).toContain("No workout");
  });

  it("returns EMPTY model for undefined", () => {
    const m = buildWorkoutAnalysisViewModel(undefined);
    expect(m.hasAnalysis).toBe(false);
  });

  it("returns EMPTY model when totalMovements=0", () => {
    const result = makeResult({ metadata: { totalMovements: 0, scoredMovements: 0, fallbackMovements: 0, fallbackMovementNames: [], totalRawScore: 0 } });
    const m = buildWorkoutAnalysisViewModel(result);
    expect(m.hasAnalysis).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// B) Structure and field mapping
// ---------------------------------------------------------------------------

describe("buildWorkoutAnalysisViewModel: structure", () => {
  const m = buildWorkoutAnalysisViewModel(makeResult());

  it("hasAnalysis = true", () => expect(m.hasAnalysis).toBe(true));

  it("topMuscles has correct length and labels", () => {
    expect(m.topMuscles.length).toBe(5);
    expect(m.topMuscles[0].key).toBe("quads");
    expect(m.topMuscles[0].label).toBe("Quadriceps");
    expect(m.topMuscles[0].rank).toBe(1);
  });

  it("topPatterns has correct labels", () => {
    expect(m.topPatterns[0].key).toBe("squat");
    expect(m.topPatterns[0].label).toBe("Squat");
  });

  it("dominantStimulus is correctly labelled", () => {
    expect(m.dominantStimulus.key).toBe("strength");
    expect(m.dominantStimulus.label).toBe("Strength");
    expect(m.dominantStimulus.dominant).toBe(true);
  });

  it("presentStimuli has correct count and marks dominant", () => {
    expect(m.presentStimuli.length).toBe(2);
    const dominant = m.presentStimuli.find((s) => s.dominant);
    expect(dominant?.key).toBe("strength");
  });

  it("movementCount / scoredCount / fallbackCount are correct", () => {
    expect(m.movementCount).toBe(4);
    expect(m.scoredCount).toBe(4);
    expect(m.fallbackCount).toBe(0);
  });

  it("sections are generated", () => {
    expect(m.sections.length).toBeGreaterThan(0);
    const muscleSection = m.sections.find((s) => s.title === "Muscles emphasised");
    expect(muscleSection).toBeDefined();
    expect(muscleSection?.items.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// C) Headline
// ---------------------------------------------------------------------------

describe("buildWorkoutAnalysisViewModel: headline", () => {
  it("combines top pattern and stimulus", () => {
    const m = buildWorkoutAnalysisViewModel(makeResult());
    expect(m.headline).toContain("Squat");
    expect(m.headline).toContain("Strength-forward");
  });

  it("uses pattern only when no stimulus is in presentStimuli", () => {
    const result = makeResult();
    result.summary.presentStimuli = [];
    const m = buildWorkoutAnalysisViewModel(result);
    expect(m.headline).toContain("Squat");
  });

  it("falls back to 'Mixed session' when no patterns and no stimulus", () => {
    const result = makeResult();
    result.summary.topPatterns = [];
    result.summary.presentStimuli = [];
    const m = buildWorkoutAnalysisViewModel(result);
    expect(m.headline).toBe("Mixed session");
  });
});

// ---------------------------------------------------------------------------
// D) Data quality note
// ---------------------------------------------------------------------------

describe("buildWorkoutAnalysisViewModel: data quality note", () => {
  it("no note when fallbackMovements=0", () => {
    const m = buildWorkoutAnalysisViewModel(makeResult());
    expect(m.dataQualityNote).toBeNull();
  });

  it("note when >50% fallback (high rate)", () => {
    const result = makeResult({
      metadata: {
        totalMovements:   4,
        scoredMovements:  1,
        fallbackMovements: 3,
        fallbackMovementNames: ["face pull", "dragon flag", "nordic curl"],
        totalRawScore: 4,
      },
    });
    const m = buildWorkoutAnalysisViewModel(result);
    expect(m.dataQualityNote).not.toBeNull();
    expect(m.dataQualityNote).toContain("generic patterns");
  });

  it("softer note when 20–50% fallback", () => {
    const result = makeResult({
      metadata: {
        totalMovements:    5,
        scoredMovements:   4,
        fallbackMovements: 1,
        fallbackMovementNames: ["nordic curl"],
        totalRawScore: 12,
      },
    });
    const m = buildWorkoutAnalysisViewModel(result);
    expect(m.dataQualityNote).not.toBeNull();
    expect(m.dataQualityNote).toContain("Some movements");
  });

  it("no note when fallback rate <20%", () => {
    const result = makeResult({
      metadata: {
        totalMovements:    10,
        scoredMovements:   9,
        fallbackMovements: 1,
        fallbackMovementNames: ["nordic curl"],
        totalRawScore: 25,
      },
    });
    const m = buildWorkoutAnalysisViewModel(result);
    expect(m.dataQualityNote).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// E) Score rounding
// ---------------------------------------------------------------------------

describe("buildWorkoutAnalysisViewModel: score rounding", () => {
  it("muscle scores are rounded to 2 decimal places", () => {
    const result = makeResult();
    result.summary.topMuscles[0].score = 3.14159;
    const m = buildWorkoutAnalysisViewModel(result);
    expect(m.topMuscles[0].score).toBe(3.14);
  });

  it("stimulus values are rounded to 2 decimal places", () => {
    const result = makeResult();
    result.summary.presentStimuli[0].value = 0.85999;
    const m = buildWorkoutAnalysisViewModel(result);
    expect(m.presentStimuli[0].value).toBe(0.86);
  });
});

// ---------------------------------------------------------------------------
// F) Sections content
// ---------------------------------------------------------------------------

describe("buildWorkoutAnalysisViewModel: sections", () => {
  const m = buildWorkoutAnalysisViewModel(makeResult());

  it("muscles section items are display labels, not keys", () => {
    const muscleSection = m.sections.find((s) => s.title === "Muscles emphasised");
    expect(muscleSection?.items).toContain("Quadriceps");
    expect(muscleSection?.items).not.toContain("quads");
  });

  it("patterns section items are display labels", () => {
    const patternSection = m.sections.find((s) => s.title === "Movement patterns");
    expect(patternSection?.items).toContain("Squat");
    expect(patternSection?.items).not.toContain("squat");
  });

  it("stimulus section contains dominant stimulus label", () => {
    const stimSection = m.sections.find((s) => s.title === "Training stimulus");
    expect(stimSection?.items).toContain("Strength");
  });
});

// ---------------------------------------------------------------------------
// G) Text safety — no prescriptions
// ---------------------------------------------------------------------------

describe("buildWorkoutAnalysisViewModel: text safety", () => {
  const m = buildWorkoutAnalysisViewModel(makeResult());
  const prescriptive = /\b(should|must|need to|prescri|rest|recover)\b/i;

  it("headline contains no prescriptive language", () => {
    expect(m.headline).not.toMatch(prescriptive);
  });

  it("section titles contain no prescriptive language", () => {
    for (const s of m.sections) {
      expect(s.title).not.toMatch(prescriptive);
    }
  });

  it("data quality note contains no alarmist language (when present)", () => {
    const result = makeResult({
      metadata: { totalMovements: 4, scoredMovements: 1, fallbackMovements: 3, fallbackMovementNames: [], totalRawScore: 4 },
    });
    const mq = buildWorkoutAnalysisViewModel(result);
    if (mq.dataQualityNote) {
      expect(mq.dataQualityNote).not.toMatch(/error|invalid|broken|failed/i);
    }
  });
});

// ---------------------------------------------------------------------------
// H) Determinism
// ---------------------------------------------------------------------------

describe("buildWorkoutAnalysisViewModel: determinism", () => {
  it("produces identical results for identical inputs", () => {
    const result = makeResult();
    const m1 = buildWorkoutAnalysisViewModel(result);
    const m2 = buildWorkoutAnalysisViewModel(result);
    expect(m1.headline).toBe(m2.headline);
    expect(m1.topMuscles.map((m) => m.key)).toEqual(m2.topMuscles.map((m) => m.key));
    expect(m1.sections).toEqual(m2.sections);
  });
});

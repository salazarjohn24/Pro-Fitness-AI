/**
 * Unit tests for appleHealthActivityAnalysis.ts
 *
 * Verifies that every label in the explicit hint map produces the expected
 * pattern, stimulus, and confidence, and that workoutType and ultimate
 * fallbacks fire for unknown inputs.
 */

import { describe, it, expect } from "vitest";
import { analyzeAppleHealthActivity } from "../appleHealthActivityAnalysis.js";
import type { ActivityAnalysisHint } from "../appleHealthActivityAnalysis.js";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function hint(label: string, workoutType: string, duration = 45): ActivityAnalysisHint {
  return analyzeAppleHealthActivity(label, workoutType, duration);
}

// ---------------------------------------------------------------------------
// Explicit label mappings — cardio cyclical (medium confidence)
// ---------------------------------------------------------------------------

describe("analyzeAppleHealthActivity — cyclical cardio labels", () => {
  const cyclicalLabels = [
    "Running",
    "Cycling",
    "Rowing",
    "Swimming",
    "Hiking",
    "Elliptical",
    "Stair Climbing",
    "Walking",
  ];

  for (const label of cyclicalLabels) {
    it(`${label} → cyclical / conditioning / medium`, () => {
      const h = hint(label, "cardio");
      expect(h.dominantPattern).toBe("cyclical");
      expect(h.stimulusBias).toBe("conditioning");
      expect(h.confidenceTier).toBe("medium");
      expect(h.trustNote.length).toBeGreaterThan(0);
      expect(h.muscleEmphasisAreas.length).toBeGreaterThan(0);
    });
  }

  it("Running emphasises lower-body muscles", () => {
    const h = hint("Running", "cardio");
    expect(h.muscleEmphasisAreas).toContain("quads");
    expect(h.muscleEmphasisAreas).toContain("hamstrings");
    expect(h.muscleEmphasisAreas).toContain("glutes");
    expect(h.muscleEmphasisAreas).toContain("calves");
  });

  it("Cycling is quad-dominant", () => {
    const h = hint("Cycling", "cardio");
    expect(h.muscleEmphasisAreas[0]).toBe("quads");
    expect(h.muscleEmphasisAreas).not.toContain("hamstrings");
  });

  it("Rowing emphasises upper back", () => {
    const h = hint("Rowing", "cardio");
    expect(h.muscleEmphasisAreas[0]).toBe("upper_back_lats");
  });

  it("Swimming emphasises upper back and shoulders", () => {
    const h = hint("Swimming", "cardio");
    expect(h.muscleEmphasisAreas).toContain("upper_back_lats");
    expect(h.muscleEmphasisAreas).toContain("shoulders");
  });
});

// ---------------------------------------------------------------------------
// Strength labels (low confidence)
// ---------------------------------------------------------------------------

describe("analyzeAppleHealthActivity — strength labels", () => {
  it("Strength Training → strength pattern, strength stimulus, low", () => {
    const h = hint("Strength Training", "strength");
    expect(h.dominantPattern).toBe("strength");
    expect(h.stimulusBias).toBe("strength");
    expect(h.confidenceTier).toBe("low");
    expect(h.muscleEmphasisAreas).toContain("full_body");
  });

  it("Functional Strength → strength pattern, mixed stimulus, low", () => {
    const h = hint("Functional Strength", "strength");
    expect(h.dominantPattern).toBe("strength");
    expect(h.stimulusBias).toBe("mixed");
    expect(h.confidenceTier).toBe("low");
  });

  it("Core Training emphasises core and lower back", () => {
    const h = hint("Core Training", "strength");
    expect(h.dominantPattern).toBe("strength");
    expect(h.muscleEmphasisAreas).toContain("core");
    expect(h.muscleEmphasisAreas).toContain("lower_back");
  });

  it("Gymnastics → upper body + core", () => {
    const h = hint("Gymnastics", "strength");
    expect(h.muscleEmphasisAreas).toContain("upper_body");
    expect(h.muscleEmphasisAreas).toContain("core");
  });
});

// ---------------------------------------------------------------------------
// Mixed modal labels (low confidence)
// ---------------------------------------------------------------------------

describe("analyzeAppleHealthActivity — mixed modal labels", () => {
  it("HIIT → mixed_modal / conditioning / low", () => {
    const h = hint("HIIT", "strength");
    expect(h.dominantPattern).toBe("mixed_modal");
    expect(h.stimulusBias).toBe("conditioning");
    expect(h.confidenceTier).toBe("low");
    expect(h.muscleEmphasisAreas).toContain("full_body");
  });

  it("Cross Training → mixed_modal / mixed / low", () => {
    const h = hint("Cross Training", "strength");
    expect(h.dominantPattern).toBe("mixed_modal");
    expect(h.stimulusBias).toBe("mixed");
    expect(h.confidenceTier).toBe("low");
  });
});

// ---------------------------------------------------------------------------
// Sport labels (low confidence)
// ---------------------------------------------------------------------------

describe("analyzeAppleHealthActivity — sport labels", () => {
  const sportLabels = ["Tennis", "Basketball", "Soccer", "Boxing", "Wrestling", "Martial Arts"];

  for (const label of sportLabels) {
    it(`${label} → sport pattern / low confidence`, () => {
      const h = hint(label, "cardio");
      expect(h.dominantPattern).toBe("sport");
      expect(h.confidenceTier).toBe("low");
      expect(h.muscleEmphasisAreas.length).toBeGreaterThan(0);
    });
  }

  it("Soccer emphasises lower body and core", () => {
    const h = hint("Soccer", "cardio");
    expect(h.muscleEmphasisAreas).toContain("lower_body");
    expect(h.muscleEmphasisAreas).toContain("core");
  });

  it("Boxing emphasises upper body and core", () => {
    const h = hint("Boxing", "strength");
    expect(h.muscleEmphasisAreas).toContain("upper_body");
    expect(h.muscleEmphasisAreas).toContain("core");
  });
});

// ---------------------------------------------------------------------------
// Recovery / mobility labels (low confidence)
// ---------------------------------------------------------------------------

describe("analyzeAppleHealthActivity — mobility labels", () => {
  const mobilityLabels = ["Yoga", "Pilates", "Stretching", "Mind & Body"];

  for (const label of mobilityLabels) {
    it(`${label} → mobility / flexibility / low`, () => {
      const h = hint(label, "recovery");
      expect(h.dominantPattern).toBe("mobility");
      expect(h.stimulusBias).toBe("flexibility");
      expect(h.confidenceTier).toBe("low");
    });
  }

  it("Pilates emphasises core and lower body", () => {
    const h = hint("Pilates", "recovery");
    expect(h.muscleEmphasisAreas).toContain("core");
    expect(h.muscleEmphasisAreas).toContain("lower_body");
  });
});

// ---------------------------------------------------------------------------
// workoutType-level fallbacks
// ---------------------------------------------------------------------------

describe("analyzeAppleHealthActivity — workoutType fallbacks", () => {
  it("unknown label + workoutType=cardio → cyclical fallback", () => {
    const h = hint("Aqua Aerobics", "cardio");
    expect(h.dominantPattern).toBe("cyclical");
    expect(h.stimulusBias).toBe("conditioning");
    expect(h.confidenceTier).toBe("low");
  });

  it("unknown label + workoutType=strength → strength fallback", () => {
    const h = hint("Barre", "strength");
    expect(h.dominantPattern).toBe("strength");
    expect(h.stimulusBias).toBe("strength");
    expect(h.confidenceTier).toBe("low");
  });

  it("unknown label + workoutType=recovery → mobility fallback", () => {
    const h = hint("Meditation", "recovery");
    expect(h.dominantPattern).toBe("mobility");
    expect(h.stimulusBias).toBe("flexibility");
    expect(h.confidenceTier).toBe("low");
  });
});

// ---------------------------------------------------------------------------
// Ultimate fallback
// ---------------------------------------------------------------------------

describe("analyzeAppleHealthActivity — ultimate fallback", () => {
  it("completely unknown label and workoutType → returns a valid hint", () => {
    const h = hint("Unknowable Thing", "unknown");
    expect(h.dominantPattern).toBeDefined();
    expect(h.stimulusBias).toBeDefined();
    expect(h.confidenceTier).toBe("low");
    expect(h.muscleEmphasisAreas.length).toBeGreaterThan(0);
    expect(h.trustNote.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Duration parameter
// ---------------------------------------------------------------------------

describe("analyzeAppleHealthActivity — duration is accepted (future use)", () => {
  it("does not throw with any numeric duration", () => {
    expect(() => hint("Running", "cardio", 0)).not.toThrow();
    expect(() => hint("Running", "cardio", 180)).not.toThrow();
    expect(() => hint("Running", "cardio", 0.5)).not.toThrow();
  });

  it("same label + workoutType always returns the same hint (deterministic)", () => {
    const a = hint("Running", "cardio", 30);
    const b = hint("Running", "cardio", 60);
    expect(a.dominantPattern).toBe(b.dominantPattern);
    expect(a.stimulusBias).toBe(b.stimulusBias);
    expect(a.confidenceTier).toBe(b.confidenceTier);
    expect(a.muscleEmphasisAreas).toEqual(b.muscleEmphasisAreas);
  });
});

// ---------------------------------------------------------------------------
// Structural shape of the hint
// ---------------------------------------------------------------------------

describe("analyzeAppleHealthActivity — hint shape", () => {
  const allLabels = [
    "Running", "Cycling", "Rowing", "Swimming", "Hiking", "Elliptical",
    "Stair Climbing", "Walking", "Strength Training", "Functional Strength",
    "Core Training", "Gymnastics", "HIIT", "Cross Training", "Tennis",
    "Basketball", "Soccer", "Boxing", "Wrestling", "Martial Arts",
    "Yoga", "Pilates", "Stretching", "Mind & Body",
  ];

  for (const label of allLabels) {
    it(`${label} → trustNote is non-empty`, () => {
      const h = hint(label, "strength");
      expect(typeof h.trustNote).toBe("string");
      expect(h.trustNote.length).toBeGreaterThan(10);
    });

    it(`${label} → muscleEmphasisAreas is non-empty array`, () => {
      const h = hint(label, "strength");
      expect(Array.isArray(h.muscleEmphasisAreas)).toBe(true);
      expect(h.muscleEmphasisAreas.length).toBeGreaterThan(0);
    });
  }
});

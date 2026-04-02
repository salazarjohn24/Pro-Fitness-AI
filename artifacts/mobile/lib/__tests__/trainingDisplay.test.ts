/**
 * trainingDisplay.test.ts — Tests for the trainingDisplay formatter module.
 */

import { describe, it, expect } from "vitest";
import {
  muscleLabel,
  patternLabel,
  stimulusLabel,
  roundScore,
  formatScorePct,
  severityTier,
  displayOrFallback,
  emptyStateLabel,
} from "../formatters/trainingDisplay";

describe("muscleLabel", () => {
  it("returns display name for known keys", () => {
    expect(muscleLabel("quads")).toBe("Quadriceps");
    expect(muscleLabel("upper_back_lats")).toBe("Upper back / lats");
    expect(muscleLabel("hip_flexors")).toBe("Hip flexors");
    expect(muscleLabel("core")).toBe("Core");
  });

  it("humanizes unknown keys (underscores to spaces)", () => {
    expect(muscleLabel("mystery_muscle")).toBe("mystery muscle");
    expect(muscleLabel("rotator_cuff")).toBe("rotator cuff");
  });

  it("handles single-word keys", () => {
    expect(muscleLabel("chest")).toBe("Chest");
    expect(muscleLabel("shoulders")).toBe("Shoulders");
  });
});

describe("patternLabel", () => {
  it("returns display name for known patterns", () => {
    expect(patternLabel("squat")).toBe("Squat");
    expect(patternLabel("horizontal_push")).toBe("Horizontal push");
    expect(patternLabel("cyclical")).toBe("Cyclical / conditioning");
    expect(patternLabel("vertical_pull")).toBe("Vertical pull");
  });

  it("humanizes unknown patterns", () => {
    expect(patternLabel("unknown_pattern")).toBe("unknown pattern");
  });
});

describe("stimulusLabel", () => {
  it("returns display name for all stimulus keys", () => {
    expect(stimulusLabel("strength")).toBe("Strength");
    expect(stimulusLabel("muscular_endurance")).toBe("Muscular endurance");
    expect(stimulusLabel("conditioning")).toBe("Conditioning");
    expect(stimulusLabel("endurance")).toBe("Endurance");
    expect(stimulusLabel("power")).toBe("Power");
  });

  it("humanizes unknown stimulus keys", () => {
    expect(stimulusLabel("zone_2")).toBe("zone 2");
  });
});

describe("roundScore", () => {
  it("rounds to 2 decimal places by default", () => {
    expect(roundScore(3.14159)).toBe(3.14);
    expect(roundScore(2.005)).toBe(2.01);
    expect(roundScore(0)).toBe(0);
  });

  it("respects custom decimal places", () => {
    expect(roundScore(3.14159, 3)).toBe(3.142);
    expect(roundScore(3.14159, 0)).toBe(3);
  });

  it("handles integer values cleanly", () => {
    expect(roundScore(5)).toBe(5);
    expect(roundScore(10)).toBe(10);
  });
});

describe("formatScorePct", () => {
  it("formats 0 → 0%", () => expect(formatScorePct(0)).toBe("0%"));
  it("formats 1 → 100%", () => expect(formatScorePct(1)).toBe("100%"));
  it("formats 0.72 → 72%", () => expect(formatScorePct(0.72)).toBe("72%"));
  it("formats 0.505 → rounds correctly", () => {
    const r = formatScorePct(0.505);
    expect(r).toBe("51%");
  });
});

describe("severityTier", () => {
  it("maps insight severity to UI tier", () => {
    expect(severityTier("info")).toBe("neutral");
    expect(severityTier("low")).toBe("soft");
    expect(severityTier("moderate")).toBe("medium");
    expect(severityTier("high")).toBe("strong");
  });
});

describe("displayOrFallback", () => {
  it("returns the value when non-empty", () => {
    expect(displayOrFallback("Quadriceps")).toBe("Quadriceps");
  });

  it("returns fallback for null", () => {
    expect(displayOrFallback(null)).toBe("—");
  });

  it("returns fallback for undefined", () => {
    expect(displayOrFallback(undefined)).toBe("—");
  });

  it("returns fallback for empty string", () => {
    expect(displayOrFallback("")).toBe("—");
    expect(displayOrFallback("   ")).toBe("—");
  });

  it("accepts custom fallback", () => {
    expect(displayOrFallback(null, "N/A")).toBe("N/A");
  });
});

describe("emptyStateLabel", () => {
  it("returns 'No data' for empty array", () => {
    expect(emptyStateLabel([])).toBe("No data");
  });

  it("returns null for non-empty array", () => {
    expect(emptyStateLabel([1, 2, 3])).toBeNull();
  });
});

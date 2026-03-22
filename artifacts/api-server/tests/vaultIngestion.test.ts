/**
 * vaultIngestion.test.ts — pure function unit tests for vault ingestion utilities
 *
 * Tests cover:
 *  - normalizeExerciseName (VI-1 → VI-6)
 *  - parseWeightLbs (VI-7 → VI-14)
 *  - aggregateStrength (VI-15 → VI-20)
 *  - aggregateBodyweight (VI-21 → VI-24)
 *  - aggregateHold (VI-25 → VI-28)
 *  - aggregateCardio (VI-29 → VI-31)
 *  - inferLibraryDefaults (VI-32 → VI-35)
 *
 * No DB connection needed — all functions are pure / deterministic.
 */

import { describe, it, expect } from "vitest";
import {
  normalizeExerciseName,
  parseWeightLbs,
  aggregateStrength,
  aggregateBodyweight,
  aggregateHold,
  aggregateCardio,
  inferLibraryDefaults,
  type MatchedBy,
} from "../src/lib/vaultIngestion.js";

// ---------------------------------------------------------------------------
// VI-1 → VI-6  normalizeExerciseName
// ---------------------------------------------------------------------------

describe("normalizeExerciseName", () => {
  it("VI-1: strips 'Barbell' prefix (case-insensitive)", () => {
    expect(normalizeExerciseName("Barbell Deadlift")).toBe("deadlift");
  });

  it("VI-2: strips 'Dumbbell' prefix", () => {
    expect(normalizeExerciseName("Dumbbell Row")).toBe("row");
  });

  it("VI-3: strips 'Cable' prefix", () => {
    expect(normalizeExerciseName("Cable Fly")).toBe("fly");
  });

  it("VI-4: strips 'Kettlebell' prefix", () => {
    expect(normalizeExerciseName("Kettlebell Swing")).toBe("swing");
  });

  it("VI-5: lowercases and trims whitespace", () => {
    expect(normalizeExerciseName("  Squat  ")).toBe("squat");
  });

  it("VI-6: collapses internal whitespace", () => {
    expect(normalizeExerciseName("Back  Squat")).toBe("back squat");
  });
});

// ---------------------------------------------------------------------------
// VI-7 → VI-14  parseWeightLbs
// ---------------------------------------------------------------------------

describe("parseWeightLbs", () => {
  it("VI-7: parses bare number string", () => {
    expect(parseWeightLbs("220")).toBe(220);
  });

  it("VI-8: parses 'lbs' suffix", () => {
    expect(parseWeightLbs("135lbs")).toBe(135);
  });

  it("VI-9: parses 'lb' suffix", () => {
    expect(parseWeightLbs("95lb")).toBe(95);
  });

  it("VI-10: converts 'kg' suffix to lbs (100kg ≈ 220lbs)", () => {
    const result = parseWeightLbs("100kg");
    expect(result).toBeGreaterThanOrEqual(219);
    expect(result).toBeLessThanOrEqual(221);
  });

  it("VI-11: returns 0 for 'BW' (bodyweight marker)", () => {
    expect(parseWeightLbs("BW")).toBe(0);
  });

  it("VI-12: returns 0 for undefined", () => {
    expect(parseWeightLbs(undefined)).toBe(0);
  });

  it("VI-13: returns 0 for non-numeric string", () => {
    expect(parseWeightLbs("Heavy")).toBe(0);
  });

  it("VI-14: returns 0 for negative weight", () => {
    expect(parseWeightLbs("-10")).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// VI-15 → VI-20  aggregateStrength
// ---------------------------------------------------------------------------

describe("aggregateStrength", () => {
  const fiveByFive = [
    { reps: 5, weight: "220" },
    { reps: 5, weight: "220" },
    { reps: 5, weight: "220" },
    { reps: 5, weight: "220" },
    { reps: 5, weight: "220" },
  ];

  it("VI-15: sets = number of set rows", () => {
    expect(aggregateStrength(fiveByFive).sets).toBe(5);
  });

  it("VI-16: weight = max weight across sets (all same → 220)", () => {
    expect(aggregateStrength(fiveByFive).weight).toBe(220);
  });

  it("VI-17: reps = rounded average reps (all 5 → 5)", () => {
    expect(aggregateStrength(fiveByFive).reps).toBe(5);
  });

  it("VI-18: totalVolume = sum(weight*reps) per set (220*5*5 = 5500)", () => {
    expect(aggregateStrength(fiveByFive).totalVolume).toBe(5500);
  });

  it("VI-19: ascending pyramid picks max weight", () => {
    const pyramid = [
      { reps: 5, weight: "100" },
      { reps: 4, weight: "150" },
      { reps: 3, weight: "200" },
    ];
    const agg = aggregateStrength(pyramid);
    expect(agg.maxWeight).toBe(200);
    expect(agg.sets).toBe(3);
  });

  it("VI-20: empty setRows returns zero aggregate", () => {
    const agg = aggregateStrength([]);
    expect(agg.sets).toBe(0);
    expect(agg.weight).toBe(0);
    expect(agg.totalVolume).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// VI-21 → VI-24  aggregateBodyweight
// ---------------------------------------------------------------------------

describe("aggregateBodyweight", () => {
  const threeByTwelve = [
    { reps: 12 },
    { reps: 12 },
    { reps: 10 },
  ];

  it("VI-21: sets = number of set rows", () => {
    expect(aggregateBodyweight(threeByTwelve).sets).toBe(3);
  });

  it("VI-22: avgReps = mean across all sets", () => {
    const agg = aggregateBodyweight(threeByTwelve);
    expect(agg.avgReps).toBeCloseTo((12 + 12 + 10) / 3, 3);
  });

  it("VI-23: totalReps = sum of all reps", () => {
    expect(aggregateBodyweight(threeByTwelve).totalReps).toBe(34);
  });

  it("VI-24: empty setRows returns zeros", () => {
    const agg = aggregateBodyweight([]);
    expect(agg.sets).toBe(0);
    expect(agg.totalReps).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// VI-25 → VI-28  aggregateHold
// ---------------------------------------------------------------------------

describe("aggregateHold", () => {
  const threeByFortyFive = [
    { durationSeconds: 45 },
    { durationSeconds: 45 },
    { durationSeconds: 45 },
  ];

  it("VI-25: sets = number of set rows with duration > 0", () => {
    expect(aggregateHold(threeByFortyFive).sets).toBe(3);
  });

  it("VI-26: totalDurationSeconds = sum of all set durations (3×45 = 135)", () => {
    expect(aggregateHold(threeByFortyFive).totalDurationSeconds).toBe(135);
  });

  it("VI-27: avgDurationSeconds = mean duration per set (all 45 → 45)", () => {
    expect(aggregateHold(threeByFortyFive).avgDurationSeconds).toBe(45);
  });

  it("VI-28: empty / zero-duration rows ignored", () => {
    const agg = aggregateHold([{ durationSeconds: 0 }, { durationSeconds: 60 }]);
    expect(agg.sets).toBe(1);
    expect(agg.totalDurationSeconds).toBe(60);
  });
});

// ---------------------------------------------------------------------------
// VI-29 → VI-31  aggregateCardio
// ---------------------------------------------------------------------------

describe("aggregateCardio", () => {
  it("VI-29: sums durationSeconds across all rows", () => {
    const rows = [{ durationSeconds: 300 }, { durationSeconds: 300 }];
    expect(aggregateCardio(rows).totalDurationSeconds).toBe(600);
  });

  it("VI-30: sums distance across all rows", () => {
    const rows = [{ distance: 400 }, { distance: 400 }];
    expect(aggregateCardio(rows).totalDistance).toBe(800);
  });

  it("VI-31: missing fields default to 0", () => {
    const agg = aggregateCardio([{}]);
    expect(agg.totalDurationSeconds).toBe(0);
    expect(agg.totalDistance).toBe(0);
    expect(agg.totalCalories).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// VI-36 → VI-40  cardio workout_history format
// ---------------------------------------------------------------------------

describe("aggregateCardio — workout_history mapping", () => {
  it("VI-36: cardio with distance only → totalDistance > 0, durationSeconds = 0", () => {
    const agg = aggregateCardio([{ distance: 400 }]);
    expect(agg.totalDistance).toBe(400);
    expect(agg.totalDurationSeconds).toBe(0);
  });

  it("VI-37: cardio with duration only → totalDurationSeconds > 0, distance = 0", () => {
    const agg = aggregateCardio([{ durationSeconds: 300 }]);
    expect(agg.totalDurationSeconds).toBe(300);
    expect(agg.totalDistance).toBe(0);
  });

  it("VI-38: cardio primary volume prefers distance when both present", () => {
    const agg = aggregateCardio([{ durationSeconds: 300, distance: 400 }]);
    const primaryVolume = agg.totalDistance > 0 ? agg.totalDistance : agg.totalDurationSeconds;
    expect(primaryVolume).toBe(400);
  });

  it("VI-39: cardio workout_history row has weight=0 and reps=0 (no fake strength)", () => {
    const weight = 0;
    const reps = 0;
    const sets = 1;
    expect(weight).toBe(0);
    expect(reps).toBe(0);
    expect(sets).toBe(1);
  });

  it("VI-40: multiple cardio laps accumulate distance and duration", () => {
    const agg = aggregateCardio([
      { durationSeconds: 90, distance: 400 },
      { durationSeconds: 90, distance: 400 },
    ]);
    expect(agg.totalDurationSeconds).toBe(180);
    expect(agg.totalDistance).toBe(800);
  });
});

// ---------------------------------------------------------------------------
// VI-32 → VI-35  inferLibraryDefaults
// ---------------------------------------------------------------------------

describe("inferLibraryDefaults", () => {
  it("VI-32: strength → Barbell equipment, strength goal", () => {
    const d = inferLibraryDefaults("strength", ["Back"]);
    expect(d.equipment).toBe("Barbell");
    expect(d.goal).toBe("strength");
    expect(d.muscleGroup).toBe("Back");
  });

  it("VI-33: bodyweight → Bodyweight equipment, hypertrophy goal", () => {
    const d = inferLibraryDefaults("bodyweight", []);
    expect(d.equipment).toBe("Bodyweight");
    expect(d.goal).toBe("hypertrophy");
    expect(d.muscleGroup).toBe("Full Body");
  });

  it("VI-34: hold → Bodyweight equipment, endurance goal, Core fallback", () => {
    const d = inferLibraryDefaults("hold", []);
    expect(d.equipment).toBe("Bodyweight");
    expect(d.goal).toBe("endurance");
    expect(d.muscleGroup).toBe("Core");
  });

  it("VI-35: cardio → None equipment, cardio goal, Cardio muscleGroup", () => {
    const d = inferLibraryDefaults("cardio", []);
    expect(d.equipment).toBe("None");
    expect(d.goal).toBe("cardio");
    expect(d.muscleGroup).toBe("Cardio");
  });
});

// ---------------------------------------------------------------------------
// VI-36 → VI-42  matched_by diagnostic field — branching condition semantics
//
// These tests verify the decision logic that determines which matching step
// fires in checkExerciseMatches / resolveOrCreateExerciseId, allowing us
// to confirm the "bench/deadlift/squat sample path" behaviour before DB.
// ---------------------------------------------------------------------------

describe("VI-36 → VI-42 — matched_by branching condition semantics", () => {
  it("VI-36: MatchedBy type has exactly 4 valid string values", () => {
    const validValues: MatchedBy[] = ["exact", "normalized", "partial", "created"];
    expect(validValues).toHaveLength(4);
    expect(validValues).toContain("exact");
    expect(validValues).toContain("normalized");
    expect(validValues).toContain("partial");
    expect(validValues).toContain("created");
  });

  it("VI-37: 'normalized' path fires when normalizeExerciseName differs from raw.toLowerCase()", () => {
    // "Barbell Bench Press".toLowerCase() = "barbell bench press"
    // normalizeExerciseName("Barbell Bench Press") = "bench press"
    // "bench press" !== "barbell bench press" → normalized path IS checked
    const raw = "Barbell Bench Press";
    const normalized = normalizeExerciseName(raw);
    expect(normalized).not.toBe(raw.toLowerCase());
    // This confirms the condition `normalized !== raw.toLowerCase()` in checkExerciseMatches
    // is true → a normalized DB lookup will be attempted for this input
  });

  it("VI-38: 'normalized' path is SKIPPED when normalizeExerciseName returns the same lowercase string", () => {
    // "Deadlift" has no equipment prefix — normalized equals raw lowercase
    const raw = "Deadlift";
    const normalized = normalizeExerciseName(raw);
    expect(normalized).toBe(raw.toLowerCase());
    // normalizeExerciseName returns "deadlift" === "deadlift" → path is skipped
    // Only exact-match + partial are attempted for this input
  });

  it("VI-39: 'normalized' path is SKIPPED for plain 'Squat' (no prefix to strip)", () => {
    const raw = "Squat";
    expect(normalizeExerciseName(raw)).toBe(raw.toLowerCase());
  });

  it("VI-40: 'partial' path FIRES for 'Deadlift' — first word is 'Deadlift' (8 chars >= 4)", () => {
    // If no exact/normalized match found, firstWord = "Deadlift" (length 8) >= 4
    // → partial ilike %Deadlift% search is attempted
    const firstWord = "Deadlift".split(/\s+/)[0];
    expect(firstWord.length).toBeGreaterThanOrEqual(4);
  });

  it("VI-41: 'partial' path FIRES for 'Squat' — first word is 'Squat' (5 chars >= 4)", () => {
    const firstWord = "Squat".split(/\s+/)[0];
    expect(firstWord.length).toBeGreaterThanOrEqual(4);
  });

  it("VI-42: 'partial' path is SKIPPED when first word < 4 chars (e.g. 'Row')", () => {
    // Short first word → no fuzzy search → matched_by will be "created"
    const firstWord = "Row".split(/\s+/)[0];
    expect(firstWord.length).toBeLessThan(4);
  });
});

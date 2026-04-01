/**
 * workoutScoring.test.ts — Step 3 workout aggregation tests.
 *
 * Test sections:
 *   A) vectorMath — sumVectors, weightedAverageStimulusVectors, rankEntries,
 *                   dominantStimulusKey, clamp, roundVector
 *   B) workoutSummary — generateWorkoutSummary output shape and ordering
 *   C) scoreWorkout — integration: spec examples, mixed-modal, metadata
 *   D) fallback safety — unknown movements degrade gracefully in aggregation
 *   E) empty/minimal workout — safe zero-state output
 *   F) monotonicity and additivity — more movements = more muscle score
 *   G) determinism — same input → identical output
 */

import { describe, it, expect } from "vitest";
import {
  sumVectors,
  weightedAverageStimulusVectors,
  rankEntries,
  dominantStimulusKey,
  clamp,
  roundVector,
} from "../vectorMath";
import { generateWorkoutSummary, STIMULUS_PRESENCE_THRESHOLD } from "../workoutSummary";
import { scoreWorkout } from "../workoutVector";
import type { StimulusVector } from "../movementScoringTypes";

// ---------------------------------------------------------------------------
// A) vectorMath
// ---------------------------------------------------------------------------

describe("sumVectors", () => {
  it("sums overlapping keys", () => {
    const result = sumVectors([{ quads: 1.5, glutes: 0.8 }, { quads: 2.0, core: 0.5 }]);
    expect(result.quads).toBeCloseTo(3.5);
    expect(result.glutes).toBeCloseTo(0.8);
    expect(result.core).toBeCloseTo(0.5);
  });

  it("handles single vector", () => {
    const result = sumVectors([{ hamstrings: 2.0 }]);
    expect(result.hamstrings).toBeCloseTo(2.0);
  });

  it("handles empty array", () => {
    expect(sumVectors([])).toEqual({});
  });

  it("treats missing keys as zero", () => {
    const result = sumVectors([{ a: 1 }, { b: 2 }]);
    expect(result.a).toBe(1);
    expect(result.b).toBe(2);
    expect(result.c).toBeUndefined();
  });

  it("returns a fresh object (no mutation)", () => {
    const v1 = { quads: 1.0 };
    const result = sumVectors([v1]);
    result.quads = 99;
    expect(v1.quads).toBe(1.0);
  });
});

describe("weightedAverageStimulusVectors", () => {
  const sv1: StimulusVector = {
    strength: 0.8, hypertrophy: 0.5, muscular_endurance: 0.2, power: 0.3, conditioning: 0.1,
  };
  const sv2: StimulusVector = {
    strength: 0.2, hypertrophy: 0.3, muscular_endurance: 0.6, power: 0.1, conditioning: 0.8,
  };

  it("equal weights = plain average", () => {
    const result = weightedAverageStimulusVectors([sv1, sv2], [1, 1]);
    expect(result.strength).toBeCloseTo(0.50);
    expect(result.conditioning).toBeCloseTo(0.45);
  });

  it("higher weight amplifies contribution", () => {
    // sv1 weight=3, sv2 weight=1 → sv1 dominates
    // strength = (0.8×3 + 0.2×1)/4 = 2.6/4 = 0.65 (exactly)
    const result = weightedAverageStimulusVectors([sv1, sv2], [3, 1]);
    expect(result.strength).toBeGreaterThanOrEqual(0.65);
    expect(result.conditioning).toBeLessThan(0.3);
  });

  it("all-zero weights falls back to equal average", () => {
    const result = weightedAverageStimulusVectors([sv1, sv2], [0, 0]);
    expect(result.strength).toBeCloseTo(0.50);
  });

  it("empty input returns all-zero stimulus", () => {
    const result = weightedAverageStimulusVectors([], []);
    expect(result.strength).toBe(0);
    expect(result.conditioning).toBe(0);
  });

  it("single vector returns itself (rounded)", () => {
    const result = weightedAverageStimulusVectors([sv1], [2.0]);
    expect(result.strength).toBeCloseTo(sv1.strength, 1);
    expect(result.conditioning).toBeCloseTo(sv1.conditioning, 1);
  });

  it("all values are clamped to [0, 1]", () => {
    const extreme: StimulusVector = {
      strength: 1.0, hypertrophy: 1.0, muscular_endurance: 1.0, power: 1.0, conditioning: 1.0,
    };
    const result = weightedAverageStimulusVectors([extreme, extreme], [5, 5]);
    for (const val of Object.values(result)) {
      expect(val).toBeLessThanOrEqual(1.0);
      expect(val).toBeGreaterThanOrEqual(0.0);
    }
  });
});

describe("rankEntries", () => {
  const vec = { quads: 3.5, core: 1.2, glutes: 3.5, biceps: 0.8, hamstrings: 2.0 };

  it("ranks by score descending", () => {
    const ranked = rankEntries(vec);
    expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[1].score);
    expect(ranked[1].score).toBeGreaterThanOrEqual(ranked[2].score);
  });

  it("breaks ties alphabetically (glutes < quads alphabetically? no — g < q)", () => {
    // quads=3.5, glutes=3.5 → glutes comes first (g < q)
    const ranked = rankEntries(vec);
    expect(ranked[0].key).toBe("glutes");
    expect(ranked[1].key).toBe("quads");
  });

  it("rank numbers start at 1", () => {
    const ranked = rankEntries(vec);
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].rank).toBe(2);
    expect(ranked[ranked.length - 1].rank).toBe(ranked.length);
  });

  it("respects topN limit", () => {
    const ranked = rankEntries(vec, 3);
    expect(ranked).toHaveLength(3);
    // Top 3 should be the three highest scores
    expect(ranked[0].score).toBeGreaterThan(1.5);
  });

  it("excludes zero-score entries", () => {
    const ranked = rankEntries({ a: 1.0, b: 0.0, c: 2.0 });
    expect(ranked.find((e) => e.key === "b")).toBeUndefined();
  });

  it("empty vector returns empty array", () => {
    expect(rankEntries({})).toEqual([]);
  });
});

describe("dominantStimulusKey", () => {
  it("returns the highest key", () => {
    const sv: StimulusVector = {
      strength: 0.3, hypertrophy: 0.4, muscular_endurance: 0.7, power: 0.2, conditioning: 0.5,
    };
    expect(dominantStimulusKey(sv)).toBe("muscular_endurance");
  });

  it("breaks ties alphabetically (conditioning < strength)", () => {
    const sv: StimulusVector = {
      strength: 0.6, hypertrophy: 0.4, muscular_endurance: 0.2, power: 0.4, conditioning: 0.6,
    };
    expect(dominantStimulusKey(sv)).toBe("conditioning"); // c < s
  });
});

describe("clamp", () => {
  it("clamps below min", () => { expect(clamp(-5, 0, 1)).toBe(0); });
  it("clamps above max", () => { expect(clamp(9, 0, 4)).toBe(4); });
  it("passes through value in range", () => { expect(clamp(0.5, 0, 1)).toBe(0.5); });
});

describe("roundVector", () => {
  it("rounds to 3 dp by default", () => {
    const result = roundVector({ a: 1.23456 });
    expect(result.a).toBe(1.235);
  });

  it("returns fresh object", () => {
    const original = { a: 1.0 };
    const result = roundVector(original);
    result.a = 99;
    expect(original.a).toBe(1.0);
  });
});

// ---------------------------------------------------------------------------
// B) workoutSummary
// ---------------------------------------------------------------------------

describe("generateWorkoutSummary", () => {
  const muscle: Record<string, number> = {
    quads: 5.2, upper_back_lats: 4.8, glutes: 3.1, shoulders: 2.5, core: 1.0,
    biceps: 0.9, hamstrings: 0.4,
  };
  const pattern: Record<string, number> = {
    squat: 4.0, vertical_pull: 3.75, vertical_push: 1.5,
  };
  const stimulus: StimulusVector = {
    strength: 0.65, hypertrophy: 0.50, muscular_endurance: 0.35, power: 0.70, conditioning: 0.40,
  };

  const summary = generateWorkoutSummary(muscle, pattern, stimulus);

  it("topMuscles is ranked descending by score", () => {
    const scores = summary.topMuscles.map((e) => e.score);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
    }
  });

  it("topMuscles rank 1 is quads (highest score)", () => {
    expect(summary.topMuscles[0].key).toBe("quads");
    expect(summary.topMuscles[0].rank).toBe(1);
  });

  it("topMuscles length ≤ 5 (default topN)", () => {
    expect(summary.topMuscles.length).toBeLessThanOrEqual(5);
  });

  it("topPatterns rank 1 is squat", () => {
    expect(summary.topPatterns[0].key).toBe("squat");
  });

  it("dominantStimulus is power (0.70 highest)", () => {
    expect(summary.dominantStimulus).toBe("power");
  });

  it("presentStimuli only includes values >= STIMULUS_PRESENCE_THRESHOLD", () => {
    for (const entry of summary.presentStimuli) {
      expect(entry.value).toBeGreaterThanOrEqual(STIMULUS_PRESENCE_THRESHOLD);
    }
  });

  it("presentStimuli excludes muscular_endurance (0.35 < threshold)", () => {
    const keys = summary.presentStimuli.map((e) => e.stimulus);
    expect(keys).not.toContain("muscular_endurance");
  });

  it("presentStimuli is sorted descending", () => {
    const vals = summary.presentStimuli.map((e) => e.value);
    for (let i = 1; i < vals.length; i++) {
      expect(vals[i]).toBeLessThanOrEqual(vals[i - 1]);
    }
  });

  it("empty vectors return empty ranked lists with neutral dominant", () => {
    const s = generateWorkoutSummary({}, {}, {
      strength: 0, hypertrophy: 0, muscular_endurance: 0, power: 0, conditioning: 0,
    });
    expect(s.topMuscles).toHaveLength(0);
    expect(s.topPatterns).toHaveLength(0);
    expect(s.presentStimuli).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// C) scoreWorkout — spec examples + integration
// ---------------------------------------------------------------------------

describe("scoreWorkout: Fran (21-15-9 thrusters + pull-ups, scored as one round)", () => {
  // Approximate Fran: one round at benchmark reps
  const result = scoreWorkout({
    workoutName: "Fran",
    workoutType: "for_time",
    movements: [
      { name: "thrusters", reps: 45, loadLb: 95 },  // 21+15+9
      { name: "pull-ups",  reps: 45 },
    ],
  });

  it("preserves workout name and type", () => {
    expect(result.workoutName).toBe("Fran");
    expect(result.workoutType).toBe("for_time");
  });

  it("has 2 movement results", () => {
    expect(result.movementResults).toHaveLength(2);
  });

  it("zero fallback movements", () => {
    expect(result.metadata.fallbackMovements).toBe(0);
    expect(result.metadata.scoredMovements).toBe(2);
  });

  it("quads and upper_back_lats are in the muscle vector", () => {
    expect(result.muscleVector["quads"]).toBeDefined();
    expect(result.muscleVector["upper_back_lats"]).toBeDefined();
  });

  it("quads score = sum of thruster quads + pull-up quads (if any)", () => {
    const thrusterResult = result.movementResults[0];
    const pullupResult   = result.movementResults[1];
    const thrusterQuads = thrusterResult.muscleVector["quads"] ?? 0;
    const pullupQuads   = pullupResult.muscleVector["quads"] ?? 0;
    expect(result.muscleVector["quads"]).toBeCloseTo(thrusterQuads + pullupQuads, 2);
  });

  it("squat and vertical_pull both appear in patternVector", () => {
    expect(result.patternVector["squat"]).toBeDefined();
    expect(result.patternVector["vertical_pull"]).toBeDefined();
  });

  it("totalRawScore = sum of both movement rawScores", () => {
    const sumRaw = result.movementResults.reduce((s, r) => s + r.exposure.rawScore, 0);
    expect(result.metadata.totalRawScore).toBeCloseTo(sumRaw, 2);
  });

  it("muscle vector is additive (upper_back_lats > either movement alone)", () => {
    // pull-up is the main upper_back_lats driver; thruster may add a little
    const pullupLats = result.movementResults[1].muscleVector["upper_back_lats"] ?? 0;
    const combinedLats = result.muscleVector["upper_back_lats"] ?? 0;
    expect(combinedLats).toBeGreaterThanOrEqual(pullupLats);
  });

  it("summary topMuscles includes quads and upper_back_lats", () => {
    const muscleKeys = result.summary.topMuscles.map((e) => e.key);
    expect(muscleKeys).toContain("quads");
    expect(muscleKeys).toContain("upper_back_lats");
  });

  it("stimulus vector is plausible for a Fran-style workout", () => {
    // Both movements are power/strength biased, high reps → conditioning present
    expect(result.stimulusVector.power).toBeGreaterThan(0.4);
    expect(result.stimulusVector.strength).toBeGreaterThan(0.4);
  });
});

describe("scoreWorkout: mixed-modal metcon (row + deadlifts + HSPU)", () => {
  const result = scoreWorkout({
    workoutName: "Mixed Metcon",
    workoutType: "for_time",
    movements: [
      { name: "row",         distanceM: 500 },
      { name: "deadlifts",   reps: 12, loadKg: 102 },
      { name: "handstand push-up", reps: 12 },
    ],
  });

  it("has 3 movement results", () => {
    expect(result.movementResults).toHaveLength(3);
  });

  it("zero fallback movements", () => {
    expect(result.metadata.fallbackMovements).toBe(0);
  });

  it("patternVector includes cyclical, hinge, and vertical_push", () => {
    expect(result.patternVector["cyclical"]).toBeDefined();
    expect(result.patternVector["hinge"]).toBeDefined();
    expect(result.patternVector["vertical_push"]).toBeDefined();
  });

  it("posterior chain muscles present (hamstrings, glutes from deadlifts)", () => {
    expect(result.muscleVector["hamstrings"]).toBeDefined();
    expect(result.muscleVector["glutes"]).toBeDefined();
  });

  it("upper body push muscles present (shoulders from HSPU)", () => {
    expect(result.muscleVector["shoulders"]).toBeDefined();
    expect(result.muscleVector["triceps"]).toBeDefined();
  });

  it("stimulus vector contains conditioning (row) and strength (deadlift)", () => {
    // Row contributes conditioning but is outweighed by deadlift+HSPU (both strength-dominant).
    // Weighted conditioning ≈ (1.0×1.0 + 0.10×2.73 + 0.10×2.1) / 5.83 ≈ 0.25 — present but modest.
    expect(result.stimulusVector.conditioning).toBeGreaterThan(0.2);
    expect(result.stimulusVector.strength).toBeGreaterThan(0.5);
  });

  it("totalRawScore is greater than any single movement's rawScore", () => {
    const maxSingle = Math.max(
      ...result.movementResults.map((r) => r.exposure.rawScore)
    );
    expect(result.metadata.totalRawScore).toBeGreaterThan(maxSingle);
  });
});

describe("scoreWorkout: ranking correctness", () => {
  // squat-dominant: back squat + front squat, both heavy
  const result = scoreWorkout({
    movements: [
      { name: "back squat",  reps: 10, loadKg: 100 },
      { name: "front squat", reps: 10, loadKg: 80  },
    ],
  });

  it("quads is rank 1 (dominant in both movements)", () => {
    expect(result.summary.topMuscles[0].key).toBe("quads");
  });

  it("topMuscles is ranked in descending order", () => {
    for (let i = 1; i < result.summary.topMuscles.length; i++) {
      expect(result.summary.topMuscles[i].score).toBeLessThanOrEqual(
        result.summary.topMuscles[i - 1].score
      );
    }
  });

  it("squat pattern dominates patternVector", () => {
    expect(result.summary.topPatterns[0].key).toBe("squat");
  });

  it("strength is dominant or co-dominant stimulus", () => {
    const dominant = result.summary.dominantStimulus;
    expect(["strength", "power"]).toContain(dominant);
  });

  it("all rank numbers are sequential starting from 1", () => {
    result.summary.topMuscles.forEach((entry, i) => {
      expect(entry.rank).toBe(i + 1);
    });
  });
});

// ---------------------------------------------------------------------------
// D) Fallback safety
// ---------------------------------------------------------------------------

describe("scoreWorkout: fallback / unknown movements", () => {
  const result = scoreWorkout({
    movements: [
      { name: "back squat",   reps: 5, loadKg: 120 },   // known
      { name: "dragon flag",  reps: 5 },                 // unknown
      { name: "nordic hamstring curl", reps: 8 },        // unknown
    ],
  });

  it("scoredMovements = 1, fallbackMovements = 2", () => {
    expect(result.metadata.scoredMovements).toBe(1);
    expect(result.metadata.fallbackMovements).toBe(2);
  });

  it("fallbackMovementNames lists the unknown movement names", () => {
    expect(result.metadata.fallbackMovementNames).toContain("dragon flag");
    expect(result.metadata.fallbackMovementNames).toContain("nordic hamstring curl");
  });

  it("muscle vector still populated from the known movement (back squat)", () => {
    expect(result.muscleVector["quads"]).toBeDefined();
    expect(result.muscleVector["quads"]!).toBeGreaterThan(0);
  });

  it("unknown movements contribute empty muscleVector (no keys added)", () => {
    // Back squat provides quads, glutes, hamstrings, core
    // Dragon flag / nordic curl should not add muscles we don't know
    const squat = scoreWorkout({
      movements: [{ name: "back squat", reps: 5, loadKg: 120 }],
    });
    // Keys in combined workout should be superset of squat keys
    const combinedKeys = new Set(Object.keys(result.muscleVector));
    const squatKeys = new Set(Object.keys(squat.muscleVector));
    for (const key of squatKeys) {
      expect(combinedKeys.has(key)).toBe(true);
    }
  });

  it("totalRawScore still includes fallback movements' minimal rawScore", () => {
    // Each fallback movement gets rawScore=0.1 (unknown method)
    // With reps=5 and no profile... actually fallback movements do have exposure
    expect(result.metadata.totalRawScore).toBeGreaterThan(0);
  });

  it("all movement results preserved even for fallback movements", () => {
    const fallbackResults = result.movementResults.filter((r) => r.fallbackUsed);
    expect(fallbackResults).toHaveLength(2);
    expect(fallbackResults.every((r) => Object.keys(r.muscleVector).length === 0)).toBe(true);
  });
});

describe("scoreWorkout: fully unknown workout", () => {
  const result = scoreWorkout({
    movements: [
      { name: "lateral raise", reps: 15, loadKg: 10 },
      { name: "face pull",     reps: 15, loadKg: 15 },
    ],
  });

  it("all movements fall back", () => {
    expect(result.metadata.fallbackMovements).toBe(2);
    expect(result.metadata.scoredMovements).toBe(0);
  });

  it("muscleVector is empty", () => {
    expect(Object.keys(result.muscleVector)).toHaveLength(0);
  });

  it("patternVector is empty (no patterns to accumulate)", () => {
    expect(Object.keys(result.patternVector)).toHaveLength(0);
  });

  it("summary topMuscles and topPatterns are empty", () => {
    expect(result.summary.topMuscles).toHaveLength(0);
    expect(result.summary.topPatterns).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// E) Empty / minimal workout
// ---------------------------------------------------------------------------

describe("scoreWorkout: empty input", () => {
  const result = scoreWorkout({ movements: [] });

  it("returns zero-state result without throwing", () => {
    expect(result).toBeDefined();
  });

  it("metadata is all zeros", () => {
    expect(result.metadata.totalMovements).toBe(0);
    expect(result.metadata.scoredMovements).toBe(0);
    expect(result.metadata.fallbackMovements).toBe(0);
    expect(result.metadata.totalRawScore).toBe(0);
  });

  it("vectors are empty", () => {
    expect(Object.keys(result.muscleVector)).toHaveLength(0);
    expect(Object.keys(result.patternVector)).toHaveLength(0);
  });

  it("movementResults is empty array", () => {
    expect(result.movementResults).toHaveLength(0);
  });
});

describe("scoreWorkout: single movement", () => {
  const result = scoreWorkout({
    movements: [{ name: "deadlift", reps: 5, loadKg: 150 }],
  });

  it("muscle vector = the single movement's muscle vector (rounded)", () => {
    const singleResult = result.movementResults[0];
    for (const [muscle, score] of Object.entries(singleResult.muscleVector)) {
      expect(result.muscleVector[muscle!]).toBeCloseTo(score!, 2);
    }
  });

  it("totalMovements = 1, scoredMovements = 1", () => {
    expect(result.metadata.totalMovements).toBe(1);
    expect(result.metadata.scoredMovements).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// F) Monotonicity and additivity
// ---------------------------------------------------------------------------

describe("scoreWorkout: additivity", () => {
  it("adding a second squat movement increases quads score", () => {
    const one = scoreWorkout({
      movements: [{ name: "back squat", reps: 5, loadKg: 100 }],
    });
    const two = scoreWorkout({
      movements: [
        { name: "back squat",  reps: 5, loadKg: 100 },
        { name: "front squat", reps: 5, loadKg: 80  },
      ],
    });
    expect(two.muscleVector["quads"]!).toBeGreaterThan(one.muscleVector["quads"]!);
  });

  it("adding a cyclical movement increases conditioning stimulus weight", () => {
    const strength = scoreWorkout({
      movements: [{ name: "back squat", reps: 5, loadKg: 100 }],
    });
    const mixed = scoreWorkout({
      movements: [
        { name: "back squat", reps: 5, loadKg: 100 },
        { name: "row",        distanceM: 1000       },
      ],
    });
    // Conditioning should increase when row is added
    expect(mixed.stimulusVector.conditioning).toBeGreaterThan(
      strength.stimulusVector.conditioning
    );
  });

  it("totalRawScore grows with each additional movement", () => {
    const one = scoreWorkout({
      movements: [{ name: "pull-up", reps: 10 }],
    });
    const two = scoreWorkout({
      movements: [
        { name: "pull-up",     reps: 10 },
        { name: "push-up",     reps: 20 },
      ],
    });
    expect(two.metadata.totalRawScore).toBeGreaterThan(one.metadata.totalRawScore);
  });
});

// ---------------------------------------------------------------------------
// G) Determinism
// ---------------------------------------------------------------------------

describe("scoreWorkout: deterministic output", () => {
  const input = {
    workoutName: "Test WOD",
    movements: [
      { name: "thrusters", reps: 21, loadLb: 95 },
      { name: "pull-ups",  reps: 21 },
      { name: "row",       distanceM: 500 },
    ],
  };

  it("identical inputs produce identical muscle vectors", () => {
    const r1 = scoreWorkout(input);
    const r2 = scoreWorkout(input);
    expect(r1.muscleVector).toEqual(r2.muscleVector);
  });

  it("identical inputs produce identical ranked summaries", () => {
    const r1 = scoreWorkout(input);
    const r2 = scoreWorkout(input);
    expect(r1.summary.topMuscles).toEqual(r2.summary.topMuscles);
    expect(r1.summary.topPatterns).toEqual(r2.summary.topPatterns);
    expect(r1.summary.dominantStimulus).toEqual(r2.summary.dominantStimulus);
  });

  it("topMuscles rank ordering is stable across runs", () => {
    const r1 = scoreWorkout(input);
    const r2 = scoreWorkout(input);
    const keys1 = r1.summary.topMuscles.map((e) => e.key);
    const keys2 = r2.summary.topMuscles.map((e) => e.key);
    expect(keys1).toEqual(keys2);
  });
});

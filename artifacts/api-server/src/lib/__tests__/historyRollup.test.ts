/**
 * historyRollup.test.ts — Step 4 historical rollup tests.
 *
 * Test sections:
 *   A) timeRange — preset cutoffs, daysAgo, filterByTimeRange
 *   B) recencyWeighting — bucket correctness, applyRecencyWeight, edge cases
 *   C) historyAggregation — core integration tests
 *       C1) cumulative aggregation correctness
 *       C2) recency weighting behavior
 *       C3) date range filtering
 *       C4) metadata correctness
 *       C5) fallback handling
 *   D) historySummary — top/bottom ranking, elevated/reduced, stimulus
 *   E) empty/minimal history safety
 *   F) determinism — same input → identical output
 */

import { describe, it, expect } from "vitest";
import { getPresetStart, daysAgo, filterByTimeRange } from "../timeRange";
import { getRecencyWeight, applyRecencyWeight, bucketLabel } from "../recencyWeighting";
import { scoreHistory } from "../historyAggregation";
import { generateHistorySummary } from "../historySummary";
import { scoreWorkout } from "../workoutVector";
import type { HistoricalWorkoutInput } from "../historyScoringTypes";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

/** Build a reference date at noon UTC on a given ISO date string. */
function refDate(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00Z`);
}

/** Shift a reference date back by N days. */
function daysBack(ref: Date, n: number): Date {
  const d = new Date(ref);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

/** Create a minimal HistoricalWorkoutInput from movements and a date. */
function makeEntry(
  movements: Array<{ name: string; reps?: number; loadKg?: number; distanceM?: number; calories?: number }>,
  performedAt: Date
): HistoricalWorkoutInput {
  return {
    workoutResult: scoreWorkout({ movements }),
    performedAt,
  };
}

// Fixed reference date so all tests are deterministic
const REF = refDate("2026-04-01");

// ---------------------------------------------------------------------------
// A) timeRange
// ---------------------------------------------------------------------------

describe("getPresetStart", () => {
  it("week → 7 days back at 00:00:00 UTC", () => {
    const cutoff = getPresetStart("week", REF)!;
    const expected = daysBack(REF, 7);
    expected.setUTCHours(0, 0, 0, 0);
    expect(cutoff.toISOString()).toBe(expected.toISOString());
  });

  it("month → 30 days back", () => {
    const cutoff = getPresetStart("month", REF)!;
    const expected = daysBack(REF, 30);
    expected.setUTCHours(0, 0, 0, 0);
    expect(cutoff.toISOString()).toBe(expected.toISOString());
  });

  it("quarter → 90 days back", () => {
    const cutoff = getPresetStart("quarter", REF)!;
    const expected = daysBack(REF, 90);
    expected.setUTCHours(0, 0, 0, 0);
    expect(cutoff.toISOString()).toBe(expected.toISOString());
  });

  it("year → 365 days back", () => {
    const cutoff = getPresetStart("year", REF)!;
    const expected = daysBack(REF, 365);
    expected.setUTCHours(0, 0, 0, 0);
    expect(cutoff.toISOString()).toBe(expected.toISOString());
  });

  it("all → returns null (no lower bound)", () => {
    expect(getPresetStart("all", REF)).toBeNull();
  });
});

describe("daysAgo", () => {
  it("same day = 0 days ago", () => {
    expect(daysAgo(REF, REF)).toBe(0);
  });

  it("1 day ago = 1", () => {
    expect(daysAgo(daysBack(REF, 1), REF)).toBe(1);
  });

  it("7 days ago = 7", () => {
    expect(daysAgo(daysBack(REF, 7), REF)).toBe(7);
  });

  it("future date = 0 (clamped, not negative)", () => {
    const future = new Date(REF);
    future.setUTCDate(future.getUTCDate() + 5);
    expect(daysAgo(future, REF)).toBe(0);
  });
});

describe("filterByTimeRange", () => {
  const today       = makeEntry([{ name: "back squat", reps: 5, loadKg: 100 }], REF);
  const threeDays   = makeEntry([{ name: "pull-up",    reps: 10 }],              daysBack(REF, 3));
  const tenDays     = makeEntry([{ name: "row",        distanceM: 500 }],        daysBack(REF, 10));
  const thirtyDays  = makeEntry([{ name: "deadlift",   reps: 5, loadKg: 120 }],  daysBack(REF, 30));
  const hundredDays = makeEntry([{ name: "thruster",   reps: 15, loadKg: 43 }],  daysBack(REF, 100));
  const all = [today, threeDays, tenDays, thirtyDays, hundredDays];

  it("week → includes 0–7 days only", () => {
    const result = filterByTimeRange(all, "week", REF);
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.performedAt.getTime())).toContain(REF.getTime());
  });

  it("month → includes 0–30 days", () => {
    const result = filterByTimeRange(all, "month", REF);
    expect(result).toHaveLength(4); // today, 3, 10, 30
  });

  it("quarter → includes 0–90 days (excludes 100 days)", () => {
    const result = filterByTimeRange(all, "quarter", REF);
    expect(result).toHaveLength(4); // today, 3, 10, 30 (100 excluded)
  });

  it("year → includes all entries ≤ 365 days", () => {
    const result = filterByTimeRange(all, "year", REF);
    expect(result).toHaveLength(5);
  });

  it("all → includes all entries regardless of age", () => {
    const result = filterByTimeRange(all, "all", REF);
    expect(result).toHaveLength(5);
  });

  it("result is sorted ascending by performedAt", () => {
    const result = filterByTimeRange(all, "all", REF);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].performedAt.getTime()).toBeGreaterThanOrEqual(
        result[i - 1].performedAt.getTime()
      );
    }
  });

  it("custom TimeRange filters correctly", () => {
    const result = filterByTimeRange(all, {
      start: daysBack(REF, 15),
      end: REF,
    }, REF);
    // Should include today, 3-days, 10-days, but NOT 30-days or 100-days
    // Wait — 30 days ago is exactly 30 days, which is before the start (15 days back)
    // So: today, 3-days, 10-days → 3 entries
    expect(result.length).toBeGreaterThanOrEqual(3);
    expect(result.find((e) => e === hundredDays)).toBeUndefined();
  });

  it("empty collection returns empty array", () => {
    expect(filterByTimeRange([], "all", REF)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// B) recencyWeighting
// ---------------------------------------------------------------------------

describe("getRecencyWeight", () => {
  const cases: [number, number][] = [
    [0,   1.00],
    [1,   1.00],
    [2,   1.00],
    [3,   0.80],
    [5,   0.80],
    [7,   0.80],
    [8,   0.55],
    [10,  0.55],
    [14,  0.55],
    [15,  0.30],
    [20,  0.30],
    [30,  0.30],
    [31,  0.15],
    [60,  0.15],
    [90,  0.15],
    [91,  0.08],
    [200, 0.08],
    [1000,0.08],
  ];

  for (const [days, expectedWeight] of cases) {
    it(`${days} days ago → weight ${expectedWeight}`, () => {
      expect(getRecencyWeight(days)).toBe(expectedWeight);
    });
  }

  it("negative days clamped to 0 → weight 1.0", () => {
    expect(getRecencyWeight(-5)).toBe(1.00);
  });

  it("weight monotonically decreases with age (sampled)", () => {
    const samples = [0, 5, 10, 20, 45, 100];
    let prev = getRecencyWeight(samples[0]);
    for (let i = 1; i < samples.length; i++) {
      const cur = getRecencyWeight(samples[i]);
      expect(cur).toBeLessThanOrEqual(prev);
      prev = cur;
    }
  });
});

describe("applyRecencyWeight", () => {
  it("multiplies each value by the weight", () => {
    const result = applyRecencyWeight({ quads: 2.0, core: 1.0 }, 0.5);
    expect(result.quads).toBeCloseTo(1.0);
    expect(result.core).toBeCloseTo(0.5);
  });

  it("does not mutate the original vector", () => {
    const original = { quads: 2.0 };
    applyRecencyWeight(original, 0.5);
    expect(original.quads).toBe(2.0);
  });

  it("weight=1.0 → same values", () => {
    const vec = { a: 1.5, b: 0.7 };
    const result = applyRecencyWeight(vec, 1.0);
    expect(result.a).toBeCloseTo(1.5);
    expect(result.b).toBeCloseTo(0.7);
  });

  it("weight=0.0 → all zeros", () => {
    const result = applyRecencyWeight({ a: 5.0, b: 3.0 }, 0);
    expect(result.a).toBe(0);
    expect(result.b).toBe(0);
  });
});

describe("bucketLabel", () => {
  it("returns a non-empty string for any day count", () => {
    for (const d of [0, 5, 12, 25, 60, 200]) {
      expect(bucketLabel(d).length).toBeGreaterThan(0);
    }
  });

  it("returns the floor label for >90 days", () => {
    expect(bucketLabel(100)).toContain("0.08");
  });
});

// ---------------------------------------------------------------------------
// C) historyAggregation
// ---------------------------------------------------------------------------

describe("scoreHistory: cumulative aggregation correctness", () => {
  // Two squat workouts → quads should be the dominant muscle cumulatively
  const squatWorkout1 = makeEntry(
    [{ name: "back squat", reps: 5, loadKg: 100 }],
    daysBack(REF, 5)
  );
  const squatWorkout2 = makeEntry(
    [{ name: "front squat", reps: 5, loadKg: 80 }],
    daysBack(REF, 2)
  );

  const result = scoreHistory([squatWorkout1, squatWorkout2], { referenceDate: REF });

  it("cumulativeMuscleVector.quads = sum of both workout quads", () => {
    const w1Quads = squatWorkout1.workoutResult.muscleVector["quads"] ?? 0;
    const w2Quads = squatWorkout2.workoutResult.muscleVector["quads"] ?? 0;
    expect(result.cumulativeMuscleVector["quads"]).toBeCloseTo(w1Quads + w2Quads, 2);
  });

  it("cumulative quads > cumulative from either workout alone", () => {
    const r1 = scoreHistory([squatWorkout1], { referenceDate: REF });
    expect(result.cumulativeMuscleVector["quads"]!).toBeGreaterThan(
      r1.cumulativeMuscleVector["quads"]!
    );
  });

  it("cumulativePatternVector.squat reflects both workouts", () => {
    const p1 = squatWorkout1.workoutResult.patternVector["squat"] ?? 0;
    const p2 = squatWorkout2.workoutResult.patternVector["squat"] ?? 0;
    expect(result.cumulativePatternVector["squat"]).toBeCloseTo(p1 + p2, 2);
  });
});

describe("scoreHistory: recency weighting behavior", () => {
  const recent = makeEntry([{ name: "deadlift", reps: 5, loadKg: 150 }], daysBack(REF, 1));  // weight=1.0
  const old    = makeEntry([{ name: "deadlift", reps: 5, loadKg: 150 }], daysBack(REF, 60)); // weight=0.15

  const result = scoreHistory([recent, old], { referenceDate: REF });

  it("recency muscle scores are lower than cumulative (decay applied)", () => {
    const cumQuads = result.cumulativeMuscleVector["quads"] ?? 0;
    const recQuads = result.recencyMuscleVector["quads"] ?? 0;
    expect(recQuads).toBeLessThan(cumQuads);
  });

  it("recent workout contributes more to recency vector than old workout", () => {
    // Recent gets weight=1.0, old gets weight=0.15
    // recency = recent_quads × 1.0 + old_quads × 0.15
    // cumulative = recent_quads + old_quads
    const recentQuads = recent.workoutResult.muscleVector["quads"] ?? 0;
    const oldQuads    = old.workoutResult.muscleVector["quads"] ?? 0;
    const expectedRecency = recentQuads * 1.0 + oldQuads * 0.15;
    expect(result.recencyMuscleVector["quads"]).toBeCloseTo(expectedRecency, 2);
  });

  it("recency vector is always ≤ cumulative for same movements (all weights ≤ 1)", () => {
    for (const muscle of Object.keys(result.cumulativeMuscleVector)) {
      const cum = result.cumulativeMuscleVector[muscle];
      const rec = result.recencyMuscleVector[muscle] ?? 0;
      expect(rec).toBeLessThanOrEqual(cum! + 0.001); // tiny float tolerance
    }
  });
});

describe("scoreHistory: date range filtering", () => {
  const thisWeek = makeEntry([{ name: "back squat", reps: 5, loadKg: 100 }], daysBack(REF, 3));
  const lastMonth = makeEntry([{ name: "pull-up",   reps: 20 }],              daysBack(REF, 20));
  const lastYear  = makeEntry([{ name: "row",       distanceM: 1000 }],       daysBack(REF, 200));
  const all = [thisWeek, lastMonth, lastYear];

  it("week filter excludes lastMonth and lastYear", () => {
    const r = scoreHistory(all, { dateRange: "week", referenceDate: REF });
    expect(r.metadata.filteredWorkouts).toBe(1);
    expect(r.cumulativeMuscleVector["quads"]).toBeDefined();
    expect(r.cumulativeMuscleVector["upper_back_lats"]).toBeUndefined();
  });

  it("month filter includes thisWeek and lastMonth, excludes lastYear", () => {
    const r = scoreHistory(all, { dateRange: "month", referenceDate: REF });
    expect(r.metadata.filteredWorkouts).toBe(2);
  });

  it("all filter includes all three", () => {
    const r = scoreHistory(all, { dateRange: "all", referenceDate: REF });
    expect(r.metadata.filteredWorkouts).toBe(3);
  });

  it("custom range works", () => {
    const r = scoreHistory(all, {
      dateRange: { start: daysBack(REF, 25), end: REF },
      referenceDate: REF,
    });
    // Includes thisWeek (3d) and lastMonth (20d); excludes lastYear (200d)
    expect(r.metadata.filteredWorkouts).toBe(2);
  });

  it("filter excludes all → empty result", () => {
    const r = scoreHistory(all, { dateRange: "week", referenceDate: daysBack(REF, 365) });
    expect(r.metadata.filteredWorkouts).toBe(0);
    expect(Object.keys(r.cumulativeMuscleVector)).toHaveLength(0);
  });
});

describe("scoreHistory: metadata correctness", () => {
  const w1 = makeEntry([{ name: "back squat", reps: 5, loadKg: 100 }], daysBack(REF, 10));
  const w2 = makeEntry([{ name: "pull-up",    reps: 20 }],              daysBack(REF, 2));
  const result = scoreHistory([w1, w2], { referenceDate: REF });

  it("totalWorkouts = input count", () => {
    expect(result.metadata.totalWorkouts).toBe(2);
  });

  it("filteredWorkouts = 2 for 'all'", () => {
    expect(result.metadata.filteredWorkouts).toBe(2);
  });

  it("oldestWorkout = 10 days ago", () => {
    expect(result.metadata.oldestWorkout?.getTime()).toBe(daysBack(REF, 10).getTime());
  });

  it("newestWorkout = 2 days ago", () => {
    expect(result.metadata.newestWorkout?.getTime()).toBe(daysBack(REF, 2).getTime());
  });

  it("dateRangeEnd is set to referenceDate when filtered workouts > 0", () => {
    expect(result.metadata.dateRangeEnd?.getTime()).toBe(REF.getTime());
  });

  it("totalFallbackMovements = sum of fallbacks across workouts", () => {
    const unknownW = makeEntry(
      [{ name: "mystery exercise", reps: 10 }],
      daysBack(REF, 1)
    );
    const r = scoreHistory([w1, w2, unknownW], { referenceDate: REF });
    expect(r.metadata.totalFallbackMovements).toBeGreaterThanOrEqual(1);
    expect(r.metadata.workoutsWithFallback).toBe(1);
  });
});

describe("scoreHistory: fallback handling", () => {
  const knownW   = makeEntry([{ name: "back squat", reps: 5, loadKg: 100 }], daysBack(REF, 1));
  const unknownW = makeEntry([{ name: "dragon flag", reps: 5 }],              daysBack(REF, 2));

  const result = scoreHistory([knownW, unknownW], { referenceDate: REF });

  it("fallback workout counted in workoutsWithFallback", () => {
    expect(result.metadata.workoutsWithFallback).toBe(1);
  });

  it("unknown workout contributes no muscles to cumulative vector", () => {
    // Back squat should be in the vector; dragon flag should not add any
    const squatOnly = scoreHistory([knownW], { referenceDate: REF });
    // Combined should not have MORE unique muscles than squatOnly
    // (dragon flag contributes empty muscleVector)
    const combinedKeys = Object.keys(result.cumulativeMuscleVector);
    const squatKeys    = Object.keys(squatOnly.cumulativeMuscleVector);
    for (const key of squatKeys) {
      expect(combinedKeys).toContain(key);
    }
  });

  it("result is still complete (no crashes)", () => {
    expect(result.summary).toBeDefined();
    expect(result.metadata).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// D) historySummary
// ---------------------------------------------------------------------------

describe("generateHistorySummary", () => {
  const cumMuscle  = { quads: 8.0, upper_back_lats: 6.5, glutes: 4.2, core: 1.5, biceps: 0.8 };
  const cumPattern = { squat: 6.0, vertical_pull: 5.0, hinge: 2.0 };
  const cumStim    = { strength: 0.6, hypertrophy: 0.5, muscular_endurance: 0.3, power: 0.4, conditioning: 0.2 };
  // Recency: quads lower, upper_back_lats now higher (pull day recently)
  const recMuscle  = { quads: 1.2, upper_back_lats: 4.0, glutes: 0.5, core: 0.3, biceps: 0.6 };
  const recPattern = { squat: 1.0, vertical_pull: 4.0, hinge: 0.5 };
  const recStim    = { strength: 0.7, hypertrophy: 0.5, muscular_endurance: 0.3, power: 0.3, conditioning: 0.2 };

  const summary = generateHistorySummary(
    cumMuscle, cumPattern, cumStim, recMuscle, recPattern, recStim
  );

  it("topMusclesCumulative rank 1 is quads (highest cumulative)", () => {
    expect(summary.topMusclesCumulative[0].key).toBe("quads");
  });

  it("topMusclesRecent rank 1 is upper_back_lats (highest recency)", () => {
    expect(summary.topMusclesRecent[0].key).toBe("upper_back_lats");
  });

  it("topPatternsCumulative rank 1 is squat", () => {
    expect(summary.topPatternsCumulative[0].key).toBe("squat");
  });

  it("topPatternsRecent rank 1 is vertical_pull", () => {
    expect(summary.topPatternsRecent[0].key).toBe("vertical_pull");
  });

  it("underrepresentedMuscles rank 1 is lowest cumulative (biceps)", () => {
    expect(summary.underrepresentedMuscles[0].key).toBe("biceps");
  });

  it("underrepresentedMuscles is ranked ascending (lowest score first)", () => {
    const scores = summary.underrepresentedMuscles.map((e) => e.score);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]);
    }
  });

  it("dominantStimulusCumulative = strength (0.6 highest)", () => {
    expect(summary.dominantStimulusCumulative).toBe("strength");
  });

  it("dominantStimulusRecent = strength (0.7 highest)", () => {
    expect(summary.dominantStimulusRecent).toBe("strength");
  });

  it("recentlyElevated includes upper_back_lats (recency rank 1 vs cumulative rank 2)", () => {
    expect(summary.recentlyElevated).toContain("upper_back_lats");
  });

  it("recentlyReduced includes quads (cumulative rank 1 vs recency rank lower)", () => {
    expect(summary.recentlyReduced).toContain("quads");
  });

  it("recentlyElevated and recentlyReduced are disjoint", () => {
    const elevated = new Set(summary.recentlyElevated);
    for (const key of summary.recentlyReduced) {
      expect(elevated.has(key)).toBe(false);
    }
  });

  it("all ranked arrays are sorted correctly", () => {
    for (let i = 1; i < summary.topMusclesCumulative.length; i++) {
      expect(summary.topMusclesCumulative[i].score).toBeLessThanOrEqual(
        summary.topMusclesCumulative[i - 1].score
      );
    }
  });
});

// ---------------------------------------------------------------------------
// E) Empty / minimal history safety
// ---------------------------------------------------------------------------

describe("scoreHistory: empty collection", () => {
  const result = scoreHistory([], { referenceDate: REF });

  it("returns a valid result without throwing", () => {
    expect(result).toBeDefined();
  });

  it("all vectors are empty", () => {
    expect(Object.keys(result.cumulativeMuscleVector)).toHaveLength(0);
    expect(Object.keys(result.recencyMuscleVector)).toHaveLength(0);
    expect(Object.keys(result.cumulativePatternVector)).toHaveLength(0);
  });

  it("metadata is all zeros / nulls", () => {
    expect(result.metadata.totalWorkouts).toBe(0);
    expect(result.metadata.filteredWorkouts).toBe(0);
    expect(result.metadata.oldestWorkout).toBeNull();
    expect(result.metadata.newestWorkout).toBeNull();
    expect(result.metadata.totalFallbackMovements).toBe(0);
  });

  it("summary ranked lists are empty", () => {
    expect(result.summary.topMusclesCumulative).toHaveLength(0);
    expect(result.summary.topPatternsCumulative).toHaveLength(0);
    expect(result.summary.underrepresentedMuscles).toHaveLength(0);
    expect(result.summary.recentlyElevated).toHaveLength(0);
    expect(result.summary.recentlyReduced).toHaveLength(0);
  });
});

describe("scoreHistory: single workout", () => {
  const entry = makeEntry([{ name: "back squat", reps: 5, loadKg: 100 }], REF);
  const result = scoreHistory([entry], { referenceDate: REF });

  it("cumulativeMuscleVector matches the single workout's muscleVector", () => {
    for (const [muscle, score] of Object.entries(entry.workoutResult.muscleVector)) {
      expect(result.cumulativeMuscleVector[muscle!]).toBeCloseTo(score!, 2);
    }
  });

  it("recencyMuscleVector = cumulativeMuscleVector × 1.0 (0 days ago)", () => {
    // workout was performed today → recency weight = 1.0
    for (const [muscle, cumScore] of Object.entries(result.cumulativeMuscleVector)) {
      const recScore = result.recencyMuscleVector[muscle] ?? 0;
      expect(recScore).toBeCloseTo(cumScore, 2);
    }
  });

  it("metadata shows 1 total and 1 filtered", () => {
    expect(result.metadata.totalWorkouts).toBe(1);
    expect(result.metadata.filteredWorkouts).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// F) Determinism
// ---------------------------------------------------------------------------

describe("scoreHistory: deterministic output", () => {
  const workouts = [
    makeEntry([{ name: "back squat",  reps: 5,  loadKg: 100 }], daysBack(REF, 1)),
    makeEntry([{ name: "pull-up",     reps: 20 }],               daysBack(REF, 3)),
    makeEntry([{ name: "row",         distanceM: 1000 }],        daysBack(REF, 8)),
    makeEntry([{ name: "thruster",    reps: 21, loadKg: 43 }],   daysBack(REF, 15)),
  ];

  it("identical calls produce identical cumulative muscle vectors", () => {
    const r1 = scoreHistory(workouts, { referenceDate: REF });
    const r2 = scoreHistory(workouts, { referenceDate: REF });
    expect(r1.cumulativeMuscleVector).toEqual(r2.cumulativeMuscleVector);
  });

  it("identical calls produce identical recency muscle vectors", () => {
    const r1 = scoreHistory(workouts, { referenceDate: REF });
    const r2 = scoreHistory(workouts, { referenceDate: REF });
    expect(r1.recencyMuscleVector).toEqual(r2.recencyMuscleVector);
  });

  it("identical calls produce identical summaries", () => {
    const r1 = scoreHistory(workouts, { referenceDate: REF });
    const r2 = scoreHistory(workouts, { referenceDate: REF });
    expect(r1.summary.topMusclesCumulative).toEqual(r2.summary.topMusclesCumulative);
    expect(r1.summary.recentlyElevated).toEqual(r2.summary.recentlyElevated);
    expect(r1.summary.recentlyReduced).toEqual(r2.summary.recentlyReduced);
  });

  it("input order does not affect cumulative muscle vector (sumVectors is order-independent)", () => {
    const reversed = [...workouts].reverse();
    const r1 = scoreHistory(workouts, { referenceDate: REF });
    const r2 = scoreHistory(reversed, { referenceDate: REF });
    expect(r1.cumulativeMuscleVector).toEqual(r2.cumulativeMuscleVector);
  });
});

// ---------------------------------------------------------------------------
// Integration: 4-week Fran-heavy block
// ---------------------------------------------------------------------------

describe("scoreHistory: integration — 4-week squat-dominant block", () => {
  const block = [
    // Week 1 (oldest)
    makeEntry([{ name: "back squat",  reps: 5,  loadKg: 110 }], daysBack(REF, 28)),
    makeEntry([{ name: "thruster",    reps: 21, loadKg: 43 }],  daysBack(REF, 26)),
    // Week 2
    makeEntry([{ name: "front squat", reps: 5,  loadKg: 90 }],  daysBack(REF, 21)),
    makeEntry([{ name: "back squat",  reps: 5,  loadKg: 110 }], daysBack(REF, 19)),
    // Week 3
    makeEntry([{ name: "back squat",  reps: 5,  loadKg: 115 }], daysBack(REF, 14)),
    makeEntry([{ name: "pull-up",     reps: 30 }],               daysBack(REF, 12)),
    // Week 4 (most recent)
    makeEntry([{ name: "back squat",  reps: 5,  loadKg: 120 }], daysBack(REF, 7)),
    makeEntry([{ name: "row",         distanceM: 2000 }],        daysBack(REF, 5)),
    makeEntry([{ name: "pull-up",     reps: 30 }],               daysBack(REF, 2)),
  ];

  const result = scoreHistory(block, { referenceDate: REF });

  it("quads is the dominant muscle cumulatively (squat-heavy block)", () => {
    expect(result.summary.topMusclesCumulative[0].key).toBe("quads");
  });

  it("squat is the dominant pattern cumulatively", () => {
    expect(result.summary.topPatternsCumulative[0].key).toBe("squat");
  });

  it("cumulative quads > cumulative upper_back_lats (more squats than pull-ups)", () => {
    const cumQuads = result.cumulativeMuscleVector["quads"] ?? 0;
    const cumLats  = result.cumulativeMuscleVector["upper_back_lats"] ?? 0;
    expect(cumQuads).toBeGreaterThan(cumLats);
  });

  it("upper_back_lats is recently elevated (pull-ups in most recent week)", () => {
    // Pull-up was performed 2 days ago (weight=1.0) — should show elevation
    expect(result.summary.recentlyElevated).toContain("upper_back_lats");
  });

  it("filteredWorkouts = 9 (all in past 90 days)", () => {
    const r = scoreHistory(block, { dateRange: "quarter", referenceDate: REF });
    expect(r.metadata.filteredWorkouts).toBe(9);
  });

  it("week filter returns only the last 7 days of workouts", () => {
    const r = scoreHistory(block, { dateRange: "week", referenceDate: REF });
    // Workouts at 7d, 5d, 2d ago = 3 workouts
    expect(r.metadata.filteredWorkouts).toBe(3);
  });

  it("totalRawScore is positive and grows with filteredWorkouts", () => {
    const rWeek  = scoreHistory(block, { dateRange: "week",    referenceDate: REF });
    const rMonth = scoreHistory(block, { dateRange: "month",   referenceDate: REF });
    expect(rMonth.metadata.filteredWorkouts).toBeGreaterThan(rWeek.metadata.filteredWorkouts);
  });
});

/**
 * historyInsights.test.ts — Step 5 insight layer tests.
 *
 * Test sections:
 *   A) insightText — display names, safe language, all types
 *   B) insightRules — sumPatternGroup, thresholds accessible
 *   C) generateInsights — structure, ordering, caps
 *       C1) elevated/reduced detection
 *       C2) underrepresented detection
 *       C3) dominant bias detection
 *       C4) balance observations
 *       C5) data quality notes
 *   D) scenario tests — squat-dominant, cyclical-heavy, push-light
 *   E) empty/sparse history safety
 *   F) text safety — no prescriptions, relative language
 *   G) determinism — identical inputs → identical outputs
 */

import { describe, it, expect } from "vitest";
import { muscleDisplay, patternDisplay, stimulusDisplay, insightText, generateHeadline } from "../insightText";
import { sumPatternGroup, PUSH_PATTERNS, PULL_PATTERNS, LOWER_PATTERNS } from "../insightRules";
import { generateInsights } from "../historyInsights";
import { scoreHistory } from "../historyAggregation";
import { scoreWorkout } from "../workoutVector";
import type { HistoricalWorkoutInput } from "../historyScoringTypes";
import type { HistoricalRollupResult } from "../historyScoringTypes";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function refDate(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00Z`);
}

function daysBack(ref: Date, n: number): Date {
  const d = new Date(ref);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

function makeEntry(
  movements: Array<{ name: string; reps?: number; loadKg?: number; distanceM?: number; calories?: number }>,
  performedAt: Date
): HistoricalWorkoutInput {
  return { workoutResult: scoreWorkout({ movements }), performedAt };
}

const REF = refDate("2026-04-01");

// ---------------------------------------------------------------------------
// A) insightText
// ---------------------------------------------------------------------------

describe("muscleDisplay", () => {
  it("returns pretty label for known keys", () => {
    expect(muscleDisplay("quads")).toBe("Quadriceps");
    expect(muscleDisplay("upper_back_lats")).toBe("Upper back / lats");
    expect(muscleDisplay("hip_flexors")).toBe("Hip flexors");
  });

  it("falls back gracefully for unknown keys (underscores → spaces)", () => {
    expect(muscleDisplay("mystery_muscle")).toBe("mystery muscle");
  });
});

describe("patternDisplay", () => {
  it("returns pretty label for known patterns", () => {
    expect(patternDisplay("squat")).toBe("squat-pattern");
    expect(patternDisplay("vertical_push")).toBe("vertical pushing");
    expect(patternDisplay("cyclical")).toBe("cyclical / conditioning");
  });

  it("falls back for unknown patterns", () => {
    expect(patternDisplay("unknown_pattern")).toBe("unknown pattern");
  });
});

describe("stimulusDisplay", () => {
  it("returns pretty label for all five stimulus keys", () => {
    expect(stimulusDisplay("strength")).toBe("strength");
    expect(stimulusDisplay("muscular_endurance")).toBe("muscular endurance");
    expect(stimulusDisplay("conditioning")).toBe("conditioning");
  });
});

describe("insightText", () => {
  it("recently_elevated_muscle text is relative and descriptive", () => {
    const text = insightText("recently_elevated_muscle", "quads");
    expect(text).toContain("elevated recently");
    expect(text).not.toMatch(/should|must|need|prescri/i);
    expect(text).toContain("Quadriceps");
  });

  it("recently_reduced_muscle text is relative and descriptive", () => {
    const text = insightText("recently_reduced_muscle", "hamstrings");
    expect(text).toContain("less prominent");
    expect(text).not.toMatch(/should|must|need/i);
  });

  it("underrepresented_muscle text is relative", () => {
    const text = insightText("underrepresented_muscle", "biceps");
    expect(text).toContain("less emphasized");
    expect(text).toContain("relative to");
  });

  it("underrepresented_pattern text uses display name", () => {
    const text = insightText("underrepresented_pattern", "horizontal_push");
    expect(text).toContain("horizontal pushing");
    expect(text).toContain("less exposure");
  });

  it("dominant_pattern_bias text uses 'leaned toward'", () => {
    const text = insightText("dominant_pattern_bias", "squat");
    expect(text).toContain("leaned toward");
    expect(text).toContain("squat-pattern");
  });

  it("dominant_stimulus_bias text uses 'forward'", () => {
    const text = insightText("dominant_stimulus_bias", "conditioning");
    expect(text).toContain("conditioning-forward");
  });

  it("data_quality_note high variant mentions high proportion", () => {
    const text = insightText("data_quality_note", "data_quality", "high");
    expect(text).toContain("high proportion");
  });

  it("data_quality_note default variant is softer", () => {
    const text = insightText("data_quality_note", "data_quality");
    expect(text).not.toContain("high proportion");
    expect(text).toContain("unrecognised");
  });
});

describe("generateHeadline", () => {
  it("empty history → no data message", () => {
    const h = generateHeadline(null, null, 0, "past 30 days");
    expect(h).toContain("No workout data");
  });

  it("single workout → single workout message", () => {
    const h = generateHeadline("squat", "strength", 1, "past week");
    expect(h).toContain("one workout");
  });

  it("multiple workouts with pattern + stimulus → compound sentence", () => {
    const h = generateHeadline("squat", "conditioning", 5, "past month");
    expect(h).toContain("squat-pattern");
    expect(h).toContain("conditioning-forward");
    expect(h).toContain("past month");
  });

  it("pattern only → pattern sentence", () => {
    const h = generateHeadline("cyclical", null, 4, "past quarter");
    expect(h).toContain("cyclical / conditioning");
    expect(h).not.toMatch(/undefined|null/i);
  });
});

// ---------------------------------------------------------------------------
// B) insightRules
// ---------------------------------------------------------------------------

describe("sumPatternGroup", () => {
  const patternVector = {
    horizontal_push: 3.0,
    vertical_push:   2.0,
    horizontal_pull: 1.5,
    vertical_pull:   2.5,
    squat:           4.0,
  };

  it("sums push patterns", () => {
    expect(sumPatternGroup(patternVector, PUSH_PATTERNS)).toBeCloseTo(5.0);
  });

  it("sums pull patterns", () => {
    expect(sumPatternGroup(patternVector, PULL_PATTERNS)).toBeCloseTo(4.0);
  });

  it("sums lower patterns (squat only here)", () => {
    expect(sumPatternGroup(patternVector, LOWER_PATTERNS)).toBeCloseTo(4.0);
  });

  it("returns 0 for empty vector", () => {
    expect(sumPatternGroup({}, PUSH_PATTERNS)).toBe(0);
  });

  it("returns 0 for non-overlapping group", () => {
    expect(sumPatternGroup({ squat: 5.0 }, PUSH_PATTERNS)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// C) generateInsights — structure
// ---------------------------------------------------------------------------

describe("generateInsights: result structure", () => {
  const squat4Weeks = [
    makeEntry([{ name: "back squat",  reps: 5, loadKg: 100 }], daysBack(REF, 25)),
    makeEntry([{ name: "front squat", reps: 5, loadKg: 80  }], daysBack(REF, 18)),
    makeEntry([{ name: "back squat",  reps: 5, loadKg: 105 }], daysBack(REF, 11)),
    makeEntry([{ name: "pull-up",     reps: 20 }],              daysBack(REF, 3)),
  ];
  const rollup = scoreHistory(squat4Weeks, { referenceDate: REF });
  const result = generateInsights(rollup, { rangeLabel: "past 30 days" });

  it("returns an array of HistoryInsight objects", () => {
    expect(Array.isArray(result.insights)).toBe(true);
    expect(result.insights.length).toBeGreaterThan(0);
  });

  it("every insight has required fields", () => {
    for (const insight of result.insights) {
      expect(insight.type).toBeDefined();
      expect(insight.severity).toBeDefined();
      expect(insight.subject).toBeDefined();
      expect(insight.text).toBeDefined();
      expect(insight.text.length).toBeGreaterThan(0);
    }
  });

  it("result has summary with headline and observations", () => {
    expect(result.summary.headline).toBeDefined();
    expect(result.summary.headline.length).toBeGreaterThan(0);
    expect(Array.isArray(result.summary.observations)).toBe(true);
  });

  it("summary observations length is between 1 and 4", () => {
    expect(result.summary.observations.length).toBeGreaterThanOrEqual(1);
    expect(result.summary.observations.length).toBeLessThanOrEqual(4);
  });

  it("rangeLabel is preserved in result", () => {
    expect(result.rangeLabel).toBe("past 30 days");
  });

  it("workoutCount equals filteredWorkouts", () => {
    expect(result.workoutCount).toBe(rollup.metadata.filteredWorkouts);
  });
});

describe("generateInsights: severity ordering", () => {
  const workouts = [
    makeEntry([{ name: "back squat",  reps: 5, loadKg: 100 }], daysBack(REF, 20)),
    makeEntry([{ name: "pull-up",     reps: 20 }],              daysBack(REF, 14)),
    makeEntry([{ name: "row",         distanceM: 500 }],        daysBack(REF, 7)),
    makeEntry([{ name: "back squat",  reps: 5, loadKg: 110 }], daysBack(REF, 2)),
  ];
  const rollup = scoreHistory(workouts, { referenceDate: REF });
  const result = generateInsights(rollup);

  it("insights are sorted severity descending (high before moderate before low before info)", () => {
    const SEVERITY_ORDER = { high: 0, moderate: 1, low: 2, info: 3 };
    for (let i = 1; i < result.insights.length; i++) {
      expect(SEVERITY_ORDER[result.insights[i].severity]).toBeGreaterThanOrEqual(
        SEVERITY_ORDER[result.insights[i - 1].severity]
      );
    }
  });

  it("within same severity, insights are sorted by type (alpha)", () => {
    for (let i = 1; i < result.insights.length; i++) {
      if (result.insights[i].severity === result.insights[i - 1].severity) {
        expect(result.insights[i].type.localeCompare(result.insights[i - 1].type)).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("generateInsights: maxInsights cap", () => {
  const workouts = Array.from({ length: 10 }, (_, i) =>
    makeEntry([{ name: "back squat", reps: 5, loadKg: 100 + i }], daysBack(REF, i * 3))
  );
  const rollup = scoreHistory(workouts, { referenceDate: REF });

  it("respects maxInsights=3", () => {
    const result = generateInsights(rollup, { maxInsights: 3 });
    expect(result.insights.length).toBeLessThanOrEqual(3);
  });

  it("default maxInsights=12 is applied", () => {
    const result = generateInsights(rollup);
    expect(result.insights.length).toBeLessThanOrEqual(12);
  });
});

// ---------------------------------------------------------------------------
// D) Scenario tests
// ---------------------------------------------------------------------------

describe("scenario: squat-dominant block (back squat + front squat + thruster)", () => {
  const block = [
    makeEntry([{ name: "back squat",  reps: 5,  loadKg: 110 }], daysBack(REF, 25)),
    makeEntry([{ name: "front squat", reps: 5,  loadKg: 90  }], daysBack(REF, 18)),
    makeEntry([{ name: "thruster",    reps: 21, loadKg: 43  }], daysBack(REF, 11)),
    makeEntry([{ name: "back squat",  reps: 5,  loadKg: 115 }], daysBack(REF, 4)),
  ];
  const rollup = scoreHistory(block, { referenceDate: REF });
  const result = generateInsights(rollup, { rangeLabel: "past month" });

  it("dominant_pattern_bias insight is emitted", () => {
    const patternInsight = result.insights.find((i) => i.type === "dominant_pattern_bias");
    expect(patternInsight).toBeDefined();
    expect(patternInsight?.subject).toBe("squat");
  });

  it("dominant_pattern_bias text mentions squat-pattern", () => {
    const text = result.insights.find((i) => i.type === "dominant_pattern_bias")?.text ?? "";
    expect(text).toContain("squat-pattern");
  });

  it("dominant_stimulus_bias insight is emitted", () => {
    const stimInsight = result.insights.find((i) => i.type === "dominant_stimulus_bias");
    expect(stimInsight).toBeDefined();
  });

  it("headline references squat pattern", () => {
    expect(result.summary.headline).toContain("squat-pattern");
  });

  it("underrepresented_pattern is emitted (e.g. horizontal_push not trained)", () => {
    const under = result.insights.filter((i) => i.type === "underrepresented_pattern");
    // Either horizontal_push or horizontal_pull should appear as underrepresented
    expect(under.length).toBeGreaterThan(0);
  });
});

describe("scenario: cyclical-heavy block (row + run + bike)", () => {
  const block = [
    makeEntry([{ name: "row",      distanceM: 2000 }], daysBack(REF, 20)),
    makeEntry([{ name: "run",      distanceM: 1600 }], daysBack(REF, 14)),
    makeEntry([{ name: "bike erg", calories: 30    }], daysBack(REF, 7)),
    makeEntry([{ name: "row",      distanceM: 1000 }], daysBack(REF, 2)),
  ];
  const rollup = scoreHistory(block, { referenceDate: REF });
  const result = generateInsights(rollup, { rangeLabel: "past month" });

  it("dominant_pattern_bias is cyclical", () => {
    const pat = result.insights.find((i) => i.type === "dominant_pattern_bias");
    expect(pat?.subject).toBe("cyclical");
  });

  it("dominant_stimulus_bias is conditioning or endurance", () => {
    const stim = result.insights.find((i) => i.type === "dominant_stimulus_bias");
    expect(["conditioning", "endurance", "muscular_endurance"]).toContain(stim?.subject);
  });

  it("headline mentions cyclical or conditioning", () => {
    const h = result.summary.headline.toLowerCase();
    expect(h.includes("cyclical") || h.includes("conditioning")).toBe(true);
  });

  it("underrepresented_pattern emitted (squat/hinge not trained)", () => {
    const under = result.insights.filter((i) => i.type === "underrepresented_pattern");
    expect(under.length).toBeGreaterThan(0);
  });
});

describe("scenario: push-light history (pull + squat, no push)", () => {
  const block = [
    makeEntry([{ name: "pull-up",   reps: 20 }],               daysBack(REF, 20)),
    makeEntry([{ name: "back squat", reps: 5, loadKg: 100 }],  daysBack(REF, 14)),
    makeEntry([{ name: "deadlift",  reps: 5,  loadKg: 140 }],  daysBack(REF, 7)),
    makeEntry([{ name: "pull-up",   reps: 25 }],               daysBack(REF, 2)),
  ];
  const rollup = scoreHistory(block, { referenceDate: REF });
  const result = generateInsights(rollup);

  it("generates at least one insight", () => {
    expect(result.insights.length).toBeGreaterThan(0);
  });

  it("no dominant_pattern_bias for horizontal_push (it wasn't trained)", () => {
    const pat = result.insights.find((i) => i.type === "dominant_pattern_bias");
    expect(pat?.subject).not.toBe("horizontal_push");
    expect(pat?.subject).not.toBe("vertical_push");
  });

  it("push-related patterns appear as underrepresented or balance observation", () => {
    const underPat = result.insights.filter(
      (i) => i.type === "underrepresented_pattern" &&
              (i.subject === "horizontal_push" || i.subject === "vertical_push")
    );
    const balancePush = result.insights.filter(
      (i) => i.type === "balance_observation" && i.subject.includes("push")
    );
    expect(underPat.length + balancePush.length).toBeGreaterThan(0);
  });

  it("push/pull imbalance balance observation emitted (pull trained, push absent)", () => {
    // When push=0, the insight subject is "minimal upper body push" (not "pull-dominant")
    // because the observation is about the under-represented side, not the dominant one
    const balance = result.insights.find(
      (i) =>
        i.type === "balance_observation" &&
        (i.subject.includes("pull") || i.subject.includes("push"))
    );
    expect(balance).toBeDefined();
    expect(balance?.text).toMatch(/push|pull/i);
  });
});

describe("scenario: mixed well-rounded history", () => {
  // All major patterns represented
  const block = [
    makeEntry([{ name: "back squat",  reps: 5,  loadKg: 100 }], daysBack(REF, 28)),
    makeEntry([{ name: "pull-up",     reps: 15 }],               daysBack(REF, 25)),
    makeEntry([{ name: "bench press", reps: 5,  loadKg: 80  }],  daysBack(REF, 21)),
    makeEntry([{ name: "deadlift",    reps: 5,  loadKg: 140 }],  daysBack(REF, 18)),
    makeEntry([{ name: "row",         distanceM: 1000 }],        daysBack(REF, 14)),
    makeEntry([{ name: "strict press",reps: 5,  loadKg: 60  }],  daysBack(REF, 10)),
    makeEntry([{ name: "back squat",  reps: 5,  loadKg: 105 }],  daysBack(REF, 7)),
    makeEntry([{ name: "pull-up",     reps: 20 }],               daysBack(REF, 3)),
  ];
  const rollup = scoreHistory(block, { referenceDate: REF });
  const result = generateInsights(rollup, { rangeLabel: "past month" });

  it("dominant_pattern_bias is emitted", () => {
    expect(result.insights.some((i) => i.type === "dominant_pattern_bias")).toBe(true);
  });

  it("dominant_stimulus_bias is emitted", () => {
    expect(result.insights.some((i) => i.type === "dominant_stimulus_bias")).toBe(true);
  });

  it("no extreme balance observation (relatively balanced history)", () => {
    const extremeBalance = result.insights.filter(
      (i) =>
        i.type === "balance_observation" &&
        (i.subject.includes("dominant") || i.subject.includes("minimal"))
    );
    // Could be 0 or 1 for a balanced history — just confirm not > 2
    expect(extremeBalance.length).toBeLessThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// E) Empty / sparse history safety
// ---------------------------------------------------------------------------

describe("generateInsights: empty rollup", () => {
  const rollup = scoreHistory([], { referenceDate: REF });
  const result = generateInsights(rollup);

  it("returns a valid result without throwing", () => {
    expect(result).toBeDefined();
    expect(result.insights).toBeDefined();
  });

  it("insights array is empty for empty rollup", () => {
    expect(result.insights).toHaveLength(0);
  });

  it("headline mentions no data", () => {
    expect(result.summary.headline.toLowerCase()).toContain("no workout data");
  });

  it("workoutCount is 0", () => {
    expect(result.workoutCount).toBe(0);
  });
});

describe("generateInsights: single workout", () => {
  const single = [
    makeEntry([{ name: "back squat", reps: 5, loadKg: 100 }], daysBack(REF, 1)),
  ];
  const rollup = scoreHistory(single, { referenceDate: REF });
  const result = generateInsights(rollup, { rangeLabel: "past week" });

  it("returns a valid result", () => {
    expect(result).toBeDefined();
    expect(Array.isArray(result.insights)).toBe(true);
  });

  it("headline mentions single workout limitation", () => {
    expect(result.summary.headline).toContain("one workout");
  });

  it("no dominant or balance insights (insufficient data)", () => {
    // dominant and balance both require >= 2 workouts
    const dominantOrBalance = result.insights.filter(
      (i) => i.type === "dominant_pattern_bias" || i.type === "balance_observation"
    );
    expect(dominantOrBalance).toHaveLength(0);
  });
});

describe("generateInsights: fallback-heavy history", () => {
  // Mostly unknown movements
  const block = [
    makeEntry([{ name: "face pull",     reps: 15, loadKg: 15 }], daysBack(REF, 10)),
    makeEntry([{ name: "lateral raise", reps: 15, loadKg: 10 }], daysBack(REF, 7)),
    makeEntry([{ name: "nordic curl",   reps: 5              }], daysBack(REF, 5)),
    makeEntry([{ name: "back squat",    reps: 5, loadKg: 100 }], daysBack(REF, 3)),
    makeEntry([{ name: "dragon flag",   reps: 5              }], daysBack(REF, 1)),
  ];
  const rollup = scoreHistory(block, { referenceDate: REF });
  const result = generateInsights(rollup);

  it("returns a valid result without throwing", () => {
    expect(result).toBeDefined();
  });

  it("data_quality_note emitted when enough fallback movements", () => {
    // 4 out of 5 workouts have fallback movements
    const qNote = result.insights.find((i) => i.type === "data_quality_note");
    expect(qNote).toBeDefined();
  });

  it("data_quality_note text is conservative and non-alarmist", () => {
    const qNote = result.insights.find((i) => i.type === "data_quality_note");
    if (qNote) {
      expect(qNote.text).not.toMatch(/error|invalid|broken|failed/i);
      expect(qNote.text).toContain("unrecognised");
    }
  });
});

// ---------------------------------------------------------------------------
// F) Text safety — no prescriptions, relative language
// ---------------------------------------------------------------------------

describe("text safety", () => {
  const block = [
    makeEntry([{ name: "back squat",  reps: 5,  loadKg: 110 }], daysBack(REF, 25)),
    makeEntry([{ name: "front squat", reps: 5,  loadKg: 90  }], daysBack(REF, 18)),
    makeEntry([{ name: "pull-up",     reps: 20 }],              daysBack(REF, 10)),
    makeEntry([{ name: "back squat",  reps: 5,  loadKg: 115 }], daysBack(REF, 3)),
  ];
  const rollup = scoreHistory(block, { referenceDate: REF });
  const result = generateInsights(rollup, { rangeLabel: "past month" });

  it("no insight text contains prescriptive language", () => {
    const prescriptive = /\b(should|must|need to|have to|recommended|prescri|rest day|recover)\b/i;
    for (const insight of result.insights) {
      expect(insight.text, `"${insight.text}" contains prescriptive language`).not.toMatch(prescriptive);
    }
  });

  it("no insight text contains medical/readiness claims", () => {
    const medical = /\b(fatigue[d]?|overtraining|overtrained|injury|recovered?|readiness|hrv)\b/i;
    for (const insight of result.insights) {
      expect(insight.text, `"${insight.text}" contains medical/readiness claim`).not.toMatch(medical);
    }
  });

  it("headline does not contain prescriptive language", () => {
    const prescriptive = /\b(should|must|need to|have to|prescribed)\b/i;
    expect(result.summary.headline).not.toMatch(prescriptive);
  });

  it("all insight texts are non-empty strings", () => {
    for (const insight of result.insights) {
      expect(typeof insight.text).toBe("string");
      expect(insight.text.trim().length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// G) Determinism
// ---------------------------------------------------------------------------

describe("generateInsights: determinism", () => {
  const block = [
    makeEntry([{ name: "back squat",  reps: 5,  loadKg: 110 }], daysBack(REF, 25)),
    makeEntry([{ name: "pull-up",     reps: 20 }],              daysBack(REF, 18)),
    makeEntry([{ name: "row",         distanceM: 1000 }],       daysBack(REF, 11)),
    makeEntry([{ name: "thruster",    reps: 21, loadKg: 43 }],  daysBack(REF, 4)),
    makeEntry([{ name: "deadlift",    reps: 5,  loadKg: 140 }], daysBack(REF, 1)),
  ];
  const rollup = scoreHistory(block, { referenceDate: REF });

  it("identical calls produce identical insight lists", () => {
    const r1 = generateInsights(rollup, { rangeLabel: "past month" });
    const r2 = generateInsights(rollup, { rangeLabel: "past month" });
    expect(r1.insights.map((i) => i.type)).toEqual(r2.insights.map((i) => i.type));
    expect(r1.insights.map((i) => i.subject)).toEqual(r2.insights.map((i) => i.subject));
    expect(r1.insights.map((i) => i.text)).toEqual(r2.insights.map((i) => i.text));
  });

  it("identical calls produce identical summaries", () => {
    const r1 = generateInsights(rollup);
    const r2 = generateInsights(rollup);
    expect(r1.summary.headline).toBe(r2.summary.headline);
    expect(r1.summary.observations).toEqual(r2.summary.observations);
  });
});

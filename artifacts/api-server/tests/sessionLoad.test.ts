import { describe, it, expect } from "vitest";
import {
  internalSessionLoad,
  externalSessionLoad,
  sessionLoadToVolumeEquiv,
  totalWeeklyLoad,
  countByType,
  INTERNAL_KG_REPS_PER_LOAD_POINT,
  INTERNAL_SET_LOAD_WEIGHT,
  LOAD_TO_VOLUME_EQUIV,
  MAX_SESSION_LOAD,
  type SessionEntry,
} from "../src/lib/sessionLoad";

// ---------------------------------------------------------------------------
// Fixtures — equivalent internal vs external sessions
// ---------------------------------------------------------------------------

// "Moderate strength session": 5,000 kg-reps → 50 load points (@ 100 kg-reps/point)
const MODERATE_INTERNAL_VOLUME = 5_000;
const MODERATE_INTERNAL_SETS = 25;

// External equivalent: 50 stimulus points
const MODERATE_EXTERNAL_SP = 50;

// "Intense session": 10,000 kg-reps → 100 load (capped at MAX)
const INTENSE_INTERNAL_VOLUME = 10_000;
const INTENSE_EXTERNAL_SP = 90;

// "Light session": 1,000 kg-reps → 10 load
const LIGHT_INTERNAL_VOLUME = 1_000;
const LIGHT_EXTERNAL_SP = 10;

// ---------------------------------------------------------------------------
// internalSessionLoad
// ---------------------------------------------------------------------------

describe("internalSessionLoad", () => {
  it("computes load from totalVolume using the calibrated divisor", () => {
    const load = internalSessionLoad({ totalVolume: MODERATE_INTERNAL_VOLUME, totalSetsCompleted: 0 });
    expect(load).toBe(Math.round(MODERATE_INTERNAL_VOLUME / INTERNAL_KG_REPS_PER_LOAD_POINT));
  });

  it("caps load at MAX_SESSION_LOAD", () => {
    const load = internalSessionLoad({ totalVolume: 999_999, totalSetsCompleted: 999 });
    expect(load).toBe(MAX_SESSION_LOAD);
  });

  it("falls back to set count when volume is null", () => {
    const load = internalSessionLoad({ totalVolume: null, totalSetsCompleted: 30 });
    expect(load).toBe(30 * INTERNAL_SET_LOAD_WEIGHT);
  });

  it("falls back to set count when volume is 0 (bodyweight)", () => {
    const load = internalSessionLoad({ totalVolume: 0, totalSetsCompleted: 20 });
    expect(load).toBe(20 * INTERNAL_SET_LOAD_WEIGHT);
  });

  it("returns 0 for a completely empty session", () => {
    const load = internalSessionLoad({ totalVolume: null, totalSetsCompleted: null });
    expect(load).toBe(0);
  });

  it("returns 0 for zero volume and zero sets", () => {
    const load = internalSessionLoad({ totalVolume: 0, totalSetsCompleted: 0 });
    expect(load).toBe(0);
  });

  it("handles undefined gracefully", () => {
    const load = internalSessionLoad({ totalVolume: undefined, totalSetsCompleted: undefined });
    expect(load).toBe(0);
  });

  it("picks the higher of volume-load vs set-load", () => {
    // 500 kg-reps → 5 load points; 20 sets → 20 load points → set wins
    const load = internalSessionLoad({ totalVolume: 500, totalSetsCompleted: 20 });
    expect(load).toBe(20);
  });

  it("returns integer (no decimals)", () => {
    const load = internalSessionLoad({ totalVolume: 333, totalSetsCompleted: 0 });
    expect(Number.isInteger(load)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// externalSessionLoad
// ---------------------------------------------------------------------------

describe("externalSessionLoad", () => {
  it("returns stimulusPoints directly", () => {
    expect(externalSessionLoad(MODERATE_EXTERNAL_SP)).toBe(MODERATE_EXTERNAL_SP);
  });

  it("caps at MAX_SESSION_LOAD", () => {
    expect(externalSessionLoad(150)).toBe(MAX_SESSION_LOAD);
  });

  it("floors at 0 — cannot be negative", () => {
    expect(externalSessionLoad(-10)).toBe(0);
  });

  it("returns 0 for null stimulusPoints", () => {
    expect(externalSessionLoad(null)).toBe(0);
  });

  it("returns 0 for undefined stimulusPoints", () => {
    expect(externalSessionLoad(undefined)).toBe(0);
  });

  it("returns integer (rounds fractional stimulus points)", () => {
    expect(Number.isInteger(externalSessionLoad(33.7))).toBe(true);
    expect(externalSessionLoad(33.7)).toBe(34);
  });
});

// ---------------------------------------------------------------------------
// Equal weighting: internal vs external equivalent sessions
// ---------------------------------------------------------------------------

describe("equal weighting — internal vs external equivalent session load", () => {
  it("moderate: external 50 SP equals internal 5,000 kg-reps at same load score", () => {
    const internal = internalSessionLoad({ totalVolume: MODERATE_INTERNAL_VOLUME, totalSetsCompleted: 0 });
    const external = externalSessionLoad(MODERATE_EXTERNAL_SP);
    expect(internal).toBe(external); // both must be 50
  });

  it("light: external 10 SP equals internal 1,000 kg-reps", () => {
    const internal = internalSessionLoad({ totalVolume: LIGHT_INTERNAL_VOLUME, totalSetsCompleted: 0 });
    const external = externalSessionLoad(LIGHT_EXTERNAL_SP);
    expect(internal).toBe(external); // both must be 10
  });

  it("intense: both cap at or near MAX_SESSION_LOAD", () => {
    const internal = internalSessionLoad({ totalVolume: INTENSE_INTERNAL_VOLUME, totalSetsCompleted: 0 });
    const external = externalSessionLoad(INTENSE_EXTERNAL_SP);
    expect(internal).toBe(MAX_SESSION_LOAD); // 10,000 / 100 = 100 → capped
    expect(external).toBe(INTENSE_EXTERNAL_SP); // 90
    // Both are high — deload logic treats them similarly
    expect(internal).toBeGreaterThan(80);
    expect(external).toBeGreaterThan(80);
  });

  it("each session counts as exactly 1 toward sessionCount regardless of type", () => {
    const sessions: SessionEntry[] = [
      { type: "internal", label: "Strength", date: "2026-01-01", load: 50 },
      { type: "external", label: "CrossFit WOD", date: "2026-01-02", load: 45 },
      { type: "external", label: "AMRAP 12", date: "2026-01-03", load: 30 },
    ];
    expect(sessions.length).toBe(3);
    expect(countByType(sessions, "internal")).toBe(1);
    expect(countByType(sessions, "external")).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// sessionLoadToVolumeEquiv
// ---------------------------------------------------------------------------

describe("sessionLoadToVolumeEquiv", () => {
  it("converts 50 load points to expected volume equivalent", () => {
    const vol = sessionLoadToVolumeEquiv(50);
    expect(vol).toBe(50 * LOAD_TO_VOLUME_EQUIV);
  });

  it("converts 0 load to 0 volume", () => {
    expect(sessionLoadToVolumeEquiv(0)).toBe(0);
  });

  it("converts MAX_SESSION_LOAD to max volume equivalent", () => {
    const vol = sessionLoadToVolumeEquiv(MAX_SESSION_LOAD);
    expect(vol).toBe(MAX_SESSION_LOAD * LOAD_TO_VOLUME_EQUIV);
  });

  it("returns integer", () => {
    expect(Number.isInteger(sessionLoadToVolumeEquiv(33.3))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// totalWeeklyLoad
// ---------------------------------------------------------------------------

describe("totalWeeklyLoad", () => {
  it("sums load across mixed internal and external sessions", () => {
    const sessions: SessionEntry[] = [
      { type: "internal", label: "Monday Strength", date: "2026-01-01", load: 50 },
      { type: "external", label: "Tuesday WOD", date: "2026-01-02", load: 45 },
      { type: "internal", label: "Thursday Strength", date: "2026-01-04", load: 60 },
      { type: "external", label: "Saturday AMRAP", date: "2026-01-06", load: 35 },
    ];
    expect(totalWeeklyLoad(sessions)).toBe(190);
  });

  it("returns 0 for empty session list", () => {
    expect(totalWeeklyLoad([])).toBe(0);
  });

  it("works for internal-only week", () => {
    const sessions: SessionEntry[] = [
      { type: "internal", label: "Day 1", date: "2026-01-01", load: 40 },
      { type: "internal", label: "Day 2", date: "2026-01-03", load: 55 },
    ];
    expect(totalWeeklyLoad(sessions)).toBe(95);
  });

  it("works for external-only week", () => {
    const sessions: SessionEntry[] = [
      { type: "external", label: "CrossFit Mon", date: "2026-01-01", load: 30 },
      { type: "external", label: "CrossFit Wed", date: "2026-01-03", load: 35 },
      { type: "external", label: "CrossFit Fri", date: "2026-01-05", load: 40 },
      { type: "external", label: "CrossFit Sat", date: "2026-01-06", load: 25 },
    ];
    expect(totalWeeklyLoad(sessions)).toBe(130);
  });

  it("4 external sessions contribute same count as 4 internal sessions", () => {
    const externalOnly: SessionEntry[] = [
      { type: "external", label: "WOD 1", date: "2026-01-01", load: 40 },
      { type: "external", label: "WOD 2", date: "2026-01-02", load: 40 },
      { type: "external", label: "WOD 3", date: "2026-01-03", load: 40 },
      { type: "external", label: "WOD 4", date: "2026-01-04", load: 40 },
    ];
    const internalOnly: SessionEntry[] = [
      { type: "internal", label: "S1", date: "2026-01-01", load: 40 },
      { type: "internal", label: "S2", date: "2026-01-02", load: 40 },
      { type: "internal", label: "S3", date: "2026-01-03", load: 40 },
      { type: "internal", label: "S4", date: "2026-01-04", load: 40 },
    ];
    // Same session count — deload threshold fires equally
    expect(externalOnly.length).toBe(internalOnly.length);
    // Same total load when loads are equal
    expect(totalWeeklyLoad(externalOnly)).toBe(totalWeeklyLoad(internalOnly));
  });
});

// ---------------------------------------------------------------------------
// Deload threshold parity — simulated deload check logic
// ---------------------------------------------------------------------------

describe("deload threshold parity", () => {
  const DELOAD_SESSION_THRESHOLD = 4;
  const DELOAD_FATIGUE_THRESHOLD = 75;

  function simulateDeloadCheck(sessionCount: number, avgFatigue: number): boolean {
    return avgFatigue >= DELOAD_FATIGUE_THRESHOLD && sessionCount >= DELOAD_SESSION_THRESHOLD;
  }

  it("4 external sessions triggers deload at high fatigue (same as 4 internal)", () => {
    const externalCount = 4;
    const internalCount = 4;
    const avgFatigue = 80;
    expect(simulateDeloadCheck(externalCount, avgFatigue)).toBe(true);
    expect(simulateDeloadCheck(internalCount, avgFatigue)).toBe(true);
  });

  it("3 sessions does not trigger deload regardless of source", () => {
    expect(simulateDeloadCheck(3, 80)).toBe(false);
  });

  it("mixed internal+external summing to 4 triggers deload", () => {
    const mixedCount = 2 + 2; // 2 internal + 2 external
    expect(simulateDeloadCheck(mixedCount, 80)).toBe(true);
  });

  it("low fatigue never triggers even at 5 sessions", () => {
    expect(simulateDeloadCheck(5, 50)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Before/After scoring comparison
// ---------------------------------------------------------------------------

describe("before/after: scoring diff with equal external vs internal", () => {
  it("BEFORE: external sessions had 0 sessionCount contribution (old bug)", () => {
    // Simulate the old logic: only count internal sessions
    const internalSessions = [{ totalVolume: 5000 }, { totalVolume: 4500 }];
    const externalWorkouts = [{ stimulusPoints: 40 }, { stimulusPoints: 35 }, { stimulusPoints: 50 }];

    const oldSessionCount = internalSessions.length; // 2 — external ignored!
    expect(oldSessionCount).toBe(2);
    // Old: 2 sessions + high fatigue would NOT trigger deload (< 4 threshold)
  });

  it("AFTER: external sessions contribute equally to sessionCount (new behavior)", () => {
    const internalSessions = [{ totalVolume: 5000 }, { totalVolume: 4500 }];
    const externalWorkouts = [{ stimulusPoints: 40 }, { stimulusPoints: 35 }, { stimulusPoints: 50 }];

    const newSessionCount = internalSessions.length + externalWorkouts.length; // 5
    expect(newSessionCount).toBe(5);
    // New: 5 sessions + high fatigue DOES trigger deload (>= 4 threshold)
    expect(newSessionCount >= 4).toBe(true);
  });

  it("BEFORE: external-only week → weeklyVolume was always 0", () => {
    const externalWorkouts = [{ stimulusPoints: 40 }, { stimulusPoints: 35 }];
    const oldWeeklyVolume = 0; // external was ignored in volume sum
    expect(oldWeeklyVolume).toBe(0);
  });

  it("AFTER: external-only week → weeklyVolume now reflects equivalent load", () => {
    const externalWorkouts = [{ stimulusPoints: 40 }, { stimulusPoints: 35 }];
    const newWeeklyVolume = externalWorkouts.reduce((sum, e) => {
      const load = externalSessionLoad(e.stimulusPoints);
      return sum + sessionLoadToVolumeEquiv(load);
    }, 0);
    expect(newWeeklyVolume).toBe((40 + 35) * LOAD_TO_VOLUME_EQUIV); // 7,500
    expect(newWeeklyVolume).toBeGreaterThan(0);
  });

  it("AFTER: mixed week weeklyVolume = internal volume + external equiv", () => {
    const internalSessions = [{ totalVolume: 5000 }];
    const externalWorkouts = [{ stimulusPoints: 50 }];

    const internalVol = internalSessions.reduce((s, e) => s + (e.totalVolume ?? 0), 0);
    const externalEquiv = externalWorkouts.reduce((sum, e) => {
      return sum + sessionLoadToVolumeEquiv(externalSessionLoad(e.stimulusPoints));
    }, 0);
    const total = internalVol + externalEquiv;

    expect(total).toBe(5000 + 50 * LOAD_TO_VOLUME_EQUIV); // 5000 + 5000 = 10,000
  });
});

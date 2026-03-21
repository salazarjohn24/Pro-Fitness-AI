/**
 * movementSets.test.ts — P3 set-level editor pure-function tests
 *
 * Tests pure utilities from utils/movementSets.ts:
 *   MS-1   inferMovementTypeFromName — hold detection
 *   MS-2   inferMovementTypeFromName — cardio detection
 *   MS-3   inferMovementTypeFromName — bodyweight detection
 *   MS-4   inferMovementTypeFromName — default strength
 *   MS-5   inferMovementTypeFromWorkout — cardio workout types
 *   MS-6   inferMovementTypeFromWorkout — hold workout types
 *   MS-7   inferMovementTypeFromWorkout — default strength
 *   MS-8   defaultSetRow — correct shape per type
 *   MS-9   parseVolumeToSets — strength "NxM @ W"
 *   MS-10  parseVolumeToSets — strength "NxM" no weight
 *   MS-11  parseVolumeToSets — bodyweight "NxM"
 *   MS-12  parseVolumeToSets — bodyweight "N reps"
 *   MS-13  parseVolumeToSets — hold "NxSs"
 *   MS-14  parseVolumeToSets — hold "Xs" single set
 *   MS-15  parseVolumeToSets — hold minutes
 *   MS-16  parseVolumeToSets — cardio distance
 *   MS-17  parseVolumeToSets — cardio minutes
 *   MS-18  parseVolumeToSets — cardio seconds
 *   MS-19  parseVolumeToSets — unrecognised → default
 *   MS-20  parseVolumeToSets — caps set count at 20
 *   MS-21  generateVolumeString — strength with weight
 *   MS-22  generateVolumeString — strength without weight
 *   MS-23  generateVolumeString — bodyweight
 *   MS-24  generateVolumeString — hold seconds
 *   MS-25  generateVolumeString — hold minutes
 *   MS-26  generateVolumeString — cardio duration
 *   MS-27  generateVolumeString — cardio distance
 *   MS-28  generateVolumeString — cardio calories
 *   MS-29  generateVolumeString — empty rows returns empty string
 *   MS-30  round-trip: parseVolumeToSets → generateVolumeString consistency
 */

import { describe, it, expect } from "vitest";
import {
  inferMovementTypeFromName,
  inferMovementTypeFromWorkout,
  defaultSetRow,
  parseVolumeToSets,
  generateVolumeString,
  type MovementType,
  type SetRow,
} from "../../utils/movementSets";

// ─── MS-1 through MS-4: inferMovementTypeFromName ───────────────────────────

describe("MS-1 through MS-4: inferMovementTypeFromName", () => {
  it("MS-1 detects hold for plank", () => {
    expect(inferMovementTypeFromName("Plank")).toBe("hold");
  });

  it("MS-1 detects hold for dead hang", () => {
    expect(inferMovementTypeFromName("Dead Hang")).toBe("hold");
  });

  it("MS-1 detects hold for wall sit", () => {
    expect(inferMovementTypeFromName("Wall Sit")).toBe("hold");
  });

  it("MS-1 detects hold for isometric hold", () => {
    expect(inferMovementTypeFromName("Isometric Hold")).toBe("hold");
  });

  it("MS-2 detects cardio for run", () => {
    expect(inferMovementTypeFromName("400m Run")).toBe("cardio");
  });

  it("MS-2 detects cardio for row", () => {
    expect(inferMovementTypeFromName("1000m Row")).toBe("cardio");
  });

  it("MS-2 detects cardio for bike", () => {
    expect(inferMovementTypeFromName("Assault Bike")).toBe("cardio");
  });

  it("MS-2 detects cardio for ski erg", () => {
    expect(inferMovementTypeFromName("Ski Erg")).toBe("cardio");
  });

  it("MS-2 detects cardio for 400 meters pattern", () => {
    expect(inferMovementTypeFromName("400")).toBe("cardio");
  });

  it("MS-3 detects bodyweight for push-up", () => {
    expect(inferMovementTypeFromName("Push-up")).toBe("bodyweight");
  });

  it("MS-3 detects bodyweight for pull-up", () => {
    expect(inferMovementTypeFromName("Pull-Up")).toBe("bodyweight");
  });

  it("MS-3 detects bodyweight for burpee", () => {
    expect(inferMovementTypeFromName("Burpee")).toBe("bodyweight");
  });

  it("MS-3 detects bodyweight for air squat", () => {
    expect(inferMovementTypeFromName("Air Squat")).toBe("bodyweight");
  });

  it("MS-3 detects bodyweight for sit-up", () => {
    expect(inferMovementTypeFromName("Sit-Up")).toBe("bodyweight");
  });

  it("MS-4 defaults to strength for back squat", () => {
    expect(inferMovementTypeFromName("Back Squat")).toBe("strength");
  });

  it("MS-4 defaults to strength for deadlift", () => {
    expect(inferMovementTypeFromName("Deadlift")).toBe("strength");
  });

  it("MS-4 defaults to strength for thruster", () => {
    expect(inferMovementTypeFromName("Thruster")).toBe("strength");
  });

  it("MS-4 defaults to strength for clean and jerk", () => {
    expect(inferMovementTypeFromName("Clean and Jerk")).toBe("strength");
  });
});

// ─── MS-5 through MS-7: inferMovementTypeFromWorkout ────────────────────────

describe("MS-5 through MS-7: inferMovementTypeFromWorkout", () => {
  it("MS-5 returns cardio for Running", () => {
    expect(inferMovementTypeFromWorkout("Running")).toBe("cardio");
  });

  it("MS-5 returns cardio for Cycling", () => {
    expect(inferMovementTypeFromWorkout("Cycling")).toBe("cardio");
  });

  it("MS-5 returns cardio for Swimming", () => {
    expect(inferMovementTypeFromWorkout("Swimming")).toBe("cardio");
  });

  it("MS-5 returns cardio for Cardio", () => {
    expect(inferMovementTypeFromWorkout("Cardio")).toBe("cardio");
  });

  it("MS-6 returns hold for Yoga", () => {
    expect(inferMovementTypeFromWorkout("Yoga")).toBe("hold");
  });

  it("MS-6 returns hold for Pilates", () => {
    expect(inferMovementTypeFromWorkout("Pilates")).toBe("hold");
  });

  it("MS-7 returns strength for Strength", () => {
    expect(inferMovementTypeFromWorkout("Strength")).toBe("strength");
  });

  it("MS-7 returns strength for CrossFit", () => {
    expect(inferMovementTypeFromWorkout("CrossFit")).toBe("strength");
  });

  it("MS-7 returns strength for HIIT", () => {
    expect(inferMovementTypeFromWorkout("HIIT")).toBe("strength");
  });

  it("MS-7 returns strength for unknown type", () => {
    expect(inferMovementTypeFromWorkout("Other")).toBe("strength");
  });
});

// ─── MS-8: defaultSetRow ─────────────────────────────────────────────────────

describe("MS-8: defaultSetRow", () => {
  it("strength has reps=10 and weight=''", () => {
    const row = defaultSetRow("strength");
    expect(row.reps).toBe(10);
    expect(row.weight).toBe("");
    expect(row.durationSeconds).toBeUndefined();
  });

  it("bodyweight has reps=10 and no weight", () => {
    const row = defaultSetRow("bodyweight");
    expect(row.reps).toBe(10);
    expect(row.weight).toBeUndefined();
  });

  it("hold has durationSeconds=30 and no reps", () => {
    const row = defaultSetRow("hold");
    expect(row.durationSeconds).toBe(30);
    expect(row.reps).toBeUndefined();
  });

  it("cardio has durationSeconds=300", () => {
    const row = defaultSetRow("cardio");
    expect(row.durationSeconds).toBe(300);
    expect(row.reps).toBeUndefined();
  });
});

// ─── MS-9 through MS-20: parseVolumeToSets ───────────────────────────────────

describe("MS-9 through MS-20: parseVolumeToSets", () => {
  it("MS-9 parses '3x10 @ 135' into 3 strength sets", () => {
    const rows = parseVolumeToSets("3x10 @ 135", "strength");
    expect(rows).toHaveLength(3);
    expect(rows[0].reps).toBe(10);
    expect(rows[0].weight).toBe("135");
  });

  it("MS-9 parses '3×10 @ 95lbs' with × character", () => {
    const rows = parseVolumeToSets("3×10 @ 95", "strength");
    expect(rows).toHaveLength(3);
    expect(rows[0].reps).toBe(10);
    expect(rows[0].weight).toBe("95");
  });

  it("MS-9 parses '5x5 @ 225' into 5 strength sets", () => {
    const rows = parseVolumeToSets("5x5 @ 225", "strength");
    expect(rows).toHaveLength(5);
    expect(rows[0].reps).toBe(5);
    expect(rows[0].weight).toBe("225");
  });

  it("MS-10 parses '3x10' without weight into strength sets with empty weight", () => {
    const rows = parseVolumeToSets("3x10", "strength");
    expect(rows).toHaveLength(3);
    expect(rows[0].reps).toBe(10);
    expect(rows[0].weight).toBe("");
  });

  it("MS-11 parses '3x15' into bodyweight sets", () => {
    const rows = parseVolumeToSets("3x15", "bodyweight");
    expect(rows).toHaveLength(3);
    expect(rows[0].reps).toBe(15);
    expect(rows[0].weight).toBeUndefined();
  });

  it("MS-12 parses '20 reps' into single bodyweight set", () => {
    const rows = parseVolumeToSets("20 reps", "bodyweight");
    expect(rows).toHaveLength(1);
    expect(rows[0].reps).toBe(20);
  });

  it("MS-13 parses '3x30s' into hold sets", () => {
    const rows = parseVolumeToSets("3x30s", "hold");
    expect(rows).toHaveLength(3);
    expect(rows[0].durationSeconds).toBe(30);
  });

  it("MS-13 parses '2x60sec' with sec suffix", () => {
    const rows = parseVolumeToSets("2x60sec", "hold");
    expect(rows).toHaveLength(2);
    expect(rows[0].durationSeconds).toBe(60);
  });

  it("MS-14 parses '45s' into single hold set", () => {
    const rows = parseVolumeToSets("45s", "hold");
    expect(rows).toHaveLength(1);
    expect(rows[0].durationSeconds).toBe(45);
  });

  it("MS-15 parses '2min' hold into durationSeconds=120", () => {
    const rows = parseVolumeToSets("2min", "hold");
    expect(rows).toHaveLength(1);
    expect(rows[0].durationSeconds).toBe(120);
  });

  it("MS-16 parses '400m' cardio into distance=400", () => {
    const rows = parseVolumeToSets("400m", "cardio");
    expect(rows).toHaveLength(1);
    expect(rows[0].distance).toBe(400);
  });

  it("MS-17 parses '5min' cardio into durationSeconds=300", () => {
    const rows = parseVolumeToSets("5min", "cardio");
    expect(rows).toHaveLength(1);
    expect(rows[0].durationSeconds).toBe(300);
  });

  it("MS-18 parses '90s' cardio into durationSeconds=90", () => {
    const rows = parseVolumeToSets("90s", "cardio");
    expect(rows).toHaveLength(1);
    expect(rows[0].durationSeconds).toBe(90);
  });

  it("MS-19 returns default for unrecognised volume string", () => {
    const rows = parseVolumeToSets("heavy", "strength");
    expect(rows).toHaveLength(1);
    expect(rows[0].reps).toBe(10);
  });

  it("MS-19 returns default for empty volume string", () => {
    const rows = parseVolumeToSets("", "bodyweight");
    expect(rows).toHaveLength(1);
    expect(rows[0].reps).toBe(10);
  });

  it("MS-20 caps set count at 20 for outlandish input", () => {
    const rows = parseVolumeToSets("99x10 @ 100", "strength");
    expect(rows).toHaveLength(20);
  });
});

// ─── MS-21 through MS-29: generateVolumeString ──────────────────────────────

describe("MS-21 through MS-29: generateVolumeString", () => {
  it("MS-21 generates 'N×M @ Wlbs' for strength with weight", () => {
    const rows: SetRow[] = [
      { reps: 10, weight: "135" },
      { reps: 10, weight: "135" },
      { reps: 10, weight: "135" },
    ];
    expect(generateVolumeString(rows, "strength")).toBe("3×10 @ 135lbs");
  });

  it("MS-22 generates 'N×M' for strength without weight", () => {
    const rows: SetRow[] = [{ reps: 8, weight: "" }, { reps: 8, weight: "" }];
    expect(generateVolumeString(rows, "strength")).toBe("2×8");
  });

  it("MS-22 generates 'N×M' for strength with undefined weight", () => {
    const rows: SetRow[] = [{ reps: 5 }];
    expect(generateVolumeString(rows, "strength")).toBe("1×5");
  });

  it("MS-23 generates 'N×M' for bodyweight", () => {
    const rows: SetRow[] = [{ reps: 15 }, { reps: 15 }, { reps: 15 }];
    expect(generateVolumeString(rows, "bodyweight")).toBe("3×15");
  });

  it("MS-24 generates 'N×Xs' for hold with seconds < 60", () => {
    const rows: SetRow[] = [{ durationSeconds: 45 }, { durationSeconds: 45 }];
    expect(generateVolumeString(rows, "hold")).toBe("2×45s");
  });

  it("MS-25 generates 'N×Xmin' for hold with exactly 60 seconds", () => {
    const rows: SetRow[] = [{ durationSeconds: 60 }];
    expect(generateVolumeString(rows, "hold")).toBe("1×1min");
  });

  it("MS-25 generates 'N×Xmin Ys' for hold with seconds remainder", () => {
    const rows: SetRow[] = [{ durationSeconds: 90 }];
    expect(generateVolumeString(rows, "hold")).toBe("1×1min 30s");
  });

  it("MS-26 generates duration part for cardio", () => {
    const rows: SetRow[] = [{ durationSeconds: 300 }];
    expect(generateVolumeString(rows, "cardio")).toBe("5min");
  });

  it("MS-26 generates seconds for short cardio duration", () => {
    const rows: SetRow[] = [{ durationSeconds: 45 }];
    expect(generateVolumeString(rows, "cardio")).toBe("45s");
  });

  it("MS-27 generates distance for cardio", () => {
    const rows: SetRow[] = [{ distance: 400 }];
    expect(generateVolumeString(rows, "cardio")).toBe("400m");
  });

  it("MS-28 generates calories for cardio", () => {
    const rows: SetRow[] = [{ calories: 50 }];
    expect(generateVolumeString(rows, "cardio")).toBe("50cal");
  });

  it("MS-28 generates combined cardio parts with separator", () => {
    const rows: SetRow[] = [{ durationSeconds: 120, distance: 400 }];
    expect(generateVolumeString(rows, "cardio")).toBe("2min · 400m");
  });

  it("MS-29 returns empty string for empty set rows", () => {
    expect(generateVolumeString([], "strength")).toBe("");
    expect(generateVolumeString([], "cardio")).toBe("");
  });
});

// ─── MS-30: round-trip consistency ─────────────────────────────────────────

describe("MS-30: round-trip consistency", () => {
  const roundTrip = (
    original: string,
    type: MovementType,
    expectedVolume: string,
  ) => {
    const rows = parseVolumeToSets(original, type);
    const volume = generateVolumeString(rows, type);
    expect(volume).toBe(expectedVolume);
  };

  it("strength '3x10 @ 135' → '3×10 @ 135lbs'", () => {
    roundTrip("3x10 @ 135", "strength", "3×10 @ 135lbs");
  });

  it("strength '3x10' without weight → '3×10'", () => {
    roundTrip("3x10", "strength", "3×10");
  });

  it("bodyweight '4x12' → '4×12'", () => {
    roundTrip("4x12", "bodyweight", "4×12");
  });

  it("hold '3x30s' → '3×30s'", () => {
    roundTrip("3x30s", "hold", "3×30s");
  });

  it("cardio '400m' → '400m'", () => {
    roundTrip("400m", "cardio", "400m");
  });

  it("cardio '5min' → '5min'", () => {
    roundTrip("5min", "cardio", "5min");
  });
});

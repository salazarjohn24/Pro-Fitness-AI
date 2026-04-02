/**
 * externalWorkoutAdapter.test.ts — Step 8 adapter unit tests.
 *
 * Tests the pure-transform logic in externalWorkoutAdapter.ts:
 *   - Rest day → ineligible
 *   - Zero movements → ineligible
 *   - Name-only movements → eligible, hasSetData=false
 *   - Movements with setRows → eligible, hasSetData=true
 *   - Mixed (some with sets, some without) → eligible, hasSetData=true
 *   - importedDataNote helper
 *   - isEligibleForScoring guard
 */

import { describe, it, expect } from "vitest";
import {
  adaptExternalWorkout,
  importedDataNote,
  isEligibleForScoring,
  type RawExternalWorkout,
} from "../externalWorkoutAdapter.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function make(overrides: Partial<RawExternalWorkout> = {}): RawExternalWorkout {
  return {
    label:       "Test Workout",
    workoutType: "strength",
    movements:   [],
    duration:    60,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Ineligible cases
// ---------------------------------------------------------------------------

describe("adaptExternalWorkout — ineligible cases", () => {
  it("rest day → ineligible with appropriate reason", () => {
    const { quality } = adaptExternalWorkout(make({ workoutType: "rest" }));
    expect(quality.isEligible).toBe(false);
    expect(quality.totalMovements).toBe(0);
    expect(quality.hasSetData).toBe(false);
    expect(quality.ineligibleReason).toMatch(/rest/i);
  });

  it("zero movements → ineligible", () => {
    const { quality } = adaptExternalWorkout(make({ movements: [] }));
    expect(quality.isEligible).toBe(false);
    expect(quality.totalMovements).toBe(0);
    expect(quality.ineligibleReason).toBeTruthy();
  });

  it("movements with empty names only → ineligible", () => {
    const { quality } = adaptExternalWorkout(
      make({ movements: [{ name: "" }, { name: "  " }] })
    );
    expect(quality.isEligible).toBe(false);
    expect(quality.totalMovements).toBe(0);
  });

  it("null movements → ineligible (graceful)", () => {
    const { quality } = adaptExternalWorkout(make({ movements: null as unknown as undefined }));
    expect(quality.isEligible).toBe(false);
  });

  it("undefined movements → ineligible (graceful)", () => {
    const { quality } = adaptExternalWorkout(make({ movements: undefined }));
    expect(quality.isEligible).toBe(false);
  });

  it("ineligible input → empty movements list", () => {
    const { input } = adaptExternalWorkout(make({ workoutType: "rest" }));
    expect(input.movements).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Name-only movements (no setRows)
// ---------------------------------------------------------------------------

describe("adaptExternalWorkout — name-only movements", () => {
  const movements = [
    { name: "Back Squat", volume: "3x5" },
    { name: "Deadlift",   volume: "1x3" },
  ];

  it("eligible when movements have names", () => {
    const { quality } = adaptExternalWorkout(make({ movements }));
    expect(quality.isEligible).toBe(true);
    expect(quality.ineligibleReason).toBeNull();
  });

  it("counts named movements correctly", () => {
    const { quality } = adaptExternalWorkout(make({ movements }));
    expect(quality.totalMovements).toBe(2);
  });

  it("hasSetData=false when no setRows", () => {
    const { quality } = adaptExternalWorkout(make({ movements }));
    expect(quality.hasSetData).toBe(false);
  });

  it("produces one PerformedMovementInput per named movement", () => {
    const { input } = adaptExternalWorkout(make({ movements }));
    expect(input.movements).toHaveLength(2);
    expect(input.movements[0].name).toBe("Back Squat");
    expect(input.movements[1].name).toBe("Deadlift");
  });

  it("name-only entries have no reps/loadKg/distanceM", () => {
    const { input } = adaptExternalWorkout(make({ movements }));
    for (const m of input.movements) {
      expect(m.reps).toBeUndefined();
      expect(m.loadKg).toBeUndefined();
      expect(m.distanceM).toBeUndefined();
    }
  });

  it("forwards workoutName and workoutType", () => {
    const { input } = adaptExternalWorkout(
      make({ label: "Morning Pull", workoutType: "strength", movements })
    );
    expect(input.workoutName).toBe("Morning Pull");
    expect(input.workoutType).toBe("strength");
  });
});

// ---------------------------------------------------------------------------
// Movements with setRows
// ---------------------------------------------------------------------------

describe("adaptExternalWorkout — movements with setRows", () => {
  const movements = [
    {
      name: "Back Squat",
      setRows: [
        { reps: 5, weight: "100kg" },
        { reps: 5, weight: "100kg" },
        { reps: 3, weight: "105kg" },
      ],
    },
    {
      name: "Romanian Deadlift",
      setRows: [
        { reps: 8, weight: "80kg" },
        { reps: 8, weight: "80kg" },
      ],
    },
  ];

  it("eligible when movements have setRows", () => {
    const { quality } = adaptExternalWorkout(make({ movements }));
    expect(quality.isEligible).toBe(true);
  });

  it("hasSetData=true when setRows present", () => {
    const { quality } = adaptExternalWorkout(make({ movements }));
    expect(quality.hasSetData).toBe(true);
  });

  it("counts total movements (not sets)", () => {
    const { quality } = adaptExternalWorkout(make({ movements }));
    expect(quality.totalMovements).toBe(2);
  });

  it("produces one PerformedMovementInput per set row", () => {
    const { input } = adaptExternalWorkout(make({ movements }));
    // 3 sets of Back Squat + 2 sets of RDL = 5 entries
    expect(input.movements).toHaveLength(5);
  });

  it("parses weight strings to kg", () => {
    const { input } = adaptExternalWorkout(make({ movements }));
    expect(input.movements[0].loadKg).toBeCloseTo(100);
    expect(input.movements[3].loadKg).toBeCloseTo(80);
  });

  it("preserves reps from setRows", () => {
    const { input } = adaptExternalWorkout(make({ movements }));
    expect(input.movements[0].reps).toBe(5);
    expect(input.movements[2].reps).toBe(3);
    expect(input.movements[3].reps).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// Mixed movements (some with sets, some without)
// ---------------------------------------------------------------------------

describe("adaptExternalWorkout — mixed movements", () => {
  const movements = [
    { name: "Back Squat", setRows: [{ reps: 5, weight: "100kg" }] },
    { name: "Box Jump",   volume: "3x10" },   // name-only
  ];

  it("eligible when at least one named movement exists", () => {
    const { quality } = adaptExternalWorkout(make({ movements }));
    expect(quality.isEligible).toBe(true);
  });

  it("hasSetData=true when any movement has setRows", () => {
    const { quality } = adaptExternalWorkout(make({ movements }));
    expect(quality.hasSetData).toBe(true);
  });

  it("totalMovements counts both entries", () => {
    const { quality } = adaptExternalWorkout(make({ movements }));
    expect(quality.totalMovements).toBe(2);
  });

  it("expands setRows movement + keeps name-only movement", () => {
    const { input } = adaptExternalWorkout(make({ movements }));
    // 1 set of Back Squat + 1 name-only Box Jump = 2 entries
    expect(input.movements).toHaveLength(2);
    expect(input.movements[0].name).toBe("Back Squat");
    expect(input.movements[0].reps).toBe(5);
    expect(input.movements[1].name).toBe("Box Jump");
    expect(input.movements[1].reps).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Edge cases for set fields
// ---------------------------------------------------------------------------

describe("adaptExternalWorkout — set field edge cases", () => {
  it("zero reps are dropped (undefined)", () => {
    const { input } = adaptExternalWorkout(
      make({ movements: [{ name: "Squat", setRows: [{ reps: 0, weight: "100kg" }] }] })
    );
    expect(input.movements[0].reps).toBeUndefined();
    expect(input.movements[0].loadKg).toBeCloseTo(100);
  });

  it("zero-weight strings produce undefined loadKg", () => {
    const { input } = adaptExternalWorkout(
      make({ movements: [{ name: "Squat", setRows: [{ reps: 5, weight: "0kg" }] }] })
    );
    expect(input.movements[0].loadKg).toBeUndefined();
  });

  it("forwards distanceM when present", () => {
    const { input } = adaptExternalWorkout(
      make({ movements: [{ name: "Row", setRows: [{ distance: 500, calories: 40 }] }] })
    );
    expect(input.movements[0].distanceM).toBe(500);
    expect(input.movements[0].calories).toBe(40);
  });

  it("skips zero distance and calories", () => {
    const { input } = adaptExternalWorkout(
      make({ movements: [{ name: "Row", setRows: [{ distance: 0, calories: 0 }] }] })
    );
    expect(input.movements[0].distanceM).toBeUndefined();
    expect(input.movements[0].calories).toBeUndefined();
  });

  it("empty setRows array falls back to name-only entry", () => {
    const { input, quality } = adaptExternalWorkout(
      make({ movements: [{ name: "Lunge", setRows: [] }] })
    );
    expect(input.movements).toHaveLength(1);
    expect(input.movements[0].name).toBe("Lunge");
    expect(quality.hasSetData).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// importedDataNote helper
// ---------------------------------------------------------------------------

describe("importedDataNote", () => {
  it("returns null for ineligible workouts", () => {
    const { quality } = adaptExternalWorkout(make({ workoutType: "rest" }));
    expect(importedDataNote(quality)).toBeNull();
  });

  it("returns null when set-level data is present", () => {
    const { quality } = adaptExternalWorkout(
      make({ movements: [{ name: "Squat", setRows: [{ reps: 5, weight: "100kg" }] }] })
    );
    expect(importedDataNote(quality)).toBeNull();
  });

  it("returns a descriptive string when name-only (no set data)", () => {
    const { quality } = adaptExternalWorkout(
      make({ movements: [{ name: "Squat", volume: "5x5" }] })
    );
    const note = importedDataNote(quality);
    expect(note).not.toBeNull();
    expect(note).toMatch(/movement names only/i);
    expect(note).toMatch(/set-level data/i);
  });
});

// ---------------------------------------------------------------------------
// Apple Health source path (AH-01 – AH-04)
// ---------------------------------------------------------------------------

describe("Apple Health source='apple_health'", () => {
  it("AH-01 — returns 'apple-health-activity-only' reason when source is apple_health and no movements", () => {
    const { quality } = adaptExternalWorkout(
      make({ source: "apple_health", movements: [], workoutType: "strength" })
    );
    expect(quality.isEligible).toBe(false);
    expect(quality.ineligibleReason).toBe("apple-health-activity-only");
  });

  it("AH-02 — returns generic reason when source is manual and no movements", () => {
    const { quality } = adaptExternalWorkout(
      make({ source: "manual", movements: [], workoutType: "strength" })
    );
    expect(quality.isEligible).toBe(false);
    expect(quality.ineligibleReason).not.toBe("apple-health-activity-only");
    expect(quality.ineligibleReason).toMatch(/named movements/i);
  });

  it("AH-03 — returns generic reason when source is omitted and no movements", () => {
    const { quality } = adaptExternalWorkout(make({ movements: [] }));
    expect(quality.ineligibleReason).not.toBe("apple-health-activity-only");
  });

  it("AH-04 — apple_health workout WITH named movements scores normally", () => {
    const { quality } = adaptExternalWorkout(
      make({ source: "apple_health", movements: [{ name: "Running" }], workoutType: "cardio" })
    );
    expect(quality.isEligible).toBe(true);
    expect(quality.ineligibleReason).toBeNull();
  });

  it("AH-05 — rest day with apple_health source uses rest-day path (not apple-health path)", () => {
    const { quality } = adaptExternalWorkout(
      make({ source: "apple_health", workoutType: "rest", movements: [] })
    );
    expect(quality.isEligible).toBe(false);
    expect(quality.ineligibleReason).toMatch(/rest day/i);
    expect(quality.ineligibleReason).not.toBe("apple-health-activity-only");
  });
});

// ---------------------------------------------------------------------------
// isEligibleForScoring guard
// ---------------------------------------------------------------------------

describe("isEligibleForScoring", () => {
  it("returns false for rest day", () => {
    const { quality } = adaptExternalWorkout(make({ workoutType: "rest" }));
    expect(isEligibleForScoring(quality)).toBe(false);
  });

  it("returns false for zero movements", () => {
    const { quality } = adaptExternalWorkout(make({ movements: [] }));
    expect(isEligibleForScoring(quality)).toBe(false);
  });

  it("returns true for named movements", () => {
    const { quality } = adaptExternalWorkout(
      make({ movements: [{ name: "Deadlift" }] })
    );
    expect(isEligibleForScoring(quality)).toBe(true);
  });
});

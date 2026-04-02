/**
 * mapHKActivity.test.ts — Unit tests for the Apple Health activityName mapper.
 *
 * Verifies that known HK activity names map to the correct internal workoutType
 * and display label, and that unknown names fall back gracefully.
 *
 * Tests: AHM-01 – AHM-12
 */

import { describe, it, expect } from "vitest";
import { mapHKActivity } from "../../routes/workouts.js";

describe("mapHKActivity — known strength activities", () => {
  it("AHM-01 — TraditionalStrengthTraining maps to strength", () => {
    const r = mapHKActivity("TraditionalStrengthTraining");
    expect(r.workoutType).toBe("strength");
    expect(r.label).toBe("Strength Training");
  });

  it("AHM-02 — FunctionalStrengthTraining maps to strength", () => {
    expect(mapHKActivity("FunctionalStrengthTraining").workoutType).toBe("strength");
  });

  it("AHM-03 — HighIntensityIntervalTraining maps to strength with label HIIT", () => {
    const r = mapHKActivity("HighIntensityIntervalTraining");
    expect(r.workoutType).toBe("strength");
    expect(r.label).toBe("HIIT");
  });

  it("AHM-04 — CrossTraining maps to strength", () => {
    expect(mapHKActivity("CrossTraining").workoutType).toBe("strength");
  });

  it("AHM-05 — CoreTraining maps to strength", () => {
    expect(mapHKActivity("CoreTraining").workoutType).toBe("strength");
  });
});

describe("mapHKActivity — known cardio activities", () => {
  it("AHM-06 — Running maps to cardio", () => {
    const r = mapHKActivity("Running");
    expect(r.workoutType).toBe("cardio");
    expect(r.label).toBe("Running");
  });

  it("AHM-07 — Cycling maps to cardio", () => {
    expect(mapHKActivity("Cycling").workoutType).toBe("cardio");
  });

  it("AHM-08 — Walking maps to cardio", () => {
    expect(mapHKActivity("Walking").workoutType).toBe("cardio");
  });

  it("AHM-09 — Hiking maps to cardio", () => {
    expect(mapHKActivity("Hiking").workoutType).toBe("cardio");
  });
});

describe("mapHKActivity — known recovery activities", () => {
  it("AHM-10 — Yoga maps to recovery", () => {
    const r = mapHKActivity("Yoga");
    expect(r.workoutType).toBe("recovery");
    expect(r.label).toBe("Yoga");
  });

  it("AHM-11 — Pilates maps to recovery", () => {
    expect(mapHKActivity("Pilates").workoutType).toBe("recovery");
  });
});

describe("mapHKActivity — fallback behaviour", () => {
  it("AHM-12 — unknown activityName falls back to strength with raw name as label", () => {
    const r = mapHKActivity("SomeNewActivity");
    expect(r.workoutType).toBe("strength");
    expect(r.label).toBe("SomeNewActivity");
  });

  it("AHM-13 — Other maps to strength with generic label", () => {
    const r = mapHKActivity("Other");
    expect(r.workoutType).toBe("strength");
    expect(r.label).toBe("Workout");
  });

  it("AHM-14 — empty string falls back to strength", () => {
    const r = mapHKActivity("");
    expect(r.workoutType).toBe("strength");
  });
});

import { describe, it, expect } from "vitest";

const LOW_CONFIDENCE_THRESHOLD = 0.65;

function computeParserConfidence(result: {
  muscleGroups: string[];
  movements: Array<unknown>;
  workoutType: string;
}): number {
  let score = 1.0;
  if (result.movements.length === 0) score -= 0.35;
  if (result.muscleGroups.length === 0) score -= 0.30;
  if (result.workoutType === "Other" || result.workoutType === "Imported") score -= 0.10;
  if (result.movements.length < 2 && result.muscleGroups.length < 2) score -= 0.10;
  return Math.max(0.05, Math.min(1.0, Math.round(score * 100) / 100));
}

function detectEditedFields(
  initial: { label: string; workoutType: string; duration: number; intensity: number; muscleGroups: string[] },
  current: { label: string; workoutType: string; duration: number; intensity: number; muscleGroups: string[] },
): string[] {
  const edited: string[] = [];
  if (current.label.trim() !== initial.label.trim()) edited.push("label");
  if (current.workoutType !== initial.workoutType) edited.push("workoutType");
  if (current.duration !== initial.duration) edited.push("duration");
  if (current.intensity !== initial.intensity) edited.push("intensity");
  const sameGroups =
    current.muscleGroups.length === initial.muscleGroups.length &&
    current.muscleGroups.every((g) => initial.muscleGroups.includes(g));
  if (!sameGroups) edited.push("muscleGroups");
  return edited;
}

const baseFields = {
  label: "My Workout",
  workoutType: "CrossFit",
  duration: 45,
  intensity: 7,
  muscleGroups: ["Legs", "Shoulders"],
};

describe("LOW_CONFIDENCE_THRESHOLD", () => {
  it("is 0.65", () => {
    expect(LOW_CONFIDENCE_THRESHOLD).toBe(0.65);
  });
});

describe("computeParserConfidence", () => {
  it("returns high confidence for rich result", () => {
    const score = computeParserConfidence({
      muscleGroups: ["Legs", "Back", "Shoulders"],
      movements: [{ name: "Thruster" }, { name: "Pull-up" }],
      workoutType: "CrossFit",
    });
    expect(score).toBeGreaterThanOrEqual(LOW_CONFIDENCE_THRESHOLD);
  });

  it("returns low confidence when no movements or muscle groups", () => {
    const score = computeParserConfidence({
      muscleGroups: [],
      movements: [],
      workoutType: "CrossFit",
    });
    expect(score).toBeLessThan(LOW_CONFIDENCE_THRESHOLD);
  });

  it("penalizes workoutType === 'Other'", () => {
    const withOther = computeParserConfidence({
      muscleGroups: ["Legs", "Back"],
      movements: [{ name: "Squat" }, { name: "Deadlift" }],
      workoutType: "Other",
    });
    const withCrossFit = computeParserConfidence({
      muscleGroups: ["Legs", "Back"],
      movements: [{ name: "Squat" }, { name: "Deadlift" }],
      workoutType: "CrossFit",
    });
    expect(withOther).toBeLessThan(withCrossFit);
  });

  it("penalizes workoutType === 'Imported'", () => {
    const score = computeParserConfidence({
      muscleGroups: ["Legs"],
      movements: [{ name: "Squat" }],
      workoutType: "Imported",
    });
    const ref = computeParserConfidence({
      muscleGroups: ["Legs"],
      movements: [{ name: "Squat" }],
      workoutType: "Strength",
    });
    expect(score).toBeLessThan(ref);
  });

  it("clamps to min 0.05", () => {
    const score = computeParserConfidence({
      muscleGroups: [],
      movements: [],
      workoutType: "Other",
    });
    expect(score).toBeGreaterThanOrEqual(0.05);
  });

  it("never exceeds 1.0", () => {
    const score = computeParserConfidence({
      muscleGroups: ["Legs", "Back", "Chest", "Shoulders"],
      movements: [{ name: "A" }, { name: "B" }, { name: "C" }],
      workoutType: "CrossFit",
    });
    expect(score).toBeLessThanOrEqual(1.0);
  });
});

describe("detectEditedFields", () => {
  it("returns empty array when nothing changed", () => {
    const result = detectEditedFields(baseFields, { ...baseFields });
    expect(result).toEqual([]);
  });

  it("detects label change", () => {
    const result = detectEditedFields(baseFields, { ...baseFields, label: "New Name" });
    expect(result).toContain("label");
  });

  it("ignores label whitespace differences", () => {
    const result = detectEditedFields(
      { ...baseFields, label: "  My Workout  " },
      { ...baseFields, label: "My Workout" },
    );
    expect(result).not.toContain("label");
  });

  it("detects workoutType change", () => {
    const result = detectEditedFields(baseFields, { ...baseFields, workoutType: "Cardio" });
    expect(result).toContain("workoutType");
  });

  it("detects duration change", () => {
    const result = detectEditedFields(baseFields, { ...baseFields, duration: 60 });
    expect(result).toContain("duration");
  });

  it("detects intensity change", () => {
    const result = detectEditedFields(baseFields, { ...baseFields, intensity: 8 });
    expect(result).toContain("intensity");
  });

  it("detects muscleGroups change — addition", () => {
    const result = detectEditedFields(baseFields, {
      ...baseFields,
      muscleGroups: ["Legs", "Shoulders", "Back"],
    });
    expect(result).toContain("muscleGroups");
  });

  it("detects muscleGroups change — removal", () => {
    const result = detectEditedFields(baseFields, {
      ...baseFields,
      muscleGroups: ["Legs"],
    });
    expect(result).toContain("muscleGroups");
  });

  it("treats muscleGroups as order-independent", () => {
    const result = detectEditedFields(baseFields, {
      ...baseFields,
      muscleGroups: ["Shoulders", "Legs"],
    });
    expect(result).not.toContain("muscleGroups");
  });

  it("detects multiple changed fields", () => {
    const result = detectEditedFields(baseFields, {
      ...baseFields,
      label: "Renamed",
      intensity: 9,
    });
    expect(result).toContain("label");
    expect(result).toContain("intensity");
    expect(result).not.toContain("workoutType");
  });

  it("wasUserEdited is true when any field changed", () => {
    const edited = detectEditedFields(baseFields, { ...baseFields, duration: 60 });
    expect(edited.length).toBeGreaterThan(0);
  });

  it("wasUserEdited is false when nothing changed", () => {
    const edited = detectEditedFields(baseFields, { ...baseFields });
    expect(edited.length).toBe(0);
  });
});

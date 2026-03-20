import { describe, it, expect } from "vitest";
import {
  WORKOUT_FORMAT_VALUES,
  PARSER_META_DEFAULTS,
  validateParserConfidence,
  validateParserWarnings,
  validateWorkoutFormat,
  validateEditedFields,
  resolveParserMeta,
} from "../src/lib/parserValidator.js";

describe("WORKOUT_FORMAT_VALUES", () => {
  it("contains exactly the five expected values", () => {
    expect(WORKOUT_FORMAT_VALUES).toEqual(["AMRAP", "EMOM", "FOR_TIME", "STANDARD", "UNKNOWN"]);
  });

  it("is a readonly tuple (length 5)", () => {
    expect(WORKOUT_FORMAT_VALUES.length).toBe(5);
  });
});

describe("PARSER_META_DEFAULTS (backward-compat sentinel)", () => {
  it("parserConfidence defaults to null", () => {
    expect(PARSER_META_DEFAULTS.parserConfidence).toBeNull();
  });

  it("parserWarnings defaults to empty array", () => {
    expect(PARSER_META_DEFAULTS.parserWarnings).toEqual([]);
  });

  it("workoutFormat defaults to null", () => {
    expect(PARSER_META_DEFAULTS.workoutFormat).toBeNull();
  });

  it("wasUserEdited defaults to false", () => {
    expect(PARSER_META_DEFAULTS.wasUserEdited).toBe(false);
  });

  it("editedFields defaults to empty array", () => {
    expect(PARSER_META_DEFAULTS.editedFields).toEqual([]);
  });
});

describe("validateParserConfidence", () => {
  it("returns null for undefined (omitted field — backward compat)", () => {
    expect(validateParserConfidence(undefined)).toBeNull();
  });

  it("returns null for null (explicit clear)", () => {
    expect(validateParserConfidence(null)).toBeNull();
  });

  it("returns null for 0", () => {
    expect(validateParserConfidence(0)).toBeNull();
  });

  it("returns null for 1", () => {
    expect(validateParserConfidence(1)).toBeNull();
  });

  it("returns null for a valid mid-range float", () => {
    expect(validateParserConfidence(0.87)).toBeNull();
  });

  it("returns an error string for value > 1", () => {
    expect(validateParserConfidence(1.01)).toMatch(/0 and 1/);
  });

  it("returns an error string for negative value", () => {
    expect(validateParserConfidence(-0.1)).toMatch(/0 and 1/);
  });

  it("returns an error string for a non-number type", () => {
    expect(validateParserConfidence("high")).toMatch(/0 and 1/);
  });
});

describe("validateParserWarnings", () => {
  it("returns null for undefined", () => {
    expect(validateParserWarnings(undefined)).toBeNull();
  });

  it("returns null for null", () => {
    expect(validateParserWarnings(null)).toBeNull();
  });

  it("returns null for empty array", () => {
    expect(validateParserWarnings([])).toBeNull();
  });

  it("returns null for array of strings", () => {
    expect(validateParserWarnings(["low confidence on movements", "duration inferred"])).toBeNull();
  });

  it("returns an error if any element is not a string", () => {
    expect(validateParserWarnings(["ok", 42])).toMatch(/strings/);
  });

  it("returns an error for non-array value", () => {
    expect(validateParserWarnings("low confidence")).toMatch(/strings/);
  });
});

describe("validateWorkoutFormat", () => {
  it("returns null for undefined", () => {
    expect(validateWorkoutFormat(undefined)).toBeNull();
  });

  it("returns null for null", () => {
    expect(validateWorkoutFormat(null)).toBeNull();
  });

  for (const fmt of ["AMRAP", "EMOM", "FOR_TIME", "STANDARD", "UNKNOWN"]) {
    it(`returns null for valid format "${fmt}"`, () => {
      expect(validateWorkoutFormat(fmt)).toBeNull();
    });
  }

  it("returns an error for an unrecognized format", () => {
    expect(validateWorkoutFormat("TABATA")).toMatch(/one of/);
  });

  it("returns an error for lowercase variant", () => {
    expect(validateWorkoutFormat("amrap")).toMatch(/one of/);
  });
});

describe("validateEditedFields", () => {
  it("returns null for undefined", () => {
    expect(validateEditedFields(undefined)).toBeNull();
  });

  it("returns null for null", () => {
    expect(validateEditedFields(null)).toBeNull();
  });

  it("returns null for empty array", () => {
    expect(validateEditedFields([])).toBeNull();
  });

  it("returns null for array of strings", () => {
    expect(validateEditedFields(["label", "muscleGroups"])).toBeNull();
  });

  it("returns an error if any element is not a string", () => {
    expect(validateEditedFields(["label", true])).toMatch(/strings/);
  });
});

describe("resolveParserMeta — backward-compat defaults for old records", () => {
  it("old record with no parser fields gets all safe defaults", () => {
    const meta = resolveParserMeta({});
    expect(meta.parserConfidence).toBeNull();
    expect(meta.parserWarnings).toEqual([]);
    expect(meta.workoutFormat).toBeNull();
    expect(meta.wasUserEdited).toBe(false);
    expect(meta.editedFields).toEqual([]);
  });

  it("preserves a full parser payload when all fields are provided", () => {
    const meta = resolveParserMeta({
      parserConfidence: 0.91,
      parserWarnings: ["duration inferred"],
      workoutFormat: "AMRAP",
      wasUserEdited: true,
      editedFields: ["label"],
    });
    expect(meta.parserConfidence).toBe(0.91);
    expect(meta.parserWarnings).toEqual(["duration inferred"]);
    expect(meta.workoutFormat).toBe("AMRAP");
    expect(meta.wasUserEdited).toBe(true);
    expect(meta.editedFields).toEqual(["label"]);
  });

  it("partial payload: only confidence provided, rest defaults", () => {
    const meta = resolveParserMeta({ parserConfidence: 0.5 });
    expect(meta.parserConfidence).toBe(0.5);
    expect(meta.parserWarnings).toEqual([]);
    expect(meta.workoutFormat).toBeNull();
    expect(meta.wasUserEdited).toBe(false);
    expect(meta.editedFields).toEqual([]);
  });

  it("serializes parserWarnings as an array even when body field is absent", () => {
    const meta = resolveParserMeta({ parserConfidence: 0.7, workoutFormat: "EMOM" });
    expect(Array.isArray(meta.parserWarnings)).toBe(true);
    expect(Array.isArray(meta.editedFields)).toBe(true);
  });
});

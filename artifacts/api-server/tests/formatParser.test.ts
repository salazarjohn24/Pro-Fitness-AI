import { describe, it, expect } from "vitest";
import {
  detectWorkoutFormat,
  normalizeMetconFormatString,
  FORMAT_CONFIDENCE_THRESHOLD,
} from "../src/lib/formatParser";

// ---------------------------------------------------------------------------
// Fixtures — representative CrossFit / strength-training text samples
// ---------------------------------------------------------------------------

const FIXTURES = {
  // --- AMRAP ---
  amrap_explicit: "AMRAP 12: 5 Thrusters (95/65), 7 Pull-ups, 10 Box Jumps (24/20\")",
  amrap_spelled_out: "As Many Rounds As Possible in 20 minutes: 10 Wall Balls, 10 Box Jumps, 200m Run",
  amrap_as_many_reps: "As Many Reps As Possible: 1 min Dumbbell Snatches (50/35)",
  amrap_as_many_possible: "8 min: as many rounds as possible — 6 pull-ups, 9 push-ups, 12 squats",
  amrap_inline: "12-Minute AMRAP: 5 Hang Power Cleans, 10 Front Squats, 15 Toes-to-Bar",

  // --- EMOM ---
  emom_explicit: "EMOM 20: Odd minutes — 10 Deadlifts @ 225/155; Even minutes — 15 Box Jumps",
  emom_full_phrase: "Every Minute on the Minute for 16 minutes: 3 Power Snatches",
  emom_dotted: "E.M.O.M. x 10: 10 Burpees each minute",
  emom_x_format: "EMOM x 12: Minute 1 – 5 Strict Pull-Ups; Minute 2 – 10 Push-Ups",
  emom_every_minute: "Every minute for 8 minutes: 2 Muscle-Ups",

  // --- FOR_TIME ---
  for_time_explicit: "For Time: 21-15-9 Thrusters (95/65) and Pull-Ups",
  for_time_rounds: "3 Rounds For Time: 400m Run, 21 Kettlebell Swings (53/35), 12 Pull-Ups",
  for_time_complete: "Complete the following for time: 50 Wall Balls, 40 Box Jumps, 30 Pull-Ups",
  for_time_fran: "21-15-9: Thrusters and Pull-Ups",
  for_time_time_cap: "Time Cap: 20 minutes — 5 Rounds: 20 Toes-to-Bar, 15 Shoulder-to-Overhead",
  for_time_rft: "5 RFT: 10 Hang Power Cleans, 10 Front Squats, 10 Shoulder-to-Overhead",

  // --- STANDARD ---
  standard_sets_reps_lift: "Back Squat: 5x5 @ 80% of 1RM. Rest 3 min between sets.",
  standard_deadlift: "Deadlift 3x10 @ 70%. 90 sec rest. Accessory: 3x12 Romanian Deadlift.",
  standard_working_sets: "Bench Press — Working Sets: 4x6 @ 225lbs. Superset with 4x10 Dumbbell Rows.",
  standard_strength_day: "Strength Day: Front Squat 4x4, Strict Press 3x8, Weighted Pull-Up 3x6",
  standard_sets_reps_only: "4x8 at moderate load with 60 sec rest",

  // --- UNKNOWN ---
  unknown_yoga: "Yoga flow and breathwork, 30 minutes, focus on hip flexibility.",
  unknown_generic: "Today's workout at the gym — had a great session.",
  unknown_empty: "",
  unknown_nutrition: "Pre-workout nutrition: 40g carbs, 20g protein, 30 min before training.",
  unknown_swimming: "500m warm-up, 4x100m at pace, 200m cool-down in the pool",

  // --- EDGE CASES ---
  edge_amrap_emom_overlap: "10-min AMRAP into 10-min EMOM: first half AMRAP thrusters, second half EMOM pull-ups",
  edge_strength_then_metcon: "Strength: Back Squat 5x5. Then AMRAP 10: 10 Burpees, 15 Wall Balls.",
  edge_uppercase_amrap: "AMRAP – 15 MINUTES",
  edge_number_21_15_9_fran: "\"Fran\" – 21-15-9 Thrusters (95lb) and Pull-Ups for time",
};

// ---------------------------------------------------------------------------
// detectWorkoutFormat
// ---------------------------------------------------------------------------

describe("detectWorkoutFormat — AMRAP", () => {
  it("detects 'AMRAP' keyword", () => {
    expect(detectWorkoutFormat(FIXTURES.amrap_explicit).format).toBe("AMRAP");
  });

  it("detects 'As Many Rounds As Possible'", () => {
    expect(detectWorkoutFormat(FIXTURES.amrap_spelled_out).format).toBe("AMRAP");
  });

  it("detects 'As Many Reps As Possible'", () => {
    expect(detectWorkoutFormat(FIXTURES.amrap_as_many_reps).format).toBe("AMRAP");
  });

  it("detects 'as many rounds as possible' (lowercase)", () => {
    expect(detectWorkoutFormat(FIXTURES.amrap_as_many_possible).format).toBe("AMRAP");
  });

  it("detects 'AMRAP' inline (high confidence)", () => {
    const result = detectWorkoutFormat(FIXTURES.amrap_inline);
    expect(result.format).toBe("AMRAP");
    expect(result.confidence).toBeGreaterThanOrEqual(FORMAT_CONFIDENCE_THRESHOLD);
  });

  it("UPPERCASE AMRAP variant works", () => {
    expect(detectWorkoutFormat(FIXTURES.edge_uppercase_amrap).format).toBe("AMRAP");
  });
});

describe("detectWorkoutFormat — EMOM", () => {
  it("detects 'EMOM' keyword", () => {
    expect(detectWorkoutFormat(FIXTURES.emom_explicit).format).toBe("EMOM");
  });

  it("detects 'Every Minute on the Minute'", () => {
    expect(detectWorkoutFormat(FIXTURES.emom_full_phrase).format).toBe("EMOM");
  });

  it("detects 'E.M.O.M.' dotted abbreviation", () => {
    expect(detectWorkoutFormat(FIXTURES.emom_dotted).format).toBe("EMOM");
  });

  it("detects 'EMOM x N' format", () => {
    expect(detectWorkoutFormat(FIXTURES.emom_x_format).format).toBe("EMOM");
  });

  it("detects 'Every minute for N minutes'", () => {
    expect(detectWorkoutFormat(FIXTURES.emom_every_minute).format).toBe("EMOM");
  });
});

describe("detectWorkoutFormat — FOR_TIME", () => {
  it("detects 'For Time' phrase", () => {
    expect(detectWorkoutFormat(FIXTURES.for_time_explicit).format).toBe("FOR_TIME");
  });

  it("detects 'N Rounds For Time'", () => {
    expect(detectWorkoutFormat(FIXTURES.for_time_rounds).format).toBe("FOR_TIME");
  });

  it("detects 'complete ... for time'", () => {
    expect(detectWorkoutFormat(FIXTURES.for_time_complete).format).toBe("FOR_TIME");
  });

  it("detects 21-15-9 (Fran) pattern → FOR_TIME", () => {
    expect(detectWorkoutFormat(FIXTURES.for_time_fran).format).toBe("FOR_TIME");
  });

  it("detects 'Time Cap' phrase", () => {
    expect(detectWorkoutFormat(FIXTURES.for_time_time_cap).format).toBe("FOR_TIME");
  });

  it("detects 'RFT' abbreviation", () => {
    expect(detectWorkoutFormat(FIXTURES.for_time_rft).format).toBe("FOR_TIME");
  });

  it("detects Fran with 'for time' context", () => {
    expect(detectWorkoutFormat(FIXTURES.edge_number_21_15_9_fran).format).toBe("FOR_TIME");
  });
});

describe("detectWorkoutFormat — STANDARD", () => {
  it("detects back squat with sets×reps", () => {
    expect(detectWorkoutFormat(FIXTURES.standard_sets_reps_lift).format).toBe("STANDARD");
  });

  it("detects deadlift with sets×reps", () => {
    expect(detectWorkoutFormat(FIXTURES.standard_deadlift).format).toBe("STANDARD");
  });

  it("detects 'Working Sets' phrase", () => {
    expect(detectWorkoutFormat(FIXTURES.standard_working_sets).format).toBe("STANDARD");
  });

  it("detects 'Strength Day' phrase", () => {
    expect(detectWorkoutFormat(FIXTURES.standard_strength_day).format).toBe("STANDARD");
  });

  it("detects bare sets×reps without lift name (lower confidence)", () => {
    const result = detectWorkoutFormat(FIXTURES.standard_sets_reps_only);
    expect(result.format).toBe("STANDARD");
  });
});

describe("detectWorkoutFormat — UNKNOWN", () => {
  it("returns UNKNOWN for yoga description", () => {
    expect(detectWorkoutFormat(FIXTURES.unknown_yoga).format).toBe("UNKNOWN");
  });

  it("returns UNKNOWN for generic activity description", () => {
    expect(detectWorkoutFormat(FIXTURES.unknown_generic).format).toBe("UNKNOWN");
  });

  it("returns UNKNOWN for empty string", () => {
    const result = detectWorkoutFormat(FIXTURES.unknown_empty);
    expect(result.format).toBe("UNKNOWN");
    expect(result.warning).toBeTruthy();
  });

  it("returns UNKNOWN for nutrition description", () => {
    expect(detectWorkoutFormat(FIXTURES.unknown_nutrition).format).toBe("UNKNOWN");
  });

  it("includes a user-visible warning when UNKNOWN", () => {
    const result = detectWorkoutFormat(FIXTURES.unknown_yoga);
    expect(result.warning).toBeTruthy();
    expect(typeof result.warning).toBe("string");
  });

  it("confidence is below threshold for UNKNOWN results", () => {
    const result = detectWorkoutFormat(FIXTURES.unknown_yoga);
    expect(result.confidence).toBeLessThan(FORMAT_CONFIDENCE_THRESHOLD);
  });
});

describe("detectWorkoutFormat — edge cases", () => {
  it("strength+AMRAP combo: AMRAP wins (first strong keyword)", () => {
    const result = detectWorkoutFormat(FIXTURES.edge_strength_then_metcon);
    expect(result.format).toBe("AMRAP");
  });

  it("confidence is always in [0, 1] range", () => {
    for (const text of Object.values(FIXTURES)) {
      const { confidence } = detectWorkoutFormat(text);
      expect(confidence).toBeGreaterThanOrEqual(0);
      expect(confidence).toBeLessThanOrEqual(1);
    }
  });

  it("all enum values handled — no unexpected format returned", () => {
    const validFormats = new Set(["AMRAP", "EMOM", "FOR_TIME", "STANDARD", "UNKNOWN"]);
    for (const text of Object.values(FIXTURES)) {
      const { format } = detectWorkoutFormat(text);
      expect(validFormats.has(format)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// normalizeMetconFormatString
// ---------------------------------------------------------------------------

describe("normalizeMetconFormatString", () => {
  it("maps 'AMRAP 12' → AMRAP", () => {
    expect(normalizeMetconFormatString("AMRAP 12")).toBe("AMRAP");
  });

  it("maps 'EMOM 20' → EMOM", () => {
    expect(normalizeMetconFormatString("EMOM 20")).toBe("EMOM");
  });

  it("maps 'AMRAP 12 Min' → AMRAP (case-insensitive)", () => {
    expect(normalizeMetconFormatString("AMRAP 12 Min")).toBe("AMRAP");
  });

  it("maps '5 Rounds For Time' → FOR_TIME", () => {
    expect(normalizeMetconFormatString("5 Rounds For Time")).toBe("FOR_TIME");
  });

  it("maps '5 RFT' → FOR_TIME", () => {
    expect(normalizeMetconFormatString("5 RFT")).toBe("FOR_TIME");
  });

  it("maps '21-15-9' → FOR_TIME", () => {
    expect(normalizeMetconFormatString("21-15-9")).toBe("FOR_TIME");
  });

  it("maps null → UNKNOWN", () => {
    expect(normalizeMetconFormatString(null)).toBe("UNKNOWN");
  });

  it("maps undefined → UNKNOWN", () => {
    expect(normalizeMetconFormatString(undefined)).toBe("UNKNOWN");
  });

  it("maps empty string → UNKNOWN", () => {
    expect(normalizeMetconFormatString("")).toBe("UNKNOWN");
  });

  it("maps unrecognized string → UNKNOWN", () => {
    expect(normalizeMetconFormatString("Gymnastics Skill Work")).toBe("UNKNOWN");
  });
});

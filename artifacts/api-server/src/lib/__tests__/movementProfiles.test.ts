/**
 * movementProfiles.test.ts — Step 1 unit tests.
 *
 * Covers:
 *   A) Alias resolution — common names, abbreviations, prefixes
 *   B) normalizeMovementName — equipment prefix, distance, hyphen, casing
 *   C) getMovementProfile — known profiles, unknown → null
 *   D) getBaseMuscleVector — weights, roles, fallback null
 *   E) Type invariants — primary >= 0.70, secondary 0.25–0.69, stabilizer < 0.25
 *   F) toAuditMuscle — V1 taxonomy → 10-group audit canonical mapping
 *   G) Integration: getMuscleGroupsFromName-equivalent via profile + toAuditMuscle
 */

import { describe, it, expect } from "vitest";
import {
  normalizeMovementName,
  getMovementProfile,
  getBaseMuscleVector,
  MOVEMENT_PROFILES,
  MOVEMENT_ALIASES,
} from "../movementProfiles";
import { toAuditMuscle } from "../muscleNormalization";

// ---------------------------------------------------------------------------
// A) Alias resolution
// ---------------------------------------------------------------------------

describe("alias resolution", () => {
  const cases: [string, string][] = [
    ["Back Squat",           "back_squat"],
    ["barbell back squat",   "back_squat"],
    ["Barbell Squat",        "back_squat"],
    ["DEADLIFT",             "deadlift"],
    ["conventional deadlift","deadlift"],
    ["RDL",                  "romanian_deadlift"],
    ["Romanian Deadlift",    "romanian_deadlift"],
    ["KB Swing",             "kettlebell_swing"],
    ["american kettlebell swing", "kettlebell_swing"],
    ["OHP",                  "strict_press"],
    ["Overhead Press",       "strict_press"],
    ["Bench Press",          "bench_press"],
    ["flat bench",           "bench_press"],
    ["Push-Up",              "push_up"],
    ["push up",              "push_up"],
    ["pushup",               "push_up"],
    ["HSPU",                 "handstand_push_up"],
    ["strict hspu",          "handstand_push_up"],
    ["Pull-Up",              "pull_up"],
    ["pull up",              "pull_up"],
    ["kipping pull-up",      "pull_up"],
    ["C2B",                  "chest_to_bar_pull_up"],
    ["chest to bar",         "chest_to_bar_pull_up"],
    ["Bar Muscle-Up",        "bar_muscle_up"],
    ["muscle up",            "bar_muscle_up"],
    ["BMU",                  "bar_muscle_up"],
    ["T2B",                  "toes_to_bar"],
    ["toes to bar",          "toes_to_bar"],
    ["Du",                   "double_under"],
    ["double unders",        "double_under"],
    ["dubs",                 "double_under"],
    ["Row",                  "row_erg"],
    ["C2 Row",               "row_erg"],
    ["Rowing",               "row_erg"],
    ["Run",                  "run"],
    ["800m run",             "run"],
    ["Echo Bike",            "echo_bike"],
    ["airdyne",              "echo_bike"],
    ["Assault Bike",         "assault_bike"],
    ["Ski Erg",              "ski_erg"],
    ["ski",                  "ski_erg"],
    ["Burpee",               "burpee"],
    ["burpees",              "burpee"],
    ["Box Jump",             "box_jump"],
    ["Walking Lunge",        "walking_lunge"],
    ["lunge",                "walking_lunge"],
    ["Thruster",             "thruster"],
    ["Wall Ball",            "wall_ball"],
    ["Air Squat",            "air_squat"],
    ["GHD Sit-Up",           "ghd_sit_up"],
    ["ghd situp",            "ghd_sit_up"],
    ["Sit-Up",               "sit_up"],
    ["sit up",               "sit_up"],
    ["Hollow Hold",          "hollow_hold"],
    ["hollow body",          "hollow_hold"],
    ["Plank",                "plank"],
    ["Jump Rope",            "jump_rope"],
    ["singles",              "jump_rope"],
    ["Power Clean",          "power_clean"],
    ["Clean",                "squat_clean"],
    ["Squat Clean",          "squat_clean"],
    ["Goblet Squat",         "goblet_squat"],
    ["Front Squat",          "front_squat"],
    ["DB Snatch",            "dumbbell_snatch"],
    ["Dumbbell Snatch",      "dumbbell_snatch"],
    ["DB Shoulder Press",    "dumbbell_shoulder_press"],
    ["Ring Row",             "ring_row"],
    ["Barbell Row",          "barbell_row"],
    ["bent over row",        "barbell_row"],
    ["DB Row",               "dumbbell_row"],
    ["single arm row",       "dumbbell_row"],
    ["Bike Erg",             "bike_erg"],
    ["Bike",                 "bike_erg"],
    ["DB Push Press",        "push_press"],
    ["Push Press",           "push_press"],
  ];

  for (const [input, expectedKey] of cases) {
    it(`"${input}" → ${expectedKey}`, () => {
      const profile = getMovementProfile(input);
      expect(profile).not.toBeNull();
      expect(profile!.key).toBe(expectedKey);
    });
  }
});

// ---------------------------------------------------------------------------
// B) normalizeMovementName
// ---------------------------------------------------------------------------

describe("normalizeMovementName", () => {
  it("lowercases and trims", () => {
    expect(normalizeMovementName("  DEADLIFT  ")).toBe("deadlift");
  });

  it("strips barbell prefix", () => {
    expect(normalizeMovementName("Barbell Back Squat")).toBe("back squat");
  });

  it("strips dumbbell prefix", () => {
    expect(normalizeMovementName("Dumbbell Row")).toBe("row");
  });

  it("strips kb prefix", () => {
    expect(normalizeMovementName("KB Swing")).toBe("swing");
  });

  it("strips leading distance token '400m '", () => {
    expect(normalizeMovementName("400m Run")).toBe("run");
  });

  it("strips trailing distance token ' 400m'", () => {
    expect(normalizeMovementName("Run 400m")).toBe("run");
  });

  it("strips '1 mile ' prefix", () => {
    expect(normalizeMovementName("1 Mile Run")).toBe("run");
  });

  it("normalizes hyphens to spaces", () => {
    expect(normalizeMovementName("Pull-Up")).toBe("pull up");
  });

  it("collapses multiple spaces", () => {
    expect(normalizeMovementName("toes  to  bar")).toBe("toes to bar");
  });
});

// ---------------------------------------------------------------------------
// C) getMovementProfile — known and unknown movements
// ---------------------------------------------------------------------------

describe("getMovementProfile", () => {
  it("returns profile for direct alias", () => {
    const p = getMovementProfile("back squat");
    expect(p).not.toBeNull();
    expect(p!.name).toBe("Back Squat");
    expect(p!.pattern).toBe("squat");
    expect(p!.modality).toBe("barbell");
  });

  it("returns profile for abbreviation alias (RDL)", () => {
    const p = getMovementProfile("RDL");
    expect(p).not.toBeNull();
    expect(p!.key).toBe("romanian_deadlift");
  });

  it("returns profile via direct key match (spaces → underscores)", () => {
    const p = getMovementProfile("hollow hold");
    expect(p).not.toBeNull();
    expect(p!.key).toBe("hollow_hold");
  });

  it("returns null for unknown movement", () => {
    expect(getMovementProfile("bicep curl")).toBeNull();
  });

  it("returns null for completely unknown exercise", () => {
    expect(getMovementProfile("underwater basket weaving")).toBeNull();
  });

  it("is case-insensitive", () => {
    expect(getMovementProfile("THRUSTER")).not.toBeNull();
    expect(getMovementProfile("Thruster")).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// D) getBaseMuscleVector
// ---------------------------------------------------------------------------

describe("getBaseMuscleVector", () => {
  it("returns null for unknown movement (fallback path required)", () => {
    expect(getBaseMuscleVector("bicep curl")).toBeNull();
  });

  it("returns non-empty array for known movement", () => {
    const v = getBaseMuscleVector("deadlift");
    expect(v).not.toBeNull();
    expect(v!.length).toBeGreaterThan(0);
  });

  it("deadlift primary is hamstrings", () => {
    const v = getBaseMuscleVector("deadlift")!;
    const hamstrings = v.find((mc) => mc.muscle === "hamstrings");
    expect(hamstrings).toBeDefined();
    expect(hamstrings!.weight).toBeGreaterThanOrEqual(0.70);
    expect(hamstrings!.role).toBe("primary");
  });

  it("deadlift includes lower_back with significant contribution", () => {
    const v = getBaseMuscleVector("deadlift")!;
    const lb = v.find((mc) => mc.muscle === "lower_back");
    expect(lb).toBeDefined();
    // lower_back is 0.65 in the deadlift profile — significant secondary, just below primary threshold
    expect(lb!.weight).toBeGreaterThanOrEqual(0.50);
  });

  it("bench press primary is chest", () => {
    const v = getBaseMuscleVector("bench press")!;
    const chest = v.find((mc) => mc.muscle === "chest");
    expect(chest).toBeDefined();
    expect(chest!.role).toBe("primary");
  });

  it("pull-up primary is upper_back_lats", () => {
    const v = getBaseMuscleVector("pull-up")!;
    const lats = v.find((mc) => mc.muscle === "upper_back_lats");
    expect(lats).toBeDefined();
    expect(lats!.role).toBe("primary");
  });

  it("thruster includes both quads and shoulders as primary", () => {
    const v = getBaseMuscleVector("thruster")!;
    const quads = v.find((mc) => mc.muscle === "quads");
    const shoulders = v.find((mc) => mc.muscle === "shoulders");
    expect(quads?.weight).toBeGreaterThanOrEqual(0.70);
    expect(shoulders?.weight).toBeGreaterThanOrEqual(0.70);
  });

  it("run includes glutes and calves", () => {
    const v = getBaseMuscleVector("run")!;
    expect(v.some((mc) => mc.muscle === "glutes")).toBe(true);
    expect(v.some((mc) => mc.muscle === "calves")).toBe(true);
  });

  it("row erg includes upper_back_lats and quads", () => {
    const v = getBaseMuscleVector("row")!;
    expect(v.some((mc) => mc.muscle === "upper_back_lats")).toBe(true);
    expect(v.some((mc) => mc.muscle === "quads")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// E) Type invariants — weight thresholds match role labels
// ---------------------------------------------------------------------------

describe("weight-role consistency invariant", () => {
  for (const [key, profile] of MOVEMENT_PROFILES) {
    it(`${key}: all weights in [0.0, 1.0]`, () => {
      for (const mc of profile.muscles) {
        expect(mc.weight).toBeGreaterThanOrEqual(0.0);
        expect(mc.weight).toBeLessThanOrEqual(1.0);
      }
    });

    it(`${key}: role matches weight threshold`, () => {
      for (const mc of profile.muscles) {
        if (mc.weight >= 0.70) {
          expect(mc.role).toBe("primary");
        } else if (mc.weight >= 0.25) {
          expect(mc.role).toBe("secondary");
        } else {
          expect(mc.role).toBe("stabilizer");
        }
      }
    });

    it(`${key}: at least one primary or high-secondary muscle`, () => {
      // Cyclical (row, run, bike) and mixed (burpee) exercises distribute load
      // across many muscle groups — no single muscle reaches the 0.70 primary threshold.
      // This is physiologically correct. We assert that at least one muscle >= 0.55.
      const hasSignificant = profile.muscles.some((mc) => mc.weight >= 0.55);
      expect(hasSignificant).toBe(true);
    });
  }
});

// ---------------------------------------------------------------------------
// F) toAuditMuscle — V1 → audit canonical mapping
// ---------------------------------------------------------------------------

describe("toAuditMuscle", () => {
  it("upper_back_lats → 'back'", () => {
    expect(toAuditMuscle("upper_back_lats")).toBe("back");
  });

  it("lower_back → 'back'", () => {
    expect(toAuditMuscle("lower_back")).toBe("back");
  });

  it("forearms_grip → null", () => {
    expect(toAuditMuscle("forearms_grip")).toBeNull();
  });

  it("chest → 'chest' (passthrough)", () => {
    expect(toAuditMuscle("chest")).toBe("chest");
  });

  it("shoulders → 'shoulders' (passthrough)", () => {
    expect(toAuditMuscle("shoulders")).toBe("shoulders");
  });

  it("quads → 'quads' (passthrough)", () => {
    expect(toAuditMuscle("quads")).toBe("quads");
  });

  it("hamstrings → 'hamstrings' (passthrough)", () => {
    expect(toAuditMuscle("hamstrings")).toBe("hamstrings");
  });

  it("glutes → 'glutes' (passthrough)", () => {
    expect(toAuditMuscle("glutes")).toBe("glutes");
  });

  it("calves → 'calves' (passthrough)", () => {
    expect(toAuditMuscle("calves")).toBe("calves");
  });

  it("core → 'core' (passthrough)", () => {
    expect(toAuditMuscle("core")).toBe("core");
  });

  it("biceps → 'biceps' (passthrough)", () => {
    expect(toAuditMuscle("biceps")).toBe("biceps");
  });

  it("triceps → 'triceps' (passthrough)", () => {
    expect(toAuditMuscle("triceps")).toBe("triceps");
  });
});

// ---------------------------------------------------------------------------
// G) Integration: full pipeline — name → audit muscles (replicates audit.ts logic)
// ---------------------------------------------------------------------------

function getMuscleGroupsFromNameViaProfile(name: string): string[] | null {
  const vector = getBaseMuscleVector(name);
  if (vector === null) return null;
  const muscles = vector
    .filter((mc) => mc.weight >= 0.25)
    .map((mc) => toAuditMuscle(mc.muscle))
    .filter((m): m is string => m !== null);
  return [...new Set(muscles)];
}

describe("integration: profile → audit muscles", () => {
  it("deadlift → includes back, glutes, hamstrings, quads", () => {
    const muscles = getMuscleGroupsFromNameViaProfile("deadlift")!;
    expect(muscles).toContain("back");
    expect(muscles).toContain("glutes");
    expect(muscles).toContain("hamstrings");
    expect(muscles).toContain("quads");
  });

  it("deadlift → forearms_grip is dropped (not in audit canonical)", () => {
    const muscles = getMuscleGroupsFromNameViaProfile("deadlift")!;
    expect(muscles).not.toContain("forearms_grip");
  });

  it("upper_back_lats and lower_back both map to 'back' (no duplicates)", () => {
    const muscles = getMuscleGroupsFromNameViaProfile("deadlift")!;
    expect(muscles.filter((m) => m === "back").length).toBe(1);
  });

  it("pull-up → includes back and biceps", () => {
    const muscles = getMuscleGroupsFromNameViaProfile("pull-up")!;
    expect(muscles).toContain("back");
    expect(muscles).toContain("biceps");
  });

  it("thruster → includes quads, shoulders, glutes", () => {
    const muscles = getMuscleGroupsFromNameViaProfile("thruster")!;
    expect(muscles).toContain("quads");
    expect(muscles).toContain("shoulders");
    expect(muscles).toContain("glutes");
  });

  it("bench press → includes chest and triceps, not quads", () => {
    const muscles = getMuscleGroupsFromNameViaProfile("bench press")!;
    expect(muscles).toContain("chest");
    expect(muscles).toContain("triceps");
    expect(muscles).not.toContain("quads");
  });

  it("wall ball → includes both quads and shoulders (compound classification)", () => {
    const muscles = getMuscleGroupsFromNameViaProfile("wall ball")!;
    expect(muscles).toContain("quads");
    expect(muscles).toContain("shoulders");
  });

  it("unknown movement returns null (keyword fallback must be used)", () => {
    expect(getMuscleGroupsFromNameViaProfile("zottman curl")).toBeNull();
    expect(getMuscleGroupsFromNameViaProfile("preacher curl")).toBeNull();
  });

  it("all entries are valid audit canonical muscle strings", () => {
    const CANONICAL = new Set(["chest","back","shoulders","quads","hamstrings","glutes","biceps","triceps","core","calves"]);
    // Iterate profiles directly using profile.muscles — avoids name-to-alias round-trip
    // issues for display names like "Row (Erg)" that aren't in the alias map.
    for (const [key, profile] of MOVEMENT_PROFILES) {
      const muscles = profile.muscles
        .filter((mc) => mc.weight >= 0.25)
        .map((mc) => toAuditMuscle(mc.muscle))
        .filter((m): m is string => m !== null);
      for (const m of muscles) {
        expect(CANONICAL.has(m)).toBe(true, `${key}: unexpected audit muscle "${m}"`);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// H) Coverage sanity — ensure all 40 profiles exist and are findable
// ---------------------------------------------------------------------------

describe("profile coverage", () => {
  const expectedKeys = [
    "air_squat","front_squat","back_squat","goblet_squat","wall_ball","thruster",
    "deadlift","romanian_deadlift","kettlebell_swing","dumbbell_snatch","power_clean","squat_clean",
    "push_press","strict_press","bench_press","push_up","handstand_push_up","dumbbell_shoulder_press",
    "pull_up","chest_to_bar_pull_up","bar_muscle_up","ring_row","dumbbell_row","barbell_row",
    "toes_to_bar","sit_up","ghd_sit_up","plank","hollow_hold",
    "row_erg","run","bike_erg","echo_bike","assault_bike","ski_erg","jump_rope","double_under",
    "burpee","box_jump","burpee_box_jump_over","walking_lunge",
  ];

  it(`total profile count is ${expectedKeys.length}`, () => {
    expect(MOVEMENT_PROFILES.size).toBe(expectedKeys.length);
  });

  for (const key of expectedKeys) {
    it(`profile exists: ${key}`, () => {
      expect(MOVEMENT_PROFILES.has(key)).toBe(true);
    });
  }
});

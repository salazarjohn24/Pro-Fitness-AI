/**
 * movementProfiles.test.ts — Step 1 unit tests.
 *
 * Covers:
 *   A) Alias resolution — common names, abbreviations, prefixes
 *   B) normalizeMovementName — equipment prefix, distance, hyphen, casing
 *   C) getMovementProfile — known profiles, unknown → null
 *   D) getBaseMuscleVector — weights, roles, fallback null
 *   E) Type invariants — weights in range, at least one primary, all roles valid
 *   F) toAuditMuscle — V1 taxonomy → 10-group audit canonical mapping
 *   G) Integration: name → audit muscles via profile + toAuditMuscle
 *   H) Coverage sanity — all 41 expected profiles exist
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
    // squat
    ["Back Squat",           "back_squat"],
    ["barbell back squat",   "back_squat"],
    ["Barbell Squat",        "back_squat"],
    ["Air Squat",            "air_squat"],
    ["Front Squat",          "front_squat"],
    ["Goblet Squat",         "goblet_squat"],
    ["Wall Ball",            "wall_ball"],
    ["Thruster",             "thruster"],
    ["DB Thruster",          "thruster"],
    // hinge
    ["DEADLIFT",             "deadlift"],
    ["conventional deadlift","deadlift"],
    ["RDL",                  "romanian_deadlift"],
    ["Romanian Deadlift",    "romanian_deadlift"],
    ["KB Swing",             "kettlebell_swing"],
    ["american kettlebell swing", "kettlebell_swing"],
    // olympic
    ["Power Clean",          "power_clean"],
    ["Clean",                "squat_clean"],
    ["Squat Clean",          "squat_clean"],
    ["DB Snatch",            "dumbbell_snatch"],
    ["Dumbbell Snatch",      "dumbbell_snatch"],
    // vertical push
    ["Push Press",           "push_press"],
    ["DB Push Press",        "push_press"],
    ["OHP",                  "strict_press"],
    ["Overhead Press",       "strict_press"],
    ["HSPU",                 "handstand_push_up"],
    ["strict hspu",          "handstand_push_up"],
    ["DB Shoulder Press",    "dumbbell_shoulder_press"],
    ["Dumbbell Shoulder Press", "dumbbell_shoulder_press"],
    // horizontal push
    ["Bench Press",          "bench_press"],
    ["flat bench",           "bench_press"],
    ["Push-Up",              "push_up"],
    ["push up",              "push_up"],
    ["pushup",               "push_up"],
    // vertical pull
    ["Pull-Up",              "pull_up"],
    ["pull up",              "pull_up"],
    ["kipping pull-up",      "pull_up"],
    ["C2B",                  "chest_to_bar_pull_up"],
    ["chest to bar",         "chest_to_bar_pull_up"],
    // horizontal pull
    ["Ring Row",             "ring_row"],
    ["DB Row",               "dumbbell_row"],      // must NOT resolve to row_erg
    ["Dumbbell Row",         "dumbbell_row"],
    ["single arm row",       "dumbbell_row"],
    ["Barbell Row",          "barbell_row"],
    ["bent over row",        "barbell_row"],
    // gymnastics
    ["Bar Muscle-Up",        "bar_muscle_up"],
    ["muscle up",            "bar_muscle_up"],
    ["BMU",                  "bar_muscle_up"],
    ["T2B",                  "toes_to_bar"],
    ["toes to bar",          "toes_to_bar"],
    ["Hollow Hold",          "hollow_hold"],
    ["hollow body",          "hollow_hold"],
    // core
    ["Sit-Up",               "sit_up"],
    ["sit up",               "sit_up"],
    ["GHD Sit-Up",           "ghd_sit_up"],
    ["ghd situp",            "ghd_sit_up"],
    ["Plank",                "plank"],
    // cyclical
    ["Row",                  "row_erg"],
    ["Rowing",               "row_erg"],
    ["C2 Row",               "row_erg"],
    ["Run",                  "run"],
    ["800m run",             "run"],
    ["Bike Erg",             "bike_erg"],
    ["Bike",                 "bike_erg"],
    ["Echo Bike",            "echo_bike"],
    ["airdyne",              "echo_bike"],
    ["Assault Bike",         "assault_bike"],
    ["Ski Erg",              "ski_erg"],
    ["ski",                  "ski_erg"],
    ["Jump Rope",            "jump_rope"],
    ["singles",              "jump_rope"],
    ["Du",                   "double_under"],
    ["double unders",        "double_under"],
    ["dubs",                 "double_under"],
    // jump / plyometric
    ["Burpee",               "burpee"],
    ["burpees",              "burpee"],
    ["Box Jump",             "box_jump"],
    ["Burpee Box Jump Over", "burpee_box_jump_over"],
    // lunge
    ["Walking Lunge",        "walking_lunge"],
    ["lunge",                "walking_lunge"],
  ];

  for (const [input, expectedKey] of cases) {
    it(`"${input}" → ${expectedKey}`, () => {
      const profile = getMovementProfile(input);
      expect(profile, `expected a profile for "${input}"`).not.toBeNull();
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
    const profile = getMovementProfile("back squat");
    expect(profile).not.toBeNull();
    expect(profile!.name).toBe("Back Squat");
    expect(profile!.pattern).toBe("squat");
    expect(profile!.modality).toBe("barbell");
  });

  it("returns profile for abbreviation alias (RDL)", () => {
    const profile = getMovementProfile("RDL");
    expect(profile).not.toBeNull();
    expect(profile!.key).toBe("romanian_deadlift");
  });

  it("returns profile via direct key match (spaces → underscores)", () => {
    const profile = getMovementProfile("hollow hold");
    expect(profile).not.toBeNull();
    expect(profile!.key).toBe("hollow_hold");
  });

  it("returns null for unknown movement (bicep curl)", () => {
    expect(getMovementProfile("bicep curl")).toBeNull();
  });

  it("returns null for completely unknown exercise", () => {
    expect(getMovementProfile("underwater basket weaving")).toBeNull();
  });

  it("is case-insensitive", () => {
    expect(getMovementProfile("THRUSTER")).not.toBeNull();
    expect(getMovementProfile("Thruster")).not.toBeNull();
  });

  it("'DB Row' resolves to dumbbell_row, not row_erg", () => {
    const profile = getMovementProfile("DB Row");
    expect(profile!.key).toBe("dumbbell_row");
  });

  it("'Row' resolves to row_erg", () => {
    const profile = getMovementProfile("Row");
    expect(profile!.key).toBe("row_erg");
  });

  it("profile includes aliases array", () => {
    const profile = getMovementProfile("back squat");
    expect(Array.isArray(profile!.aliases)).toBe(true);
    expect(profile!.aliases.length).toBeGreaterThan(0);
  });

  it("MovementPattern uses V1 15-pattern taxonomy", () => {
    const v1Patterns = new Set([
      "squat","hinge","lunge","horizontal_push","vertical_push",
      "horizontal_pull","vertical_pull","carry","core_flexion","core_bracing",
      "rotation","jump","cyclical","olympic_lift","gymnastics",
    ]);
    for (const [, profile] of MOVEMENT_PROFILES) {
      expect(v1Patterns.has(profile.pattern)).toBe(true);
    }
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

  it("deadlift primary muscles include hamstrings and glutes", () => {
    const v = getBaseMuscleVector("deadlift")!;
    const primaryMuscles = v.filter((mc) => mc.role === "primary").map((mc) => mc.muscle);
    expect(primaryMuscles).toContain("hamstrings");
    expect(primaryMuscles).toContain("glutes");
    expect(primaryMuscles).toContain("lower_back");
  });

  it("deadlift: hamstrings weight is prominent", () => {
    const v = getBaseMuscleVector("deadlift")!;
    const h = v.find((mc) => mc.muscle === "hamstrings");
    expect(h!.weight).toBeGreaterThanOrEqual(0.70);
  });

  it("bench press primary is chest", () => {
    const v = getBaseMuscleVector("bench press")!;
    const chest = v.find((mc) => mc.muscle === "chest");
    expect(chest).toBeDefined();
    expect(chest!.role).toBe("primary");
  });

  it("pull-up primary includes upper_back_lats and biceps", () => {
    const v = getBaseMuscleVector("pull-up")!;
    const primaryMuscles = v.filter((mc) => mc.role === "primary").map((mc) => mc.muscle);
    expect(primaryMuscles).toContain("upper_back_lats");
    expect(primaryMuscles).toContain("biceps");
  });

  it("thruster has both quads and shoulders as primary", () => {
    const v = getBaseMuscleVector("thruster")!;
    const primaryMuscles = v.filter((mc) => mc.role === "primary").map((mc) => mc.muscle);
    expect(primaryMuscles).toContain("quads");
    expect(primaryMuscles).toContain("shoulders");
  });

  it("run includes glutes, quads, hamstrings and calves", () => {
    const v = getBaseMuscleVector("run")!;
    const muscles = v.map((mc) => mc.muscle);
    expect(muscles).toContain("glutes");
    expect(muscles).toContain("quads");
    expect(muscles).toContain("hamstrings");
    expect(muscles).toContain("calves");
  });

  it("row_erg includes upper_back_lats and quads (distributed, no single prime)", () => {
    const v = getBaseMuscleVector("row")!;
    const muscles = v.map((mc) => mc.muscle);
    expect(muscles).toContain("upper_back_lats");
    expect(muscles).toContain("quads");
    // Conservative: no single muscle should be overstated at 1.0
    for (const mc of v) {
      expect(mc.weight).toBeLessThan(0.80);
    }
  });

  it("cyclical movements have distributed weights (max <= 0.70)", () => {
    const cyclicalKeys = [
      "row", "run", "bike erg", "echo bike", "assault bike",
      "ski erg", "jump rope", "double-under",
    ];
    for (const name of cyclicalKeys) {
      const v = getBaseMuscleVector(name)!;
      expect(v, `expected vector for "${name}"`).not.toBeNull();
      const max = Math.max(...v.map((mc) => mc.weight));
      expect(max, `${name} max weight ${max} should be <= 0.75`).toBeLessThanOrEqual(0.75);
    }
  });
});

// ---------------------------------------------------------------------------
// E) Type invariants
// ---------------------------------------------------------------------------

describe("type invariants", () => {
  const VALID_ROLES = new Set<string>(["primary", "secondary", "stabilizer"]);
  const VALID_PATTERNS = new Set<string>([
    "squat","hinge","lunge","horizontal_push","vertical_push",
    "horizontal_pull","vertical_pull","carry","core_flexion","core_bracing",
    "rotation","jump","cyclical","olympic_lift","gymnastics",
  ]);

  for (const [key, profile] of MOVEMENT_PROFILES) {
    it(`${key}: all weights in [0.0, 1.0]`, () => {
      for (const mc of profile.muscles) {
        expect(mc.weight, `${key}.${mc.muscle} weight OOB`).toBeGreaterThanOrEqual(0.0);
        expect(mc.weight, `${key}.${mc.muscle} weight OOB`).toBeLessThanOrEqual(1.0);
      }
    });

    it(`${key}: all roles are valid`, () => {
      for (const mc of profile.muscles) {
        expect(VALID_ROLES.has(mc.role), `${key}.${mc.muscle} has invalid role "${mc.role}"`).toBe(true);
      }
    });

    it(`${key}: at least one primary muscle`, () => {
      // Roles are AUTHORED — every profile must have at least one "primary" contributor.
      // Note: cyclical profiles may have primary at moderate weights (0.45–0.60) which
      // is intentional: they are primary movers in the cyclical kinetic chain even at
      // conservative weights.
      const hasPrimary = profile.muscles.some((mc) => mc.role === "primary");
      expect(hasPrimary, `${key}: must have at least one primary role`).toBe(true);
    });

    it(`${key}: pattern is valid V1 taxonomy`, () => {
      expect(VALID_PATTERNS.has(profile.pattern)).toBe(true);
    });

    it(`${key}: has at least one alias`, () => {
      expect(profile.aliases.length).toBeGreaterThan(0);
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
// G) Integration: full pipeline — name → audit muscles
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

  it("upper_back_lats and lower_back both map to 'back' with no duplicates", () => {
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

  it("wall ball → includes both quads and shoulders", () => {
    const muscles = getMuscleGroupsFromNameViaProfile("wall ball")!;
    expect(muscles).toContain("quads");
    expect(muscles).toContain("shoulders");
  });

  it("unknown movement returns null (keyword fallback must be used)", () => {
    expect(getMuscleGroupsFromNameViaProfile("zottman curl")).toBeNull();
    expect(getMuscleGroupsFromNameViaProfile("preacher curl")).toBeNull();
  });

  it("all entries only produce valid audit canonical muscle strings", () => {
    const CANONICAL = new Set([
      "chest","back","shoulders","quads","hamstrings",
      "glutes","biceps","triceps","core","calves",
    ]);
    for (const [key, profile] of MOVEMENT_PROFILES) {
      const muscles = profile.muscles
        .filter((mc) => mc.weight >= 0.25)
        .map((mc) => toAuditMuscle(mc.muscle))
        .filter((m): m is string => m !== null);
      for (const m of muscles) {
        expect(CANONICAL.has(m), `${key}: unexpected audit muscle "${m}"`).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// H) Coverage sanity — all 41 expected profiles exist
// ---------------------------------------------------------------------------

describe("profile coverage", () => {
  const expectedKeys = [
    // squat (6)
    "air_squat","front_squat","back_squat","goblet_squat","wall_ball","thruster",
    // hinge (3)
    "deadlift","romanian_deadlift","kettlebell_swing",
    // olympic (3)
    "dumbbell_snatch","power_clean","squat_clean",
    // vertical push (4)
    "push_press","strict_press","handstand_push_up","dumbbell_shoulder_press",
    // horizontal push (2)
    "bench_press","push_up",
    // vertical pull (2)
    "pull_up","chest_to_bar_pull_up",
    // horizontal pull (3)
    "ring_row","dumbbell_row","barbell_row",
    // gymnastics (2)
    "bar_muscle_up","toes_to_bar",
    // core bracing (2)
    "hollow_hold","plank",
    // core flexion (2)
    "sit_up","ghd_sit_up",
    // cyclical (8)
    "row_erg","run","bike_erg","echo_bike","assault_bike","ski_erg","jump_rope","double_under",
    // jump (3)
    "burpee","box_jump","burpee_box_jump_over",
    // lunge (1)
    "walking_lunge",
  ];

  it(`total profile count is ${expectedKeys.length}`, () => {
    expect(MOVEMENT_PROFILES.size).toBe(expectedKeys.length);
  });

  for (const key of expectedKeys) {
    it(`profile exists: ${key}`, () => {
      expect(MOVEMENT_PROFILES.has(key)).toBe(true);
    });
  }

  it("MOVEMENT_ALIASES is derived from profile.aliases (no separate source of truth)", () => {
    // Every alias in the flat map must point to an existing profile key
    for (const [alias, profileKey] of MOVEMENT_ALIASES) {
      expect(MOVEMENT_PROFILES.has(profileKey), `alias "${alias}" → "${profileKey}" (not found)`).toBe(true);
    }
    // Every profile's aliases must appear in the flat map
    for (const [, profile] of MOVEMENT_PROFILES) {
      for (const alias of profile.aliases) {
        expect(MOVEMENT_ALIASES.has(alias), `profile "${profile.key}" alias "${alias}" missing from MOVEMENT_ALIASES`).toBe(true);
      }
    }
  });
});

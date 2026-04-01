/**
 * movementProfiles.test.ts — Step 1 hardened unit tests.
 *
 * Covers:
 *   A) Alias resolution — common names, abbreviations, prefixes
 *   B) normalizeMovementName — equipment prefix, distance/cal token, hyphen, casing
 *   C) getMovementProfile — known profiles, unknown → null
 *   D) getBaseMuscleVector — weights, roles, fallback null
 *   E) Type invariants — weights in range, at least one primary, all roles valid
 *   F) toAuditMuscle — V1 taxonomy → 10-group audit canonical mapping
 *   G) Integration: name → audit muscles via profile + toAuditMuscle
 *   H) Coverage sanity — all 50 expected profiles exist
 *   I) Real WOD fixtures — workout-level alias/muscle sanity
 *   J) Alias stress — plurals, abbreviations, shorthand, equipment collision
 *   K) Unknown movement fallback — safe degradation
 *   L) Conservative cyclical enforcement
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
    ["Back Squat",                "back_squat"],
    ["barbell back squat",        "back_squat"],
    ["Barbell Squat",             "back_squat"],
    ["Air Squat",                 "air_squat"],
    ["Front Squat",               "front_squat"],
    ["Goblet Squat",              "goblet_squat"],
    ["OHS",                       "overhead_squat"],
    ["Overhead Squat",            "overhead_squat"],
    ["Wall Ball",                 "wall_ball"],
    ["Thruster",                  "thruster"],
    ["DB Thruster",               "thruster"],
    // hinge
    ["DEADLIFT",                  "deadlift"],
    ["conventional deadlift",     "deadlift"],
    ["RDL",                       "romanian_deadlift"],
    ["Romanian Deadlift",         "romanian_deadlift"],
    ["KB Swing",                  "kettlebell_swing"],
    ["american kettlebell swing", "kettlebell_swing"],
    // olympic
    ["Power Clean",               "power_clean"],
    ["Hang Power Clean",          "hang_power_clean"],
    ["Clean",                     "squat_clean"],
    ["Squat Clean",               "squat_clean"],
    ["Hang Clean",                "hang_squat_clean"],
    ["Hang Squat Clean",          "hang_squat_clean"],
    ["DB Snatch",                 "dumbbell_snatch"],
    ["Dumbbell Snatch",           "dumbbell_snatch"],
    ["KB Snatch",                 "kettlebell_snatch"],
    ["Kettlebell Snatch",         "kettlebell_snatch"],
    // vertical push
    ["Push Press",                "push_press"],
    ["Push Jerk",                 "push_jerk"],
    ["Split Jerk",                "split_jerk"],
    ["jerk",                      "split_jerk"],
    ["DB Push Press",             "push_press"],
    ["OHP",                       "strict_press"],
    ["Overhead Press",            "strict_press"],
    ["HSPU",                      "handstand_push_up"],
    ["strict hspu",               "handstand_push_up"],
    ["DB Shoulder Press",         "dumbbell_shoulder_press"],
    ["Dumbbell Shoulder Press",   "dumbbell_shoulder_press"],
    // horizontal push
    ["Bench Press",               "bench_press"],
    ["flat bench",                "bench_press"],
    ["Push-Up",                   "push_up"],
    ["push up",                   "push_up"],
    ["pushup",                    "push_up"],
    ["HRPU",                      "hand_release_push_up"],
    ["hand release push-up",      "hand_release_push_up"],
    // vertical pull
    ["Pull-Up",                   "pull_up"],
    ["pull up",                   "pull_up"],
    ["kipping pull-up",           "pull_up"],
    ["C2B",                       "chest_to_bar_pull_up"],
    ["chest to bar",              "chest_to_bar_pull_up"],
    // horizontal pull
    ["Ring Row",                  "ring_row"],
    ["DB Row",                    "dumbbell_row"],      // must NOT resolve to row_erg
    ["Dumbbell Row",              "dumbbell_row"],
    ["single arm row",            "dumbbell_row"],
    ["Barbell Row",               "barbell_row"],
    ["bent over row",             "barbell_row"],
    // gymnastics
    ["Bar Muscle-Up",             "bar_muscle_up"],
    ["muscle up",                 "bar_muscle_up"],
    ["BMU",                       "bar_muscle_up"],
    ["T2B",                       "toes_to_bar"],
    ["TTB",                       "toes_to_bar"],
    ["toes to bar",               "toes_to_bar"],
    ["Hollow Hold",               "hollow_hold"],
    ["hollow body",               "hollow_hold"],
    // core
    ["Sit-Up",                    "sit_up"],
    ["sit up",                    "sit_up"],
    ["GHD Sit-Up",                "ghd_sit_up"],
    ["ghd situp",                 "ghd_sit_up"],
    ["v-up",                      "v_up"],
    ["v up",                      "v_up"],
    ["Plank",                     "plank"],
    // cyclical
    ["Row",                       "row_erg"],
    ["Rowing",                    "row_erg"],
    ["C2 Row",                    "row_erg"],
    ["calorie row",               "row_erg"],
    ["cal row",                   "row_erg"],
    ["Run",                       "run"],
    ["800m run",                  "run"],
    ["Bike Erg",                  "bike_erg"],
    ["Bike",                      "bike_erg"],
    ["calorie bike",              "bike_erg"],
    ["cal bike",                  "bike_erg"],
    ["Echo Bike",                 "echo_bike"],
    ["echo",                      "echo_bike"],
    ["airdyne",                   "echo_bike"],
    ["Assault Bike",              "assault_bike"],
    ["Ski Erg",                   "ski_erg"],
    ["ski",                       "ski_erg"],
    ["Jump Rope",                 "jump_rope"],
    ["singles",                   "jump_rope"],
    ["Du",                        "double_under"],
    ["double unders",             "double_under"],
    ["dubs",                      "double_under"],
    // jump / plyometric
    ["Burpee",                    "burpee"],
    ["burpees",                   "burpee"],
    ["Box Jump",                  "box_jump"],
    ["Burpee Box Jump Over",      "burpee_box_jump_over"],
    // lunge
    ["Walking Lunge",             "walking_lunge"],
    ["lunge",                     "walking_lunge"],
    ["Front Rack Lunge",          "front_rack_lunge"],
    ["front rack lunges",         "front_rack_lunge"],
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

  it("strips leading '200m '", () => {
    expect(normalizeMovementName("200m Run")).toBe("run");
  });

  it("strips leading '500m '", () => {
    expect(normalizeMovementName("500m Row")).toBe("row");
  });

  it("strips leading '1 mile '", () => {
    expect(normalizeMovementName("1 Mile Run")).toBe("run");
  });

  it("strips leading calorie token '20 cal '", () => {
    expect(normalizeMovementName("20 Cal Bike")).toBe("bike");
  });

  it("strips leading calorie token '20 calorie '", () => {
    expect(normalizeMovementName("20 Calorie Row")).toBe("row");
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
    expect(getMovementProfile("DB Row")!.key).toBe("dumbbell_row");
  });

  it("'Row' resolves to row_erg", () => {
    expect(getMovementProfile("Row")!.key).toBe("row_erg");
  });

  it("'Dumbbell Row' resolves to dumbbell_row, not row_erg", () => {
    expect(getMovementProfile("Dumbbell Row")!.key).toBe("dumbbell_row");
  });

  it("'Barbell Row' resolves to barbell_row, not row_erg", () => {
    expect(getMovementProfile("Barbell Row")!.key).toBe("barbell_row");
  });

  it("profile includes aliases array", () => {
    const profile = getMovementProfile("back squat");
    expect(Array.isArray(profile!.aliases)).toBe(true);
    expect(profile!.aliases.length).toBeGreaterThan(0);
  });

  it("all profiles use V1 15-pattern taxonomy", () => {
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

  it("deadlift primary muscles include hamstrings, glutes, lower_back", () => {
    const v = getBaseMuscleVector("deadlift")!;
    const primaries = v.filter((mc) => mc.role === "primary").map((mc) => mc.muscle);
    expect(primaries).toContain("hamstrings");
    expect(primaries).toContain("glutes");
    expect(primaries).toContain("lower_back");
  });

  it("bench press primary is chest", () => {
    const chest = getBaseMuscleVector("bench press")!.find((mc) => mc.muscle === "chest");
    expect(chest).toBeDefined();
    expect(chest!.role).toBe("primary");
  });

  it("pull-up primary includes upper_back_lats and biceps", () => {
    const primaries = getBaseMuscleVector("pull-up")!
      .filter((mc) => mc.role === "primary").map((mc) => mc.muscle);
    expect(primaries).toContain("upper_back_lats");
    expect(primaries).toContain("biceps");
  });

  it("thruster has quads, shoulders, and glutes as primary", () => {
    const primaries = getBaseMuscleVector("thruster")!
      .filter((mc) => mc.role === "primary").map((mc) => mc.muscle);
    expect(primaries).toContain("quads");
    expect(primaries).toContain("shoulders");
    expect(primaries).toContain("glutes");
  });

  it("overhead squat includes shoulders and core (overhead lockout demands)", () => {
    const v = getBaseMuscleVector("overhead squat")!;
    const muscles = v.map((mc) => mc.muscle);
    expect(muscles).toContain("shoulders");
    expect(muscles).toContain("core");
    expect(muscles).toContain("upper_back_lats");
  });

  it("push jerk has leg drive (quads secondary)", () => {
    const v = getBaseMuscleVector("push jerk")!;
    const quads = v.find((mc) => mc.muscle === "quads");
    expect(quads).toBeDefined();
    expect(quads!.role).toBe("secondary");
  });

  it("hand release push-up has upper_back_lats secondary (retraction at bottom)", () => {
    const v = getBaseMuscleVector("hrpu")!;
    const back = v.find((mc) => mc.muscle === "upper_back_lats");
    expect(back).toBeDefined();
    expect(back!.role).toBe("secondary");
  });

  it("front rack lunge has upper_back_lats secondary (rack position demand)", () => {
    const v = getBaseMuscleVector("front rack lunge")!;
    const back = v.find((mc) => mc.muscle === "upper_back_lats");
    expect(back).toBeDefined();
    expect(back!.role).toBe("secondary");
  });

  it("run includes glutes, quads, hamstrings and calves", () => {
    const muscles = getBaseMuscleVector("run")!.map((mc) => mc.muscle);
    expect(muscles).toContain("glutes");
    expect(muscles).toContain("quads");
    expect(muscles).toContain("hamstrings");
    expect(muscles).toContain("calves");
  });

  it("row_erg is distributed (no single muscle above 0.55)", () => {
    const v = getBaseMuscleVector("row")!;
    for (const mc of v) expect(mc.weight).toBeLessThanOrEqual(0.55);
  });

  it("v-up primary is core", () => {
    const v = getBaseMuscleVector("v-up")!;
    const core = v.find((mc) => mc.muscle === "core");
    expect(core).toBeDefined();
    expect(core!.role).toBe("primary");
  });
});

// ---------------------------------------------------------------------------
// E) Type invariants (per-profile, generated)
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
        expect(mc.weight).toBeGreaterThanOrEqual(0.0);
        expect(mc.weight).toBeLessThanOrEqual(1.0);
      }
    });

    it(`${key}: all roles are valid`, () => {
      for (const mc of profile.muscles) {
        expect(VALID_ROLES.has(mc.role)).toBe(true);
      }
    });

    it(`${key}: at least one primary muscle (role is authored)`, () => {
      expect(profile.muscles.some((mc) => mc.role === "primary")).toBe(true);
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
  const mappings: [string, string | null][] = [
    ["upper_back_lats", "back"],
    ["lower_back",      "back"],
    ["forearms_grip",   null],
    ["chest",           "chest"],
    ["shoulders",       "shoulders"],
    ["quads",           "quads"],
    ["hamstrings",      "hamstrings"],
    ["glutes",          "glutes"],
    ["calves",          "calves"],
    ["core",            "core"],
    ["biceps",          "biceps"],
    ["triceps",         "triceps"],
  ];

  for (const [v1, expected] of mappings) {
    it(`${v1} → ${expected ?? "null"}`, () => {
      expect(toAuditMuscle(v1 as any)).toBe(expected);
    });
  }
});

// ---------------------------------------------------------------------------
// G) Integration: full pipeline — name → audit muscles
// ---------------------------------------------------------------------------

function auditMusclesFromName(name: string): string[] | null {
  const vector = getBaseMuscleVector(name);
  if (vector === null) return null;
  return [
    ...new Set(
      vector
        .filter((mc) => mc.weight >= 0.25)
        .map((mc) => toAuditMuscle(mc.muscle))
        .filter((m): m is string => m !== null)
    ),
  ];
}

describe("integration: profile → audit muscles", () => {
  it("deadlift → back, glutes, hamstrings, quads", () => {
    const muscles = auditMusclesFromName("deadlift")!;
    expect(muscles).toContain("back");
    expect(muscles).toContain("glutes");
    expect(muscles).toContain("hamstrings");
    expect(muscles).toContain("quads");
  });

  it("deadlift → forearms_grip silently dropped (not in audit canonical)", () => {
    expect(auditMusclesFromName("deadlift")).not.toContain("forearms_grip");
  });

  it("upper_back_lats + lower_back both map to 'back' — no duplicate", () => {
    const muscles = auditMusclesFromName("deadlift")!;
    expect(muscles.filter((m) => m === "back").length).toBe(1);
  });

  it("pull-up → back and biceps", () => {
    const muscles = auditMusclesFromName("pull-up")!;
    expect(muscles).toContain("back");
    expect(muscles).toContain("biceps");
  });

  it("thruster → quads, shoulders, glutes", () => {
    const muscles = auditMusclesFromName("thruster")!;
    expect(muscles).toContain("quads");
    expect(muscles).toContain("shoulders");
    expect(muscles).toContain("glutes");
  });

  it("bench press → chest and triceps, not quads", () => {
    const muscles = auditMusclesFromName("bench press")!;
    expect(muscles).toContain("chest");
    expect(muscles).toContain("triceps");
    expect(muscles).not.toContain("quads");
  });

  it("wall ball → quads and shoulders", () => {
    const muscles = auditMusclesFromName("wall ball")!;
    expect(muscles).toContain("quads");
    expect(muscles).toContain("shoulders");
  });

  it("unknown movement returns null (keyword fallback must be used)", () => {
    expect(auditMusclesFromName("zottman curl")).toBeNull();
    expect(auditMusclesFromName("preacher curl")).toBeNull();
  });

  it("all profiles produce only valid audit canonical muscle strings", () => {
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
// H) Coverage sanity — all 50 expected profiles exist
// ---------------------------------------------------------------------------

describe("profile coverage", () => {
  const expectedKeys = [
    // squat (7)
    "air_squat","front_squat","back_squat","overhead_squat",
    "goblet_squat","wall_ball","thruster",
    // hinge (3)
    "deadlift","romanian_deadlift","kettlebell_swing",
    // olympic (7)
    "dumbbell_snatch","kettlebell_snatch",
    "power_clean","hang_power_clean",
    "squat_clean","hang_squat_clean",
    // vertical push (6)
    "push_press","push_jerk","split_jerk",
    "strict_press","handstand_push_up","dumbbell_shoulder_press",
    // horizontal push (3)
    "bench_press","push_up","hand_release_push_up",
    // vertical pull (2)
    "pull_up","chest_to_bar_pull_up",
    // horizontal pull (3)
    "ring_row","dumbbell_row","barbell_row",
    // gymnastics (3)
    "bar_muscle_up","toes_to_bar","hollow_hold",
    // core flexion (3)
    "sit_up","ghd_sit_up","v_up",
    // core bracing (1)
    "plank",
    // cyclical (8)
    "row_erg","run","bike_erg","echo_bike",
    "assault_bike","ski_erg","jump_rope","double_under",
    // jump (3)
    "burpee","box_jump","burpee_box_jump_over",
    // lunge (2)
    "walking_lunge","front_rack_lunge",
  ];

  it(`total profile count is ${expectedKeys.length}`, () => {
    expect(MOVEMENT_PROFILES.size).toBe(expectedKeys.length);
  });

  for (const key of expectedKeys) {
    it(`profile exists: ${key}`, () => {
      expect(MOVEMENT_PROFILES.has(key)).toBe(true);
    });
  }

  it("MOVEMENT_ALIASES is derived from profile.aliases (single source of truth)", () => {
    // Every alias in the flat map must point to an existing profile key
    for (const [alias, profileKey] of MOVEMENT_ALIASES) {
      expect(MOVEMENT_PROFILES.has(profileKey), `alias "${alias}" → "${profileKey}" (not found)`).toBe(true);
    }
    // Every profile's aliases must appear in the flat map
    for (const [, profile] of MOVEMENT_PROFILES) {
      for (const alias of profile.aliases) {
        expect(MOVEMENT_ALIASES.has(alias), `profile "${profile.key}" alias "${alias}" missing`).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// I) Real WOD fixtures — workout-level alias and muscle sanity
// ---------------------------------------------------------------------------

describe("WOD fixture: Fran (21-15-9 thrusters and pull-ups)", () => {
  it("'thrusters' resolves", () => {
    expect(getMovementProfile("thrusters")).not.toBeNull();
    expect(getMovementProfile("thrusters")!.key).toBe("thruster");
  });

  it("'pull-ups' resolves", () => {
    expect(getMovementProfile("pull-ups")).not.toBeNull();
    expect(getMovementProfile("pull-ups")!.key).toBe("pull_up");
  });

  it("thrusters produce quads + shoulders + glutes in audit output", () => {
    const muscles = auditMusclesFromName("thrusters")!;
    expect(muscles).toContain("quads");
    expect(muscles).toContain("shoulders");
    expect(muscles).toContain("glutes");
  });

  it("pull-ups produce back + biceps in audit output", () => {
    const muscles = auditMusclesFromName("pull-ups")!;
    expect(muscles).toContain("back");
    expect(muscles).toContain("biceps");
  });
});

describe("WOD fixture: 5 rounds — wall balls, toes-to-bar, 200m run", () => {
  it("'wall balls' (plural) resolves to wall_ball", () => {
    expect(getMovementProfile("wall balls")!.key).toBe("wall_ball");
  });

  it("'toes-to-bar' resolves", () => {
    expect(getMovementProfile("toes-to-bar")!.key).toBe("toes_to_bar");
  });

  it("'200m run' resolves via distance-strip normalizer", () => {
    expect(getMovementProfile("200m run")!.key).toBe("run");
  });

  it("wall balls produce quads + shoulders", () => {
    const m = auditMusclesFromName("wall balls")!;
    expect(m).toContain("quads");
    expect(m).toContain("shoulders");
  });

  it("toes-to-bar produces core", () => {
    const m = auditMusclesFromName("toes-to-bar")!;
    expect(m).toContain("core");
  });
});

describe("WOD fixture: EMOM — power cleans and burpees", () => {
  it("'power cleans' (plural) resolves to power_clean", () => {
    expect(getMovementProfile("power cleans")!.key).toBe("power_clean");
  });

  it("'burpees' resolves to burpee", () => {
    expect(getMovementProfile("burpees")!.key).toBe("burpee");
  });

  it("power cleans produce glutes + hamstrings + quads (full triple extension)", () => {
    const m = auditMusclesFromName("power cleans")!;
    expect(m).toContain("glutes");
    expect(m).toContain("hamstrings");
    expect(m).toContain("quads");
  });

  it("burpees produce chest + quads + core", () => {
    const m = auditMusclesFromName("burpees")!;
    expect(m).toContain("chest");
    expect(m).toContain("quads");
    expect(m).toContain("core");
  });
});

describe("WOD fixture: 4 rounds — 500m row, deadlifts, handstand push-ups", () => {
  it("'500m row' resolves to row_erg via distance-strip normalizer", () => {
    expect(getMovementProfile("500m row")!.key).toBe("row_erg");
  });

  it("'deadlifts' (plural) resolves to deadlift", () => {
    expect(getMovementProfile("deadlifts")!.key).toBe("deadlift");
  });

  it("'handstand push-ups' (plural) resolves to handstand_push_up", () => {
    expect(getMovementProfile("handstand push-ups")!.key).toBe("handstand_push_up");
  });

  it("deadlifts produce hamstrings + glutes + back", () => {
    const m = auditMusclesFromName("deadlifts")!;
    expect(m).toContain("hamstrings");
    expect(m).toContain("glutes");
    expect(m).toContain("back");
  });

  it("handstand push-ups produce shoulders", () => {
    const m = auditMusclesFromName("handstand push-ups")!;
    expect(m).toContain("shoulders");
  });
});

describe("WOD fixture: AMRAP — walking lunges, box jumps, push press", () => {
  it("'walking lunges' (plural) resolves to walking_lunge", () => {
    expect(getMovementProfile("walking lunges")!.key).toBe("walking_lunge");
  });

  it("'box jumps' (plural) resolves to box_jump", () => {
    expect(getMovementProfile("box jumps")!.key).toBe("box_jump");
  });

  it("'push press' resolves to push_press", () => {
    expect(getMovementProfile("push press")!.key).toBe("push_press");
  });

  it("walking lunges produce quads + glutes", () => {
    const m = auditMusclesFromName("walking lunges")!;
    expect(m).toContain("quads");
    expect(m).toContain("glutes");
  });

  it("push press produces shoulders", () => {
    const m = auditMusclesFromName("push press")!;
    expect(m).toContain("shoulders");
  });
});

describe("WOD fixture: 50 double-unders, 20 cal bike, 15 sit-ups", () => {
  it("'double-unders' resolves to double_under", () => {
    expect(getMovementProfile("double-unders")!.key).toBe("double_under");
  });

  it("'20 cal bike' resolves to bike_erg via calorie-strip normalizer", () => {
    expect(getMovementProfile("20 cal bike")!.key).toBe("bike_erg");
  });

  it("'sit-ups' (plural) resolves to sit_up", () => {
    expect(getMovementProfile("sit-ups")!.key).toBe("sit_up");
  });

  it("double-unders produce calves", () => {
    const m = auditMusclesFromName("double-unders")!;
    expect(m).toContain("calves");
  });

  it("cal bike produces quads", () => {
    const m = auditMusclesFromName("20 cal bike")!;
    expect(m).toContain("quads");
  });

  it("sit-ups produce core", () => {
    const m = auditMusclesFromName("sit-ups")!;
    expect(m).toContain("core");
  });
});

// ---------------------------------------------------------------------------
// J) Alias stress — plurals, abbreviations, shorthand, equipment collision
// ---------------------------------------------------------------------------

describe("alias stress: plural forms", () => {
  const pluralCases: [string, string][] = [
    ["air squats",          "air_squat"],
    ["front squats",        "front_squat"],
    ["back squats",         "back_squat"],
    ["overhead squats",     "overhead_squat"],
    ["goblet squats",       "goblet_squat"],
    ["wall balls",          "wall_ball"],
    ["wall ball shots",     "wall_ball"],
    ["thrusters",           "thruster"],
    ["deadlifts",           "deadlift"],
    ["romanian deadlifts",  "romanian_deadlift"],
    ["kettlebell swings",   "kettlebell_swing"],
    ["kb swings",           "kettlebell_swing"],
    ["power cleans",        "power_clean"],
    ["squat cleans",        "squat_clean"],
    ["hang power cleans",   "hang_power_clean"],
    ["hang squat cleans",   "hang_squat_clean"],
    ["push presses",        "push_press"],
    ["handstand push-ups",  "handstand_push_up"],
    ["handstand push ups",  "handstand_push_up"],
    ["push-ups",            "push_up"],
    ["pushups",             "push_up"],
    ["push ups",            "push_up"],
    ["pull-ups",            "pull_up"],
    ["pull ups",            "pull_up"],
    ["pullups",             "pull_up"],
    ["sit-ups",             "sit_up"],
    ["sit ups",             "sit_up"],
    ["double-unders",       "double_under"],
    ["double unders",       "double_under"],
    ["box jumps",           "box_jump"],
    ["burpees",             "burpee"],
    ["walking lunges",      "walking_lunge"],
    ["lunges",              "walking_lunge"],
    ["front rack lunges",   "front_rack_lunge"],
    ["ring rows",           "ring_row"],
    ["dumbbell rows",       "dumbbell_row"],
    ["db rows",             "dumbbell_row"],
  ];

  for (const [input, expectedKey] of pluralCases) {
    it(`"${input}" (plural) → ${expectedKey}`, () => {
      const profile = getMovementProfile(input);
      expect(profile, `expected profile for "${input}"`).not.toBeNull();
      expect(profile!.key).toBe(expectedKey);
    });
  }
});

describe("alias stress: abbreviations and shorthand", () => {
  const abbrevCases: [string, string][] = [
    ["OHS",   "overhead_squat"],
    ["RDL",   "romanian_deadlift"],
    ["OHP",   "strict_press"],
    ["HSPU",  "handstand_push_up"],
    ["HRPU",  "hand_release_push_up"],
    ["BMU",   "bar_muscle_up"],
    ["BMUs",  "bar_muscle_up"],
    ["T2B",   "toes_to_bar"],
    ["TTB",   "toes_to_bar"],
    ["C2B",   "chest_to_bar_pull_up"],
    ["DU",    "double_under"],
    ["Du",    "double_under"],
  ];

  for (const [input, expectedKey] of abbrevCases) {
    it(`abbrev "${input}" → ${expectedKey}`, () => {
      const profile = getMovementProfile(input);
      expect(profile, `expected profile for "${input}"`).not.toBeNull();
      expect(profile!.key).toBe(expectedKey);
    });
  }
});

describe("alias stress: equipment collision safety", () => {
  it("'row' → row_erg (not a dumbbell/barbell row)", () => {
    expect(getMovementProfile("row")!.key).toBe("row_erg");
  });

  it("'db row' → dumbbell_row (not row_erg)", () => {
    expect(getMovementProfile("db row")!.key).toBe("dumbbell_row");
  });

  it("'dumbbell row' → dumbbell_row (not row_erg)", () => {
    expect(getMovementProfile("dumbbell row")!.key).toBe("dumbbell_row");
  });

  it("'barbell row' → barbell_row (not row_erg)", () => {
    expect(getMovementProfile("barbell row")!.key).toBe("barbell_row");
  });

  it("'bike' → bike_erg (not echo or assault)", () => {
    expect(getMovementProfile("bike")!.key).toBe("bike_erg");
  });

  it("'echo bike' → echo_bike (not bike_erg)", () => {
    expect(getMovementProfile("echo bike")!.key).toBe("echo_bike");
  });

  it("'assault bike' → assault_bike (not echo_bike)", () => {
    expect(getMovementProfile("assault bike")!.key).toBe("assault_bike");
  });

  it("'echo' → echo_bike (standalone shorthand)", () => {
    expect(getMovementProfile("echo")!.key).toBe("echo_bike");
  });

  it("'clean' → squat_clean (not hang_squat_clean or power_clean)", () => {
    expect(getMovementProfile("clean")!.key).toBe("squat_clean");
  });

  it("'hang clean' → hang_squat_clean (not squat_clean)", () => {
    expect(getMovementProfile("hang clean")!.key).toBe("hang_squat_clean");
  });

  it("'jerk' → split_jerk (canonical barbell jerk)", () => {
    expect(getMovementProfile("jerk")!.key).toBe("split_jerk");
  });

  it("'push jerk' → push_jerk (not split_jerk)", () => {
    expect(getMovementProfile("push jerk")!.key).toBe("push_jerk");
  });

  it("'lunge' → walking_lunge (not front_rack_lunge)", () => {
    expect(getMovementProfile("lunge")!.key).toBe("walking_lunge");
  });

  it("'front rack lunge' → front_rack_lunge (not walking_lunge)", () => {
    expect(getMovementProfile("front rack lunge")!.key).toBe("front_rack_lunge");
  });
});

describe("alias stress: distance and calorie token stripping", () => {
  const distanceCases: [string, string][] = [
    ["200m run",       "run"],
    ["400m run",       "run"],
    ["800m run",       "run"],
    ["1600m run",      "run"],
    ["500m row",       "row_erg"],
    ["1000m row",      "row_erg"],
    ["2000m row",      "row_erg"],
    ["20 cal bike",    "bike_erg"],
    ["20 calorie row", "row_erg"],
  ];

  for (const [input, expectedKey] of distanceCases) {
    it(`"${input}" → ${expectedKey} via distance/calorie strip`, () => {
      const profile = getMovementProfile(input);
      expect(profile, `expected profile for "${input}"`).not.toBeNull();
      expect(profile!.key).toBe(expectedKey);
    });
  }
});

// ---------------------------------------------------------------------------
// K) Unknown movement fallback — safe degradation
// ---------------------------------------------------------------------------

describe("unknown movement fallback", () => {
  const unknowns = [
    "bicep curl", "zottman curl", "preacher curl",
    "lateral raise", "face pull", "cable fly",
    "nordic curl", "reverse hyper", "glute bridge",
    "farmers carry", "sled push", "tire flip",
  ];

  for (const name of unknowns) {
    it(`"${name}" returns null (safe fallback required)`, () => {
      expect(getMovementProfile(name)).toBeNull();
      expect(getBaseMuscleVector(name)).toBeNull();
    });
  }
});

// ---------------------------------------------------------------------------
// L) Conservative cyclical enforcement
// ---------------------------------------------------------------------------

describe("conservative cyclical: max weight <= 0.70", () => {
  const cyclicalCases: [string, string][] = [
    ["row",          "row_erg"],
    ["500m row",     "row_erg"],
    ["run",          "run"],
    ["800m run",     "run"],
    ["bike erg",     "bike_erg"],
    ["20 cal bike",  "bike_erg"],
    ["echo bike",    "echo_bike"],
    ["assault bike", "assault_bike"],
    ["ski erg",      "ski_erg"],
    ["jump rope",    "jump_rope"],
    ["double-under", "double_under"],
  ];

  for (const [name, expectedKey] of cyclicalCases) {
    it(`${expectedKey} (via "${name}"): max weight ≤ 0.70`, () => {
      const v = getBaseMuscleVector(name)!;
      expect(v).not.toBeNull();
      const max = Math.max(...v.map((mc) => mc.weight));
      expect(max, `${expectedKey} max=${max} exceeds 0.70`).toBeLessThanOrEqual(0.70);
    });
  }

  it("cyclical profiles do not claim a single muscle > 0.70", () => {
    for (const [key, profile] of MOVEMENT_PROFILES) {
      if (profile.pattern !== "cyclical") continue;
      for (const mc of profile.muscles) {
        expect(
          mc.weight,
          `${key}.${mc.muscle} weight ${mc.weight} exceeds cyclical cap 0.70`
        ).toBeLessThanOrEqual(0.70);
      }
    }
  });
});

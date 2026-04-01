/**
 * movementProfiles.ts — V1 canonical muscle weighting engine.
 *
 * Provides movement-level muscle contribution vectors for high-frequency
 * CrossFit + strength movements. Augments (never replaces) the existing
 * broad keyword stimulus logic in audit.ts: profile vector is used when a
 * movement is recognized; keyword fallback is used otherwise.
 *
 * SCOPE: Step 1 only. No prescribed/performed delta, no fatigue scoring,
 * no readiness/recovery — those are explicitly deferred to Step 2+.
 *
 * V1 Muscle Taxonomy (12 groups):
 *   chest | shoulders | triceps | biceps | upper_back_lats | lower_back |
 *   core | glutes | hamstrings | quads | calves | forearms_grip
 *
 * Weight scale: 0.0 – 1.0
 *   primary   ~0.70–1.00
 *   secondary ~0.25–0.70
 *   stabilizer ~0.10–0.30
 */

// ---------------------------------------------------------------------------
// V1 Taxonomy
// ---------------------------------------------------------------------------

export type MuscleGroup =
  | "chest"
  | "shoulders"
  | "triceps"
  | "biceps"
  | "upper_back_lats"
  | "lower_back"
  | "core"
  | "glutes"
  | "hamstrings"
  | "quads"
  | "calves"
  | "forearms_grip";

// ---------------------------------------------------------------------------
// Supporting types
// ---------------------------------------------------------------------------

export type MovementPattern =
  | "squat"
  | "hinge"
  | "upper_push"
  | "upper_pull"
  | "core"
  | "cyclical"
  | "mixed";

export type ModalityType =
  | "barbell"
  | "dumbbell"
  | "kettlebell"
  | "bodyweight"
  | "machine"
  | "erg"
  | "mixed";

export type StimulusBias =
  | "strength"
  | "hypertrophy"
  | "power"
  | "endurance"
  | "mixed";

export type MuscleRole = "primary" | "secondary" | "stabilizer";

export interface MuscleContribution {
  muscle: MuscleGroup;
  weight: number;       // 0.0 – 1.0
  role: MuscleRole;
}

export interface MovementProfile {
  /** Canonical snake_case key (used as dictionary key). */
  key: string;
  /** Human-readable display name. */
  name: string;
  pattern: MovementPattern;
  modality: ModalityType;
  bias: StimulusBias;
  /** Ordered list — primary first, then secondary, then stabilizers. */
  muscles: MuscleContribution[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function p(muscle: MuscleGroup, weight: number): MuscleContribution {
  const role: MuscleRole =
    weight >= 0.70 ? "primary" : weight >= 0.25 ? "secondary" : "stabilizer";
  return { muscle, weight, role };
}

// ---------------------------------------------------------------------------
// Movement Profile Dictionary (40 entries)
// ---------------------------------------------------------------------------

const PROFILES_LIST: MovementProfile[] = [

  // ─── Squat-dominant (6) ──────────────────────────────────────────────────

  {
    key: "air_squat",
    name: "Air Squat",
    pattern: "squat", modality: "bodyweight", bias: "hypertrophy",
    muscles: [
      p("quads", 0.85), p("glutes", 0.65), p("hamstrings", 0.30),
      p("core", 0.20), p("calves", 0.15),
    ],
  },
  {
    key: "front_squat",
    name: "Front Squat",
    pattern: "squat", modality: "barbell", bias: "strength",
    muscles: [
      p("quads", 0.90), p("glutes", 0.55), p("core", 0.35),
      p("hamstrings", 0.25), p("upper_back_lats", 0.20),
    ],
  },
  {
    key: "back_squat",
    name: "Back Squat",
    pattern: "squat", modality: "barbell", bias: "strength",
    muscles: [
      p("quads", 0.85), p("glutes", 0.70), p("hamstrings", 0.35),
      p("lower_back", 0.25), p("core", 0.25), p("calves", 0.15),
    ],
  },
  {
    key: "goblet_squat",
    name: "Goblet Squat",
    pattern: "squat", modality: "kettlebell", bias: "hypertrophy",
    muscles: [
      p("quads", 0.85), p("glutes", 0.65), p("core", 0.30),
      p("hamstrings", 0.25), p("biceps", 0.15),
    ],
  },
  {
    key: "wall_ball",
    name: "Wall Ball",
    pattern: "squat", modality: "mixed", bias: "mixed",
    muscles: [
      p("quads", 0.80), p("glutes", 0.55), p("shoulders", 0.50),
      p("core", 0.35), p("hamstrings", 0.25), p("triceps", 0.20),
    ],
  },
  {
    key: "thruster",
    name: "Thruster",
    pattern: "squat", modality: "barbell", bias: "power",
    muscles: [
      p("quads", 0.80), p("shoulders", 0.80), p("glutes", 0.55),
      p("triceps", 0.35), p("core", 0.35), p("hamstrings", 0.25),
    ],
  },

  // ─── Hinge-dominant (6) ──────────────────────────────────────────────────

  {
    key: "deadlift",
    name: "Deadlift",
    pattern: "hinge", modality: "barbell", bias: "strength",
    muscles: [
      p("hamstrings", 0.85), p("glutes", 0.75), p("lower_back", 0.65),
      p("quads", 0.40), p("upper_back_lats", 0.40),
      p("forearms_grip", 0.25), p("core", 0.20),
    ],
  },
  {
    key: "romanian_deadlift",
    name: "Romanian Deadlift",
    pattern: "hinge", modality: "barbell", bias: "hypertrophy",
    muscles: [
      p("hamstrings", 0.90), p("glutes", 0.75), p("lower_back", 0.45),
      p("upper_back_lats", 0.25), p("forearms_grip", 0.20),
    ],
  },
  {
    key: "kettlebell_swing",
    name: "Kettlebell Swing",
    pattern: "hinge", modality: "kettlebell", bias: "power",
    muscles: [
      p("glutes", 0.85), p("hamstrings", 0.70), p("lower_back", 0.45),
      p("core", 0.40), p("shoulders", 0.25), p("forearms_grip", 0.20),
    ],
  },
  {
    key: "dumbbell_snatch",
    name: "Dumbbell Snatch",
    pattern: "hinge", modality: "dumbbell", bias: "power",
    muscles: [
      p("shoulders", 0.65), p("glutes", 0.70), p("hamstrings", 0.60),
      p("quads", 0.45), p("lower_back", 0.35), p("core", 0.30),
      p("forearms_grip", 0.20),
    ],
  },
  {
    key: "power_clean",
    name: "Power Clean",
    pattern: "hinge", modality: "barbell", bias: "power",
    muscles: [
      p("glutes", 0.75), p("hamstrings", 0.65), p("quads", 0.60),
      p("upper_back_lats", 0.55), p("shoulders", 0.45),
      p("forearms_grip", 0.35), p("lower_back", 0.30), p("core", 0.25),
    ],
  },
  {
    key: "squat_clean",
    name: "Squat Clean",
    pattern: "hinge", modality: "barbell", bias: "power",
    muscles: [
      p("quads", 0.85), p("glutes", 0.75), p("hamstrings", 0.55),
      p("upper_back_lats", 0.55), p("shoulders", 0.45),
      p("lower_back", 0.35), p("forearms_grip", 0.30), p("core", 0.25),
    ],
  },

  // ─── Upper push (6) ──────────────────────────────────────────────────────

  {
    key: "push_press",
    name: "Push Press",
    pattern: "upper_push", modality: "barbell", bias: "power",
    muscles: [
      p("shoulders", 0.85), p("triceps", 0.55), p("quads", 0.35),
      p("glutes", 0.30), p("core", 0.25), p("upper_back_lats", 0.15),
    ],
  },
  {
    key: "strict_press",
    name: "Strict Press",
    pattern: "upper_push", modality: "barbell", bias: "strength",
    muscles: [
      p("shoulders", 0.90), p("triceps", 0.60), p("core", 0.30),
      p("upper_back_lats", 0.25),
    ],
  },
  {
    key: "bench_press",
    name: "Bench Press",
    pattern: "upper_push", modality: "barbell", bias: "hypertrophy",
    muscles: [
      p("chest", 0.90), p("triceps", 0.60), p("shoulders", 0.40),
      p("upper_back_lats", 0.20),
    ],
  },
  {
    key: "push_up",
    name: "Push-Up",
    pattern: "upper_push", modality: "bodyweight", bias: "hypertrophy",
    muscles: [
      p("chest", 0.80), p("triceps", 0.55), p("shoulders", 0.45),
      p("core", 0.25),
    ],
  },
  {
    key: "handstand_push_up",
    name: "Handstand Push-Up",
    pattern: "upper_push", modality: "bodyweight", bias: "strength",
    muscles: [
      p("shoulders", 0.90), p("triceps", 0.65), p("core", 0.30),
      p("upper_back_lats", 0.25),
    ],
  },
  {
    key: "dumbbell_shoulder_press",
    name: "Dumbbell Shoulder Press",
    pattern: "upper_push", modality: "dumbbell", bias: "hypertrophy",
    muscles: [
      p("shoulders", 0.85), p("triceps", 0.55), p("core", 0.20),
      p("upper_back_lats", 0.15),
    ],
  },

  // ─── Upper pull (6) ──────────────────────────────────────────────────────

  {
    key: "pull_up",
    name: "Pull-Up",
    pattern: "upper_pull", modality: "bodyweight", bias: "strength",
    muscles: [
      p("upper_back_lats", 0.90), p("biceps", 0.65),
      p("forearms_grip", 0.30), p("core", 0.25), p("shoulders", 0.20),
    ],
  },
  {
    key: "chest_to_bar_pull_up",
    name: "Chest-to-Bar Pull-Up",
    pattern: "upper_pull", modality: "bodyweight", bias: "strength",
    muscles: [
      p("upper_back_lats", 0.90), p("biceps", 0.65),
      p("forearms_grip", 0.30), p("core", 0.30), p("shoulders", 0.25),
    ],
  },
  {
    key: "bar_muscle_up",
    name: "Bar Muscle-Up",
    pattern: "upper_pull", modality: "bodyweight", bias: "strength",
    muscles: [
      p("upper_back_lats", 0.85), p("biceps", 0.60), p("chest", 0.50),
      p("triceps", 0.45), p("core", 0.35), p("forearms_grip", 0.25),
      p("shoulders", 0.20),
    ],
  },
  {
    key: "ring_row",
    name: "Ring Row",
    pattern: "upper_pull", modality: "bodyweight", bias: "hypertrophy",
    muscles: [
      p("upper_back_lats", 0.80), p("biceps", 0.55),
      p("core", 0.25), p("shoulders", 0.25),
    ],
  },
  {
    key: "dumbbell_row",
    name: "Dumbbell Row",
    pattern: "upper_pull", modality: "dumbbell", bias: "hypertrophy",
    muscles: [
      p("upper_back_lats", 0.85), p("biceps", 0.55), p("lower_back", 0.25),
      p("core", 0.20), p("forearms_grip", 0.20),
    ],
  },
  {
    key: "barbell_row",
    name: "Barbell Row",
    pattern: "upper_pull", modality: "barbell", bias: "strength",
    muscles: [
      p("upper_back_lats", 0.85), p("biceps", 0.55), p("lower_back", 0.30),
      p("core", 0.25), p("forearms_grip", 0.20),
    ],
  },

  // ─── Core / gymnastics (5) ───────────────────────────────────────────────

  {
    key: "toes_to_bar",
    name: "Toes-to-Bar",
    pattern: "core", modality: "bodyweight", bias: "strength",
    muscles: [
      p("core", 0.90), p("forearms_grip", 0.35), p("upper_back_lats", 0.30),
      p("shoulders", 0.25),
    ],
  },
  {
    key: "sit_up",
    name: "Sit-Up",
    pattern: "core", modality: "bodyweight", bias: "hypertrophy",
    muscles: [
      p("core", 0.90), p("hamstrings", 0.20),
    ],
  },
  {
    key: "ghd_sit_up",
    name: "GHD Sit-Up",
    pattern: "core", modality: "machine", bias: "hypertrophy",
    muscles: [
      p("core", 0.85), p("hamstrings", 0.40), p("glutes", 0.25),
    ],
  },
  {
    key: "plank",
    name: "Plank",
    pattern: "core", modality: "bodyweight", bias: "endurance",
    muscles: [
      p("core", 0.90), p("shoulders", 0.35), p("glutes", 0.25),
    ],
  },
  {
    key: "hollow_hold",
    name: "Hollow Hold",
    pattern: "core", modality: "bodyweight", bias: "endurance",
    muscles: [
      p("core", 0.90), p("shoulders", 0.25),
    ],
  },

  // ─── Cyclical (8) ────────────────────────────────────────────────────────

  {
    key: "row_erg",
    name: "Row (Erg)",
    pattern: "cyclical", modality: "erg", bias: "endurance",
    muscles: [
      p("upper_back_lats", 0.55), p("hamstrings", 0.45), p("glutes", 0.45),
      p("quads", 0.40), p("biceps", 0.30), p("core", 0.30),
      p("forearms_grip", 0.20),
    ],
  },
  {
    key: "run",
    name: "Run",
    pattern: "cyclical", modality: "bodyweight", bias: "endurance",
    muscles: [
      p("quads", 0.65), p("hamstrings", 0.55), p("glutes", 0.65),
      p("calves", 0.50), p("core", 0.20),
    ],
  },
  {
    key: "bike_erg",
    name: "Bike Erg",
    pattern: "cyclical", modality: "erg", bias: "endurance",
    muscles: [
      p("quads", 0.75), p("glutes", 0.50), p("hamstrings", 0.40),
      p("calves", 0.20), p("core", 0.15),
    ],
  },
  {
    key: "echo_bike",
    name: "Echo Bike",
    pattern: "cyclical", modality: "erg", bias: "endurance",
    muscles: [
      p("quads", 0.70), p("glutes", 0.45), p("hamstrings", 0.40),
      p("shoulders", 0.35), p("chest", 0.25), p("calves", 0.20),
      p("core", 0.20),
    ],
  },
  {
    key: "assault_bike",
    name: "Assault Bike",
    pattern: "cyclical", modality: "erg", bias: "endurance",
    muscles: [
      p("quads", 0.70), p("glutes", 0.45), p("hamstrings", 0.40),
      p("shoulders", 0.35), p("chest", 0.25), p("calves", 0.20),
      p("core", 0.20),
    ],
  },
  {
    key: "ski_erg",
    name: "Ski Erg",
    pattern: "cyclical", modality: "erg", bias: "endurance",
    muscles: [
      p("upper_back_lats", 0.65), p("shoulders", 0.55), p("core", 0.50),
      p("triceps", 0.35), p("hamstrings", 0.30), p("glutes", 0.30),
    ],
  },
  {
    key: "jump_rope",
    name: "Jump Rope",
    pattern: "cyclical", modality: "bodyweight", bias: "endurance",
    muscles: [
      p("calves", 0.70), p("quads", 0.40), p("core", 0.25),
      p("shoulders", 0.25), p("forearms_grip", 0.20),
    ],
  },
  {
    key: "double_under",
    name: "Double-Under",
    pattern: "cyclical", modality: "bodyweight", bias: "endurance",
    muscles: [
      p("calves", 0.75), p("quads", 0.35), p("forearms_grip", 0.30),
      p("shoulders", 0.25), p("core", 0.20),
    ],
  },

  // ─── Mixed / plyometric (4) ──────────────────────────────────────────────

  {
    key: "burpee",
    name: "Burpee",
    pattern: "mixed", modality: "bodyweight", bias: "mixed",
    muscles: [
      p("quads", 0.60), p("chest", 0.55), p("glutes", 0.40),
      p("shoulders", 0.45), p("core", 0.45), p("triceps", 0.35),
      p("hamstrings", 0.25),
    ],
  },
  {
    key: "box_jump",
    name: "Box Jump",
    pattern: "mixed", modality: "bodyweight", bias: "power",
    muscles: [
      p("quads", 0.75), p("glutes", 0.65), p("hamstrings", 0.50),
      p("calves", 0.40), p("core", 0.25),
    ],
  },
  {
    key: "burpee_box_jump_over",
    name: "Burpee Box Jump Over",
    pattern: "mixed", modality: "bodyweight", bias: "mixed",
    muscles: [
      p("quads", 0.65), p("glutes", 0.60), p("chest", 0.55),
      p("hamstrings", 0.45), p("core", 0.45), p("shoulders", 0.40),
      p("triceps", 0.30), p("calves", 0.25),
    ],
  },
  {
    key: "walking_lunge",
    name: "Walking Lunge",
    pattern: "squat", modality: "bodyweight", bias: "hypertrophy",
    muscles: [
      p("quads", 0.80), p("glutes", 0.65), p("hamstrings", 0.45),
      p("calves", 0.25), p("core", 0.20),
    ],
  },
];

// ---------------------------------------------------------------------------
// Profile dictionary (keyed by canonical key)
// ---------------------------------------------------------------------------

export const MOVEMENT_PROFILES: ReadonlyMap<string, MovementProfile> =
  new Map(PROFILES_LIST.map((p) => [p.key, p]));

// ---------------------------------------------------------------------------
// Alias map — maps common name variants → canonical profile key
// ---------------------------------------------------------------------------

export const MOVEMENT_ALIASES: ReadonlyMap<string, string> = new Map([
  // air squat
  ["air squat",            "air_squat"],
  ["airsquat",             "air_squat"],
  ["bodyweight squat",     "air_squat"],
  ["bw squat",             "air_squat"],

  // back squat
  ["back squat",           "back_squat"],
  ["barbell squat",        "back_squat"],
  ["barbell back squat",   "back_squat"],
  ["low bar squat",        "back_squat"],
  ["high bar squat",       "back_squat"],

  // front squat
  ["front squat",          "front_squat"],
  ["barbell front squat",  "front_squat"],

  // goblet squat
  ["goblet squat",         "goblet_squat"],
  ["kb goblet squat",      "goblet_squat"],
  ["kettlebell goblet squat", "goblet_squat"],
  ["dumbbell goblet squat", "goblet_squat"],

  // wall ball
  ["wall ball",            "wall_ball"],
  ["wall ball shot",       "wall_ball"],
  ["wallball",             "wall_ball"],

  // thruster
  ["thruster",             "thruster"],
  ["barbell thruster",     "thruster"],
  ["dumbbell thruster",    "thruster"],
  ["db thruster",          "thruster"],

  // deadlift
  ["deadlift",             "deadlift"],
  ["barbell deadlift",     "deadlift"],
  ["conventional deadlift","deadlift"],
  ["sumo deadlift",        "deadlift"],     // close enough for Step 1

  // romanian deadlift
  ["romanian deadlift",    "romanian_deadlift"],
  ["rdl",                  "romanian_deadlift"],
  ["barbell rdl",          "romanian_deadlift"],
  ["dumbbell rdl",         "romanian_deadlift"],
  ["db rdl",               "romanian_deadlift"],
  ["stiff leg deadlift",   "romanian_deadlift"],
  ["stiff-leg deadlift",   "romanian_deadlift"],

  // kettlebell swing
  ["kettlebell swing",     "kettlebell_swing"],
  ["kb swing",             "kettlebell_swing"],
  ["american kettlebell swing", "kettlebell_swing"],
  ["american kb swing",    "kettlebell_swing"],
  ["russian kettlebell swing", "kettlebell_swing"],
  ["russian kb swing",     "kettlebell_swing"],

  // dumbbell snatch
  ["dumbbell snatch",      "dumbbell_snatch"],
  ["db snatch",            "dumbbell_snatch"],
  ["single arm dumbbell snatch", "dumbbell_snatch"],

  // power clean
  ["power clean",          "power_clean"],
  ["barbell power clean",  "power_clean"],

  // squat clean
  ["squat clean",          "squat_clean"],
  ["clean",                "squat_clean"],
  ["barbell clean",        "squat_clean"],
  ["full clean",           "squat_clean"],

  // push press
  ["push press",           "push_press"],
  ["barbell push press",   "push_press"],
  ["dumbbell push press",  "push_press"],
  ["db push press",        "push_press"],

  // strict press / overhead press
  ["strict press",         "strict_press"],
  ["overhead press",       "strict_press"],
  ["ohp",                  "strict_press"],
  ["barbell press",        "strict_press"],
  ["barbell overhead press", "strict_press"],
  ["military press",       "strict_press"],

  // bench press
  ["bench press",          "bench_press"],
  ["barbell bench press",  "bench_press"],
  ["flat bench press",     "bench_press"],
  ["flat bench",           "bench_press"],
  ["chest press",          "bench_press"],

  // push-up
  ["push-up",              "push_up"],
  ["push up",              "push_up"],
  ["pushup",               "push_up"],
  ["push ups",             "push_up"],
  ["push-ups",             "push_up"],

  // handstand push-up
  ["handstand push-up",    "handstand_push_up"],
  ["handstand push up",    "handstand_push_up"],
  ["hspu",                 "handstand_push_up"],
  ["strict hspu",          "handstand_push_up"],
  ["kipping hspu",         "handstand_push_up"],

  // dumbbell shoulder press
  ["dumbbell shoulder press", "dumbbell_shoulder_press"],
  ["db shoulder press",    "dumbbell_shoulder_press"],
  ["dumbbell press",       "dumbbell_shoulder_press"],
  ["db press",             "dumbbell_shoulder_press"],

  // pull-up
  ["pull-up",              "pull_up"],
  ["pull up",              "pull_up"],
  ["pullup",               "pull_up"],
  ["pull-ups",             "pull_up"],
  ["pull ups",             "pull_up"],
  ["strict pull-up",       "pull_up"],
  ["strict pull up",       "pull_up"],
  ["kipping pull-up",      "pull_up"],
  ["kipping pull up",      "pull_up"],
  ["banded pull-up",       "pull_up"],
  ["ring pull-up",         "pull_up"],

  // chest-to-bar pull-up
  ["chest-to-bar pull-up", "chest_to_bar_pull_up"],
  ["chest to bar pull-up", "chest_to_bar_pull_up"],
  ["chest-to-bar",         "chest_to_bar_pull_up"],
  ["chest to bar",         "chest_to_bar_pull_up"],
  ["c2b",                  "chest_to_bar_pull_up"],
  ["c2b pull-up",          "chest_to_bar_pull_up"],

  // bar muscle-up
  ["bar muscle-up",        "bar_muscle_up"],
  ["bar muscle up",        "bar_muscle_up"],
  ["muscle-up",            "bar_muscle_up"],
  ["muscle up",            "bar_muscle_up"],
  ["bmu",                  "bar_muscle_up"],

  // ring row
  ["ring row",             "ring_row"],
  ["ring rows",            "ring_row"],

  // dumbbell row
  ["dumbbell row",         "dumbbell_row"],
  ["db row",               "dumbbell_row"],
  ["single arm dumbbell row", "dumbbell_row"],
  ["single arm row",       "dumbbell_row"],

  // barbell row
  ["barbell row",          "barbell_row"],
  ["bent over row",        "barbell_row"],
  ["barbell bent over row", "barbell_row"],
  ["pendlay row",          "barbell_row"],

  // toes-to-bar
  ["toes-to-bar",          "toes_to_bar"],
  ["toes to bar",          "toes_to_bar"],
  ["t2b",                  "toes_to_bar"],

  // sit-up
  ["sit-up",               "sit_up"],
  ["sit up",               "sit_up"],
  ["situp",                "sit_up"],
  ["sit-ups",              "sit_up"],
  ["sit ups",              "sit_up"],

  // ghd sit-up
  ["ghd sit-up",           "ghd_sit_up"],
  ["ghd sit up",           "ghd_sit_up"],
  ["ghd situp",            "ghd_sit_up"],
  ["glute ham developer sit up", "ghd_sit_up"],

  // plank
  ["plank",                "plank"],
  ["front plank",          "plank"],

  // hollow hold
  ["hollow hold",          "hollow_hold"],
  ["hollow body hold",     "hollow_hold"],
  ["hollow body",          "hollow_hold"],

  // row erg
  ["row",                  "row_erg"],
  ["rowing",               "row_erg"],
  ["erg row",              "row_erg"],
  ["row erg",              "row_erg"],
  ["concept 2 row",        "row_erg"],
  ["c2 row",               "row_erg"],
  ["concept2 row",         "row_erg"],
  ["rower",                "row_erg"],

  // run
  ["run",                  "run"],
  ["running",              "run"],
  ["run 400m",             "run"],
  ["400m run",             "run"],
  ["800m run",             "run"],
  ["1 mile run",           "run"],
  ["1600m run",            "run"],
  ["mile run",             "run"],

  // bike erg
  ["bike erg",             "bike_erg"],
  ["bike",                 "bike_erg"],
  ["cycling",              "bike_erg"],

  // echo bike
  ["echo bike",            "echo_bike"],
  ["airdyne",              "echo_bike"],
  ["air bike",             "echo_bike"],

  // assault bike
  ["assault bike",         "assault_bike"],
  ["assault bike erg",     "assault_bike"],

  // ski erg
  ["ski erg",              "ski_erg"],
  ["ski",                  "ski_erg"],
  ["skierg",               "ski_erg"],

  // jump rope
  ["jump rope",            "jump_rope"],
  ["single under",         "jump_rope"],
  ["singles",              "jump_rope"],
  ["single-under",         "jump_rope"],

  // double-under
  ["double-under",         "double_under"],
  ["double under",         "double_under"],
  ["double-unders",        "double_under"],
  ["double unders",        "double_under"],
  ["du",                   "double_under"],
  ["dubs",                 "double_under"],

  // burpee
  ["burpee",               "burpee"],
  ["burpees",              "burpee"],

  // box jump
  ["box jump",             "box_jump"],
  ["box jumps",            "box_jump"],

  // burpee box jump over
  ["burpee box jump over", "burpee_box_jump_over"],
  ["burpee box jump",      "burpee_box_jump_over"],

  // walking lunge
  ["walking lunge",        "walking_lunge"],
  ["walking lunges",       "walking_lunge"],
  ["lunge",                "walking_lunge"],
  ["lunges",               "walking_lunge"],
  ["forward lunge",        "walking_lunge"],
  ["reverse lunge",        "walking_lunge"],
]);

// ---------------------------------------------------------------------------
// Core lookup functions
// ---------------------------------------------------------------------------

/**
 * Normalize a raw movement name to a canonical lookup key.
 *
 * Steps (applied in order):
 *  1. Lowercase + collapse whitespace
 *  2. Strip leading equipment prefix (barbell/dumbbell/kettlebell/cable/etc.)
 *  3. Strip leading/trailing distance tokens (400m, 1 mile, etc.)
 *  4. Replace hyphens with spaces, collapse repeated spaces
 *
 * This is intentionally more aggressive than the existing normalizeExerciseName()
 * in vaultIngestion.ts (which is equipment-only). That function is untouched.
 */
export function normalizeMovementName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    // strip equipment prefix
    .replace(/^(barbell|dumbbell|db|kettlebell|kb|cable|machine|ez[\s-]?bar|smith)\s+/i, "")
    // strip leading distance tokens ("400m ", "1 mile ", "800m ")
    .replace(/^\d+\s?(?:m|km|mile[s]?)\s+/i, "")
    // strip trailing distance tokens (" 400m", " 1 mile")
    .replace(/\s+\d+\s?(?:m|km|mile[s]?)$/i, "")
    // normalize hyphens to spaces
    .replace(/-/g, " ")
    // collapse multi-space
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Lightly normalize a name for alias lookup: lowercase, trim, hyphens → spaces,
 * collapse whitespace. Does NOT strip equipment prefixes or distance tokens.
 * Used as a pre-normalization alias check to avoid equipment-ambiguity collisions
 * (e.g. "DB Row" should not collapse to "row" → row_erg).
 */
function liteNormalize(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/-/g, " ")
    .replace(/\s+/g, " ");
}

/**
 * Look up a movement profile by raw name.
 *
 * Resolution order:
 *  1. Alias map on lightly-normalized name (no equipment-prefix stripping)
 *     — preserves "db row" → dumbbell_row vs. "row" → row_erg distinction
 *  2. Alias map on fully-normalized name (strips equipment prefix, distance tokens)
 *  3. Direct profile key match (fully-normalized, spaces → underscores)
 *  4. null — caller must fall back to keyword logic
 */
export function getMovementProfile(name: string): MovementProfile | null {
  // 1. Lite alias lookup (equipment prefix retained)
  const lite = liteNormalize(name);
  const liteKey = MOVEMENT_ALIASES.get(lite);
  if (liteKey) return MOVEMENT_PROFILES.get(liteKey) ?? null;

  // 2. Full alias lookup (equipment prefix stripped)
  const full = normalizeMovementName(name);
  const fullKey = MOVEMENT_ALIASES.get(full);
  if (fullKey) return MOVEMENT_PROFILES.get(fullKey) ?? null;

  // 3. Direct key match (spaces → underscores)
  const directKey = full.replace(/\s+/g, "_");
  if (MOVEMENT_PROFILES.has(directKey)) return MOVEMENT_PROFILES.get(directKey)!;

  return null;
}

/**
 * Return the ordered muscle contribution vector for a movement, or null if
 * the movement is not in the profile dictionary.
 *
 * Callers should fall back to existing broad stimulus logic when null is returned.
 */
export function getBaseMuscleVector(name: string): MuscleContribution[] | null {
  const profile = getMovementProfile(name);
  return profile ? profile.muscles : null;
}

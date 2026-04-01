/**
 * movementProfiles.ts — V1 canonical movement-level muscle weighting engine.
 *
 * Pure module: no DB dependencies, no route dependencies, no server-specific
 * logic. Only types, constants, normalization helpers, and lookup helpers.
 *
 * Provides movement-level muscle contribution vectors for high-frequency
 * CrossFit + strength movements. Augments (never replaces) the existing broad
 * keyword stimulus logic in audit.ts: profile vector is used when a movement
 * is recognized; keyword fallback is used otherwise.
 *
 * SCOPE: Step 1 only. No prescribed/performed delta, no fatigue scoring,
 * no readiness/recovery/fatigue — explicitly deferred to Step 2+.
 *
 * V1 Muscle Taxonomy (12 groups):
 *   chest | shoulders | triceps | biceps | upper_back_lats | lower_back |
 *   core | glutes | hamstrings | quads | calves | forearms_grip
 *
 * Weight scale: 0.0 – 1.0
 *   role is AUTHORED intentionally per movement — not derived from weight thresholds
 */

// ---------------------------------------------------------------------------
// V1 Muscle Taxonomy (12 groups)
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

/**
 * V1 movement pattern taxonomy (15 patterns).
 * Richer than a collapsed push/pull/squat/hinge set — allows precise
 * classification of olympic lifts, gymnastics, bracing vs. flexion, etc.
 */
export type MovementPattern =
  | "squat"
  | "hinge"
  | "lunge"
  | "horizontal_push"
  | "vertical_push"
  | "horizontal_pull"
  | "vertical_pull"
  | "carry"
  | "core_flexion"
  | "core_bracing"
  | "rotation"
  | "jump"
  | "cyclical"
  | "olympic_lift"
  | "gymnastics";

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
  | "conditioning"
  | "mixed";

/**
 * Muscle role is AUTHORED intentionally per movement — not inferred from weight.
 * A muscle can be a primary driver at 0.50 (e.g. lats in rowing) even though
 * the weight is below the "primary ≥ 0.70" threshold used in earlier designs.
 */
export type MuscleRole = "primary" | "secondary" | "stabilizer";

export interface MuscleContribution {
  muscle: MuscleGroup;
  /** 0.0 – 1.0. Relative stimulus weight within this movement. */
  weight: number;
  /**
   * Biomechanically authored role — NOT derived from weight.
   * Use "primary" for muscles that are primary movers or dominant contributors
   * regardless of exact weight value.
   */
  role: MuscleRole;
}

export interface MovementProfile {
  /** Canonical snake_case key used as dictionary key. */
  key: string;
  /** Human-readable display name. */
  name: string;
  /**
   * All recognized alias strings for this movement (lowercase, hyphen-free).
   * These are the single source of truth — MOVEMENT_ALIASES is derived from them.
   */
  aliases: string[];
  pattern: MovementPattern;
  modality: ModalityType;
  bias: StimulusBias;
  /** Ordered: primary first, then secondary, then stabilizers. */
  muscles: MuscleContribution[];
}

// ---------------------------------------------------------------------------
// Movement Profile Dictionary (41 entries)
// ---------------------------------------------------------------------------

const PROFILES_LIST: MovementProfile[] = [

  // ─── Squat-dominant (6) ──────────────────────────────────────────────────

  {
    key: "air_squat",
    name: "Air Squat",
    aliases: ["air squat", "airsquat", "bodyweight squat", "bw squat"],
    pattern: "squat", modality: "bodyweight", bias: "hypertrophy",
    muscles: [
      { muscle: "quads",     weight: 0.85, role: "primary"    },
      { muscle: "glutes",    weight: 0.65, role: "primary"    },
      { muscle: "hamstrings",weight: 0.30, role: "secondary"  },
      { muscle: "core",      weight: 0.20, role: "stabilizer" },
      { muscle: "calves",    weight: 0.15, role: "stabilizer" },
    ],
  },
  {
    key: "front_squat",
    name: "Front Squat",
    aliases: ["front squat", "barbell front squat"],
    pattern: "squat", modality: "barbell", bias: "strength",
    muscles: [
      { muscle: "quads",          weight: 0.90, role: "primary"   },
      { muscle: "glutes",         weight: 0.55, role: "secondary" },
      { muscle: "core",           weight: 0.35, role: "secondary" },
      { muscle: "hamstrings",     weight: 0.25, role: "secondary" },
      { muscle: "upper_back_lats",weight: 0.20, role: "stabilizer"},
    ],
  },
  {
    key: "back_squat",
    name: "Back Squat",
    aliases: [
      "back squat", "barbell squat", "barbell back squat",
      "low bar squat", "high bar squat",
    ],
    pattern: "squat", modality: "barbell", bias: "strength",
    muscles: [
      { muscle: "quads",     weight: 0.85, role: "primary"    },
      { muscle: "glutes",    weight: 0.70, role: "primary"    },
      { muscle: "hamstrings",weight: 0.35, role: "secondary"  },
      { muscle: "lower_back",weight: 0.25, role: "secondary"  },
      { muscle: "core",      weight: 0.25, role: "secondary"  },
      { muscle: "calves",    weight: 0.15, role: "stabilizer" },
    ],
  },
  {
    key: "goblet_squat",
    name: "Goblet Squat",
    aliases: [
      "goblet squat", "kb goblet squat", "kettlebell goblet squat",
      "dumbbell goblet squat",
    ],
    pattern: "squat", modality: "kettlebell", bias: "hypertrophy",
    muscles: [
      { muscle: "quads",     weight: 0.85, role: "primary"    },
      { muscle: "glutes",    weight: 0.65, role: "primary"    },
      { muscle: "core",      weight: 0.30, role: "secondary"  },
      { muscle: "hamstrings",weight: 0.25, role: "secondary"  },
      { muscle: "biceps",    weight: 0.15, role: "stabilizer" },
    ],
  },
  {
    key: "wall_ball",
    name: "Wall Ball",
    aliases: ["wall ball", "wall ball shot", "wallball"],
    pattern: "squat", modality: "mixed", bias: "conditioning",
    muscles: [
      { muscle: "quads",    weight: 0.80, role: "primary"   },
      { muscle: "glutes",   weight: 0.55, role: "primary"   },
      { muscle: "shoulders",weight: 0.50, role: "primary"   },
      { muscle: "core",     weight: 0.35, role: "secondary" },
      { muscle: "hamstrings",weight: 0.25, role: "secondary"},
      { muscle: "triceps",  weight: 0.20, role: "secondary" },
    ],
  },
  {
    key: "thruster",
    name: "Thruster",
    aliases: ["thruster", "barbell thruster", "dumbbell thruster", "db thruster"],
    pattern: "squat", modality: "barbell", bias: "power",
    muscles: [
      { muscle: "quads",    weight: 0.80, role: "primary"   },
      { muscle: "shoulders",weight: 0.80, role: "primary"   },
      { muscle: "glutes",   weight: 0.55, role: "primary"   },
      { muscle: "triceps",  weight: 0.35, role: "secondary" },
      { muscle: "core",     weight: 0.35, role: "secondary" },
      { muscle: "hamstrings",weight: 0.25, role: "secondary"},
    ],
  },

  // ─── Hinge-dominant (3) ──────────────────────────────────────────────────

  {
    key: "deadlift",
    name: "Deadlift",
    aliases: [
      "deadlift", "barbell deadlift", "conventional deadlift", "sumo deadlift",
    ],
    pattern: "hinge", modality: "barbell", bias: "strength",
    muscles: [
      { muscle: "hamstrings",     weight: 0.85, role: "primary"    },
      { muscle: "glutes",         weight: 0.75, role: "primary"    },
      { muscle: "lower_back",     weight: 0.65, role: "primary"    },
      { muscle: "quads",          weight: 0.40, role: "secondary"  },
      { muscle: "upper_back_lats",weight: 0.40, role: "secondary"  },
      { muscle: "forearms_grip",  weight: 0.25, role: "secondary"  },
      { muscle: "core",           weight: 0.20, role: "stabilizer" },
    ],
  },
  {
    key: "romanian_deadlift",
    name: "Romanian Deadlift",
    aliases: [
      "romanian deadlift", "rdl", "barbell rdl", "dumbbell rdl", "db rdl",
      "stiff leg deadlift", "stiff-leg deadlift",
    ],
    pattern: "hinge", modality: "barbell", bias: "hypertrophy",
    muscles: [
      { muscle: "hamstrings",     weight: 0.90, role: "primary"    },
      { muscle: "glutes",         weight: 0.75, role: "primary"    },
      { muscle: "lower_back",     weight: 0.45, role: "secondary"  },
      { muscle: "upper_back_lats",weight: 0.25, role: "secondary"  },
      { muscle: "forearms_grip",  weight: 0.20, role: "stabilizer" },
    ],
  },
  {
    key: "kettlebell_swing",
    name: "Kettlebell Swing",
    aliases: [
      "kettlebell swing", "kb swing",
      "american kettlebell swing", "american kb swing",
      "russian kettlebell swing", "russian kb swing",
    ],
    pattern: "hinge", modality: "kettlebell", bias: "power",
    muscles: [
      { muscle: "glutes",        weight: 0.85, role: "primary"    },
      { muscle: "hamstrings",    weight: 0.70, role: "primary"    },
      { muscle: "lower_back",    weight: 0.45, role: "secondary"  },
      { muscle: "core",          weight: 0.40, role: "secondary"  },
      { muscle: "shoulders",     weight: 0.25, role: "secondary"  },
      { muscle: "forearms_grip", weight: 0.20, role: "stabilizer" },
    ],
  },

  // ─── Olympic lifts (3) ───────────────────────────────────────────────────

  {
    key: "dumbbell_snatch",
    name: "Dumbbell Snatch",
    aliases: ["dumbbell snatch", "db snatch", "single arm dumbbell snatch"],
    pattern: "olympic_lift", modality: "dumbbell", bias: "power",
    muscles: [
      { muscle: "glutes",        weight: 0.70, role: "primary"    },
      { muscle: "hamstrings",    weight: 0.60, role: "primary"    },
      { muscle: "shoulders",     weight: 0.65, role: "primary"    },
      { muscle: "quads",         weight: 0.45, role: "secondary"  },
      { muscle: "lower_back",    weight: 0.35, role: "secondary"  },
      { muscle: "core",          weight: 0.30, role: "secondary"  },
      { muscle: "forearms_grip", weight: 0.20, role: "stabilizer" },
    ],
  },
  {
    key: "power_clean",
    name: "Power Clean",
    aliases: ["power clean", "barbell power clean"],
    pattern: "olympic_lift", modality: "barbell", bias: "power",
    muscles: [
      { muscle: "glutes",         weight: 0.75, role: "primary"    },
      { muscle: "hamstrings",     weight: 0.65, role: "primary"    },
      { muscle: "quads",          weight: 0.60, role: "primary"    },
      { muscle: "upper_back_lats",weight: 0.55, role: "secondary"  },
      { muscle: "shoulders",      weight: 0.45, role: "secondary"  },
      { muscle: "lower_back",     weight: 0.30, role: "secondary"  },
      { muscle: "forearms_grip",  weight: 0.35, role: "secondary"  },
      { muscle: "core",           weight: 0.25, role: "stabilizer" },
    ],
  },
  {
    key: "squat_clean",
    name: "Squat Clean",
    aliases: ["squat clean", "clean", "barbell clean", "full clean"],
    pattern: "olympic_lift", modality: "barbell", bias: "power",
    muscles: [
      { muscle: "quads",          weight: 0.85, role: "primary"    },
      { muscle: "glutes",         weight: 0.75, role: "primary"    },
      { muscle: "hamstrings",     weight: 0.55, role: "primary"    },
      { muscle: "upper_back_lats",weight: 0.55, role: "secondary"  },
      { muscle: "shoulders",      weight: 0.45, role: "secondary"  },
      { muscle: "lower_back",     weight: 0.35, role: "secondary"  },
      { muscle: "forearms_grip",  weight: 0.30, role: "secondary"  },
      { muscle: "core",           weight: 0.25, role: "stabilizer" },
    ],
  },

  // ─── Vertical push (4) ───────────────────────────────────────────────────

  {
    key: "push_press",
    name: "Push Press",
    aliases: [
      "push press", "barbell push press", "dumbbell push press", "db push press",
    ],
    pattern: "vertical_push", modality: "barbell", bias: "power",
    muscles: [
      { muscle: "shoulders",weight: 0.85, role: "primary"    },
      { muscle: "triceps",  weight: 0.55, role: "secondary"  },
      { muscle: "quads",    weight: 0.35, role: "secondary"  },
      { muscle: "glutes",   weight: 0.30, role: "secondary"  },
      { muscle: "core",     weight: 0.25, role: "secondary"  },
    ],
  },
  {
    key: "strict_press",
    name: "Strict Press",
    aliases: [
      "strict press", "overhead press", "ohp", "barbell press",
      "barbell overhead press", "military press",
    ],
    pattern: "vertical_push", modality: "barbell", bias: "strength",
    muscles: [
      { muscle: "shoulders",      weight: 0.90, role: "primary"    },
      { muscle: "triceps",        weight: 0.60, role: "secondary"  },
      { muscle: "core",           weight: 0.30, role: "secondary"  },
      { muscle: "upper_back_lats",weight: 0.25, role: "stabilizer" },
    ],
  },
  {
    key: "handstand_push_up",
    name: "Handstand Push-Up",
    aliases: [
      "handstand push-up", "handstand push up", "hspu",
      "strict hspu", "kipping hspu",
    ],
    pattern: "vertical_push", modality: "bodyweight", bias: "strength",
    muscles: [
      { muscle: "shoulders",      weight: 0.90, role: "primary"    },
      { muscle: "triceps",        weight: 0.65, role: "secondary"  },
      { muscle: "core",           weight: 0.30, role: "secondary"  },
      { muscle: "upper_back_lats",weight: 0.25, role: "stabilizer" },
    ],
  },
  {
    key: "dumbbell_shoulder_press",
    name: "Dumbbell Shoulder Press",
    aliases: [
      "dumbbell shoulder press", "db shoulder press",
      "dumbbell press", "db press",
    ],
    pattern: "vertical_push", modality: "dumbbell", bias: "hypertrophy",
    muscles: [
      { muscle: "shoulders",      weight: 0.85, role: "primary"    },
      { muscle: "triceps",        weight: 0.55, role: "secondary"  },
      { muscle: "core",           weight: 0.20, role: "stabilizer" },
      { muscle: "upper_back_lats",weight: 0.15, role: "stabilizer" },
    ],
  },

  // ─── Horizontal push (2) ─────────────────────────────────────────────────

  {
    key: "bench_press",
    name: "Bench Press",
    aliases: [
      "bench press", "barbell bench press", "flat bench press",
      "flat bench", "chest press",
    ],
    pattern: "horizontal_push", modality: "barbell", bias: "hypertrophy",
    muscles: [
      { muscle: "chest",          weight: 0.90, role: "primary"    },
      { muscle: "triceps",        weight: 0.60, role: "secondary"  },
      { muscle: "shoulders",      weight: 0.40, role: "secondary"  },
      { muscle: "upper_back_lats",weight: 0.20, role: "stabilizer" },
    ],
  },
  {
    key: "push_up",
    name: "Push-Up",
    aliases: ["push-up", "push up", "pushup", "push ups", "push-ups"],
    pattern: "horizontal_push", modality: "bodyweight", bias: "hypertrophy",
    muscles: [
      { muscle: "chest",    weight: 0.80, role: "primary"    },
      { muscle: "triceps",  weight: 0.55, role: "secondary"  },
      { muscle: "shoulders",weight: 0.45, role: "secondary"  },
      { muscle: "core",     weight: 0.25, role: "stabilizer" },
    ],
  },

  // ─── Vertical pull (2) ───────────────────────────────────────────────────

  {
    key: "pull_up",
    name: "Pull-Up",
    aliases: [
      "pull-up", "pull up", "pullup", "pull-ups", "pull ups",
      "strict pull-up", "strict pull up",
      "kipping pull-up", "kipping pull up",
      "banded pull-up", "ring pull-up",
    ],
    pattern: "vertical_pull", modality: "bodyweight", bias: "strength",
    muscles: [
      { muscle: "upper_back_lats",weight: 0.90, role: "primary"    },
      { muscle: "biceps",         weight: 0.65, role: "primary"    },
      { muscle: "forearms_grip",  weight: 0.30, role: "secondary"  },
      { muscle: "core",           weight: 0.25, role: "secondary"  },
      { muscle: "shoulders",      weight: 0.20, role: "stabilizer" },
    ],
  },
  {
    key: "chest_to_bar_pull_up",
    name: "Chest-to-Bar Pull-Up",
    aliases: [
      "chest-to-bar pull-up", "chest to bar pull-up",
      "chest-to-bar", "chest to bar",
      "c2b", "c2b pull-up",
    ],
    pattern: "vertical_pull", modality: "bodyweight", bias: "strength",
    muscles: [
      { muscle: "upper_back_lats",weight: 0.90, role: "primary"    },
      { muscle: "biceps",         weight: 0.65, role: "primary"    },
      { muscle: "forearms_grip",  weight: 0.30, role: "secondary"  },
      { muscle: "core",           weight: 0.30, role: "secondary"  },
      { muscle: "shoulders",      weight: 0.25, role: "secondary"  },
    ],
  },

  // ─── Horizontal pull (3) ─────────────────────────────────────────────────

  {
    key: "ring_row",
    name: "Ring Row",
    aliases: ["ring row", "ring rows"],
    pattern: "horizontal_pull", modality: "bodyweight", bias: "hypertrophy",
    muscles: [
      { muscle: "upper_back_lats",weight: 0.80, role: "primary"   },
      { muscle: "biceps",         weight: 0.55, role: "secondary" },
      { muscle: "core",           weight: 0.25, role: "secondary" },
      { muscle: "shoulders",      weight: 0.25, role: "secondary" },
    ],
  },
  {
    key: "dumbbell_row",
    name: "Dumbbell Row",
    aliases: [
      "dumbbell row", "db row",
      "single arm dumbbell row", "single arm row",
    ],
    pattern: "horizontal_pull", modality: "dumbbell", bias: "hypertrophy",
    muscles: [
      { muscle: "upper_back_lats",weight: 0.85, role: "primary"    },
      { muscle: "biceps",         weight: 0.55, role: "secondary"  },
      { muscle: "lower_back",     weight: 0.25, role: "secondary"  },
      { muscle: "core",           weight: 0.20, role: "stabilizer" },
      { muscle: "forearms_grip",  weight: 0.20, role: "stabilizer" },
    ],
  },
  {
    key: "barbell_row",
    name: "Barbell Row",
    aliases: [
      "barbell row", "bent over row", "barbell bent over row", "pendlay row",
    ],
    pattern: "horizontal_pull", modality: "barbell", bias: "strength",
    muscles: [
      { muscle: "upper_back_lats",weight: 0.85, role: "primary"    },
      { muscle: "biceps",         weight: 0.55, role: "secondary"  },
      { muscle: "lower_back",     weight: 0.30, role: "secondary"  },
      { muscle: "core",           weight: 0.25, role: "secondary"  },
      { muscle: "forearms_grip",  weight: 0.20, role: "stabilizer" },
    ],
  },

  // ─── Gymnastics (3) ──────────────────────────────────────────────────────

  {
    key: "bar_muscle_up",
    name: "Bar Muscle-Up",
    aliases: [
      "bar muscle-up", "bar muscle up",
      "muscle-up", "muscle up", "bmu",
    ],
    pattern: "gymnastics", modality: "bodyweight", bias: "strength",
    muscles: [
      { muscle: "upper_back_lats",weight: 0.85, role: "primary"    },
      { muscle: "biceps",         weight: 0.60, role: "primary"    },
      { muscle: "chest",          weight: 0.50, role: "secondary"  },
      { muscle: "triceps",        weight: 0.45, role: "secondary"  },
      { muscle: "core",           weight: 0.35, role: "secondary"  },
      { muscle: "forearms_grip",  weight: 0.25, role: "secondary"  },
      { muscle: "shoulders",      weight: 0.20, role: "stabilizer" },
    ],
  },
  {
    key: "toes_to_bar",
    name: "Toes-to-Bar",
    aliases: ["toes-to-bar", "toes to bar", "t2b"],
    pattern: "gymnastics", modality: "bodyweight", bias: "strength",
    muscles: [
      { muscle: "core",           weight: 0.90, role: "primary"    },
      { muscle: "forearms_grip",  weight: 0.35, role: "secondary"  },
      { muscle: "upper_back_lats",weight: 0.30, role: "secondary"  },
      { muscle: "shoulders",      weight: 0.25, role: "secondary"  },
    ],
  },
  {
    key: "hollow_hold",
    name: "Hollow Hold",
    aliases: ["hollow hold", "hollow body hold", "hollow body"],
    pattern: "core_bracing", modality: "bodyweight", bias: "strength",
    muscles: [
      { muscle: "core",     weight: 0.90, role: "primary"    },
      { muscle: "shoulders",weight: 0.25, role: "stabilizer" },
    ],
  },

  // ─── Core flexion (2) ────────────────────────────────────────────────────

  {
    key: "sit_up",
    name: "Sit-Up",
    aliases: ["sit-up", "sit up", "situp", "sit-ups", "sit ups"],
    pattern: "core_flexion", modality: "bodyweight", bias: "hypertrophy",
    muscles: [
      { muscle: "core",      weight: 0.90, role: "primary"   },
      { muscle: "hamstrings",weight: 0.20, role: "stabilizer"},
    ],
  },
  {
    key: "ghd_sit_up",
    name: "GHD Sit-Up",
    aliases: [
      "ghd sit-up", "ghd sit up", "ghd situp",
      "glute ham developer sit up",
    ],
    pattern: "core_flexion", modality: "machine", bias: "hypertrophy",
    muscles: [
      { muscle: "core",      weight: 0.85, role: "primary"   },
      { muscle: "hamstrings",weight: 0.40, role: "secondary" },
      { muscle: "glutes",    weight: 0.25, role: "secondary" },
    ],
  },

  // ─── Core bracing (1) ────────────────────────────────────────────────────

  {
    key: "plank",
    name: "Plank",
    aliases: ["plank", "front plank"],
    pattern: "core_bracing", modality: "bodyweight", bias: "endurance",
    muscles: [
      { muscle: "core",     weight: 0.90, role: "primary"    },
      { muscle: "shoulders",weight: 0.35, role: "secondary"  },
      { muscle: "glutes",   weight: 0.25, role: "stabilizer" },
    ],
  },

  // ─── Cyclical (8) — conservative, distributed weights ────────────────────
  // Physiological note: cyclical movements distribute load across multiple
  // systems. No single muscle group should be overstated. Weights are moderate
  // and reflect relative contribution, not peak activation. All roles are
  // authored to reflect primary movers in the kinetic chain.

  {
    key: "row_erg",
    name: "Row (Erg)",
    aliases: [
      "row", "rowing", "erg row", "row erg",
      "concept 2 row", "c2 row", "concept2 row", "rower",
    ],
    pattern: "cyclical", modality: "erg", bias: "conditioning",
    muscles: [
      { muscle: "upper_back_lats",weight: 0.50, role: "primary"   },
      { muscle: "quads",          weight: 0.45, role: "primary"   },
      { muscle: "hamstrings",     weight: 0.40, role: "secondary" },
      { muscle: "glutes",         weight: 0.40, role: "secondary" },
      { muscle: "biceps",         weight: 0.30, role: "secondary" },
      { muscle: "core",           weight: 0.30, role: "secondary" },
      { muscle: "forearms_grip",  weight: 0.20, role: "stabilizer"},
    ],
  },
  {
    key: "run",
    name: "Run",
    aliases: [
      "run", "running",
      "run 400m", "400m run", "800m run",
      "1 mile run", "1600m run", "mile run",
    ],
    pattern: "cyclical", modality: "bodyweight", bias: "conditioning",
    muscles: [
      { muscle: "quads",    weight: 0.60, role: "primary"    },
      { muscle: "glutes",   weight: 0.55, role: "primary"    },
      { muscle: "hamstrings",weight: 0.55, role: "primary"   },
      { muscle: "calves",   weight: 0.45, role: "secondary"  },
      { muscle: "core",     weight: 0.20, role: "stabilizer" },
    ],
  },
  {
    key: "bike_erg",
    name: "Bike Erg",
    aliases: ["bike erg", "bike", "cycling"],
    pattern: "cyclical", modality: "erg", bias: "conditioning",
    muscles: [
      { muscle: "quads",    weight: 0.65, role: "primary"    },
      { muscle: "glutes",   weight: 0.45, role: "secondary"  },
      { muscle: "hamstrings",weight: 0.35, role: "secondary" },
      { muscle: "calves",   weight: 0.20, role: "stabilizer" },
      { muscle: "core",     weight: 0.15, role: "stabilizer" },
    ],
  },
  {
    key: "echo_bike",
    name: "Echo Bike",
    aliases: ["echo bike", "airdyne", "air bike"],
    pattern: "cyclical", modality: "erg", bias: "conditioning",
    muscles: [
      { muscle: "quads",    weight: 0.60, role: "primary"    },
      { muscle: "glutes",   weight: 0.40, role: "secondary"  },
      { muscle: "hamstrings",weight: 0.35, role: "secondary" },
      { muscle: "shoulders",weight: 0.35, role: "secondary"  },
      { muscle: "chest",    weight: 0.25, role: "secondary"  },
      { muscle: "calves",   weight: 0.20, role: "stabilizer" },
      { muscle: "core",     weight: 0.20, role: "stabilizer" },
    ],
  },
  {
    key: "assault_bike",
    name: "Assault Bike",
    aliases: ["assault bike", "assault bike erg"],
    pattern: "cyclical", modality: "erg", bias: "conditioning",
    muscles: [
      { muscle: "quads",    weight: 0.60, role: "primary"    },
      { muscle: "glutes",   weight: 0.40, role: "secondary"  },
      { muscle: "hamstrings",weight: 0.35, role: "secondary" },
      { muscle: "shoulders",weight: 0.35, role: "secondary"  },
      { muscle: "chest",    weight: 0.25, role: "secondary"  },
      { muscle: "calves",   weight: 0.20, role: "stabilizer" },
      { muscle: "core",     weight: 0.20, role: "stabilizer" },
    ],
  },
  {
    key: "ski_erg",
    name: "Ski Erg",
    aliases: ["ski erg", "ski", "skierg"],
    pattern: "cyclical", modality: "erg", bias: "conditioning",
    muscles: [
      { muscle: "upper_back_lats",weight: 0.55, role: "primary"   },
      { muscle: "shoulders",      weight: 0.50, role: "primary"   },
      { muscle: "core",           weight: 0.45, role: "primary"   },
      { muscle: "triceps",        weight: 0.35, role: "secondary" },
      { muscle: "hamstrings",     weight: 0.30, role: "secondary" },
      { muscle: "glutes",         weight: 0.30, role: "secondary" },
    ],
  },
  {
    key: "jump_rope",
    name: "Jump Rope",
    aliases: ["jump rope", "single under", "singles", "single-under"],
    pattern: "cyclical", modality: "bodyweight", bias: "conditioning",
    muscles: [
      { muscle: "calves",       weight: 0.65, role: "primary"    },
      { muscle: "quads",        weight: 0.35, role: "secondary"  },
      { muscle: "core",         weight: 0.25, role: "secondary"  },
      { muscle: "shoulders",    weight: 0.25, role: "secondary"  },
      { muscle: "forearms_grip",weight: 0.20, role: "stabilizer" },
    ],
  },
  {
    key: "double_under",
    name: "Double-Under",
    aliases: [
      "double-under", "double under",
      "double-unders", "double unders", "du", "dubs",
    ],
    pattern: "cyclical", modality: "bodyweight", bias: "conditioning",
    muscles: [
      { muscle: "calves",       weight: 0.70, role: "primary"    },
      { muscle: "quads",        weight: 0.35, role: "secondary"  },
      { muscle: "forearms_grip",weight: 0.30, role: "secondary"  },
      { muscle: "shoulders",    weight: 0.25, role: "secondary"  },
      { muscle: "core",         weight: 0.20, role: "stabilizer" },
    ],
  },

  // ─── Jump / plyometric (3) ───────────────────────────────────────────────

  {
    key: "burpee",
    name: "Burpee",
    aliases: ["burpee", "burpees"],
    pattern: "jump", modality: "bodyweight", bias: "conditioning",
    muscles: [
      { muscle: "quads",    weight: 0.60, role: "primary"    },
      { muscle: "chest",    weight: 0.55, role: "primary"    },
      { muscle: "glutes",   weight: 0.40, role: "secondary"  },
      { muscle: "shoulders",weight: 0.45, role: "secondary"  },
      { muscle: "core",     weight: 0.45, role: "secondary"  },
      { muscle: "triceps",  weight: 0.35, role: "secondary"  },
      { muscle: "hamstrings",weight: 0.25, role: "secondary" },
    ],
  },
  {
    key: "box_jump",
    name: "Box Jump",
    aliases: ["box jump", "box jumps"],
    pattern: "jump", modality: "bodyweight", bias: "power",
    muscles: [
      { muscle: "quads",    weight: 0.75, role: "primary"    },
      { muscle: "glutes",   weight: 0.65, role: "primary"    },
      { muscle: "hamstrings",weight: 0.50, role: "secondary" },
      { muscle: "calves",   weight: 0.40, role: "secondary"  },
      { muscle: "core",     weight: 0.25, role: "stabilizer" },
    ],
  },
  {
    key: "burpee_box_jump_over",
    name: "Burpee Box Jump Over",
    aliases: ["burpee box jump over", "burpee box jump"],
    pattern: "jump", modality: "bodyweight", bias: "conditioning",
    muscles: [
      { muscle: "quads",    weight: 0.65, role: "primary"    },
      { muscle: "glutes",   weight: 0.60, role: "primary"    },
      { muscle: "chest",    weight: 0.55, role: "primary"    },
      { muscle: "hamstrings",weight: 0.45, role: "secondary" },
      { muscle: "core",     weight: 0.45, role: "secondary"  },
      { muscle: "shoulders",weight: 0.40, role: "secondary"  },
      { muscle: "triceps",  weight: 0.30, role: "secondary"  },
      { muscle: "calves",   weight: 0.25, role: "secondary"  },
    ],
  },

  // ─── Lunge (1) ───────────────────────────────────────────────────────────

  {
    key: "walking_lunge",
    name: "Walking Lunge",
    aliases: [
      "walking lunge", "walking lunges", "lunge", "lunges",
      "forward lunge", "reverse lunge",
    ],
    pattern: "lunge", modality: "bodyweight", bias: "hypertrophy",
    muscles: [
      { muscle: "quads",    weight: 0.80, role: "primary"    },
      { muscle: "glutes",   weight: 0.65, role: "primary"    },
      { muscle: "hamstrings",weight: 0.45, role: "secondary" },
      { muscle: "calves",   weight: 0.25, role: "secondary"  },
      { muscle: "core",     weight: 0.20, role: "stabilizer" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Derived lookup structures (computed from profile data — single source of truth)
// ---------------------------------------------------------------------------

/** Profile dictionary keyed by canonical key. */
export const MOVEMENT_PROFILES: ReadonlyMap<string, MovementProfile> =
  new Map(PROFILES_LIST.map((profile) => [profile.key, profile]));

/**
 * Flat alias map derived from profile.aliases — single source of truth for
 * alias strings lives on each profile, not in a separate top-level map.
 *
 * Alias strings are stored lowercase and hyphen-free in each profile.aliases
 * array and indexed directly here.
 */
export const MOVEMENT_ALIASES: ReadonlyMap<string, string> = new Map(
  PROFILES_LIST.flatMap((profile) =>
    profile.aliases.map((alias) => [alias, profile.key])
  )
);

// ---------------------------------------------------------------------------
// Normalization helpers
// ---------------------------------------------------------------------------

/**
 * Lightly normalize a name for alias lookup: lowercase, trim, hyphens → spaces,
 * collapse whitespace. Does NOT strip equipment prefixes or distance tokens.
 *
 * Used as the primary alias lookup path to preserve equipment-context distinctions
 * (e.g. "db row" must not collapse to "row" → row_erg).
 */
function liteNormalize(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/-/g, " ")
    .replace(/\s+/g, " ");
}

/**
 * Fully normalize a movement name for secondary alias lookup and direct key match.
 *
 * Steps applied in order:
 *  1. Lowercase + collapse whitespace
 *  2. Strip leading equipment prefix (barbell/dumbbell/kb/etc.)
 *  3. Strip leading/trailing distance tokens (400m, 1 mile, etc.)
 *  4. Replace hyphens with spaces, collapse repeated spaces
 *
 * This is more aggressive than the equipment-only stripping in
 * vaultIngestion.normalizeExerciseName() — that function is untouched.
 */
export function normalizeMovementName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/^(barbell|dumbbell|db|kettlebell|kb|cable|machine|ez[\s-]?bar|smith)\s+/i, "")
    .replace(/^\d+\s?(?:m|km|mile[s]?)\s+/i, "")
    .replace(/\s+\d+\s?(?:m|km|mile[s]?)$/i, "")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Core lookup functions
// ---------------------------------------------------------------------------

/**
 * Look up a movement profile by raw name.
 *
 * Resolution order:
 *  1. Lite alias lookup (lowercase + trim + hyphens, NO prefix strip)
 *     — preserves "db row" ≠ "row" equipment-context distinction
 *  2. Full alias lookup (strips equipment prefix, distance tokens)
 *     — handles "Barbell Back Squat" → "back squat" → back_squat
 *  3. Direct key match (fully-normalized, spaces → underscores)
 *     — handles "hollow hold" → "hollow_hold" without needing an alias entry
 *  4. null — caller must use keyword fallback
 */
export function getMovementProfile(name: string): MovementProfile | null {
  // 1. Lite alias lookup
  const lite = liteNormalize(name);
  const liteKey = MOVEMENT_ALIASES.get(lite);
  if (liteKey) return MOVEMENT_PROFILES.get(liteKey) ?? null;

  // 2. Full alias lookup (equipment prefix stripped)
  const full = normalizeMovementName(name);
  const fullKey = MOVEMENT_ALIASES.get(full);
  if (fullKey) return MOVEMENT_PROFILES.get(fullKey) ?? null;

  // 3. Direct key match
  const directKey = full.replace(/\s+/g, "_");
  if (MOVEMENT_PROFILES.has(directKey)) return MOVEMENT_PROFILES.get(directKey)!;

  return null;
}

/**
 * Return the ordered muscle contribution vector for a movement, or null if
 * the movement is not recognized.
 *
 * Callers MUST fall back to the existing broad keyword stimulus logic when
 * this returns null — do not treat null as "no muscles".
 */
export function getBaseMuscleVector(name: string): MuscleContribution[] | null {
  const profile = getMovementProfile(name);
  return profile ? profile.muscles : null;
}

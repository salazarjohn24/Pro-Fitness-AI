/**
 * movementScoringTypes.ts — Step 2 shared types.
 *
 * Pure type module: no runtime logic, no imports from server infrastructure.
 * Consumed by exposureScoring.ts, muscleVector.ts, stimulusVector.ts, and
 * any future route or service that needs to score a movement.
 *
 * SCOPE: Step 2 only. No prescribed/performed delta, no fatigue/recovery/
 * readiness, no historical aggregation — those are explicitly Step 3+.
 */

import type { MovementProfile } from "./movementProfiles";

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

/**
 * Raw inputs describing a single performed movement entry.
 *
 * Callers supply whatever fields they have — the scoring engine selects the
 * best available method and annotates its assumptions.
 *
 * Load can be provided in kg or lb; if both are present, kg takes precedence.
 */
export interface PerformedMovementInput {
  /** Raw movement name, resolved via Step 1 profile lookup. */
  name: string;

  /** Rep count (for rep-based movements). */
  reps?: number;

  /** External load in kilograms. */
  loadKg?: number;

  /** External load in pounds (converted to kg internally). */
  loadLb?: number;

  /** Duration in seconds (for time-based holds or cyclical time workouts). */
  durationSec?: number;

  /** Distance in metres (for distance-based cyclical movements). */
  distanceM?: number;

  /** Calories (for calorie-based cyclical movements). */
  calories?: number;
}

// ---------------------------------------------------------------------------
// Exposure
// ---------------------------------------------------------------------------

/**
 * Which data inputs were used to compute exposure.
 * Annotated on the output so callers can understand the scoring path.
 */
export type ExposureMethod =
  | "loaded_reps"       // reps + external load (barbell, KB, DB)
  | "bodyweight_reps"   // reps with no external load
  | "duration"          // time-based hold (plank, hollow hold, etc.)
  | "cyclical_distance" // distance-based cyclical (row 500m, run 400m)
  | "cyclical_calories" // calorie-based cyclical (20 cal bike)
  | "cyclical_time"     // time-based cyclical (row for time, run for time)
  | "unknown";          // insufficient data — score is minimal placeholder

/**
 * Full exposure breakdown including method, inputs used, scalar result, and
 * human-readable assumptions for transparency.
 *
 * rawScore is a dimensionless scalar (≥ 0.0) used to scale muscle weights:
 *   ~0.0–0.5  → light / sub-threshold
 *   ~0.5–1.5  → moderate working-set equivalent
 *   ~1.5–3.0  → high-volume or high-load
 *   ~3.0–4.0  → extreme (capped at MAX_RAW_SCORE)
 */
export interface MovementExposureBreakdown {
  method: ExposureMethod;
  /** Dimensionless exposure scalar used to scale muscle weights. */
  rawScore: number;
  reps?: number;
  loadKg?: number;
  durationSec?: number;
  distanceM?: number;
  calories?: number;
  /** Human-readable explanation of how rawScore was computed. */
  assumptions: string[];
}

// ---------------------------------------------------------------------------
// Muscle vector
// ---------------------------------------------------------------------------

/**
 * Per-muscle weighted score map.
 *
 * Keys are V1 MuscleGroup strings (e.g. "quads", "upper_back_lats").
 * Values are dimensionless scores derived from:
 *   score = baseWeight × rawScore × roleFactor
 *
 * Scores are NOT normalised to sum to 1.0. They represent relative stimulus
 * magnitude across muscles within a single movement. Consumers comparing
 * across multiple movements should aggregate (Step 3+, not here).
 */
export type MuscleVector = Partial<Record<string, number>>;

// ---------------------------------------------------------------------------
// Stimulus vector
// ---------------------------------------------------------------------------

/**
 * Broad physiological stimulus tendencies for a movement.
 *
 * Each value is 0.0–1.0 and represents tendency (not probability or certainty).
 * Derived heuristically from profile.bias + pattern + rep-range signals.
 *
 * Not mutually exclusive — a thruster can simultaneously be power (0.8) and
 * conditioning (0.7) in high-rep form.
 */
export interface StimulusVector {
  strength: number;
  hypertrophy: number;
  muscular_endurance: number;
  power: number;
  conditioning: number;
}

// ---------------------------------------------------------------------------
// Movement score result
// ---------------------------------------------------------------------------

/**
 * Full result from scoring a single performed movement.
 *
 * When fallbackUsed=true, the profile was not resolved and muscleVector will
 * be empty ({}). Downstream callers MUST apply the existing broad keyword
 * stimulus logic in audit.ts as Tier 2 fallback.
 */
export interface MovementScoreResult {
  /** Canonical Step 1 key, or null if unrecognised. */
  movementKey: string | null;
  /** Original input name (preserved for logging / debugging). */
  movementName: string;
  /** Step 1 profile if found, else null. */
  profile: MovementProfile | null;
  /** How exposure was computed. */
  exposure: MovementExposureBreakdown;
  /** Per-muscle weighted scores. Empty when fallbackUsed=true. */
  muscleVector: MuscleVector;
  /** Broad stimulus tendencies. */
  stimulusVector: StimulusVector;
  /**
   * True if Step 1 profile was not found.
   * Callers MUST NOT treat this as "no muscles" — apply keyword fallback.
   */
  fallbackUsed: boolean;
}

/**
 * exposureScoring.ts — Step 2 V1 heuristic exposure scalar.
 *
 * Given a PerformedMovementInput and the resolved MovementProfile (or null),
 * returns a MovementExposureBreakdown that includes:
 *   - which scoring method was used
 *   - the dimensionless rawScore
 *   - all inputs consumed
 *   - human-readable assumption notes
 *
 * DESIGN PRINCIPLES
 * -----------------
 * 1. Conservative — heuristics deliberately underestimate rather than overstate.
 * 2. Explainable — rawScore derivation is always annotated in `assumptions`.
 * 3. Movement-type aware — cyclical, duration, loaded-rep, and bodyweight-rep
 *    movements each use method-appropriate heuristics.
 * 4. Graceful — always returns a valid breakdown, even with no useful inputs.
 *
 * rawScore scale (approximate):
 *   ~0.0–0.5   light / sub-threshold
 *   ~0.5–1.5   moderate working-set equivalent
 *   ~1.5–3.0   high-volume or high-load
 *   ~3.0–4.0   extreme (hard-capped at MAX_RAW_SCORE to prevent outliers)
 *
 * SCOPE: Step 2 only. No prescribed/performed delta. No fatigue scoring.
 */

import type { MovementProfile } from "./movementProfiles";
import type {
  PerformedMovementInput,
  MovementExposureBreakdown,
  ExposureMethod,
} from "./movementScoringTypes";

// ---------------------------------------------------------------------------
// Calibration constants (conservative, easily adjustable for V2)
// ---------------------------------------------------------------------------

/** "Moderate" barbell reference load for load factor normalisation. */
const LOAD_REFERENCE_KG = 80;

/** "Moderate" rep count for rep factor normalisation. */
const REP_REFERENCE = 10;

/** Hard cap on rawScore — prevents extreme outliers from dominating. */
const MAX_RAW_SCORE = 4.0;

/** Pounds → kilograms conversion. */
const KG_PER_LB = 0.453592;

/**
 * Bodyweight load proxy. Bodyweight movements are estimated as roughly
 * equivalent to carrying ~60 kg of external load for scoring purposes.
 * Conservative: a 60 kg adult performing pull-ups receives half the load
 * factor of someone pressing 120 kg.
 */
const BW_LOAD_PROXY_KG = 60;

/** 500 m = 1 exposure unit for distance-based cyclical movements. */
const DISTANCE_REFERENCE_M = 500;

/** 15 cal = 1 exposure unit for calorie-based cyclical movements. */
const CALORIE_REFERENCE = 15;

/** 60 s = 1 exposure unit for time-based holds and cyclical time work. */
const DURATION_REFERENCE_SEC = 60;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Resolve external load in kg from the input, preferring kg over lb.
 * Returns undefined if no load was provided.
 */
export function resolveLoadKg(
  input: Pick<PerformedMovementInput, "loadKg" | "loadLb">
): number | undefined {
  if (input.loadKg != null && input.loadKg > 0) return input.loadKg;
  if (input.loadLb != null && input.loadLb > 0) {
    return Number((input.loadLb * KG_PER_LB).toFixed(1));
  }
  return undefined;
}

/** Clamp a value to [min, max]. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// ---------------------------------------------------------------------------
// Core scoring functions (exported for unit testing)
// ---------------------------------------------------------------------------

/**
 * Compute rawScore for a distance-based cyclical movement.
 * Reference: 500 m = 1.0 rawScore.
 */
export function scoreDistanceCyclical(distanceM: number): number {
  return clamp(distanceM / DISTANCE_REFERENCE_M, 0, MAX_RAW_SCORE);
}

/**
 * Compute rawScore for a calorie-based cyclical movement.
 * Reference: 15 cal = 1.0 rawScore.
 */
export function scoreCalorieCyclical(calories: number): number {
  return clamp(calories / CALORIE_REFERENCE, 0, MAX_RAW_SCORE);
}

/**
 * Compute rawScore for a duration-based movement (holds, timed cyclical).
 * Reference: 60 s = 1.0 rawScore.
 */
export function scoreDuration(durationSec: number): number {
  return clamp(durationSec / DURATION_REFERENCE_SEC, 0, MAX_RAW_SCORE);
}

/**
 * Compute rawScore for rep-based movements (loaded or bodyweight).
 *
 * Formula: (reps / REP_REFERENCE) × (1 + effectiveLoadKg / LOAD_REFERENCE_KG)
 * Capped at MAX_RAW_SCORE.
 *
 * - REP_REFERENCE = 10 → 10 reps at reference load = rawScore 2.0
 * - loadFactor grows sub-linearly: at 0 kg load factor = 1.0, at 80 kg = 2.0
 * - Bodyweight movements use BW_LOAD_PROXY_KG (60 kg) when no load given
 */
export function scoreReps(reps: number, effectiveLoadKg: number): number {
  const repFactor = reps / REP_REFERENCE;
  const loadFactor = 1 + effectiveLoadKg / LOAD_REFERENCE_KG;
  return clamp(repFactor * loadFactor, 0, MAX_RAW_SCORE);
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Compute the exposure breakdown for a single performed movement.
 *
 * Resolution priority:
 *   1. distanceM  → cyclical_distance
 *   2. calories   → cyclical_calories
 *   3. durationSec (cyclical pattern or no reps) → cyclical_time or duration
 *   4. reps       → loaded_reps or bodyweight_reps
 *   5. fallthrough → unknown (minimal placeholder)
 */
export function computeExposure(
  input: PerformedMovementInput,
  profile: MovementProfile | null
): MovementExposureBreakdown {
  const loadKg = resolveLoadKg(input);
  const assumptions: string[] = [];

  // 1. Distance-based cyclical ─────────────────────────────────────────────
  if (input.distanceM != null && input.distanceM > 0) {
    const rawScore = scoreDistanceCyclical(input.distanceM);
    return {
      method: "cyclical_distance",
      rawScore: Number(rawScore.toFixed(3)),
      distanceM: input.distanceM,
      assumptions: [
        `distance=${input.distanceM}m ÷ ref=${DISTANCE_REFERENCE_M}m → rawScore=${rawScore.toFixed(3)}`,
      ],
    };
  }

  // 2. Calorie-based cyclical ──────────────────────────────────────────────
  if (input.calories != null && input.calories > 0) {
    const rawScore = scoreCalorieCyclical(input.calories);
    return {
      method: "cyclical_calories",
      rawScore: Number(rawScore.toFixed(3)),
      calories: input.calories,
      assumptions: [
        `calories=${input.calories} ÷ ref=${CALORIE_REFERENCE} → rawScore=${rawScore.toFixed(3)}`,
      ],
    };
  }

  // 3. Duration-based (time holds or cyclical-time) ────────────────────────
  const hasDuration = input.durationSec != null && input.durationSec > 0;
  const hasReps = input.reps != null && input.reps > 0;
  const isCyclical = profile?.pattern === "cyclical";

  if (hasDuration && (!hasReps || isCyclical)) {
    const rawScore = scoreDuration(input.durationSec!);
    const method: ExposureMethod = isCyclical ? "cyclical_time" : "duration";
    return {
      method,
      rawScore: Number(rawScore.toFixed(3)),
      durationSec: input.durationSec!,
      assumptions: [
        `duration=${input.durationSec!}s ÷ ref=${DURATION_REFERENCE_SEC}s → rawScore=${rawScore.toFixed(3)}`,
      ],
    };
  }

  // 4. Rep-based ───────────────────────────────────────────────────────────
  if (hasReps) {
    const reps = input.reps!;
    const isBodyweightProfile = profile?.modality === "bodyweight";
    const isBodyweightInput = loadKg == null || loadKg === 0;

    // Effective load: explicit kg > explicit lb-converted > BW proxy > 0
    let effectiveLoadKg: number;
    let method: ExposureMethod;

    if (!isBodyweightInput) {
      effectiveLoadKg = loadKg!;
      method = "loaded_reps";
      assumptions.push(`load=${effectiveLoadKg.toFixed(1)}kg provided`);
    } else if (isBodyweightProfile) {
      effectiveLoadKg = BW_LOAD_PROXY_KG;
      method = "bodyweight_reps";
      assumptions.push(
        `no external load — bodyweight profile, using proxy ${BW_LOAD_PROXY_KG}kg`
      );
    } else {
      // Unloaded but not explicitly a bodyweight profile (edge case)
      effectiveLoadKg = BW_LOAD_PROXY_KG;
      method = "bodyweight_reps";
      assumptions.push(
        `no load provided — defaulting to bodyweight proxy ${BW_LOAD_PROXY_KG}kg`
      );
    }

    const rawScore = scoreReps(reps, effectiveLoadKg);
    const repFactor = reps / REP_REFERENCE;
    const loadFactor = 1 + effectiveLoadKg / LOAD_REFERENCE_KG;
    assumptions.push(
      `repFactor=${repFactor.toFixed(2)} × loadFactor=${loadFactor.toFixed(2)}` +
        ` = ${(repFactor * loadFactor).toFixed(3)} → clamped to ${rawScore.toFixed(3)}`
    );

    return {
      method,
      rawScore: Number(rawScore.toFixed(3)),
      reps,
      loadKg: effectiveLoadKg,
      assumptions,
    };
  }

  // 5. Unknown / insufficient data ─────────────────────────────────────────
  return {
    method: "unknown",
    rawScore: 0.1,
    assumptions: [
      "insufficient input (no reps, load, distance, calories, or duration) — minimal placeholder score",
    ],
  };
}

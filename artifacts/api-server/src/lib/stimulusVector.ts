/**
 * stimulusVector.ts — Step 2 physiological stimulus tendency generator.
 *
 * Produces a StimulusVector (five 0.0–1.0 tendency values) from:
 *   1. The movement profile's bias field (primary signal)
 *   2. The movement pattern (secondary override)
 *   3. The exposure breakdown's rep range (tertiary rep-range adjustment)
 *
 * Values represent tendency, not probability. They are NOT mutually exclusive —
 * 45 thrusters can simultaneously express high power and high conditioning.
 *
 * DESIGN PRINCIPLES
 * -----------------
 * - All output values are clamped to [0.0, 1.0].
 * - Adjustments are small (≤ 0.20) to avoid over-fitting rep range signals.
 * - Pattern overrides are additive on top of bias base — not replacements.
 * - When no profile is available, a neutral "unknown" template is returned.
 *
 * SCOPE: Step 2 only. No readiness/recovery/fatigue. No historical context.
 */

import type { StimulusBias, MovementPattern, MovementProfile } from "./movementProfiles";
import type { MovementExposureBreakdown, StimulusVector } from "./movementScoringTypes";

// ---------------------------------------------------------------------------
// Base templates by profile.bias
// ---------------------------------------------------------------------------

type BiasTemplate = Record<StimulusBias, StimulusVector>;

const BIAS_BASE: BiasTemplate = {
  strength: {
    strength: 0.80, hypertrophy: 0.50, muscular_endurance: 0.20,
    power: 0.30, conditioning: 0.10,
  },
  hypertrophy: {
    strength: 0.40, hypertrophy: 0.80, muscular_endurance: 0.40,
    power: 0.20, conditioning: 0.20,
  },
  power: {
    strength: 0.50, hypertrophy: 0.40, muscular_endurance: 0.20,
    power: 0.80, conditioning: 0.30,
  },
  endurance: {
    strength: 0.10, hypertrophy: 0.20, muscular_endurance: 0.80,
    power: 0.10, conditioning: 0.50,
  },
  conditioning: {
    strength: 0.20, hypertrophy: 0.30, muscular_endurance: 0.60,
    power: 0.30, conditioning: 0.80,
  },
  mixed: {
    strength: 0.40, hypertrophy: 0.50, muscular_endurance: 0.50,
    power: 0.40, conditioning: 0.40,
  },
};

/** Returned when no profile is available (fallback path). */
const UNKNOWN_STIMULUS: StimulusVector = {
  strength: 0.25, hypertrophy: 0.25, muscular_endurance: 0.25,
  power: 0.25, conditioning: 0.25,
};

// ---------------------------------------------------------------------------
// Pattern-level adjustments (additive, applied on top of bias base)
// ---------------------------------------------------------------------------

type PatternAdjustment = Partial<StimulusVector>;

const PATTERN_ADJUSTMENTS: Partial<Record<MovementPattern, PatternAdjustment>> = {
  cyclical:     { conditioning: +0.20, strength: -0.10, muscular_endurance: +0.10 },
  olympic_lift: { power: +0.15, conditioning: +0.05 },
  jump:         { power: +0.10, conditioning: +0.10, strength: -0.05 },
  core_bracing: { muscular_endurance: +0.15, strength: -0.10 },
  gymnastics:   { strength: +0.10, power: +0.05 },
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0.0), 1.0);
}

function applyAdjustment(
  base: StimulusVector,
  delta: PatternAdjustment
): StimulusVector {
  return {
    strength:          clamp01(base.strength          + (delta.strength          ?? 0)),
    hypertrophy:       clamp01(base.hypertrophy       + (delta.hypertrophy       ?? 0)),
    muscular_endurance:clamp01(base.muscular_endurance+ (delta.muscular_endurance?? 0)),
    power:             clamp01(base.power             + (delta.power             ?? 0)),
    conditioning:      clamp01(base.conditioning      + (delta.conditioning      ?? 0)),
  };
}

/**
 * Adjust stimulus based on rep-range signals.
 *
 * Low reps (≤ 5):   boost strength, reduce muscular_endurance
 * High reps (≥ 20): boost muscular_endurance + conditioning, reduce strength
 * Middle range:     no adjustment (profile bias is the dominant signal)
 */
function applyRepRangeAdjustment(
  sv: StimulusVector,
  reps: number
): StimulusVector {
  if (reps <= 5) {
    return applyAdjustment(sv, {
      strength: +0.15,
      power: +0.05,
      muscular_endurance: -0.15,
      conditioning: -0.05,
    });
  }
  if (reps >= 20) {
    return applyAdjustment(sv, {
      muscular_endurance: +0.15,
      conditioning: +0.10,
      strength: -0.10,
    });
  }
  return sv;
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Compute a stimulus tendency vector for a performed movement.
 *
 * @param profile - Resolved Step 1 profile (null → unknown template returned)
 * @param exposure - Computed exposure breakdown (used for rep-range signals)
 * @returns StimulusVector with all values in [0.0, 1.0]
 */
export function computeStimulusVector(
  profile: MovementProfile | null,
  exposure: MovementExposureBreakdown
): StimulusVector {
  if (profile === null) {
    return { ...UNKNOWN_STIMULUS };
  }

  // 1. Start from bias base template
  const biasBase = BIAS_BASE[profile.bias] ?? BIAS_BASE.mixed;
  let sv: StimulusVector = { ...biasBase };

  // 2. Apply pattern-level adjustment
  const patternDelta = PATTERN_ADJUSTMENTS[profile.pattern];
  if (patternDelta) {
    sv = applyAdjustment(sv, patternDelta);
  }

  // 3. Apply rep-range adjustment if reps available
  if (exposure.reps != null && exposure.reps > 0) {
    sv = applyRepRangeAdjustment(sv, exposure.reps);
  }

  // 4. Round to 2dp for clean output
  return {
    strength:           round2(sv.strength),
    hypertrophy:        round2(sv.hypertrophy),
    muscular_endurance: round2(sv.muscular_endurance),
    power:              round2(sv.power),
    conditioning:       round2(sv.conditioning),
  };
}

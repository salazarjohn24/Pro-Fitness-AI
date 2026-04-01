/**
 * muscleVector.ts — Step 2 muscle vector builder and main scoring entry point.
 *
 * Exports two functions:
 *   buildMuscleVector  — pure: profile × exposure → per-muscle scores
 *   scoreMovement      — orchestrator: resolves profile, computes exposure,
 *                        builds muscle vector, computes stimulus vector, and
 *                        returns a complete MovementScoreResult.
 *
 * ROLE MULTIPLIERS
 * ----------------
 * The Step 1 base weight encodes relative contribution within the movement.
 * The role multiplier additionally discounts secondary and stabilizer muscles
 * to reflect that involvement ≠ loading. A secondary muscle at weight 0.55
 * receives 70% of the stimulus that a primary at the same weight would receive.
 *
 *   primary    → 1.00 (full stimulus credit)
 *   secondary  → 0.70 (meaningful but subordinate contributor)
 *   stabilizer → 0.35 (postural / joint-support role, minimal hypertrophic load)
 *
 * Muscle scores use V1 MuscleGroup keys (not audit canonical keys). Callers
 * needing audit canonical mapping should use toAuditMuscle() from
 * muscleNormalization.ts.
 *
 * SCOPE: Step 2 only. No historical aggregation. No prescribed/performed delta.
 */

import { getMovementProfile } from "./movementProfiles";
import { computeExposure } from "./exposureScoring";
import { computeStimulusVector } from "./stimulusVector";
import type { MuscleRole, MovementProfile } from "./movementProfiles";
import type {
  PerformedMovementInput,
  MuscleVector,
  MovementScoreResult,
  StimulusVector,
} from "./movementScoringTypes";

// ---------------------------------------------------------------------------
// Role multipliers
// ---------------------------------------------------------------------------

const ROLE_MULTIPLIERS: Record<MuscleRole, number> = {
  primary:    1.00,
  secondary:  0.70,
  stabilizer: 0.35,
};

// ---------------------------------------------------------------------------
// Neutral stimulus vector (returned when profile is null)
// ---------------------------------------------------------------------------

const NEUTRAL_STIMULUS: StimulusVector = {
  strength: 0.25, hypertrophy: 0.25, muscular_endurance: 0.25,
  power: 0.25, conditioning: 0.25,
};

// ---------------------------------------------------------------------------
// Core computation
// ---------------------------------------------------------------------------

/**
 * Build a per-muscle weighted score map from a resolved profile and computed
 * exposure breakdown.
 *
 * Formula per muscle:
 *   score = contribution.weight × exposure.rawScore × ROLE_MULTIPLIERS[role]
 *
 * Muscles not in the profile receive no entry (not a zero — absence means
 * "not involved" rather than "zero stimulus").
 */
export function buildMuscleVector(
  profile: MovementProfile,
  rawScore: number
): MuscleVector {
  const vector: MuscleVector = {};
  for (const contribution of profile.muscles) {
    const roleFactor = ROLE_MULTIPLIERS[contribution.role] ?? 0.5;
    const score = contribution.weight * rawScore * roleFactor;
    vector[contribution.muscle] = Number(score.toFixed(3));
  }
  return vector;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Score a single performed movement entry.
 *
 * Resolution pipeline:
 *   1. Resolve movement profile from Step 1 (getMovementProfile)
 *   2. Compute exposure breakdown (computeExposure)
 *   3. Build muscle vector (buildMuscleVector) — empty when no profile
 *   4. Compute stimulus vector (computeStimulusVector)
 *   5. Assemble and return MovementScoreResult
 *
 * When the movement is unrecognised (fallbackUsed=true):
 *   - muscleVector is empty ({})
 *   - stimulusVector is the neutral equal-weight placeholder
 *   - Callers MUST apply the keyword fallback in audit.ts as Tier 2
 */
export function scoreMovement(input: PerformedMovementInput): MovementScoreResult {
  // Step 1: resolve profile
  const profile = getMovementProfile(input.name);
  const movementKey = profile?.key ?? null;
  const fallbackUsed = profile === null;

  // Step 2: compute exposure (profile may be null — handled gracefully)
  const exposure = computeExposure(input, profile);

  // Step 3: build muscle vector (only when profile is available)
  const muscleVector: MuscleVector = profile
    ? buildMuscleVector(profile, exposure.rawScore)
    : {};

  // Step 4: compute stimulus vector
  const stimulusVector: StimulusVector = profile
    ? computeStimulusVector(profile, exposure)
    : { ...NEUTRAL_STIMULUS };

  return {
    movementKey,
    movementName: input.name,
    profile,
    exposure,
    muscleVector,
    stimulusVector,
    fallbackUsed,
  };
}

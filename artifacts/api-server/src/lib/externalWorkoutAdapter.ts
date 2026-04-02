/**
 * externalWorkoutAdapter.ts — Step 8 external workout adapter.
 *
 * Converts the raw external workout DB row into a PerformedWorkoutInput that
 * can be passed to the existing Step 3–5 scoring stack.  Also computes
 * extraction-quality metadata so callers can decide eligibility and surface
 * accurate data-quality cues to users.
 *
 * SCOPE:
 *   - Pure transform — no DB access, no side effects.
 *   - Adapts external workout movements (name-only, or name+setRows) into the
 *     scoring input format.
 *   - Tracks how much per-set data was available, which lets the view model
 *     surface the right caveats.
 *
 * NOT IN SCOPE:
 *   - Running scoreWorkout() — that stays in the route.
 *   - Readiness/recovery/fatigue logic.
 *   - Prescribed-vs-performed delta.
 */

import { parseWeightToKg } from "./weightParser.js";
import type { PerformedMovementInput, PerformedWorkoutInput } from "./workoutScoringTypes.js";

// ---------------------------------------------------------------------------
// Input shape (the raw DB row fields we need)
// ---------------------------------------------------------------------------

export interface RawExternalWorkout {
  label?: string | null;
  workoutType?: string | null;
  movements?: unknown;
  duration?: number | null;
  stimulusPoints?: number | null;
}

// One movement as stored in the DB
interface ExternalMovementRaw {
  name: string;
  movementType?: string;
  volume?: string;
  setRows?: Array<{
    reps?: number;
    weight?: string;
    durationSeconds?: number;
    distance?: number;
    calories?: number;
  }>;
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

/**
 * Pre-scoring extraction quality metadata.
 *
 * Tells the caller what data was actually available in the external record,
 * before any movement-profile lookups are done.
 */
export interface ExtractionQuality {
  /** Total number of named movements extracted from the record. */
  totalMovements: number;
  /**
   * Whether at least one movement had set-level rows (reps, weight, etc.)
   * True → more precise scoring possible (rep/weight weighting).
   * False → name-only scoring (profile-based only).
   */
  hasSetData: boolean;
  /**
   * Whether this external workout can meaningfully be run through the
   * scoring stack.  False when there is nothing to score (rest day or
   * zero movements).
   */
  isEligible: boolean;
  /**
   * Human-readable reason when isEligible=false.
   * Null when isEligible=true.
   */
  ineligibleReason: string | null;
}

export interface AdaptedExternalWorkout {
  /** Input ready for scoreWorkout(). */
  input: PerformedWorkoutInput;
  /** Pre-scoring quality metadata for eligibility checks and UI notes. */
  quality: ExtractionQuality;
}

// ---------------------------------------------------------------------------
// Core adapter
// ---------------------------------------------------------------------------

/**
 * Convert a raw external workout record into a PerformedWorkoutInput plus
 * extraction quality metadata.
 *
 * Rules:
 *   - Rest-day workouts are ineligible (no movements to score).
 *   - Workouts with zero named movements are ineligible.
 *   - When setRows are present, each row becomes its own PerformedMovementInput.
 *   - When no setRows, the movement is included as name-only (one entry).
 *   - Distance/calories are forwarded so the scoring engine can apply the
 *     appropriate cyclical/cardio exposure method.
 */
export function adaptExternalWorkout(raw: RawExternalWorkout): AdaptedExternalWorkout {
  // --- Rest day fast path ---
  if (raw.workoutType === "rest") {
    return {
      input:   { movements: [] },
      quality: {
        totalMovements: 0,
        hasSetData:      false,
        isEligible:      false,
        ineligibleReason: "Rest days do not have scoreable movement data.",
      },
    };
  }

  const rawMovements = (raw.movements ?? []) as ExternalMovementRaw[];

  // Filter to named movements only (defensive — ignore empty-name entries)
  const namedMovements = rawMovements.filter(
    (m) => typeof m?.name === "string" && m.name.trim().length > 0
  );

  if (namedMovements.length === 0) {
    return {
      input:   { movements: [] },
      quality: {
        totalMovements:  0,
        hasSetData:       false,
        isEligible:       false,
        ineligibleReason: "No named movements found. Cannot score this workout.",
      },
    };
  }

  let hasSetData = false;

  const movements: PerformedMovementInput[] = namedMovements.flatMap((m) => {
    const rows = m.setRows ?? [];

    if (rows.length === 0) {
      // Name-only entry — the scoring engine will use the movement profile
      return [{ name: m.name }];
    }

    hasSetData = true;

    return rows.map((r): PerformedMovementInput => ({
      name:      m.name,
      reps:      r.reps != null && r.reps > 0         ? r.reps       : undefined,
      loadKg:    r.weight != null                      ? (() => { const kg = parseWeightToKg(r.weight!); return kg > 0 ? kg : undefined; })() : undefined,
      distanceM: r.distance != null && r.distance > 0  ? r.distance   : undefined,
      calories:  r.calories != null && r.calories > 0  ? r.calories   : undefined,
    }));
  });

  return {
    input: {
      movements,
      workoutName: raw.label ?? undefined,
      workoutType: raw.workoutType ?? undefined,
    },
    quality: {
      totalMovements:  namedMovements.length,
      hasSetData,
      isEligible:      true,
      ineligibleReason: null,
    },
  };
}

/**
 * Convenience guard — returns true when the adapted workout can be scored.
 */
export function isEligibleForScoring(quality: ExtractionQuality): boolean {
  return quality.isEligible;
}

/**
 * Derive a human-readable imported-data note based on quality metadata.
 *
 * Returned as a string when the note should be surfaced, null when the data
 * is complete enough that no caveat is needed.
 *
 * The scoring engine already generates data-quality notes based on fallback
 * ratios (see workoutAnalysisViewModel.ts). This note is specifically for the
 * "imported from external source without set-level data" case that the scoring
 * engine cannot know about.
 */
export function importedDataNote(quality: ExtractionQuality): string | null {
  if (!quality.isEligible) return null;
  if (quality.hasSetData) return null;
  return "Scored from movement names only — set-level data (reps/weight) was not captured for this import.";
}

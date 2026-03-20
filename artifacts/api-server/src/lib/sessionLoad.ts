/**
 * sessionLoad.ts — single source of scoring truth for workout load normalization.
 *
 * Purpose: Convert any workout — whether completed inside the app (internal session)
 * or imported from an external source — to a common "session load" score on a 0-100
 * scale. This score drives fatigue/recovery decisions and ensures external workouts
 * are weighted equally to internal workouts of equivalent effort.
 *
 * Design principles:
 *   - All calibration constants defined here only — never scattered across routes.
 *   - No AI calls, no DB access — pure deterministic functions that are easy to test.
 *   - External stimulus_points and internal volume/set counts map to the same 0-100 output.
 */

// ---------------------------------------------------------------------------
// Calibration constants (change here, effects everywhere)
// ---------------------------------------------------------------------------

/** Maximum session load score (both internal and external are capped here). */
export const MAX_SESSION_LOAD = 100;

/**
 * Internal sessions: kg-reps per 1 load point.
 * Calibrated so a moderate strength session (5,000 kg-reps, e.g. 5×10 @ 100kg)
 * produces ~50 load points — equal to an equivalent-effort external workout.
 */
export const INTERNAL_KG_REPS_PER_LOAD_POINT = 100;

/**
 * Internal sessions: backup load per completed set when totalVolume is null
 * (bodyweight circuits, yoga, cardio with no barbell load).
 * Calibrated: 30 sets of bodyweight work ≈ 30 load points.
 */
export const INTERNAL_SET_LOAD_WEIGHT = 1;

/**
 * Factor to convert a session load score (0-100) back to a "volume equivalent"
 * for backward-compatible display in the deload-check response.
 * Calibrated: 50 load points × 100 ≈ 5,000 "kg-reps equivalent" (legacy unit).
 */
export const LOAD_TO_VOLUME_EQUIV = 100;

// ---------------------------------------------------------------------------
// Core load functions
// ---------------------------------------------------------------------------

/**
 * Compute session load (0-100) for an **internal** workout session.
 *
 * Priority: totalVolume (kg × reps) → totalSetsCompleted (fallback for
 * bodyweight/cardio sessions where barbell volume is zero or null).
 */
export function internalSessionLoad(params: {
  totalVolume: number | null | undefined;
  totalSetsCompleted: number | null | undefined;
}): number {
  const volumeLoad = (params.totalVolume ?? 0) / INTERNAL_KG_REPS_PER_LOAD_POINT;
  const setLoad = (params.totalSetsCompleted ?? 0) * INTERNAL_SET_LOAD_WEIGHT;
  const raw = Math.max(volumeLoad, setLoad);
  return Math.min(MAX_SESSION_LOAD, Math.round(raw));
}

/**
 * Compute session load (0-100) for an **external** workout.
 *
 * External workouts already compute `stimulusPoints` via `computeStimulusPoints()`
 * (duration × intensity × muscleGroupCount × skillMultiplier, capped at 100),
 * so we use that directly. No conversion needed — it is already on the same scale.
 */
export function externalSessionLoad(stimulusPoints: number | null | undefined): number {
  return Math.min(MAX_SESSION_LOAD, Math.max(0, Math.round(stimulusPoints ?? 0)));
}

/**
 * Convert a session load score back to a legacy "volume equivalent" number
 * for backward-compatible weeklyVolume sums in API responses.
 */
export function sessionLoadToVolumeEquiv(loadScore: number): number {
  return Math.round(loadScore * LOAD_TO_VOLUME_EQUIV);
}

// ---------------------------------------------------------------------------
// Composite helpers
// ---------------------------------------------------------------------------

export interface SessionEntry {
  type: "internal" | "external";
  label: string;
  date: string;
  load: number;
}

/**
 * Sum all session load scores across a mixed list of internal + external sessions.
 * Use this wherever a cumulative weekly load is needed.
 */
export function totalWeeklyLoad(sessions: SessionEntry[]): number {
  return sessions.reduce((sum, s) => sum + s.load, 0);
}

/**
 * Count sessions of a given type in the list.
 */
export function countByType(sessions: SessionEntry[], type: "internal" | "external"): number {
  return sessions.filter((s) => s.type === type).length;
}

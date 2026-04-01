/**
 * Canonical muscle normalization shared by the workout generator and audit paths.
 *
 * Canonical decision — traps: "shoulders"
 *   Upper-trap exercises (shrugs, face pulls) are programmed on shoulder day.
 *   Both paths must agree so volume accounting is consistent across the app.
 *
 * This module is the single source of truth. Do NOT add local alias maps in
 * individual routes. Extend MUSCLE_ALIAS here and add a regression test.
 *
 * toAuditMuscle() maps the V1 12-group movement profile taxonomy back to the
 * existing 10-group audit canonical (CANONICAL_MUSCLES in audit.ts), preserving
 * backward compatibility with all audit, alerts, and rebalance-plan routes.
 */
import type { MuscleGroup } from "./movementProfiles";

export const MUSCLE_ALIAS: Record<string, string> = {
  // lateralized bodymap names (used in exercise JSON data)
  biceps_l: "biceps",
  biceps_r: "biceps",
  triceps_l: "triceps",
  triceps_r: "triceps",
  quads_l: "quads",
  quads_r: "quads",
  hamstrings_l: "hamstrings",
  hamstrings_r: "hamstrings",

  // back family
  upper_back: "back",
  lower_back: "back",
  lats: "back",

  // shoulder family — CANONICAL: traps → "shoulders"
  traps: "shoulders",
  deltoids: "shoulders",
  delts: "shoulders",

  // core family
  abs: "core",
  abdominals: "core",

  // colloquial groupings
  legs: "quads",
  arms: "biceps",
  forearms: "biceps",
  hips: "glutes",
  pecs: "chest",

  // other
  shins: "calves",
};

/**
 * Normalize a raw muscle string to its canonical group name.
 * Returns the input unchanged if no alias is registered.
 */
export function normalizeMuscle(muscle: string): string {
  const lower = muscle.toLowerCase().trim();
  return MUSCLE_ALIAS[lower] ?? lower;
}

/**
 * Map a V1 12-group MuscleGroup to the existing 10-group audit canonical
 * used by CANONICAL_MUSCLES in audit.ts.
 *
 * Mapping rules:
 *   upper_back_lats → "back"
 *   lower_back      → "back"
 *   forearms_grip   → null  (not tracked in current audit canonical — caller omits)
 *   all others      → unchanged (they already match the 10-group canonical)
 *
 * Returns null when the group has no current audit equivalent and should be
 * silently dropped from the muscle set returned to the audit route.
 */
export function toAuditMuscle(mg: MuscleGroup): string | null {
  switch (mg) {
    case "upper_back_lats": return "back";
    case "lower_back":      return "back";
    case "forearms_grip":   return null;
    default:                return mg;
  }
}

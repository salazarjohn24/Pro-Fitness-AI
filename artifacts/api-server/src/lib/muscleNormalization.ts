/**
 * Canonical muscle normalization shared by the workout generator and audit paths.
 *
 * Canonical decision — traps: "shoulders"
 *   Upper-trap exercises (shrugs, face pulls) are programmed on shoulder day.
 *   Both paths must agree so volume accounting is consistent across the app.
 *
 * This module is the single source of truth. Do NOT add local alias maps in
 * individual routes. Extend MUSCLE_ALIAS here and add a regression test.
 */

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

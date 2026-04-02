/**
 * weightParser.ts — Convert user-entered weight strings to kilograms.
 *
 * Handles the full range of free-text weight entries a user might type:
 *   "135 lbs"  → 61.24
 *   "60 kg"    → 60
 *   "135"      → 61.24  (bare number treated as lbs — common US context)
 *   "bodyweight" / "bw" / "" / null → 0
 *   "#135"     → 61.24  (# prefix common in US gym notes)
 *   "60.5 kg"  → 60.5
 *
 * Returns 0 for any input that cannot be meaningfully parsed.
 * Never throws.
 */

const LBS_TO_KG = 0.453592;

/**
 * Attempt to extract a numeric kg value from a raw weight string.
 *
 * @param raw - Raw string from the user (e.g. "135 lbs", "60 kg", "bodyweight")
 * @returns Weight in kilograms, or 0 if unresolvable.
 */
export function parseWeightToKg(raw: string | null | undefined): number {
  if (raw == null) return 0;

  const s = raw.trim().toLowerCase();

  if (
    s === "" ||
    s === "bodyweight" ||
    s === "bw" ||
    s === "body weight" ||
    s === "n/a" ||
    s === "none"
  ) {
    return 0;
  }

  const withKg = s.match(/^#?([\d.]+)\s*kg$/);
  if (withKg) {
    const v = parseFloat(withKg[1]);
    return isNaN(v) ? 0 : Math.round(v * 1000) / 1000;
  }

  const withLbs = s.match(/^#?([\d.]+)\s*(lbs?|lb|pounds?)$/);
  if (withLbs) {
    const v = parseFloat(withLbs[1]);
    return isNaN(v) ? 0 : Math.round(v * LBS_TO_KG * 1000) / 1000;
  }

  const bare = s.match(/^#?([\d.]+)$/);
  if (bare) {
    const v = parseFloat(bare[1]);
    return isNaN(v) ? 0 : Math.round(v * LBS_TO_KG * 1000) / 1000;
  }

  return 0;
}

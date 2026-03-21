/**
 * featureFlags.ts — Server-side feature flag registry.
 *
 * Flags are read from environment variables at call time so they can be
 * toggled with a redeployment (or, in future, a real flag service).
 *
 * Naming convention: FEATURE_<FLAG_NAME_UPPER>
 *
 * Defaults are the closed-beta safe values.
 */

export type FeatureFlag =
  | "external_to_vault_ingestion"
  | "low_confidence_insights_inclusion"
  | "exercise_mismatch_prompt";

const DEFAULTS: Record<FeatureFlag, boolean> = {
  external_to_vault_ingestion: true,
  low_confidence_insights_inclusion: false,
  exercise_mismatch_prompt: true,
};

/**
 * Returns true if the feature is enabled.
 * Env override:  FEATURE_EXTERNAL_TO_VAULT_INGESTION=0  → disables ingestion
 *               FEATURE_LOW_CONFIDENCE_INSIGHTS_INCLUSION=1 → enables for beta testers
 */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  const key = `FEATURE_${flag.toUpperCase()}`;
  const val = process.env[key];
  if (val === undefined) return DEFAULTS[flag];
  return val === "1" || val.toLowerCase() === "true";
}

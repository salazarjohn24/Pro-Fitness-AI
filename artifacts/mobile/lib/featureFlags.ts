/**
 * featureFlags.ts — Client-side feature flag registry (mobile).
 *
 * Mirrors the server-side flags. Closed-beta defaults are conservative:
 *   - vault ingestion: ON (core feature)
 *   - low-confidence insights: OFF (requires explicit user confirmation first)
 *
 * To override during QA/development, change these values and rebuild.
 * For production, these must match FEATURE_* env vars on the API server.
 */

export type FeatureFlag =
  | "external_to_vault_ingestion"
  | "low_confidence_insights_inclusion";

const FLAGS: Record<FeatureFlag, boolean> = {
  external_to_vault_ingestion: true,
  low_confidence_insights_inclusion: false,
};

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return FLAGS[flag] ?? false;
}

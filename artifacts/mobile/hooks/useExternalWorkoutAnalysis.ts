/**
 * useExternalWorkoutAnalysis.ts — Step 8 React Query hook.
 *
 * Calls GET /api/workouts/external/:id/analysis and returns the analysis
 * result when the external workout is eligible for scoring.
 *
 * Response shape:
 *   200  → WorkoutScoreResultJSON & { importedDataNote: string | null }
 *   422  → { eligible: false, reason: string }   → treated as null (ineligible)
 *   404  → null (workout not found)
 *   5xx  → throws (error state in the hook)
 *
 * The hook returns null for any non-200 status so the consuming screen can
 * fall back gracefully to the existing coarse fields without special-casing
 * the error type.
 */

import { useQuery } from "@tanstack/react-query";
import { getApiBase, getAuthHeaders, getFetchOptions } from "@/hooks/apiHelpers";
import type { WorkoutScoreResultJSON } from "@/lib/viewModels/workoutAnalysisViewModel";
import type { ActivityBasedAnalysisResult } from "@/lib/viewModels/appleHealthActivityViewModel";

export interface ExternalWorkoutAnalysisResult extends WorkoutScoreResultJSON {
  /**
   * Surfaced when the workout was scored from movement names only (no set-level
   * data was captured).  Null when set-level data was available and complete.
   *
   * The view model's dataQualityNote covers fallback-movement issues;
   * this field covers the imported-data-without-sets scenario separately.
   */
  importedDataNote: string | null;
}

/**
 * Structured summary returned for Apple Health imports that cannot be scored
 * because they contain activity-level data only (no individual exercises).
 */
export interface AppleHealthActivitySummary {
  label: string;
  durationMinutes: number;
  workoutType: string;
  source: string;
  workoutDate: string | null;
}

/**
 * The 422 response shape when an external workout is ineligible for scoring.
 * When source is "apple_health", activitySummary is populated with structured
 * metadata so the view can surface richer context to the user.
 */
export interface IneligibleAnalysisResult {
  eligible: false;
  reason: string;
  activitySummary?: AppleHealthActivitySummary;
}

export function useExternalWorkoutAnalysis(workoutId: number | null) {
  return useQuery<ExternalWorkoutAnalysisResult | ActivityBasedAnalysisResult | IneligibleAnalysisResult | null>({
    queryKey: ["externalWorkoutAnalysis", workoutId],
    queryFn:  async () => {
      if (workoutId == null) return null;

      const headers = await getAuthHeaders();
      const res = await fetch(
        `${getApiBase()}/api/workouts/external/${workoutId}/analysis`,
        getFetchOptions(headers)
      );

      if (res.status === 404) return null;

      if (res.status === 422) {
        const body = await res.json().catch(() => null);
        if (body?.activitySummary) {
          return body as IneligibleAnalysisResult;
        }
        return null;
      }

      if (!res.ok) {
        throw new Error(`External workout analysis failed: ${res.status}`);
      }

      const body = await res.json();

      // Activity-based analysis (Apple Health workouts with no exercise detail).
      // Server returns analysisKind: "activity-based" for this case.
      if (body?.analysisKind === "activity-based") {
        return body as ActivityBasedAnalysisResult;
      }

      // Movement-based analysis (normal scored workout).
      return body as ExternalWorkoutAnalysisResult;
    },
    enabled:   workoutId != null,
    staleTime: 5 * 60 * 1000,
    retry:     1,
  });
}

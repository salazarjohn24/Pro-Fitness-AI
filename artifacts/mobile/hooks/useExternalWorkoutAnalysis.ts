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

export function useExternalWorkoutAnalysis(workoutId: number | null) {
  return useQuery<ExternalWorkoutAnalysisResult | null>({
    queryKey: ["externalWorkoutAnalysis", workoutId],
    queryFn:  async () => {
      if (workoutId == null) return null;

      const headers = await getAuthHeaders();
      const res = await fetch(
        `${getApiBase()}/api/workouts/external/${workoutId}/analysis`,
        getFetchOptions(headers)
      );

      // Ineligible or not found → graceful null (not an error)
      if (res.status === 404 || res.status === 422) return null;

      if (!res.ok) {
        throw new Error(`External workout analysis failed: ${res.status}`);
      }

      return res.json();
    },
    enabled:   workoutId != null,
    staleTime: 5 * 60 * 1000,
    retry:     1,
  });
}

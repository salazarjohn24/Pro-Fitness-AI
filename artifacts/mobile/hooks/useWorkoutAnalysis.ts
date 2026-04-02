/**
 * useWorkoutAnalysis.ts — React Query hook for single-workout analysis.
 *
 * Calls GET /api/workouts/sessions/:id/analysis and returns a
 * WorkoutScoreResultJSON (Step 3 output from the backend).
 *
 * The raw API response is passed to buildWorkoutAnalysisViewModel() by the
 * consuming component or screen — this hook stays data-only.
 */

import { useQuery } from "@tanstack/react-query";
import { getApiBase, getAuthHeaders, getFetchOptions } from "@/hooks/apiHelpers";
import type { WorkoutScoreResultJSON } from "@/lib/viewModels/workoutAnalysisViewModel";

export function useWorkoutAnalysis(sessionId: number | null) {
  return useQuery<WorkoutScoreResultJSON | null>({
    queryKey: ["workoutAnalysis", sessionId],
    queryFn: async () => {
      if (sessionId == null) return null;
      const headers = await getAuthHeaders();
      const res = await fetch(
        `${getApiBase()}/api/workouts/sessions/${sessionId}/analysis`,
        getFetchOptions(headers)
      );
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error("Failed to load workout analysis");
      }
      return res.json();
    },
    enabled: sessionId !== null,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
}

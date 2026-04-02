/**
 * useTrainingAnalysis.ts — React Query hook for historical training analysis.
 *
 * Calls GET /api/training/history-analysis?days=N&rangeLabel=... and returns
 * the combined { rollup, insights } payload (Steps 4+5 from the backend).
 *
 * The caller passes the result to buildHistoryAnalysisViewModel() for display.
 */

import { useQuery } from "@tanstack/react-query";
import { getApiBase, getAuthHeaders, getFetchOptions } from "@/hooks/apiHelpers";
import type {
  HistoricalRollupResultJSON,
  InsightGenerationResultJSON,
} from "@/lib/viewModels/historyAnalysisViewModel";

export interface TrainingAnalysisResponse {
  rollup: HistoricalRollupResultJSON;
  insights: InsightGenerationResultJSON;
}

export type TrainingRangePreset = 7 | 14 | 30 | 60 | 90;

const RANGE_LABELS: Record<TrainingRangePreset, string> = {
  7:  "past week",
  14: "past 2 weeks",
  30: "past month",
  60: "past 2 months",
  90: "past 3 months",
};

export function useTrainingAnalysis(days: TrainingRangePreset = 30) {
  const rangeLabel = RANGE_LABELS[days] ?? `past ${days} days`;

  return useQuery<TrainingAnalysisResponse | null>({
    queryKey: ["trainingAnalysis", days],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const url = `${getApiBase()}/api/training/history-analysis?days=${days}&rangeLabel=${encodeURIComponent(rangeLabel)}`;
      const res = await fetch(url, getFetchOptions(headers));
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error("Failed to load training analysis");
      }
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

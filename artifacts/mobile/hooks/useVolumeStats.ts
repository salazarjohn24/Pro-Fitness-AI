import { useQuery } from "@tanstack/react-query";
import { getApiBase, getAuthHeaders, getFetchOptions } from "./apiHelpers";

export interface VolumeTimelinePoint {
  date: string;
  volume: number;
}

export interface MuscleFocusItem {
  muscle: string;
  sets: number;
  percentage: number;
}

export interface VolumeStats {
  range: string;
  totalSessions: number;
  totalVolume: number;
  volumeTimeline: VolumeTimelinePoint[];
  muscleFocus: MuscleFocusItem[];
  hasEnoughData: boolean;
}

export function useVolumeStats(range: string) {
  return useQuery<VolumeStats>({
    queryKey: ["volumeStats", range],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(
        `${getApiBase()}/api/audit/volume-stats?range=${range}`,
        getFetchOptions(headers)
      );
      if (!res.ok) throw new Error("Failed to fetch volume stats");
      return res.json();
    },
    staleTime: 120_000,
  });
}

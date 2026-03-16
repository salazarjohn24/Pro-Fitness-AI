import { useQuery } from "@tanstack/react-query";
import { getApiBase, getAuthHeaders, getFetchOptions } from "./apiHelpers";

export interface RecoveryCorrelation {
  highRecoveryCount: number;
  lowRecoveryCount: number;
  avgHighVolume: number;
  avgLowVolume: number;
  percentageDifference: number;
  hasEnoughData: boolean;
}

export function useRecoveryCorrelation() {
  return useQuery<RecoveryCorrelation>({
    queryKey: ["recovery-correlation"],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${getApiBase()}/api/audit/recovery-correlation`, getFetchOptions(headers));
      if (!res.ok) throw new Error(`Failed to load recovery correlation: ${res.status}`);
      return res.json();
    },
    retry: (count, error) => {
      if (error?.message?.includes("401")) return false;
      return count < 2;
    },
  });
}

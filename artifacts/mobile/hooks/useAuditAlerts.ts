import { useQuery } from "@tanstack/react-query";
import { getApiBase, getAuthHeaders, getFetchOptions } from "./apiHelpers";

export interface AuditAlert {
  type: "neglect" | "consistency";
  priority: number;
  muscle: string;
  message: string;
  daysSince?: number;
  consistencyIndex?: number;
}

export function useAuditAlerts() {
  return useQuery<AuditAlert[]>({
    queryKey: ["audit-alerts"],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${getApiBase()}/api/audit/alerts`, getFetchOptions(headers));
      if (!res.ok) throw new Error(`Failed to load audit alerts: ${res.status}`);
      return res.json();
    },
    retry: (count, error) => {
      if (error?.message?.includes("401")) return false;
      return count < 2;
    },
  });
}

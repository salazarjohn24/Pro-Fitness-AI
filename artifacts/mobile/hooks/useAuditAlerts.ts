import { useQuery } from "@tanstack/react-query";
import { getApiBase, getAuthHeaders, getFetchOptions } from "./apiHelpers";

export interface AIInsightResponse {
  insight: string;
}

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

export interface RebalancePlanDay {
  day: string;
  name: string;
  exercises: string[];
  tag: "Push" | "Pull" | "Compound" | "Recovery";
  reason: string;
}

export interface RebalancePlanResponse {
  insightBanner: string;
  titleSubtext: string;
  days: RebalancePlanDay[];
}

export function useRebalancePlan(enabled: boolean) {
  return useQuery<RebalancePlanResponse>({
    queryKey: ["rebalance-plan"],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${getApiBase()}/api/audit/rebalance-plan`, getFetchOptions(headers));
      if (!res.ok) throw new Error(`Failed to load rebalance plan: ${res.status}`);
      return res.json();
    },
    enabled,
    staleTime: 1000 * 60 * 10,
    retry: (count, error) => {
      if (error?.message?.includes("401")) return false;
      return count < 1;
    },
  });
}

export function useAIAuditInsight() {
  return useQuery<AIInsightResponse>({
    queryKey: ["audit-ai-insight"],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${getApiBase()}/api/audit/ai-insight`, getFetchOptions(headers));
      if (!res.ok) throw new Error(`Failed to load AI insight: ${res.status}`);
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
    retry: (count, error) => {
      if (error?.message?.includes("401")) return false;
      return count < 2;
    },
  });
}

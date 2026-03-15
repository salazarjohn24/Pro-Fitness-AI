import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as SecureStore from "expo-secure-store";

const AUTH_TOKEN_KEY = "auth_session_token";

function getApiBase(): string {
  if (process.env.EXPO_PUBLIC_DOMAIN) {
    return `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
  }
  return "";
}

async function getAuthHeaders() {
  const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}

export interface FitnessProfile {
  userId: string;
  streakDays: number | null;
  fitnessGoal: string | null;
  workoutFrequency: number | null;
  dailySyncProgress: number | null;
  checkInCompleted: boolean | null;
  activityImported: boolean | null;
  updatedAt: string | null;
}

export function useProfile() {
  return useQuery<FitnessProfile>({
    queryKey: ["profile"],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${getApiBase()}/api/profile`, { headers });
      if (!res.ok) throw new Error("Failed to load profile");
      return res.json();
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Omit<FitnessProfile, "userId" | "updatedAt">>) => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${getApiBase()}/api/profile`, {
        method: "PUT",
        headers,
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update profile");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

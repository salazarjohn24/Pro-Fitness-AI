import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const AUTH_TOKEN_KEY = "auth_session_token";
const IS_WEB = Platform.OS === "web";

function getApiBase(): string {
  if (process.env.EXPO_PUBLIC_DOMAIN) {
    return `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
  }
  return "";
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  if (IS_WEB) {
    return { "Content-Type": "application/json" };
  }
  try {
    const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
    return token
      ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
      : { "Content-Type": "application/json" };
  } catch {
    return { "Content-Type": "application/json" };
  }
}

function getFetchOptions(headers: Record<string, string>): RequestInit {
  return IS_WEB ? { headers, credentials: "include" } : { headers };
}

export interface FitnessProfile {
  userId: string;
  streakDays: number | null;
  fitnessGoal: string | null;
  workoutFrequency: number | null;
  dailySyncProgress: number | null;
  checkInCompleted: boolean | null;
  activityImported: boolean | null;
  equipment: string[] | null;
  skillLevel: string | null;
  injuries: string[] | null;
  onboardingCompleted: boolean | null;
  updatedAt: string | null;
}

export function useProfile() {
  return useQuery<FitnessProfile>({
    queryKey: ["profile"],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${getApiBase()}/api/profile`, getFetchOptions(headers));
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
        ...getFetchOptions(headers),
        method: "PUT",
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

export interface DailyCheckIn {
  id: number;
  userId: string;
  date: string;
  energyLevel: number;
  sleepQuality: number;
  stressLevel: number;
  sorenessScore: number;
  soreMuscleGroups: string[];
  notes: string | null;
  createdAt: string;
}

export function useTodayCheckIn() {
  return useQuery<DailyCheckIn | null>({
    queryKey: ["checkin-today"],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${getApiBase()}/api/checkins/today`, getFetchOptions(headers));
      if (!res.ok) throw new Error("Failed to load check-in");
      return res.json();
    },
  });
}

export function useSubmitCheckIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      energyLevel: number;
      sleepQuality: number;
      stressLevel: number;
      sorenessScore: number;
      soreMuscleGroups: string[];
      notes: string;
    }) => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${getApiBase()}/api/checkins`, {
        ...getFetchOptions(headers),
        method: "POST",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to submit check-in");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checkin-today"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

export function useSubmitExternalWorkout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      label: string;
      duration: number;
      workoutType: string;
      source?: string;
    }) => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${getApiBase()}/api/workouts/external`, {
        ...getFetchOptions(headers),
        method: "POST",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to log workout");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

export function computeReadinessScore(checkIn: DailyCheckIn | null | undefined): number {
  if (!checkIn) return 0;
  const energy = checkIn.energyLevel;
  const sleep = checkIn.sleepQuality;
  const stress = checkIn.stressLevel;
  const soreness = checkIn.sorenessScore;
  const weighted = (energy * 0.3 + sleep * 0.3 + stress * 0.2 + soreness * 0.2);
  return Math.round((weighted / 5) * 100);
}

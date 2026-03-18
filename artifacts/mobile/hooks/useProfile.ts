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
  age: number | null;
  weight: number | null;
  height: number | null;
  gender: string | null;
  experienceLevel: string | null;
  injuries: string[] | null;
  injuryNotes: string | null;
  primaryGoal: string | null;
  unitSystem: string | null;
  onboardingCompleted: boolean | null;
  insightDetailLevel: string | null;
  syncPreferences: { appleHealth: boolean; strava: boolean; manualScreenshot: boolean } | null;
  activeEnvironmentId: number | null;
  preferredWorkoutDuration: number | null;
  updatedAt: string | null;
}

export function useProfile() {
  return useQuery<FitnessProfile>({
    queryKey: ["profile"],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${getApiBase()}/api/profile`, getFetchOptions(headers));
      if (!res.ok) throw new Error(`Failed to load profile: ${res.status}`);
      return res.json();
    },
    staleTime: 30_000,
    retry: (count, error) => {
      if (error?.message?.includes("401")) return false;
      return count < 2;
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
  soreMuscleGroups: { muscle: string; severity: number }[];
  notes: string | null;
  createdAt: string;
}

export function useTodayCheckIn() {
  return useQuery<DailyCheckIn | null>({
    queryKey: ["checkin-today"],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const localDate = new Date().toLocaleDateString("en-CA");
      const res = await fetch(`${getApiBase()}/api/checkins/today?date=${localDate}`, getFetchOptions(headers));
      if (!res.ok) throw new Error(`Failed to load check-in: ${res.status}`);
      return res.json();
    },
    retry: (count, error) => {
      if (error?.message?.includes("401")) return false;
      return count < 2;
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
      soreMuscleGroups: { muscle: string; severity: number }[];
      notes?: string;
    }) => {
      const headers = await getAuthHeaders();
      const localDate = new Date().toLocaleDateString("en-CA");
      const res = await fetch(`${getApiBase()}/api/checkins`, {
        ...getFetchOptions(headers),
        method: "POST",
        body: JSON.stringify({ ...data, date: localDate }),
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

export function useUpdateCheckIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: {
      id: number;
      energyLevel: number;
      sleepQuality: number;
      stressLevel: number;
      sorenessScore: number;
      soreMuscleGroups: { muscle: string; severity: number }[];
      notes?: string;
    }) => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${getApiBase()}/api/checkins/${id}`, {
        ...getFetchOptions(headers),
        method: "PUT",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update check-in");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checkin-today"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

export interface ExternalWorkout {
  id: number;
  userId: string;
  label: string;
  duration: number;
  workoutType: string;
  source: string | null;
  intensity: number | null;
  muscleGroups: string[] | null;
  stimulusPoints: number | null;
  workoutDate: string | null;
  movements: Array<{ name: string; volume: string; muscleGroups: string[]; fatiguePercent: number }> | null;
  isMetcon: boolean | null;
  metconFormat: string | null;
  createdAt: string;
}

export function useSubmitExternalWorkout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      label: string;
      duration: number;
      workoutType: string;
      source?: string;
      intensity?: number;
      muscleGroups?: string[];
      stimulusPoints?: number;
      workoutDate?: string | null;
      movements?: Array<{ name: string; volume: string; muscleGroups: string[]; fatiguePercent: number }>;
      isMetcon?: boolean;
      metconFormat?: string | null;
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
      queryClient.invalidateQueries({ queryKey: ["recent-external-workouts"] });
    },
  });
}

export function useRecentExternalWorkouts() {
  return useQuery<ExternalWorkout[]>({
    queryKey: ["recent-external-workouts"],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${getApiBase()}/api/workouts/external`, getFetchOptions(headers));
      if (!res.ok) throw new Error(`Failed to load external workouts: ${res.status}`);
      return res.json();
    },
    retry: (count, error) => {
      if (error?.message?.includes("401")) return false;
      return count < 2;
    },
  });
}

export function useUpdateExternalWorkout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: {
      id: number;
      label?: string;
      duration?: number;
      workoutType?: string;
      intensity?: number | null;
      muscleGroups?: string[] | null;
      stimulusPoints?: number | null;
      workoutDate?: string | null;
    }) => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${getApiBase()}/api/workouts/external/${id}`, {
        ...getFetchOptions(headers),
        method: "PUT",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update workout");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recent-external-workouts"] });
    },
  });
}

export function useDeleteExternalWorkout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${getApiBase()}/api/workouts/external/${id}`, {
        ...getFetchOptions(headers),
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete workout");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recent-external-workouts"] });
      queryClient.invalidateQueries({ queryKey: ["workoutHistory"] });
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

export function useDeleteAccount() {
  return useMutation({
    mutationFn: async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${getApiBase()}/api/auth/account`, {
        ...getFetchOptions(headers),
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete account");
      return res.json();
    },
  });
}

export { getApiBase, getAuthHeaders, getFetchOptions };

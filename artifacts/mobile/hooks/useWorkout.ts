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

export interface GeneratedExercise {
  exerciseId: string;
  name: string;
  primaryMuscle: string;
  secondaryMuscles: string[];
  category: string;
  sets: number;
  reps: number;
  weight: string;
  youtubeKeyword: string;
}

export interface GeneratedWorkout {
  workoutTitle: string;
  subtitle: string;
  rationale: string;
  exercises: GeneratedExercise[];
  totalSets: number;
  estimatedMinutes: number;
}

export interface AlternativeExercise {
  id: string;
  name: string;
  primaryMuscle: string;
  secondaryMuscles: string[];
  equipment: string[];
  category: string;
  difficulty: string;
  alternatives: string[];
  youtubeKeyword: string;
}

export function useGenerateWorkout() {
  const queryClient = useQueryClient();
  return useMutation<GeneratedWorkout>({
    mutationFn: async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${getApiBase()}/api/workout/generate`, {
        ...getFetchOptions(headers),
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to generate workout");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workout"] });
    },
  });
}

export function useSaveWorkout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      workoutTitle: string;
      durationSeconds: number;
      exercises: { exerciseId: string; name: string; sets: { reps: number; weight: string; completed: boolean }[] }[];
      totalSetsCompleted: number;
      postWorkoutFeedback?: {
        perceivedDifficulty: number;
        energyAfter: number;
        enjoyment: number;
        notes: string;
      };
    }) => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${getApiBase()}/api/workout/sessions`, {
        ...getFetchOptions(headers),
        method: "POST",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to save workout");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workoutSessions"] });
    },
  });
}

export function useArchitectGenerate() {
  return useMutation<GeneratedWorkout, Error, { muscleGroups: string[]; equipment: string[]; availableMinutes?: number }>({
    mutationFn: async (data) => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${getApiBase()}/api/workout/architect-generate`, {
        ...getFetchOptions(headers),
        method: "POST",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to generate workout" }));
        throw new Error(err.error || "Failed to generate workout");
      }
      return res.json();
    },
  });
}

export async function fetchExerciseAlternatives(exerciseId: string): Promise<AlternativeExercise[]> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${getApiBase()}/api/exercises/${exerciseId}/alternatives`, getFetchOptions(headers));
  if (!res.ok) return [];
  return res.json();
}

export async function recordExerciseSubstitution(originalName: string, preferredName: string): Promise<void> {
  try {
    const headers = await getAuthHeaders();
    await fetch(`${getApiBase()}/api/exercise/substitution`, {
      ...getFetchOptions(headers),
      method: "POST",
      body: JSON.stringify({ originalName, preferredName }),
    });
  } catch {
    // fire-and-forget
  }
}

export interface DeloadCheckResult {
  recommended: boolean;
  reason: string | null;
  avgFatigue: number;
  weeklyVolume: number;
  sessionCount: number;
}

export function useDeloadCheck() {
  return useQuery<DeloadCheckResult>({
    queryKey: ["deloadCheck"],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${getApiBase()}/api/workout/deload-check`, getFetchOptions(headers));
      if (!res.ok) return { recommended: false, reason: null, avgFatigue: 0, weeklyVolume: 0, sessionCount: 0 };
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}

export interface UnifiedWorkout {
  id: number;
  type: "internal" | "external";
  label: string;
  date: string;
  durationMinutes: number;
  muscleGroups: string[];
  stimulusPoints: number | null;
  source: string;
  exerciseCount: number;
  totalSetsCompleted: number | null;
  feedback: { perceivedDifficulty: number; energyAfter: number; enjoyment: number; notes: string } | null;
  workoutType?: string;
  intensity?: number | null;
}

export interface SessionDetail {
  id: number;
  workoutTitle: string;
  durationSeconds: number;
  exercises: {
    exerciseId: string;
    name: string;
    primaryMuscle?: string;
    secondaryMuscles?: string[];
    targetWeight?: string;
    targetReps?: number;
    sets: { reps: number; weight: string; completed: boolean }[];
  }[];
  totalSetsCompleted: number;
  totalVolume: number | null;
  postWorkoutFeedback: { perceivedDifficulty: number; energyAfter: number; enjoyment: number; notes: string } | null;
  sessionDate: string;
  createdAt: string;
}

export function useWorkoutHistory(days = 90) {
  return useQuery<UnifiedWorkout[]>({
    queryKey: ["workoutHistory", days],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${getApiBase()}/api/workouts/history?days=${days}`, getFetchOptions(headers));
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useSessionDetail(id: number | null) {
  return useQuery<SessionDetail>({
    queryKey: ["sessionDetail", id],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${getApiBase()}/api/workouts/sessions/${id}`, getFetchOptions(headers));
      if (!res.ok) throw new Error("Session not found");
      return res.json();
    },
    enabled: id !== null,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateSessionExercises() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, exercises }: { id: number; exercises: SessionDetail["exercises"] }) => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${getApiBase()}/api/workouts/sessions/${id}/exercises`, {
        ...getFetchOptions(headers),
        method: "PATCH",
        body: JSON.stringify({ exercises }),
      });
      if (!res.ok) throw new Error("Failed to update session");
      return res.json();
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["sessionDetail", id] });
      queryClient.invalidateQueries({ queryKey: ["workoutHistory"] });
    },
  });
}

export interface RecoveryTip {
  category: string;
  title: string;
  detail: string;
}

export interface RecoveryInsights {
  headline: string;
  tips: RecoveryTip[];
}

export function useRecoveryInsights(enabled: boolean) {
  return useQuery<RecoveryInsights>({
    queryKey: ["recovery-insights", new Date().toLocaleDateString("en-CA")],
    enabled,
    staleTime: 1000 * 60 * 30,
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${getApiBase()}/api/workout/recovery-insights`, {
        ...getFetchOptions(headers),
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to fetch recovery insights");
      return res.json();
    },
  });
}

export function useDeleteSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${getApiBase()}/api/workouts/sessions/${id}`, {
        ...getFetchOptions(headers),
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete session");
      return res.json();
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["sessionDetail", id] });
      queryClient.invalidateQueries({ queryKey: ["workoutHistory"] });
      queryClient.invalidateQueries({ queryKey: ["recent-external-workouts"] });
    },
  });
}

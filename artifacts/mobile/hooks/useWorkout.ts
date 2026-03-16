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
  return useMutation<GeneratedWorkout, Error, { muscleGroups: string[]; equipment: string[] }>({
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

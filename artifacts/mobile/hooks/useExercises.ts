import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiBase, getAuthHeaders, getFetchOptions } from "./useProfile";

export interface Exercise {
  id: number;
  name: string;
  muscleGroup: string;
  equipment: string;
  goal: string;
  difficulty: string;
  youtubeUrl: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  tertiaryMuscles: string[];
}

export interface ExerciseDetail extends Exercise {
  instructions: string[];
  commonMistakes: string[];
  alternatives: Exercise[];
}

export interface SessionVolume {
  performedAt: string;
  totalVolume: number;
  weight: number;
  reps: number;
  sets: number;
}

export interface ExerciseHistoryResponse {
  sessions: SessionVolume[];
  estimated1RM: number | null;
  isPlateaued: boolean;
  restRecommendation: string | null;
}

export function useExercises(params?: {
  muscle_group?: string;
  equipment?: string;
  goal?: string;
  search?: string;
}) {
  const queryString = params
    ? "?" + Object.entries(params)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
        .join("&")
    : "";

  return useQuery<Exercise[]>({
    queryKey: ["exercises", params],
    queryFn: async () => {
      const res = await fetch(`${getApiBase()}/api/exercises${queryString}`);
      if (!res.ok) throw new Error(`Failed to load exercises: ${res.status}`);
      return res.json();
    },
  });
}

export function useExerciseDetail(id: number) {
  return useQuery<ExerciseDetail>({
    queryKey: ["exercise", id],
    queryFn: async () => {
      const res = await fetch(`${getApiBase()}/api/exercises/${id}`);
      if (!res.ok) throw new Error(`Failed to load exercise: ${res.status}`);
      return res.json();
    },
    enabled: id > 0,
  });
}

export function useExerciseHistory(id: number) {
  return useQuery<ExerciseHistoryResponse>({
    queryKey: ["exercise-history", id],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(
        `${getApiBase()}/api/exercises/${id}/history`,
        getFetchOptions(headers)
      );
      if (!res.ok) throw new Error(`Failed to load history: ${res.status}`);
      return res.json();
    },
    enabled: id > 0,
  });
}

export function useExerciseCoachNote(id: number) {
  return useQuery<{ coachNote: string }>({
    queryKey: ["exercise-coach-note", id],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(
        `${getApiBase()}/api/exercises/${id}/coach-note`,
        getFetchOptions(headers)
      );
      if (!res.ok) throw new Error(`Failed to load coach note: ${res.status}`);
      return res.json();
    },
    enabled: id > 0,
    staleTime: 1000 * 60 * 5,
  });
}

export function useExerciseFavorites() {
  return useQuery<Exercise[]>({
    queryKey: ["exercise-favorites"],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${getApiBase()}/api/exercises/favorites`, getFetchOptions(headers));
      if (!res.ok) throw new Error("Failed to load favorites");
      return res.json();
    },
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, favorited }: { id: number; favorited: boolean; exercise?: Exercise }) => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${getApiBase()}/api/exercises/${id}/favorite`, {
        ...getFetchOptions(headers),
        method: favorited ? "DELETE" : "POST",
      });
      if (!res.ok) throw new Error("Failed to toggle favorite");
      return res.json();
    },
    onMutate: async ({ id, favorited, exercise }) => {
      await queryClient.cancelQueries({ queryKey: ["exercise-favorites"] });
      const prev = queryClient.getQueryData<Exercise[]>(["exercise-favorites"]);
      queryClient.setQueryData<Exercise[]>(["exercise-favorites"], (old = []) => {
        if (favorited) {
          return old.filter((e) => e.id !== id);
        }
        if (exercise && !old.some((e) => e.id === id)) {
          return [...old, exercise];
        }
        return old;
      });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev !== undefined) {
        queryClient.setQueryData(["exercise-favorites"], ctx.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["exercise-favorites"] });
    },
  });
}

export function useLogExerciseSet(exerciseId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { weight: number; reps: number; sets: number }) => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${getApiBase()}/api/exercises/${exerciseId}/history`, {
        ...getFetchOptions(headers),
        method: "POST",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to log set");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exercise-history", exerciseId] });
    },
  });
}

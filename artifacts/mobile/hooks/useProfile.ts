import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiBase, getAuthHeaders, getFetchOptions } from "@/hooks/apiHelpers";

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
  workoutPreferences: string | null;
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
  parserConfidence?: number | null;
  parserWarnings?: string[] | null;
  workoutFormat?: string | null;
  wasUserEdited?: boolean | null;
  editedFields?: string[] | null;
}

export type SubmitExternalWorkoutData = {
  label: string;
  duration: number;
  workoutType: string;
  source?: string;
  intensity?: number;
  muscleGroups?: string[];
  stimulusPoints?: number;
  workoutDate?: string | null;
  movements?: Array<{ name: string; volume: string; muscleGroups: string[]; fatiguePercent: number; movementType?: string; setRows?: unknown[] }>;
  isMetcon?: boolean;
  metconFormat?: string | null;
  parserConfidence?: number | null;
  parserWarnings?: string[];
  workoutFormat?: string | null;
  wasUserEdited?: boolean;
  editedFields?: string[];
  lastEditedAt?: string | null;
  editSource?: "user" | "ai" | "manual" | null;
  rawImportText?: string | null;
};

export type SubmitExternalWorkoutResult = {
  id: number;
  [key: string]: unknown;
};

export function useSubmitExternalWorkout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: SubmitExternalWorkoutData): Promise<SubmitExternalWorkoutResult> => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${getApiBase()}/api/workouts/external`, {
        ...getFetchOptions(headers),
        method: "POST",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = body?.error ?? "Failed to log workout";
        const err = new Error(msg) as Error & { code?: string; retryable?: boolean };
        err.code = body?.code;
        err.retryable = body?.retryable ?? false;
        throw err;
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["recent-external-workouts"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Alignment Item 2: Exercise mismatch check (read-only pre-submit lookup)
// ---------------------------------------------------------------------------

export type ExerciseMatchCheck = {
  name: string;
  willCreate: boolean;
  matchedId: number | null;
  matchedName: string | null;
  /** Diagnostic: which matching step resolved this name. */
  matched_by: "exact" | "normalized" | "partial" | "created";
  suggestion: { id: number; name: string } | null;
};

export type ExerciseResolution = {
  originalName: string;
  resolution: "auto-create" | "use-fit" | "manual";
  resolvedName: string;
  suggestedId?: number | null;
};

export function useCheckExerciseMatches() {
  return useMutation({
    mutationFn: async (
      movements: Array<{ name: string; movementType?: string }>
    ): Promise<ExerciseMatchCheck[]> => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${getApiBase()}/api/workouts/check-exercise-matches`, {
        ...getFetchOptions(headers),
        method: "POST",
        body: JSON.stringify({ movements }),
      });
      if (!res.ok) throw new Error("Failed to check exercise matches");
      const data = await res.json();
      return data.checks as ExerciseMatchCheck[];
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
      wasUserEdited?: boolean;
      editedFields?: string[];
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

import AsyncStorage from "@react-native-async-storage/async-storage";
import { sendArchitectWorkoutReadyNotification } from "@/lib/notifications";
import { getApiBase, getAuthHeaders, getFetchOptions } from "@/hooks/apiHelpers";
import type { GeneratedWorkout } from "@/hooks/useWorkout";

const PENDING_KEY = "arch_pending_workout";

type GenerationCallback = (workout: GeneratedWorkout | null) => void;

let activeCallback: GenerationCallback | null = null;
let activeAbortController: AbortController | null = null;

export function setGenerationCallback(cb: GenerationCallback | null): void {
  activeCallback = cb;
}

export function cancelGeneration(): void {
  activeAbortController?.abort();
  activeAbortController = null;
  activeCallback = null;
}

export function sendToBackground(): void {
  activeCallback = null;
}

export async function startGeneration(
  params: { muscleGroups: string[]; equipment: string[]; availableMinutes: number },
  onResult: GenerationCallback
): Promise<void> {
  cancelGeneration();

  activeCallback = onResult;
  activeAbortController = new AbortController();
  const controller = activeAbortController;

  const headers = await getAuthHeaders();

  doGenerate(params, headers, controller).catch(() => {});
}

async function doGenerate(
  params: { muscleGroups: string[]; equipment: string[]; availableMinutes: number },
  headers: Record<string, string>,
  controller: AbortController
): Promise<void> {
  try {
    const res = await fetch(`${getApiBase()}/api/workout/architect-generate`, {
      ...getFetchOptions(headers),
      method: "POST",
      body: JSON.stringify(params),
      signal: controller.signal,
    });

    if (!res.ok) {
      if (activeCallback) {
        activeCallback(null);
        activeCallback = null;
      }
      return;
    }

    const workout = (await res.json()) as GeneratedWorkout;

    if (activeCallback) {
      activeCallback(workout);
      activeCallback = null;
    } else {
      await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(workout));
      await sendArchitectWorkoutReadyNotification(workout.workoutTitle);
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") return;
    if (activeCallback) {
      activeCallback(null);
      activeCallback = null;
    }
  }
}

export async function takePendingWorkout(): Promise<GeneratedWorkout | null> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    await AsyncStorage.removeItem(PENDING_KEY);
    return JSON.parse(raw) as GeneratedWorkout;
  } catch {
    return null;
  }
}

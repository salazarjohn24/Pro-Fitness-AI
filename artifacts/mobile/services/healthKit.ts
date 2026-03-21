/**
 * healthKit.ts — Apple Health sync with structured logging, retry, timeout,
 * deduplication, and timezone-safe date handling.
 *
 * Sync pipeline stages:
 *   permission → read → transform → dedupe → save
 *
 * Each stage emits [health-sync] log lines. Errors include an error code
 * (HealthErrorCode) and a user-safe message — never raw JS stack traces.
 *
 * Resilience:
 *   - Individual reads: 3 attempts, 500 ms base backoff (exponential)
 *   - Per-read timeout: 10 s (READ_TIMEOUT_MS)
 *   - Global sync timeout: 45 s (SYNC_TIMEOUT_MS)
 *   - Promise.allSettled: one failed read does not block the others
 *   - Dedup: workouts keyed by HealthKit UUID → retry-safe
 */

import { Platform } from "react-native";
import AppleHealthKit, {
  HealthKitPermissions,
  HealthValue,
  HealthInputOptions,
} from "react-native-health";

import {
  HEALTH_ERROR,
  HEALTH_USER_MESSAGES,
  HealthSyncError,
  dedupeWorkouts,
  localDayStart,
  log,
  logError,
  withRetry,
  withTimeout,
  type HKSample,
  type HealthErrorCode,
} from "@/lib/healthSyncUtils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const READ_TIMEOUT_MS = 10_000;
const SYNC_TIMEOUT_MS = 45_000;
const RETRY_OPTS = {
  maxAttempts: 3,
  baseDelayMs: 500,
  label: "",
  onRetry: (attempt: number, delayMs: number) =>
    log("read", "retry_backoff", { attempt, delay_ms: delayMs }),
} as const;

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

export interface SyncResult {
  success: boolean;
  partialSuccess: boolean;
  steps?: number;
  activeCalories?: number;
  workoutCount?: number;
  errorCode?: HealthErrorCode;
  userMessage?: string;
}

// ---------------------------------------------------------------------------
// HealthKit permission helpers
// ---------------------------------------------------------------------------

function buildPermissions(): HealthKitPermissions | null {
  try {
    return {
      permissions: {
        read: [
          AppleHealthKit.Constants.Permissions.Workout,
          AppleHealthKit.Constants.Permissions.Steps,
          AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
        ],
        write: [],
      },
    };
  } catch {
    return null;
  }
}

export function isHealthKitAvailable(): boolean {
  return Platform.OS === "ios";
}

export function requestHealthKitPermissions(): Promise<boolean> {
  return new Promise((resolve) => {
    if (!isHealthKitAvailable()) {
      resolve(false);
      return;
    }
    const permissions = buildPermissions();
    if (!permissions) {
      resolve(false);
      return;
    }
    try {
      AppleHealthKit.initHealthKit(permissions, (error: string) => {
        if (error) {
          console.error("[health-sync] initHealthKit error:", error);
          resolve(false);
          return;
        }
        resolve(true);
      });
    } catch (e) {
      console.error("[health-sync] initHealthKit threw:", e);
      resolve(false);
    }
  });
}

// ---------------------------------------------------------------------------
// HealthKit read primitives (each returns a Promise so withRetry/withTimeout
// can wrap them directly)
// ---------------------------------------------------------------------------

function getStepCount(startDate: Date, endDate: Date): Promise<HealthValue[]> {
  return new Promise((resolve, reject) => {
    const options: HealthInputOptions = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };
    try {
      AppleHealthKit.getDailyStepCountSamples(
        options,
        (error: string, results: HealthValue[]) => {
          if (error) {
            reject(new HealthSyncError(HEALTH_ERROR.READ_FAILED, error));
            return;
          }
          resolve(results);
        },
      );
    } catch (e) {
      reject(new HealthSyncError(HEALTH_ERROR.READ_FAILED, String(e)));
    }
  });
}

function getActiveEnergyBurned(
  startDate: Date,
  endDate: Date,
): Promise<HealthValue[]> {
  return new Promise((resolve, reject) => {
    const options: HealthInputOptions = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };
    try {
      AppleHealthKit.getActiveEnergyBurned(
        options,
        (error: string, results: HealthValue[]) => {
          if (error) {
            reject(new HealthSyncError(HEALTH_ERROR.READ_FAILED, error));
            return;
          }
          resolve(results);
        },
      );
    } catch (e) {
      reject(new HealthSyncError(HEALTH_ERROR.READ_FAILED, String(e)));
    }
  });
}

function getWorkouts(startDate: Date, endDate: Date): Promise<HealthValue[]> {
  return new Promise((resolve, reject) => {
    const options: HealthInputOptions = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };
    try {
      AppleHealthKit.getSamples(
        { ...options, type: "Workout" } as any,
        (error: string, results: HealthValue[]) => {
          if (error) {
            reject(new HealthSyncError(HEALTH_ERROR.READ_FAILED, error));
            return;
          }
          resolve(results);
        },
      );
    } catch (e) {
      reject(new HealthSyncError(HEALTH_ERROR.READ_FAILED, String(e)));
    }
  });
}

// ---------------------------------------------------------------------------
// Core sync pipeline (wrapped by global timeout in syncWithAppleHealth)
// ---------------------------------------------------------------------------

async function doSync(): Promise<SyncResult> {
  // ── Stage: permission ────────────────────────────────────────────────────
  log("permission", "start");

  if (!isHealthKitAvailable()) {
    logError(
      "permission",
      HEALTH_ERROR.NOT_AVAILABLE,
      HEALTH_USER_MESSAGES.NOT_AVAILABLE,
    );
    return {
      success: false,
      partialSuccess: false,
      errorCode: HEALTH_ERROR.NOT_AVAILABLE,
      userMessage: HEALTH_USER_MESSAGES.NOT_AVAILABLE,
    };
  }

  let granted = false;
  try {
    granted = await withTimeout(
      requestHealthKitPermissions(),
      15_000,
      "permissions",
    );
  } catch (err) {
    const code =
      err instanceof HealthSyncError ? err.code : HEALTH_ERROR.UNKNOWN;
    const userMsg = HEALTH_USER_MESSAGES[code] ?? HEALTH_USER_MESSAGES.UNKNOWN;
    logError("permission", code, userMsg, err);
    return { success: false, partialSuccess: false, errorCode: code, userMessage: userMsg };
  }

  if (!granted) {
    logError(
      "permission",
      HEALTH_ERROR.PERMISSION_DENIED,
      HEALTH_USER_MESSAGES.PERMISSION_DENIED,
    );
    return {
      success: false,
      partialSuccess: false,
      errorCode: HEALTH_ERROR.PERMISSION_DENIED,
      userMessage: HEALTH_USER_MESSAGES.PERMISSION_DENIED,
    };
  }
  log("permission", "granted");

  // ── Stage: read ──────────────────────────────────────────────────────────
  // Fix: use local midnight for startDate so HealthKit day-boundary queries
  // align with the device's local timezone, not UTC.
  const endDate = new Date();
  const startDate = localDayStart(new Date("2010-01-01"));

  log("read", "start", {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  });

  const [stepsResult, caloriesResult, workoutsResult] =
    await Promise.allSettled([
      withRetry(
        () =>
          withTimeout(getStepCount(startDate, endDate), READ_TIMEOUT_MS, "steps"),
        { ...RETRY_OPTS, label: "steps" },
      ),
      withRetry(
        () =>
          withTimeout(
            getActiveEnergyBurned(startDate, endDate),
            READ_TIMEOUT_MS,
            "calories",
          ),
        { ...RETRY_OPTS, label: "calories" },
      ),
      withRetry(
        () =>
          withTimeout(
            getWorkouts(startDate, endDate),
            READ_TIMEOUT_MS,
            "workouts",
          ),
        { ...RETRY_OPTS, label: "workouts" },
      ),
    ]);

  // Log per-read outcomes
  if (stepsResult.status === "fulfilled") {
    log("read", "steps_ok", { count: stepsResult.value.length });
  } else {
    logError(
      "read",
      HEALTH_ERROR.READ_FAILED,
      HEALTH_USER_MESSAGES.READ_FAILED,
      stepsResult.reason,
    );
  }
  if (caloriesResult.status === "fulfilled") {
    log("read", "calories_ok", { count: caloriesResult.value.length });
  } else {
    logError(
      "read",
      HEALTH_ERROR.READ_FAILED,
      HEALTH_USER_MESSAGES.READ_FAILED,
      caloriesResult.reason,
    );
  }
  if (workoutsResult.status === "fulfilled") {
    log("read", "workouts_ok", { count: workoutsResult.value.length });
  } else {
    logError(
      "read",
      HEALTH_ERROR.READ_FAILED,
      HEALTH_USER_MESSAGES.READ_FAILED,
      workoutsResult.reason,
    );
  }

  // All three failed → total failure
  if (
    stepsResult.status === "rejected" &&
    caloriesResult.status === "rejected" &&
    workoutsResult.status === "rejected"
  ) {
    logError(
      "read",
      HEALTH_ERROR.READ_FAILED,
      HEALTH_USER_MESSAGES.READ_FAILED,
    );
    return {
      success: false,
      partialSuccess: false,
      errorCode: HEALTH_ERROR.READ_FAILED,
      userMessage: HEALTH_USER_MESSAGES.READ_FAILED,
    };
  }

  // ── Stage: transform ─────────────────────────────────────────────────────
  const rawSteps =
    stepsResult.status === "fulfilled" ? stepsResult.value : [];
  const rawCalories =
    caloriesResult.status === "fulfilled" ? caloriesResult.value : [];
  const rawWorkouts =
    workoutsResult.status === "fulfilled" ? workoutsResult.value : [];

  log("transform", "start", { raw_workouts: rawWorkouts.length });

  const totalSteps = rawSteps.reduce((sum, s) => sum + (s.value ?? 0), 0);
  const totalCalories = rawCalories.reduce((sum, c) => sum + (c.value ?? 0), 0);

  // ── Stage: dedupe ────────────────────────────────────────────────────────
  log("dedupe", "start", { workouts: rawWorkouts.length });
  const uniqueWorkouts = dedupeWorkouts(rawWorkouts as HKSample[]);
  log("dedupe", "complete", {
    unique: uniqueWorkouts.length,
    dupes_removed: rawWorkouts.length - uniqueWorkouts.length,
  });

  log("transform", "complete", {
    steps: Math.round(totalSteps),
    calories: Math.round(totalCalories),
    workouts: uniqueWorkouts.length,
  });

  const partialSuccess =
    stepsResult.status === "rejected" ||
    caloriesResult.status === "rejected" ||
    workoutsResult.status === "rejected";

  // ── Stage: save ──────────────────────────────────────────────────────────
  // P1: "save" is local — persisted via useHealthSync → AsyncStorage.
  // P4 will add server ingestion of uniqueWorkouts into exercise vault history.
  log("save", "complete", {
    steps: Math.round(totalSteps),
    calories: Math.round(totalCalories),
    workouts: uniqueWorkouts.length,
    partial: partialSuccess,
  });

  return {
    success: true,
    partialSuccess,
    steps: Math.round(totalSteps),
    activeCalories: Math.round(totalCalories),
    workoutCount: uniqueWorkouts.length,
  };
}

// ---------------------------------------------------------------------------
// Public entry point — wraps doSync() with a global timeout
// ---------------------------------------------------------------------------

export async function syncWithAppleHealth(): Promise<SyncResult> {
  log("permission", "sync_start");
  try {
    return await withTimeout(doSync(), SYNC_TIMEOUT_MS, "full_sync");
  } catch (err) {
    const code =
      err instanceof HealthSyncError &&
      err.code === HEALTH_ERROR.READ_TIMEOUT
        ? HEALTH_ERROR.SYNC_TIMEOUT
        : HEALTH_ERROR.UNKNOWN;
    const userMsg = HEALTH_USER_MESSAGES[code] ?? HEALTH_USER_MESSAGES.UNKNOWN;
    logError("save", code, userMsg, err);
    return { success: false, partialSuccess: false, errorCode: code, userMessage: userMsg };
  }
}

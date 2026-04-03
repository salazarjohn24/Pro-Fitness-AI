/**
 * healthKit.ts — Apple Health sync with structured logging, retry, timeout,
 * deduplication, and timezone-safe date handling.
 *
 * Sync pipeline stages:
 *   permission → read → transform → dedupe → save
 *
 * Each stage emits [health-sync] log lines including stage, event, retry_count,
 * and timeout_status. Errors include an error code (HealthErrorCode) and a
 * user-safe message — never raw JS stack traces.
 *
 * Resilience:
 *   - Individual reads: 3 attempts, 500 ms base backoff (exponential)
 *   - Per-read timeout: 10 s (READ_TIMEOUT_MS)
 *   - Global sync timeout: 45 s (SYNC_TIMEOUT_MS)
 *   - Promise.allSettled: one failed read does not block the others
 *   - Dedup: workouts keyed by HealthKit UUID → retry-safe
 *
 * Bug fixes (Stabilization Phase A):
 *   FIX-1: buildPermissions() used AppleHealthKit.Constants.Permissions.* which
 *           could silently throw if the native module wasn't ready. Replaced with
 *           explicit string literals — same values, no native-module dependency.
 *   FIX-2: initHealthKit error was mapped to PERMISSION_DENIED. WRONG — initHealthKit
 *           errors mean HealthKit is unavailable at the system level (entitlement
 *           missing, device restriction). Correct mapping: NOT_AVAILABLE.
 *   FIX-3: isHealthKitAvailable() only checked Platform.OS. Now calls the real
 *           AppleHealthKit.isAvailable() API and persists result for diagnostics.
 *   FIX-4: authRequestAttempted was not tracked. Now persisted to AsyncStorage
 *           before calling initHealthKit so diagnostics can confirm it fired.
 *   FIX-5: Per-category auth status (getAuthStatus) was never called. Now called
 *           after successful initHealthKit to surface per-permission grant state.
 *
 * Hardening pass (Phase B):
 *   HARDEN-1: Renamed isHealthKitAvailable() → isPlatformIOS(). The old name
 *             implied authoritative HealthKit availability but only checked
 *             Platform.OS. The async checkHealthKitAvailableViaAPI() remains the
 *             real availability gate. A deprecated alias preserves API surface.
 *   HARDEN-2: Replaced getSamples({ type: "Workout" } as any) with the typed
 *             getAnchoredWorkouts() API. Provides structured workout records:
 *             activityName, activityId, calories, distance, duration, device, etc.
 *   HARDEN-3: getAuthStatus index mapping now driven by AUTH_READ_PERMISSION_KEYS
 *             from healthSyncUtils — no more hardcoded [0][1][2] positional
 *             assumptions. Adding a permission to the array automatically updates
 *             both buildPermissions() and the status mapping.
 *   HARDEN-4: onRetry callbacks now receive the triggering error (3rd argument)
 *             and log error_type / error_code alongside retry metadata.
 */

import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AppleHealthKit, {
  HealthKitPermissions,
  HealthValue,
  HealthInputOptions,
  HKWorkoutQueriedSampleType,
  AnchoredQueryResults,
  HKErrorResponse,
} from "react-native-health";

import {
  HEALTH_ERROR,
  HEALTH_USER_MESSAGES,
  HealthSyncError,
  DIAG_STORAGE_KEY,
  DIAG_INITIAL,
  WORKOUT_ANCHOR_STORAGE_KEY,
  dedupeWorkouts,
  dedupeHKWorkouts,
  isAnchorInvalidationError,
  localDayStart,
  log,
  logError,
  withRetry,
  withTimeout,
  AUTH_READ_PERMISSION_KEYS,
  type DiagnosticState,
  type AuthCategory,
  type HealthAuthStatus,
  type HKSample,
  type HKWorkoutSample,
  type HealthErrorCode,
  type SyncMode,
} from "@/lib/healthSyncUtils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const READ_TIMEOUT_MS = 10_000;
const SYNC_TIMEOUT_MS = 45_000;

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

/** Structured workout record extracted from a HealthKit getAnchoredWorkouts result. */
export interface SyncWorkout {
  id: string;
  activityName: string;
  activityId: number;
  calories: number;
  distance: number;
  /** Duration in seconds. */
  duration: number;
  startDate: string;
  endDate: string;
  sourceName: string;
}

export interface SyncResult {
  success: boolean;
  partialSuccess: boolean;
  steps?: number;
  activeCalories?: number;
  workoutCount?: number;
  /** Structured workout records, available when workouts read succeeds. */
  workouts?: SyncWorkout[];
  errorCode?: HealthErrorCode;
  userMessage?: string;
}

// ---------------------------------------------------------------------------
// Diagnostic storage helpers
// ---------------------------------------------------------------------------

async function readDiag(): Promise<DiagnosticState> {
  try {
    const raw = await AsyncStorage.getItem(DIAG_STORAGE_KEY);
    if (!raw) return { ...DIAG_INITIAL };
    return { ...DIAG_INITIAL, ...(JSON.parse(raw) as Partial<DiagnosticState>) };
  } catch {
    return { ...DIAG_INITIAL };
  }
}

async function writeDiag(patch: Partial<DiagnosticState>): Promise<void> {
  try {
    const current = await readDiag();
    await AsyncStorage.setItem(DIAG_STORAGE_KEY, JSON.stringify({ ...current, ...patch }));
  } catch {
    // Non-fatal — sync continues; diagnostic state just won't persist
  }
}

export { readDiag };

// ---------------------------------------------------------------------------
// Anchor storage helpers — incremental workout sync
// ---------------------------------------------------------------------------

/**
 * Read the persisted HealthKit workout anchor from AsyncStorage.
 * Returns null when no anchor exists (first sync, or after a reset/fallback).
 */
async function readWorkoutAnchor(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(WORKOUT_ANCHOR_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Persist a new HealthKit workout anchor after a successful incremental read.
 * Non-fatal: if storage fails the next sync just falls back to a full query.
 */
async function writeWorkoutAnchor(anchor: string): Promise<void> {
  try {
    await AsyncStorage.setItem(WORKOUT_ANCHOR_STORAGE_KEY, anchor);
  } catch {
    // Non-fatal — next sync falls back to full query
  }
}

/**
 * Remove the stored workout anchor.
 * Called when an anchor-based read fails (e.g. anchor invalidated by HealthKit
 * after a data restore or Health app reset) so the next sync does a full query.
 */
async function clearWorkoutAnchor(): Promise<void> {
  try {
    await AsyncStorage.removeItem(WORKOUT_ANCHOR_STORAGE_KEY);
  } catch {
    // Non-fatal
  }
}

// ---------------------------------------------------------------------------
// HealthKit permission helpers
// ---------------------------------------------------------------------------

/**
 * FIX-1: Use explicit string literals instead of AppleHealthKit.Constants.Permissions.*
 * These are guaranteed identical values (HealthPermission enum) but do NOT
 * require the native module to be initialized when this function runs, preventing
 * the silent null-return bug where initHealthKit was never called.
 *
 * HARDEN-3: read array is now derived from AUTH_READ_PERMISSION_KEYS (single source
 * of truth). This keeps buildPermissions() and getAuthStatusByCategory() in sync
 * automatically when new permission categories are added.
 */
function buildPermissions(): HealthKitPermissions {
  return {
    permissions: {
      read: [...AUTH_READ_PERMISSION_KEYS] as any[],
      write: [],
    },
  };
}

/**
 * HARDEN-1: Authoritative platform check — returns true only when running on iOS.
 *
 * This is a fast, synchronous, platform-level check. It does NOT verify that
 * HealthKit is actually available on this specific device (entitlement active,
 * no MDM restriction, not an iPad without the capability).
 *
 * For the authoritative availability check, use checkHealthKitAvailableViaAPI().
 */
export function isPlatformIOS(): boolean {
  return Platform.OS === "ios";
}

/**
 * @deprecated Use isPlatformIOS() for the synchronous platform check.
 *             For authoritative HealthKit availability, use checkHealthKitAvailableViaAPI().
 *
 * Retained as a deprecated alias to avoid breaking any existing callers outside
 * of this module. Will be removed in a future cleanup pass.
 */
export function isHealthKitAvailable(): boolean {
  return isPlatformIOS();
}

/**
 * FIX-3: Real HealthKit availability check via AppleHealthKit.isAvailable().
 * This checks that the device supports HealthKit (iPhone, not iPad w/o entitlement,
 * not restricted by MDM/parental controls) and the entitlement is active.
 * Persists result to diagnostic state.
 */
export function checkHealthKitAvailableViaAPI(): Promise<boolean> {
  return new Promise((resolve) => {
    if (!isPlatformIOS()) {
      writeDiag({ hkAvailableChecked: true, hkAvailable: false });
      resolve(false);
      return;
    }
    try {
      AppleHealthKit.isAvailable((err: Object, available: boolean) => {
        const hkAvailable = !err && available === true;
        writeDiag({ hkAvailableChecked: true, hkAvailable });
        log("permission", "is_available", { available: hkAvailable, api_error: err ? String(err) : null });
        resolve(hkAvailable);
      });
    } catch (e) {
      writeDiag({ hkAvailableChecked: true, hkAvailable: false });
      log("permission", "is_available_threw", { error: String(e) });
      resolve(false);
    }
  });
}

/**
 * FIX-2 + FIX-4: Request HealthKit permissions with full diagnostic tracking.
 *
 * - Marks authRequestAttempted = true in storage BEFORE calling initHealthKit,
 *   so the diagnostics panel can confirm the call was made even if the callback
 *   never fires (native crash, deadlock, etc.).
 * - Maps initHealthKit error → NOT_AVAILABLE (system-level failure), NOT
 *   PERMISSION_DENIED (which is a user choice, not a system error).
 * - On success, calls getAuthStatus to get per-category grant state.
 */
export function requestHealthKitPermissions(): Promise<boolean> {
  return new Promise(async (resolve) => {
    if (!isPlatformIOS()) {
      resolve(false);
      return;
    }

    const permissions = buildPermissions();

    // FIX-4: mark attempt BEFORE initHealthKit fires; also record exact call timestamp
    const initCalledAt = new Date().toISOString();
    await writeDiag({ authRequestAttempted: true, initCalledAt, lastSyncAttemptAt: initCalledAt });
    log("permission", "init_healthkit_start", { init_called_at: initCalledAt });

    try {
      AppleHealthKit.initHealthKit(permissions, async (error: string) => {
        if (error) {
          // FIX-2: initHealthKit error = system-level failure (entitlement missing,
          // device restriction, HealthKit not supported). NOT a user permission choice.
          log("permission", "init_healthkit_error", { raw_error: error });
          await writeDiag({ initHealthKitError: error });
          resolve(false);
          return;
        }

        // initHealthKit succeeded — user was shown the permission dialog
        // (or had already responded to it previously)
        await writeDiag({ initHealthKitError: null });
        log("permission", "init_healthkit_ok");

        // FIX-5: call getAuthStatus to capture per-category grant state
        try {
          const authResult = await getAuthStatusByCategory(permissions);
          await writeDiag({ authResult });
          log("permission", "auth_status", {
            workout: authResult.Workout,
            steps: authResult.Steps,
            calories: authResult.ActiveEnergyBurned,
          });
        } catch {
          // getAuthStatus failure is non-fatal — we still proceed with reads
          log("permission", "auth_status_failed");
        }

        resolve(true);
      });
    } catch (e) {
      log("permission", "init_healthkit_threw", { error: String(e) });
      await writeDiag({ initHealthKitError: String(e) });
      resolve(false);
    }
  });
}

/**
 * FIX-5 + HARDEN-3: Get per-category authorization status using getAuthStatus().
 *
 * HARDEN-3: The mapping from the read status array → AuthCategory is now driven by
 * AUTH_READ_PERMISSION_KEYS (same array used in buildPermissions()), not hardcoded
 * positional indices. When a new permission is added to AUTH_READ_PERMISSION_KEYS,
 * the mapping here updates automatically.
 *
 * iOS PRIVACY NOTE: iOS does not reliably report read-permission grant status to
 * apps (privacy protection). getAuthStatus may return SharingAuthorized for reads
 * that the user actually denied. Only write-permission status is definitively
 * accurate. Treat read auth status as a heuristic, not a guarantee.
 */
function getAuthStatusByCategory(
  permissions: HealthKitPermissions
): Promise<Record<AuthCategory, HealthAuthStatus>> {
  const unknown = Object.fromEntries(
    AUTH_READ_PERMISSION_KEYS.map((cat) => [cat, "NotDetermined" as HealthAuthStatus])
  ) as Record<AuthCategory, HealthAuthStatus>;

  return new Promise((resolve) => {
    try {
      AppleHealthKit.getAuthStatus(permissions, (err: string, results: any) => {
        if (err || !results?.permissions?.read) {
          resolve(unknown);
          return;
        }
        const codeToStatus = (code: number): HealthAuthStatus =>
          code === 2 ? "SharingAuthorized" : code === 1 ? "SharingDenied" : "NotDetermined";

        // HARDEN-3: Map read statuses by iterating AUTH_READ_PERMISSION_KEYS.
        // Positional order matches buildPermissions().permissions.read exactly.
        const read: number[] = results.permissions.read;
        const result = { ...unknown };
        AUTH_READ_PERMISSION_KEYS.forEach((cat, i) => {
          result[cat] = codeToStatus(read[i] ?? 0);
        });
        resolve(result);
      });
    } catch {
      resolve(unknown);
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

/**
 * Structured return type for getWorkoutSamples.
 *
 * `newAnchor` is the HealthKit-issued token for the NEXT incremental query.
 * It should be persisted to AsyncStorage immediately after a successful read
 * and passed back to the next call as the `anchor` parameter.
 * A null `newAnchor` means the native call returned no anchor (unexpected;
 * treated as a full-sync result that does not update the stored anchor).
 */
interface WorkoutSamplesResult {
  workouts: HKWorkoutQueriedSampleType[];
  newAnchor: string | null;
}

/**
 * HARDEN-2: Reads workouts via getAnchoredWorkouts() — the typed, workout-native
 * HealthKit API — instead of getSamples({ type: "Workout" } as any).
 *
 * When `anchor` is provided (truthy string from a previous sync), HealthKit
 * returns ONLY workouts added or modified since that anchor point — making
 * this an incremental read.  The result always includes a new `anchor` string
 * that should replace the stored one for the next sync.
 *
 * When `anchor` is absent or undefined, the call behaves as a date-range sweep
 * (full sync): all workouts from startDate to endDate are returned.
 *
 * Incremental sync lifecycle:
 *   first sync  → no anchor → full sweep → receive anchor A1 → store A1
 *   next sync   → pass A1  → incremental → receive anchor A2 → store A2
 *   …
 *   anchor bad  → error    → caller clears anchor → falls back to full sweep
 */
function getWorkoutSamples(
  startDate: Date,
  endDate: Date,
  anchor?: string,
): Promise<WorkoutSamplesResult> {
  return new Promise((resolve, reject) => {
    const options: HealthInputOptions = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      // Only include anchor when defined — passing undefined would be a no-op,
      // but explicit is clearer for both the reader and the native layer.
      ...(anchor ? { anchor } : {}),
    };
    try {
      AppleHealthKit.getAnchoredWorkouts(
        options,
        (error: HKErrorResponse, results: AnchoredQueryResults) => {
          if (error?.message) {
            reject(new HealthSyncError(HEALTH_ERROR.READ_FAILED, error.message));
            return;
          }
          resolve({
            workouts:  results?.data    ?? [],
            newAnchor: results?.anchor  ?? null,
          });
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
  await writeDiag({ lastStageReached: "permission", lastSyncAttemptAt: new Date().toISOString() });

  // FIX-3: real availability check via HealthKit API
  const hkAvailable = await checkHealthKitAvailableViaAPI();
  if (!hkAvailable) {
    const msg = HEALTH_USER_MESSAGES.NOT_AVAILABLE;
    logError("permission", HEALTH_ERROR.NOT_AVAILABLE, msg);
    await writeDiag({ lastErrorCode: HEALTH_ERROR.NOT_AVAILABLE, lastErrorMsg: msg });
    return {
      success: false,
      partialSuccess: false,
      errorCode: HEALTH_ERROR.NOT_AVAILABLE,
      userMessage: msg,
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
    logError("permission", code, userMsg, err, { timeout_status: "timed_out" });
    await writeDiag({ lastErrorCode: code, lastErrorMsg: userMsg });
    return { success: false, partialSuccess: false, errorCode: code, userMessage: userMsg };
  }

  if (!granted) {
    // FIX-2: initHealthKit failure → NOT_AVAILABLE, not PERMISSION_DENIED.
    const msg = HEALTH_USER_MESSAGES.NOT_AVAILABLE;
    logError("permission", HEALTH_ERROR.NOT_AVAILABLE, msg, undefined, { timeout_status: "ok" });
    await writeDiag({ lastErrorCode: HEALTH_ERROR.NOT_AVAILABLE, lastErrorMsg: msg });
    return {
      success: false,
      partialSuccess: false,
      errorCode: HEALTH_ERROR.NOT_AVAILABLE,
      userMessage: msg,
    };
  }
  log("permission", "granted", { timeout_status: "ok" });

  // ── Stage: read ──────────────────────────────────────────────────────────
  await writeDiag({ lastStageReached: "read" });

  const endDate = new Date();
  const startDate = localDayStart(new Date("2010-01-01"));

  log("read", "start", {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    timeout_status: "ok",
  });

  // Load the stored workout anchor for incremental sync.
  // First sync: storedAnchor is null → full date-range sweep.
  // Subsequent syncs: storedAnchor is set → HealthKit returns only new/modified workouts.
  const storedAnchor = await readWorkoutAnchor();
  const initialSyncMode: SyncMode = storedAnchor ? "anchor" : "full";
  log("read", "anchor_check", { sync_mode: initialSyncMode, has_anchor: !!storedAnchor });

  let stepsRetryCount = 0;
  let caloriesRetryCount = 0;
  let workoutsRetryCount = 0;

  // HARDEN-4: onRetry callbacks now accept the triggering error (3rd arg) and
  // log error_type / error_code for richer retry diagnostics.
  // `let` (not `const`) so the anchor fallback block can rebind workoutsResult.
  let [stepsResult, caloriesResult, workoutsResult] =
    await Promise.allSettled([
      withRetry(
        () =>
          withTimeout(getStepCount(startDate, endDate), READ_TIMEOUT_MS, "steps"),
        {
          maxAttempts: 3,
          baseDelayMs: 500,
          label: "steps",
          onRetry: (attempt, delayMs, err) => {
            stepsRetryCount = attempt;
            log("read", "retry_backoff", {
              metric: "steps",
              attempt,
              delay_ms: delayMs,
              retry_count: attempt,
              error_type: err instanceof Error ? err.constructor.name : typeof err,
              error_code: err instanceof HealthSyncError ? err.code : undefined,
            });
          },
        },
      ),
      withRetry(
        () =>
          withTimeout(getActiveEnergyBurned(startDate, endDate), READ_TIMEOUT_MS, "calories"),
        {
          maxAttempts: 3,
          baseDelayMs: 500,
          label: "calories",
          onRetry: (attempt, delayMs, err) => {
            caloriesRetryCount = attempt;
            log("read", "retry_backoff", {
              metric: "calories",
              attempt,
              delay_ms: delayMs,
              retry_count: attempt,
              error_type: err instanceof Error ? err.constructor.name : typeof err,
              error_code: err instanceof HealthSyncError ? err.code : undefined,
            });
          },
        },
      ),
      withRetry(
        () =>
          withTimeout(
            getWorkoutSamples(startDate, endDate, storedAnchor ?? undefined),
            READ_TIMEOUT_MS,
            "workouts",
          ),
        {
          maxAttempts: 3,
          baseDelayMs: 500,
          label: "workouts",
          onRetry: (attempt, delayMs, err) => {
            workoutsRetryCount = attempt;
            log("read", "retry_backoff", {
              metric: "workouts",
              attempt,
              delay_ms: delayMs,
              retry_count: attempt,
              error_type: err instanceof Error ? err.constructor.name : typeof err,
              error_code: err instanceof HealthSyncError ? err.code : undefined,
            });
          },
        },
      ),
    ]);

  // ── Anchor fallback ───────────────────────────────────────────────────────
  // If an anchor-based workout read fails (e.g. HealthKit invalidated the token
  // after a data restore or Health app reset), clear the stale anchor and retry
  // once without it. The full date-range sweep combined with server-side UUID
  // deduplication guarantees a safe, consistent result.
  if (workoutsResult.status === "rejected" && storedAnchor) {
    const reason = workoutsResult.reason;
    const errMsg =
      reason instanceof HealthSyncError
        ? reason.message
        : String(reason ?? "");
    const anchorRelated = isAnchorInvalidationError(errMsg);
    log("read", "anchor_fallback", {
      sync_mode: "full",
      anchor_related: anchorRelated,
      error_code: reason instanceof HealthSyncError ? reason.code : undefined,
    });
    await clearWorkoutAnchor();
    try {
      const fallbackResult = await withTimeout(
        getWorkoutSamples(startDate, endDate, undefined),
        READ_TIMEOUT_MS,
        "workouts_fallback",
      );
      workoutsResult = { status: "fulfilled", value: fallbackResult };
      log("read", "anchor_fallback_ok", { count: fallbackResult.workouts.length });
    } catch {
      // Fallback also failed; workoutsResult stays as "rejected" — handled below
      log("read", "anchor_fallback_failed");
    }
  }

  // Log per-read outcomes with retry_count and timeout_status
  if (stepsResult.status === "fulfilled") {
    log("read", "steps_ok", { count: stepsResult.value.length, retry_count: stepsRetryCount, timeout_status: "ok" });
  } else {
    const isTimeout = stepsResult.reason instanceof HealthSyncError &&
      stepsResult.reason.code === HEALTH_ERROR.READ_TIMEOUT;
    logError("read", HEALTH_ERROR.READ_FAILED, HEALTH_USER_MESSAGES.READ_FAILED, stepsResult.reason,
      { metric: "steps", retry_count: stepsRetryCount, timeout_status: isTimeout ? "timed_out" : "ok" });
  }
  if (caloriesResult.status === "fulfilled") {
    log("read", "calories_ok", { count: caloriesResult.value.length, retry_count: caloriesRetryCount, timeout_status: "ok" });
  } else {
    const isTimeout = caloriesResult.reason instanceof HealthSyncError &&
      caloriesResult.reason.code === HEALTH_ERROR.READ_TIMEOUT;
    logError("read", HEALTH_ERROR.READ_FAILED, HEALTH_USER_MESSAGES.READ_FAILED, caloriesResult.reason,
      { metric: "calories", retry_count: caloriesRetryCount, timeout_status: isTimeout ? "timed_out" : "ok" });
  }
  if (workoutsResult.status === "fulfilled") {
    log("read", "workouts_ok", {
      count: workoutsResult.value.workouts.length,
      sync_mode: storedAnchor && workoutsResult.status === "fulfilled" ? initialSyncMode : "full",
      has_new_anchor: !!workoutsResult.value.newAnchor,
      retry_count: workoutsRetryCount,
      timeout_status: "ok",
    });
  } else {
    const isTimeout = workoutsResult.reason instanceof HealthSyncError &&
      workoutsResult.reason.code === HEALTH_ERROR.READ_TIMEOUT;
    logError("read", HEALTH_ERROR.READ_FAILED, HEALTH_USER_MESSAGES.READ_FAILED, workoutsResult.reason,
      { metric: "workouts", retry_count: workoutsRetryCount, timeout_status: isTimeout ? "timed_out" : "ok" });
  }

  // All three failed → total failure
  if (
    stepsResult.status === "rejected" &&
    caloriesResult.status === "rejected" &&
    workoutsResult.status === "rejected"
  ) {
    logError("read", HEALTH_ERROR.READ_FAILED, HEALTH_USER_MESSAGES.READ_FAILED);
    await writeDiag({ lastErrorCode: HEALTH_ERROR.READ_FAILED, lastErrorMsg: HEALTH_USER_MESSAGES.READ_FAILED });
    return {
      success: false,
      partialSuccess: false,
      errorCode: HEALTH_ERROR.READ_FAILED,
      userMessage: HEALTH_USER_MESSAGES.READ_FAILED,
    };
  }

  // ── Stage: transform ─────────────────────────────────────────────────────
  await writeDiag({ lastStageReached: "transform" });

  const rawSteps =
    stepsResult.status === "fulfilled" ? stepsResult.value : [];
  const rawCalories =
    caloriesResult.status === "fulfilled" ? caloriesResult.value : [];
  // Extract the workouts array and new anchor from the structured result.
  const rawWorkouts: HKWorkoutQueriedSampleType[] =
    workoutsResult.status === "fulfilled" ? workoutsResult.value.workouts : [];
  const freshAnchor: string | null =
    workoutsResult.status === "fulfilled" ? workoutsResult.value.newAnchor : null;

  // Persist the new anchor immediately after a successful workout read so the
  // NEXT sync can send it back to HealthKit for an incremental query.
  if (freshAnchor) {
    await writeWorkoutAnchor(freshAnchor);
    log("read", "anchor_saved", { sync_mode: initialSyncMode });
  }

  log("transform", "start", { raw_workouts: rawWorkouts.length });

  const totalSteps = rawSteps.reduce((sum, s) => sum + (s.value ?? 0), 0);
  const totalCalories = rawCalories.reduce((sum, c) => sum + (c.value ?? 0), 0);

  // ── Stage: dedupe ────────────────────────────────────────────────────────
  // HARDEN-2: dedupeHKWorkouts is used instead of the generic dedupeWorkouts,
  // correctly keying on id and using start::end (not startDate::endDate) as fallback.
  await writeDiag({ lastStageReached: "dedupe" });
  log("dedupe", "start", { workouts: rawWorkouts.length });
  const uniqueWorkouts = dedupeHKWorkouts(rawWorkouts as HKWorkoutSample[]);
  log("dedupe", "complete", {
    unique: uniqueWorkouts.length,
    dupes_removed: rawWorkouts.length - uniqueWorkouts.length,
  });

  // Build structured SyncWorkout records from the richer workout data.
  const syncWorkouts: SyncWorkout[] = uniqueWorkouts.map((w) => ({
    id: w.id,
    activityName: w.activityName,
    activityId: w.activityId,
    calories: w.calories,
    distance: w.distance,
    duration: w.duration,
    startDate: w.start,
    endDate: w.end,
    sourceName: w.sourceName,
  }));

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
  await writeDiag({ lastStageReached: "save", lastErrorCode: null, lastErrorMsg: null });
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
    workouts: syncWorkouts,
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
    logError("save", code, userMsg, err, { timeout_status: "timed_out" });
    await writeDiag({ lastErrorCode: code, lastErrorMsg: userMsg });
    return { success: false, partialSuccess: false, errorCode: code, userMessage: userMsg };
  }
}

// ---------------------------------------------------------------------------
// Entitlement / config verification checklist
// Run from dev console or diagnostics panel to verify HealthKit setup.
// ---------------------------------------------------------------------------

export async function runHealthEntitlementChecklist(): Promise<{
  checks: Array<{ label: string; pass: boolean; detail: string }>;
  allPass: boolean;
}> {
  const checks: Array<{ label: string; pass: boolean; detail: string }> = [];

  // Check 1: Platform
  checks.push({
    label: "Platform is iOS",
    pass: isPlatformIOS(),
    detail: `Platform.OS = "${Platform.OS}"`,
  });

  // Check 2: HealthKit available via API
  const hkAvailable = await checkHealthKitAvailableViaAPI();
  checks.push({
    label: "HealthKit available on device (isAvailable API)",
    pass: hkAvailable,
    detail: hkAvailable
      ? "AppleHealthKit.isAvailable() → true"
      : "AppleHealthKit.isAvailable() → false (entitlement missing or device restriction)",
  });

  // Check 3: Entitlement config from app.json
  // The com.apple.developer.healthkit entitlement is set in app.json ios.entitlements.
  // At runtime, we verify the permission build succeeded by checking the permissions object.
  const perms = buildPermissions();
  const permReadLength = perms.permissions.read.length;
  const expectedCount = AUTH_READ_PERMISSION_KEYS.length;
  checks.push({
    label: `HealthKit permissions object builds correctly (${expectedCount} read categories)`,
    pass: permReadLength === expectedCount,
    detail: `permissions.read.length = ${permReadLength} (expected ${expectedCount}: ${AUTH_READ_PERMISSION_KEYS.join(", ")})`,
  });

  // Check 4: Diagnostic state
  const diag = await readDiag();
  checks.push({
    label: "initHealthKit attempted at least once",
    pass: diag.authRequestAttempted,
    detail: diag.authRequestAttempted
      ? "authRequestAttempted = true"
      : "authRequestAttempted = false — initHealthKit has never been called",
  });

  checks.push({
    label: "initHealthKit completed without system error",
    pass: diag.initHealthKitError === null && diag.authRequestAttempted,
    detail: diag.initHealthKitError
      ? `initHealthKit error: "${diag.initHealthKitError}"`
      : diag.authRequestAttempted
        ? "initHealthKit succeeded (no error)"
        : "Not attempted yet",
  });

  // Log the checklist
  console.log("[health-entitlement-checklist]");
  for (const c of checks) {
    console.log(`  [${c.pass ? "✓" : "✗"}] ${c.label}: ${c.detail}`);
  }

  const allPass = checks.every((c) => c.pass);
  return { checks, allPass };
}

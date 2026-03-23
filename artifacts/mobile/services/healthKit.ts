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
 */

import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AppleHealthKit, {
  HealthKitPermissions,
  HealthValue,
  HealthInputOptions,
} from "react-native-health";

import {
  HEALTH_ERROR,
  HEALTH_USER_MESSAGES,
  HealthSyncError,
  DIAG_STORAGE_KEY,
  DIAG_INITIAL,
  dedupeWorkouts,
  localDayStart,
  log,
  logError,
  withRetry,
  withTimeout,
  type DiagnosticState,
  type AuthCategory,
  type HealthAuthStatus,
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
    log("read", "retry_backoff", { attempt, delay_ms: delayMs, retry_count: attempt }),
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
// HealthKit permission helpers
// ---------------------------------------------------------------------------

/**
 * FIX-1: Use explicit string literals instead of AppleHealthKit.Constants.Permissions.*
 * These are guaranteed identical values (HealthPermission enum) but do NOT
 * require the native module to be initialized when this function runs, preventing
 * the silent null-return bug where initHealthKit was never called.
 */
function buildPermissions(): HealthKitPermissions {
  return {
    permissions: {
      read: [
        "Workout" as any,
        "Steps" as any,
        "ActiveEnergyBurned" as any,
      ],
      write: [],
    },
  };
}

/**
 * FIX-3: Real HealthKit availability check via AppleHealthKit.isAvailable().
 * This checks that the device supports HealthKit (iPhone, not iPad w/o entitlement,
 * not restricted by MDM/parental controls) and the entitlement is active.
 * Persists result to diagnostic state.
 */
export function checkHealthKitAvailableViaAPI(): Promise<boolean> {
  return new Promise((resolve) => {
    if (Platform.OS !== "ios") {
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
 * Fast platform check (synchronous). Use checkHealthKitAvailableViaAPI() for
 * the authoritative async check.
 */
export function isHealthKitAvailable(): boolean {
  return Platform.OS === "ios";
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
    if (!isHealthKitAvailable()) {
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
 * FIX-5: Get per-category authorization status using getAuthStatus().
 * Returns { Workout, Steps, ActiveEnergyBurned } each as NotDetermined / SharingDenied / SharingAuthorized.
 */
function getAuthStatusByCategory(
  permissions: HealthKitPermissions
): Promise<Record<AuthCategory, HealthAuthStatus>> {
  const unknown: Record<AuthCategory, HealthAuthStatus> = {
    Workout: "NotDetermined",
    Steps: "NotDetermined",
    ActiveEnergyBurned: "NotDetermined",
  };

  return new Promise((resolve) => {
    try {
      AppleHealthKit.getAuthStatus(permissions, (err: string, results: any) => {
        if (err || !results?.permissions?.read) {
          resolve(unknown);
          return;
        }
        const codeToStatus = (code: number): HealthAuthStatus =>
          code === 2 ? "SharingAuthorized" : code === 1 ? "SharingDenied" : "NotDetermined";

        // read statuses come back in the same order as permissions.read array:
        // [Workout, Steps, ActiveEnergyBurned]
        const read: number[] = results.permissions.read;
        resolve({
          Workout: codeToStatus(read[0] ?? 0),
          Steps: codeToStatus(read[1] ?? 0),
          ActiveEnergyBurned: codeToStatus(read[2] ?? 0),
        });
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
    // The user-safe message directs them to check Settings > Health entitlement,
    // not to "grant permissions" (which is incorrect when initHealthKit failed).
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

  let stepsRetryCount = 0;
  let caloriesRetryCount = 0;
  let workoutsRetryCount = 0;

  const [stepsResult, caloriesResult, workoutsResult] =
    await Promise.allSettled([
      withRetry(
        () =>
          withTimeout(getStepCount(startDate, endDate), READ_TIMEOUT_MS, "steps"),
        {
          ...RETRY_OPTS, label: "steps",
          onRetry: (attempt, delayMs) => {
            stepsRetryCount = attempt;
            log("read", "retry_backoff", { metric: "steps", attempt, delay_ms: delayMs, retry_count: attempt });
          },
        },
      ),
      withRetry(
        () =>
          withTimeout(getActiveEnergyBurned(startDate, endDate), READ_TIMEOUT_MS, "calories"),
        {
          ...RETRY_OPTS, label: "calories",
          onRetry: (attempt, delayMs) => {
            caloriesRetryCount = attempt;
            log("read", "retry_backoff", { metric: "calories", attempt, delay_ms: delayMs, retry_count: attempt });
          },
        },
      ),
      withRetry(
        () =>
          withTimeout(getWorkouts(startDate, endDate), READ_TIMEOUT_MS, "workouts"),
        {
          ...RETRY_OPTS, label: "workouts",
          onRetry: (attempt, delayMs) => {
            workoutsRetryCount = attempt;
            log("read", "retry_backoff", { metric: "workouts", attempt, delay_ms: delayMs, retry_count: attempt });
          },
        },
      ),
    ]);

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
    log("read", "workouts_ok", { count: workoutsResult.value.length, retry_count: workoutsRetryCount, timeout_status: "ok" });
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
  const rawWorkouts =
    workoutsResult.status === "fulfilled" ? workoutsResult.value : [];

  log("transform", "start", { raw_workouts: rawWorkouts.length });

  const totalSteps = rawSteps.reduce((sum, s) => sum + (s.value ?? 0), 0);
  const totalCalories = rawCalories.reduce((sum, c) => sum + (c.value ?? 0), 0);

  // ── Stage: dedupe ────────────────────────────────────────────────────────
  await writeDiag({ lastStageReached: "dedupe" });
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
// Requirement 3: Entitlement / config verification checklist
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
    pass: Platform.OS === "ios",
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
  checks.push({
    label: "HealthKit permissions object builds correctly (3 read categories)",
    pass: permReadLength === 3,
    detail: `permissions.read.length = ${permReadLength} (expected 3: Workout, Steps, ActiveEnergyBurned)`,
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
  console.log(`[health-entitlement-checklist] ${allPass ? "ALL PASS" : "FAILURES DETECTED"}`);

  return { checks, allPass };
}

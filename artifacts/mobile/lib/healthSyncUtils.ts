/**
 * healthSyncUtils.ts — Pure utility functions for Apple Health sync.
 *
 * No React Native imports. All functions are pure or only use standard JS
 * so they can be tested in a Node.js environment without native module mocks.
 *
 * Stages (for structured logging):
 *   permission → read → transform → dedupe → save
 */

// ---------------------------------------------------------------------------
// Error taxonomy
// ---------------------------------------------------------------------------

export const HEALTH_ERROR = {
  NOT_AVAILABLE: "NOT_AVAILABLE",
  PERMISSION_DENIED: "PERMISSION_DENIED",
  READ_TIMEOUT: "READ_TIMEOUT",
  READ_FAILED: "READ_FAILED",
  SYNC_TIMEOUT: "SYNC_TIMEOUT",
  UNKNOWN: "UNKNOWN",
} as const;

export type HealthErrorCode = (typeof HEALTH_ERROR)[keyof typeof HEALTH_ERROR];

export type SyncStage = "permission" | "read" | "transform" | "dedupe" | "save";

export class HealthSyncError extends Error {
  constructor(
    public readonly code: HealthErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "HealthSyncError";
  }
}

/** User-safe messages keyed by error code. Never expose raw JS errors to users. */
export const HEALTH_USER_MESSAGES: Record<HealthErrorCode, string> = {
  NOT_AVAILABLE: "Apple Health is not available on this device.",
  PERMISSION_DENIED:
    "Permission denied. Go to Settings \u203a Health \u203a Pro Fitness AI and enable all categories.",
  READ_TIMEOUT:
    "Apple Health took too long to respond. Make sure Health is enabled in Settings, then try again.",
  READ_FAILED:
    "Could not read health data. Please try again in a moment.",
  SYNC_TIMEOUT:
    "Sync timed out. Apple Health may be busy \u2014 wait a moment and tap Retry.",
  UNKNOWN: "An unexpected error occurred. Please try again.",
};

// ---------------------------------------------------------------------------
// Async utilities
// ---------------------------------------------------------------------------

/** Promisified setTimeout — injectable so tests can use fake timers. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Races `promise` against a timeout.
 * Throws `HealthSyncError(READ_TIMEOUT)` if the timeout fires first.
 * Clears the timer if the promise resolves/rejects first.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new HealthSyncError(
            HEALTH_ERROR.READ_TIMEOUT,
            `Timed out after ${ms}ms (${label})`,
          ),
        ),
      ms,
    );
  });
  try {
    const result = await Promise.race([promise, timeout]);
    clearTimeout(timer);
    return result;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  label: string;
  onRetry?: (attempt: number, delayMs: number, err: unknown) => void;
}

/**
 * Retries `fn` up to `maxAttempts` times with exponential backoff.
 * Delay sequence: baseDelayMs, 2×baseDelayMs, 4×baseDelayMs, …
 * Throws the last error if all attempts fail.
 * `onRetry` receives (attempt, delayMs, err) — the triggering error is
 * included so callers can log its type/code alongside the retry metadata.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < opts.maxAttempts) {
        const delay = opts.baseDelayMs * 2 ** (attempt - 1);
        opts.onRetry?.(attempt, delay, err);
        await sleep(delay);
      }
    }
  }
  throw lastError;
}

// ---------------------------------------------------------------------------
// Time handling
// ---------------------------------------------------------------------------

/**
 * Converts a HealthKit ISO timestamp to a YYYY-MM-DD date string in the
 * device's LOCAL timezone.
 *
 * Problem with naive UTC conversion:
 *   A workout ending at "2024-01-16T00:30:00.000Z" (UTC) is still Jan 15
 *   in UTC-8 (Pacific). Using `.toISOString().slice(0,10)` would return
 *   "2024-01-16", misassigning it to the wrong day.
 *
 * Fix: `toLocaleDateString("en-CA")` returns YYYY-MM-DD in local timezone,
 * so the workout is correctly assigned to Jan 15 for Pacific users.
 *
 * Midnight boundary:
 *   "2024-01-15T23:59:59.999Z" (UTC) → "2024-01-15" ✓
 *   "2024-01-16T00:00:00.001Z" (UTC) → "2024-01-16" ✓
 *
 * DST-like edge (UTC+5:30 / IST):
 *   "2024-01-15T18:30:00.000Z" = midnight IST Jan 16
 *   → toLocaleDateString returns "2024-01-16" on an IST device ✓
 *   → would return "2024-01-15" on UTC (correct for that device) ✓
 */
export function toLocalDateString(isoString: string): string {
  return new Date(isoString).toLocaleDateString("en-CA");
}

/**
 * Returns a new Date set to LOCAL midnight (00:00:00.000) for the given date.
 * Use when building HealthKit query start boundaries to avoid UTC-drift.
 */
export function localDayStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Returns a new Date set to LOCAL end-of-day (23:59:59.999) for the given date.
 * Use when building HealthKit query end boundaries.
 */
export function localDayEnd(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

// ---------------------------------------------------------------------------
// Anchor storage — incremental workout sync
// ---------------------------------------------------------------------------

/**
 * AsyncStorage key for the HealthKit workout query anchor.
 *
 * The anchor is a server-issued opaque string returned by getAnchoredWorkouts().
 * Persisting it and passing it on the next call makes subsequent syncs
 * incremental: HealthKit only returns workouts added/modified since the anchor.
 *
 * Anchor lifecycle:
 *   first sync  → no anchor → full date-range query → receive anchor A1 → store A1
 *   next sync   → pass A1   → receive only new items → receive anchor A2 → store A2
 *   ...
 *   anchor invalid → error  → clear anchor → fall back to full date-range query
 *
 * Stored here as a plain string (react-native-health representation).
 * Clearing the anchor forces a full re-fetch on the next sync (safe fallback).
 */
export const WORKOUT_ANCHOR_STORAGE_KEY = "@health_workout_anchor_v1";

/**
 * Identifies the sync mode for a given workout read.
 *
 * "anchor" — incremental: only workouts added/modified since the last stored anchor.
 * "full"   — date-range sweep: all workouts from 2010-01-01 to now.
 */
export type SyncMode = "anchor" | "full";

/**
 * Heuristic to detect when HealthKit has invalidated a stored anchor.
 *
 * When an anchor becomes stale (Health data restored from backup, Health app
 * reset, etc.) HealthKit may return an error whose message references "anchor".
 * This helper matches common patterns to trigger the full-sync fallback safely.
 *
 * Exported as a pure function so it can be unit-tested without any mocks.
 * Intentionally broad: false-positive anchor detections just trigger an
 * unnecessary full sync, which is always safe (server deduplicates by UUID).
 */
export function isAnchorInvalidationError(errorMessage: string): boolean {
  return /anchor/i.test(errorMessage);
}

// ---------------------------------------------------------------------------
// Permission constants — single source of truth for read permission order
// ---------------------------------------------------------------------------

/**
 * Ordered list of HealthKit read permission categories requested by this app.
 *
 * ORDER MATTERS: getAuthStatus returns an array parallel to this list.
 * When you add a new category here, also add it to AuthCategory and update
 * the DiagnosticState.authResult type accordingly.
 *
 * buildPermissions() and getAuthStatusByCategory() both consume this array,
 * so the mapping stays in sync automatically when the list grows.
 */
export type AuthCategory = "Workout" | "Steps" | "ActiveEnergyBurned";

export const AUTH_READ_PERMISSION_KEYS: ReadonlyArray<AuthCategory> = Object.freeze([
  "Workout",
  "Steps",
  "ActiveEnergyBurned",
] as const);

export type HealthAuthStatus = "NotDetermined" | "SharingDenied" | "SharingAuthorized";

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

export type HKSample = Record<string, unknown>;

/**
 * Deduplicates HealthKit samples by their `id` field (HealthKit UUID).
 * Falls back to the composite key `"startDate::endDate"` when `id` is absent.
 *
 * This guards against double-counting on retries: if a partial read succeeds
 * and is then retried, the same samples returned by both reads are collapsed
 * to one entry.
 *
 * First occurrence wins (stable order preserved).
 */
export function dedupeWorkouts(workouts: HKSample[]): HKSample[] {
  const seen = new Map<string, HKSample>();
  for (const w of workouts) {
    const key =
      typeof w.id === "string" && w.id
        ? w.id
        : `${String(w.startDate ?? "")}::${String(w.endDate ?? "")}`;
    if (!seen.has(key)) seen.set(key, w);
  }
  return Array.from(seen.values());
}

/**
 * Typed variant of dedupeWorkouts for HKWorkoutSample records returned by
 * getAnchoredWorkouts(). Uses `id` as primary key; falls back to `start::end`
 * (the field names from HKWorkoutQueriedSampleType, which differ from the
 * generic HKSample that uses startDate/endDate).
 *
 * First occurrence wins (stable order preserved).
 */
export interface HKWorkoutSample {
  id: string;
  activityId: number;
  activityName: string;
  calories: number;
  distance: number;
  duration: number;
  start: string;
  end: string;
  device: string;
  sourceName: string;
  sourceId: string;
  tracked: boolean;
  metadata?: unknown;
}

export function dedupeHKWorkouts(workouts: HKWorkoutSample[]): HKWorkoutSample[] {
  const seen = new Map<string, HKWorkoutSample>();
  for (const w of workouts) {
    const key = w.id ? w.id : `${w.start}::${w.end}`;
    if (!seen.has(key)) seen.set(key, w);
  }
  return Array.from(seen.values());
}

// ---------------------------------------------------------------------------
// Diagnostic state — persisted to AsyncStorage for the diagnostics panel
// ---------------------------------------------------------------------------

export const DIAG_STORAGE_KEY = "@health_diag_v1";

export interface DiagnosticState {
  /** True if AppleHealthKit.isAvailable() was called and result received */
  hkAvailableChecked: boolean;
  /** Result from AppleHealthKit.isAvailable() */
  hkAvailable: boolean | null;
  /** True if initHealthKit was invoked at least once */
  authRequestAttempted: boolean;
  /** ISO timestamp of the moment initHealthKit was called (null = never called) */
  initCalledAt: string | null;
  /** Per-category auth status from getAuthStatus() after initHealthKit.
   *  NOTE: iOS read-permission status is privacy-limited — the OS may return
   *  SharingAuthorized for reads even when the user denied that category.
   *  Only write-permission status is definitively accurate on iOS. */
  authResult: Record<AuthCategory, HealthAuthStatus> | null;
  /** Raw error string from initHealthKit callback, null on success */
  initHealthKitError: string | null;
  /** Furthest pipeline stage reached in the last sync attempt */
  lastStageReached: SyncStage | null;
  lastErrorCode: HealthErrorCode | null;
  lastErrorMsg: string | null;
  lastSyncAttemptAt: string | null;
}

export const DIAG_INITIAL: DiagnosticState = {
  hkAvailableChecked: false,
  hkAvailable: null,
  authRequestAttempted: false,
  initCalledAt: null,
  authResult: null,
  initHealthKitError: null,
  lastStageReached: null,
  lastErrorCode: null,
  lastErrorMsg: null,
  lastSyncAttemptAt: null,
};

// ---------------------------------------------------------------------------
// Structured logging
// ---------------------------------------------------------------------------

export interface LogDetails extends Record<string, unknown> {
  retry_count?: number;
  timeout_status?: "ok" | "timed_out";
}

/** Emits a structured log line: [health-sync] stage=X event=Y key="val" … */
export function log(
  stage: SyncStage,
  event: string,
  details?: LogDetails,
): void {
  const parts: string[] = [`[health-sync] stage=${stage}`, `event=${event}`];
  if (details) {
    for (const [k, v] of Object.entries(details)) {
      parts.push(`${k}=${JSON.stringify(v)}`);
    }
  }
  console.log(parts.join(" "));
}

/** Emits a structured error line with error code and user-safe message. */
export function logError(
  stage: SyncStage,
  code: HealthErrorCode,
  userMessage: string,
  err?: unknown,
  details?: LogDetails,
): void {
  const parts: string[] = [
    `[health-sync] stage=${stage}`,
    `error_code=${code}`,
    `user_message=${JSON.stringify(userMessage)}`,
  ];
  if (details) {
    for (const [k, v] of Object.entries(details)) {
      parts.push(`${k}=${JSON.stringify(v)}`);
    }
  }
  console.error(parts.join(" "), err ?? "");
}

// ---------------------------------------------------------------------------
// UI formatting helpers (pure — no RN imports, safe for Node.js tests)
// ---------------------------------------------------------------------------

/** Formats a lastSyncedAt ISO string as "Today 3:42 PM" or "Jan 14, 3:42 PM". */
export function formatLastSynced(isoString: string | null): string {
  if (!isoString) return "";
  const d = new Date(isoString);
  const now = new Date();
  const isToday =
    d.toLocaleDateString("en-CA") === now.toLocaleDateString("en-CA");
  if (isToday) {
    return `Today ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  }
  return (
    d.toLocaleDateString([], { month: "short", day: "numeric" }) +
    " " +
    d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
  );
}

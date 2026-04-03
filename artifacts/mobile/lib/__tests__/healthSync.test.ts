/**
 * healthSync.test.ts — P1 Apple Health sync reliability tests
 *
 * Tests pure utility functions from lib/healthSyncUtils.ts:
 *   HS-1   toLocalDateString — midnight boundary
 *   HS-2   toLocalDateString — DST-like edge window
 *   HS-3   localDayStart / localDayEnd — local boundary correctness
 *   HS-4   dedupeWorkouts — idempotency / deduplication
 *   HS-5   withRetry — retry count and backoff
 *   HS-6   withTimeout — fires on timeout, resolves before
 *   HS-7   HealthSyncError — error code propagation
 *   HS-8   HEALTH_USER_MESSAGES — all codes have user-safe messages
 *   HS-9   log / logError — structured output format
 *   HS-10  formatLastSynced helper
 *
 * No React Native native modules needed — all functions are pure JS.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  HEALTH_ERROR,
  HEALTH_USER_MESSAGES,
  HealthSyncError,
  DIAG_INITIAL,
  DIAG_STORAGE_KEY,
  WORKOUT_ANCHOR_STORAGE_KEY,
  AUTH_READ_PERMISSION_KEYS,
  dedupeWorkouts,
  dedupeHKWorkouts,
  formatLastSynced,
  isAnchorInvalidationError,
  localDayEnd,
  localDayStart,
  log,
  logError,
  sleep,
  toLocalDateString,
  withRetry,
  withTimeout,
  type AuthCategory,
  type DiagnosticState,
  type HKSample,
  type HKWorkoutSample,
  type SyncMode,
} from "../healthSyncUtils";

// ---------------------------------------------------------------------------
// HS-1  toLocalDateString — midnight boundary
// ---------------------------------------------------------------------------
describe("HS-1 — toLocalDateString midnight boundary", () => {
  it("returns YYYY-MM-DD format", () => {
    const result = toLocalDateString("2024-06-15T12:00:00.000Z");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("noon UTC → same calendar day in UTC", () => {
    // "en-CA" in UTC → "2024-06-15"
    const result = toLocalDateString("2024-06-15T12:00:00.000Z");
    expect(result).toBe("2024-06-15");
  });

  it("one second before local midnight stays on the previous day", () => {
    // In UTC test environment: 2024-01-15T23:59:59.000Z → "2024-01-15"
    const result = toLocalDateString("2024-01-15T23:59:59.000Z");
    expect(result).toBe("2024-01-15");
  });

  it("exactly at local midnight transitions to the next day", () => {
    // In UTC: 2024-01-16T00:00:00.000Z → "2024-01-16"
    const result = toLocalDateString("2024-01-16T00:00:00.000Z");
    expect(result).toBe("2024-01-16");
  });

  it("one millisecond after midnight is still the new day", () => {
    const result = toLocalDateString("2024-01-16T00:00:00.001Z");
    expect(result).toBe("2024-01-16");
  });

  it("two consecutive samples spanning midnight get different dates", () => {
    const before = toLocalDateString("2024-03-10T23:59:59.999Z");
    const after = toLocalDateString("2024-03-11T00:00:00.000Z");
    expect(before).toBe("2024-03-10");
    expect(after).toBe("2024-03-11");
  });
});

// ---------------------------------------------------------------------------
// HS-2  toLocalDateString — DST-like edge window
// ---------------------------------------------------------------------------
describe("HS-2 — toLocalDateString DST-like edge window", () => {
  /**
   * This suite simulates the key invariant that matters during DST transitions:
   * two timestamps 1 ms apart straddling midnight MUST produce different dates.
   *
   * Real DST spring-forward (e.g. US clocks jump 02:00→03:00):
   *   "2024-03-10T06:59:59.999Z" = 01:59:59 EST (before spring-forward)
   *   "2024-03-10T07:00:00.000Z" = 03:00:00 EDT (after spring-forward)
   *
   * These are both Mar 10 in the US. The critical case is near UTC midnight
   * where local-timezone logic must not slip a date.
   */

  it("timestamps on opposite sides of UTC midnight get different local dates", () => {
    const d1 = toLocalDateString("2024-03-10T23:59:59.999Z");
    const d2 = toLocalDateString("2024-03-11T00:00:00.001Z");
    expect(d1).toBe("2024-03-10");
    expect(d2).toBe("2024-03-11");
    expect(d1).not.toBe(d2);
  });

  it("the DST spring-forward date (Mar 10) is handled correctly", () => {
    // Noon on the spring-forward day — unambiguous
    const result = toLocalDateString("2024-03-10T17:00:00.000Z"); // noon UTC
    expect(result).toBe("2024-03-10");
  });

  it("the DST fall-back date (Nov 3) is handled correctly", () => {
    // Noon on fall-back day — unambiguous
    const result = toLocalDateString("2024-11-03T17:00:00.000Z");
    expect(result).toBe("2024-11-03");
  });
});

// ---------------------------------------------------------------------------
// HS-3  localDayStart / localDayEnd
// ---------------------------------------------------------------------------
describe("HS-3 — localDayStart / localDayEnd", () => {
  it("localDayStart sets hours=0, minutes=0, seconds=0, ms=0", () => {
    const d = localDayStart(new Date("2024-06-15T15:30:45.123"));
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
    expect(d.getMilliseconds()).toBe(0);
  });

  it("localDayEnd sets hours=23, minutes=59, seconds=59, ms=999", () => {
    const d = localDayEnd(new Date("2024-06-15T00:00:00.000"));
    expect(d.getHours()).toBe(23);
    expect(d.getMinutes()).toBe(59);
    expect(d.getSeconds()).toBe(59);
    expect(d.getMilliseconds()).toBe(999);
  });

  it("localDayStart < localDayEnd for the same date", () => {
    const ref = new Date("2024-06-15T12:00:00");
    expect(localDayStart(ref).getTime()).toBeLessThan(localDayEnd(ref).getTime());
  });

  it("does not mutate the original date", () => {
    const ref = new Date("2024-06-15T12:00:00");
    const original = ref.getTime();
    localDayStart(ref);
    localDayEnd(ref);
    expect(ref.getTime()).toBe(original);
  });

  it("preserves the calendar date (year/month/day)", () => {
    const ref = new Date(2024, 5, 15, 14, 30, 0); // June 15
    const start = localDayStart(ref);
    expect(start.getFullYear()).toBe(2024);
    expect(start.getMonth()).toBe(5);
    expect(start.getDate()).toBe(15);
  });
});

// ---------------------------------------------------------------------------
// HS-4  dedupeWorkouts
// ---------------------------------------------------------------------------
describe("HS-4 — dedupeWorkouts idempotency and deduplication", () => {
  it("returns empty array for empty input", () => {
    expect(dedupeWorkouts([])).toEqual([]);
  });

  it("returns single item unchanged", () => {
    const w: HKSample = { id: "abc", startDate: "2024-01-01T10:00:00Z" };
    expect(dedupeWorkouts([w])).toEqual([w]);
  });

  it("preserves two items with different ids", () => {
    const w1: HKSample = { id: "aaa", startDate: "2024-01-01T10:00:00Z" };
    const w2: HKSample = { id: "bbb", startDate: "2024-01-02T10:00:00Z" };
    const result = dedupeWorkouts([w1, w2]);
    expect(result).toHaveLength(2);
  });

  it("collapses two items with the same id to one (first occurrence wins)", () => {
    const w1: HKSample = { id: "dup", value: 1 };
    const w2: HKSample = { id: "dup", value: 2 };
    const result = dedupeWorkouts([w1, w2]);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(w1);
  });

  it("uses startDate::endDate fallback when id is absent", () => {
    const w1: HKSample = { startDate: "2024-01-01T10:00:00Z", endDate: "2024-01-01T11:00:00Z" };
    const w2: HKSample = { startDate: "2024-01-01T10:00:00Z", endDate: "2024-01-01T11:00:00Z" };
    const result = dedupeWorkouts([w1, w2]);
    expect(result).toHaveLength(1);
  });

  it("treats different startDate::endDate as distinct when id is absent", () => {
    const w1: HKSample = { startDate: "2024-01-01T10:00:00Z", endDate: "2024-01-01T11:00:00Z" };
    const w2: HKSample = { startDate: "2024-01-02T10:00:00Z", endDate: "2024-01-02T11:00:00Z" };
    const result = dedupeWorkouts([w1, w2]);
    expect(result).toHaveLength(2);
  });

  it("is idempotent: deduping an already-deduped list returns the same result", () => {
    const ws: HKSample[] = [
      { id: "a" }, { id: "b" }, { id: "c" },
    ];
    expect(dedupeWorkouts(dedupeWorkouts(ws))).toHaveLength(3);
  });

  it("removes the retry-duplicate scenario (same list appended to itself)", () => {
    const ws: HKSample[] = [
      { id: "x1" }, { id: "x2" }, { id: "x1" }, { id: "x2" },
    ];
    expect(dedupeWorkouts(ws)).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// HS-5  withRetry
// ---------------------------------------------------------------------------
describe("HS-5 — withRetry retry count and backoff", () => {
  it("returns the value on first successful attempt", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 0, label: "test" });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries and succeeds on second attempt", async () => {
    let calls = 0;
    const fn = vi.fn().mockImplementation(async () => {
      if (++calls === 1) throw new Error("transient");
      return "recovered";
    });
    const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 0, label: "test" });
    expect(result).toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("throws the last error after exhausting all attempts", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("always fails"));
    await expect(
      withRetry(fn, { maxAttempts: 3, baseDelayMs: 0, label: "test" })
    ).rejects.toThrow("always fails");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("respects maxAttempts=1 (no retry)", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));
    await expect(
      withRetry(fn, { maxAttempts: 1, baseDelayMs: 0, label: "test" })
    ).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("calls onRetry with the attempt number and delay", async () => {
    const retries: { attempt: number; delay: number }[] = [];
    let calls = 0;
    const fn = vi.fn().mockImplementation(async () => {
      if (++calls < 3) throw new Error("fail");
      return "done";
    });
    await withRetry(fn, {
      maxAttempts: 3,
      baseDelayMs: 0,
      label: "test",
      onRetry: (attempt, delay) => retries.push({ attempt, delay }),
    });
    expect(retries).toHaveLength(2);
    expect(retries[0].attempt).toBe(1);
    expect(retries[1].attempt).toBe(2);
  });

  it("doubles the delay on each retry (exponential backoff)", async () => {
    const delays: number[] = [];
    const fn = vi.fn().mockRejectedValue(new Error("fail"));
    await withRetry(fn, {
      maxAttempts: 4,
      baseDelayMs: 100,
      label: "test",
      onRetry: (_, delay) => delays.push(delay),
    }).catch(() => {});
    expect(delays).toEqual([100, 200, 400]);
  });
});

// ---------------------------------------------------------------------------
// HS-6  withTimeout
// ---------------------------------------------------------------------------
describe("HS-6 — withTimeout", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("resolves with the promise value if it completes before timeout", async () => {
    const p = Promise.resolve("value");
    const result = await withTimeout(p, 5000, "test");
    expect(result).toBe("value");
  });

  it("rejects with HealthSyncError(READ_TIMEOUT) when timeout fires first", async () => {
    const neverResolves = new Promise<string>(() => {});
    const p = withTimeout(neverResolves, 1000, "test-op");
    vi.advanceTimersByTime(1001);
    await expect(p).rejects.toMatchObject({
      code: HEALTH_ERROR.READ_TIMEOUT,
    });
  });

  it("rejected HealthSyncError has the label in the message", async () => {
    const neverResolves = new Promise<string>(() => {});
    const p = withTimeout(neverResolves, 500, "my-read-op");
    vi.advanceTimersByTime(501);
    await expect(p).rejects.toThrow("my-read-op");
  });

  it("does not fire if promise resolves just before timeout", async () => {
    const p = withTimeout(Promise.resolve("fast"), 1000, "test");
    // Do NOT advance timers — promise should resolve immediately
    const result = await p;
    expect(result).toBe("fast");
  });
});

// ---------------------------------------------------------------------------
// HS-7  HealthSyncError
// ---------------------------------------------------------------------------
describe("HS-7 — HealthSyncError", () => {
  it("has the correct name", () => {
    const e = new HealthSyncError(HEALTH_ERROR.READ_FAILED, "oops");
    expect(e.name).toBe("HealthSyncError");
  });

  it("exposes the error code", () => {
    const e = new HealthSyncError(HEALTH_ERROR.PERMISSION_DENIED, "denied");
    expect(e.code).toBe(HEALTH_ERROR.PERMISSION_DENIED);
  });

  it("instanceof Error is true", () => {
    expect(new HealthSyncError(HEALTH_ERROR.UNKNOWN, "x")).toBeInstanceOf(Error);
  });
});

// ---------------------------------------------------------------------------
// HS-8  HEALTH_USER_MESSAGES completeness
// ---------------------------------------------------------------------------
describe("HS-8 — HEALTH_USER_MESSAGES coverage", () => {
  it("has a message for every error code", () => {
    for (const code of Object.values(HEALTH_ERROR)) {
      expect(HEALTH_USER_MESSAGES[code]).toBeTruthy();
      expect(typeof HEALTH_USER_MESSAGES[code]).toBe("string");
    }
  });

  it("no message is the empty string", () => {
    for (const msg of Object.values(HEALTH_USER_MESSAGES)) {
      expect(msg.trim().length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// HS-9  log / logError structured output format
// ---------------------------------------------------------------------------
describe("HS-9 — log / logError structured output", () => {
  it("log emits [health-sync] prefix with stage and event", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    log("read", "steps_ok", { count: 42 });
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("[health-sync] stage=read event=steps_ok")
    );
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('count=42'));
    spy.mockRestore();
  });

  it("log works without details", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    log("permission", "start");
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("[health-sync] stage=permission event=start")
    );
    spy.mockRestore();
  });

  it("logError emits error_code and user_message", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logError("permission", HEALTH_ERROR.PERMISSION_DENIED, "Go to Settings.");
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("error_code=PERMISSION_DENIED"),
      ""
    );
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// HS-10  formatLastSynced
// ---------------------------------------------------------------------------
describe("HS-10 — formatLastSynced helper", () => {
  it("returns empty string for null", () => {
    expect(formatLastSynced(null)).toBe("");
  });

  it("returns a non-empty string for a valid ISO timestamp", () => {
    const iso = new Date().toISOString();
    expect(formatLastSynced(iso).length).toBeGreaterThan(0);
  });

  it("includes 'Today' for a timestamp from today", () => {
    const iso = new Date().toISOString();
    expect(formatLastSynced(iso)).toContain("Today");
  });

  it("does not include 'Today' for a past date", () => {
    const past = new Date("2023-01-01T12:00:00Z").toISOString();
    expect(formatLastSynced(past)).not.toContain("Today");
  });
});

// ---------------------------------------------------------------------------
// HS-11  DiagnosticState / DIAG_INITIAL shape
// ---------------------------------------------------------------------------
describe("HS-11 — DiagnosticState / DIAG_INITIAL shape", () => {
  it("DIAG_INITIAL has all required fields", () => {
    const fields: (keyof DiagnosticState)[] = [
      "hkAvailableChecked",
      "hkAvailable",
      "authRequestAttempted",
      "authResult",
      "initHealthKitError",
      "lastStageReached",
      "lastErrorCode",
      "lastErrorMsg",
      "lastSyncAttemptAt",
    ];
    for (const f of fields) {
      expect(DIAG_INITIAL).toHaveProperty(f);
    }
  });

  it("DIAG_INITIAL starts with false/null values indicating no sync has run", () => {
    expect(DIAG_INITIAL.hkAvailableChecked).toBe(false);
    expect(DIAG_INITIAL.hkAvailable).toBeNull();
    expect(DIAG_INITIAL.authRequestAttempted).toBe(false);
    expect(DIAG_INITIAL.authResult).toBeNull();
    expect(DIAG_INITIAL.initHealthKitError).toBeNull();
    expect(DIAG_INITIAL.lastStageReached).toBeNull();
    expect(DIAG_INITIAL.lastErrorCode).toBeNull();
    expect(DIAG_INITIAL.lastErrorMsg).toBeNull();
    expect(DIAG_INITIAL.lastSyncAttemptAt).toBeNull();
  });

  it("spreading DIAG_INITIAL produces an independent copy", () => {
    const copy = { ...DIAG_INITIAL };
    copy.authRequestAttempted = true;
    expect(DIAG_INITIAL.authRequestAttempted).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// HS-12  DIAG_STORAGE_KEY
// ---------------------------------------------------------------------------
describe("HS-12 — DIAG_STORAGE_KEY", () => {
  it("is a non-empty string", () => {
    expect(typeof DIAG_STORAGE_KEY).toBe("string");
    expect(DIAG_STORAGE_KEY.trim().length).toBeGreaterThan(0);
  });

  it("includes a version segment to allow future schema changes", () => {
    expect(DIAG_STORAGE_KEY).toMatch(/v\d+/);
  });
});

// ---------------------------------------------------------------------------
// HS-13  logError — accepts and emits details (retry_count + timeout_status)
// ---------------------------------------------------------------------------
describe("HS-13 — logError with LogDetails (retry_count / timeout_status)", () => {
  it("emits retry_count in the log line when provided", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logError("read", HEALTH_ERROR.READ_FAILED, "Read failed.", undefined, {
      retry_count: 3,
    });
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("retry_count=3"),
      "",
    );
    spy.mockRestore();
  });

  it("emits timeout_status=timed_out in the log line when provided", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logError("read", HEALTH_ERROR.READ_TIMEOUT, "Read timed out.", undefined, {
      timeout_status: "timed_out",
    });
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('timeout_status="timed_out"'),
      "",
    );
    spy.mockRestore();
  });

  it("still emits error_code and user_message alongside details", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logError("save", HEALTH_ERROR.SYNC_TIMEOUT, "Sync timed out.", undefined, {
      retry_count: 1,
      timeout_status: "timed_out",
    });
    const [msg] = spy.mock.calls[0];
    expect(msg).toContain("error_code=SYNC_TIMEOUT");
    expect(msg).toContain("retry_count=1");
    expect(msg).toContain('timeout_status="timed_out"');
    spy.mockRestore();
  });

  it("works without details (backwards compatible)", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logError("permission", HEALTH_ERROR.NOT_AVAILABLE, "Not available.");
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("error_code=NOT_AVAILABLE"),
      "",
    );
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// HS-14  log — emits retry_count and timeout_status when in LogDetails
// ---------------------------------------------------------------------------
describe("HS-14 — log with retry_count / timeout_status in details", () => {
  it("emits retry_count in structured log line", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    log("read", "steps_ok", { count: 100, retry_count: 2 });
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("retry_count=2"),
    );
    spy.mockRestore();
  });

  it("emits timeout_status=ok in structured log line", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    log("read", "workouts_ok", { count: 5, timeout_status: "ok" });
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('timeout_status="ok"'),
    );
    spy.mockRestore();
  });

  it("emits both retry_count and timeout_status when both provided", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    log("permission", "granted", { retry_count: 0, timeout_status: "ok" });
    const [msg] = spy.mock.calls[0];
    expect(msg).toContain("retry_count=0");
    expect(msg).toContain('timeout_status="ok"');
    spy.mockRestore();
  });

  it("stage and event are still present when details include retry_count", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    log("dedupe", "complete", { unique: 3, retry_count: 1 });
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("[health-sync] stage=dedupe event=complete"),
    );
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// HS-15  isPlatformIOS vs checkHealthKitAvailableViaAPI separation
// ---------------------------------------------------------------------------
describe("HS-15 — platform helper isolation (isPlatformIOS)", () => {
  /**
   * isPlatformIOS() is a fast, synchronous, platform-level check.
   * It does NOT verify HealthKit availability on the device.
   * checkHealthKitAvailableViaAPI() is the authoritative async check.
   *
   * These tests validate the pure utility behavior of the platform constants
   * and that AUTH_READ_PERMISSION_KEYS is consistent with AuthCategory.
   */

  it("AUTH_READ_PERMISSION_KEYS is a non-empty array", () => {
    expect(Array.isArray(AUTH_READ_PERMISSION_KEYS)).toBe(true);
    expect(AUTH_READ_PERMISSION_KEYS.length).toBeGreaterThan(0);
  });

  it("AUTH_READ_PERMISSION_KEYS contains exactly the expected categories", () => {
    expect(AUTH_READ_PERMISSION_KEYS).toContain("Workout");
    expect(AUTH_READ_PERMISSION_KEYS).toContain("Steps");
    expect(AUTH_READ_PERMISSION_KEYS).toContain("ActiveEnergyBurned");
  });

  it("AUTH_READ_PERMISSION_KEYS has no duplicate entries", () => {
    const unique = new Set(AUTH_READ_PERMISSION_KEYS);
    expect(unique.size).toBe(AUTH_READ_PERMISSION_KEYS.length);
  });

  it("every element of AUTH_READ_PERMISSION_KEYS is a valid AuthCategory string", () => {
    const validCategories: AuthCategory[] = ["Workout", "Steps", "ActiveEnergyBurned"];
    for (const key of AUTH_READ_PERMISSION_KEYS) {
      expect(validCategories).toContain(key);
    }
  });

  it("AUTH_READ_PERMISSION_KEYS elements are all strings", () => {
    for (const key of AUTH_READ_PERMISSION_KEYS) {
      expect(typeof key).toBe("string");
    }
  });
});

// ---------------------------------------------------------------------------
// HS-16  Auth status mapping driven by AUTH_READ_PERMISSION_KEYS
// ---------------------------------------------------------------------------
describe("HS-16 — auth status mapping consistency with AUTH_READ_PERMISSION_KEYS", () => {
  /**
   * Validates that a mapping built using AUTH_READ_PERMISSION_KEYS positional
   * iteration produces the same stable result regardless of index.
   *
   * Simulates what getAuthStatusByCategory() does internally, without calling
   * the native module.
   */

  function simulateAuthMapping(
    readCodes: number[]
  ): Record<AuthCategory, "NotDetermined" | "SharingDenied" | "SharingAuthorized"> {
    const codeToStatus = (code: number) =>
      code === 2 ? "SharingAuthorized" : code === 1 ? "SharingDenied" : "NotDetermined";
    const result = {} as Record<AuthCategory, "NotDetermined" | "SharingDenied" | "SharingAuthorized">;
    AUTH_READ_PERMISSION_KEYS.forEach((cat, i) => {
      result[cat] = codeToStatus(readCodes[i] ?? 0);
    });
    return result;
  }

  it("maps all-authorized (code 2) to SharingAuthorized for every category", () => {
    const codes = AUTH_READ_PERMISSION_KEYS.map(() => 2);
    const result = simulateAuthMapping(codes);
    for (const cat of AUTH_READ_PERMISSION_KEYS) {
      expect(result[cat]).toBe("SharingAuthorized");
    }
  });

  it("maps all-denied (code 1) to SharingDenied for every category", () => {
    const codes = AUTH_READ_PERMISSION_KEYS.map(() => 1);
    const result = simulateAuthMapping(codes);
    for (const cat of AUTH_READ_PERMISSION_KEYS) {
      expect(result[cat]).toBe("SharingDenied");
    }
  });

  it("maps all-not-determined (code 0) to NotDetermined", () => {
    const codes = AUTH_READ_PERMISSION_KEYS.map(() => 0);
    const result = simulateAuthMapping(codes);
    for (const cat of AUTH_READ_PERMISSION_KEYS) {
      expect(result[cat]).toBe("NotDetermined");
    }
  });

  it("maps mixed codes correctly in order of AUTH_READ_PERMISSION_KEYS", () => {
    const codes = AUTH_READ_PERMISSION_KEYS.map((_, i) => i % 3);
    const result = simulateAuthMapping(codes);
    AUTH_READ_PERMISSION_KEYS.forEach((cat, i) => {
      const expected =
        i % 3 === 2 ? "SharingAuthorized" : i % 3 === 1 ? "SharingDenied" : "NotDetermined";
      expect(result[cat]).toBe(expected);
    });
  });

  it("result contains exactly one key per AUTH_READ_PERMISSION_KEYS entry", () => {
    const codes = AUTH_READ_PERMISSION_KEYS.map(() => 2);
    const result = simulateAuthMapping(codes);
    expect(Object.keys(result)).toHaveLength(AUTH_READ_PERMISSION_KEYS.length);
    for (const cat of AUTH_READ_PERMISSION_KEYS) {
      expect(result).toHaveProperty(cat);
    }
  });

  it("unknown code (e.g. 99) falls through to NotDetermined", () => {
    const codes = AUTH_READ_PERMISSION_KEYS.map(() => 99);
    const result = simulateAuthMapping(codes);
    for (const cat of AUTH_READ_PERMISSION_KEYS) {
      expect(result[cat]).toBe("NotDetermined");
    }
  });

  it("missing read code (undefined → 0) falls through to NotDetermined", () => {
    // Shorter array than AUTH_READ_PERMISSION_KEYS — simulates HealthKit
    // returning fewer statuses than expected.
    const result = simulateAuthMapping([2]);
    expect(result[AUTH_READ_PERMISSION_KEYS[0]]).toBe("SharingAuthorized");
    for (let i = 1; i < AUTH_READ_PERMISSION_KEYS.length; i++) {
      expect(result[AUTH_READ_PERMISSION_KEYS[i]]).toBe("NotDetermined");
    }
  });
});

// ---------------------------------------------------------------------------
// HS-17  dedupeHKWorkouts — typed workout deduplication
// ---------------------------------------------------------------------------
describe("HS-17 — dedupeHKWorkouts typed workout deduplication", () => {
  function makeWorkout(overrides: Partial<HKWorkoutSample> = {}): HKWorkoutSample {
    return {
      id: "uuid-001",
      activityId: 79,
      activityName: "TraditionalStrengthTraining",
      calories: 320,
      distance: 0,
      duration: 3600,
      start: "2024-06-01T10:00:00.000Z",
      end: "2024-06-01T11:00:00.000Z",
      device: "Apple Watch",
      sourceName: "Pro Fitness AI",
      sourceId: "com.example.app",
      tracked: true,
      ...overrides,
    };
  }

  it("returns empty array for empty input", () => {
    expect(dedupeHKWorkouts([])).toEqual([]);
  });

  it("returns a single item unchanged", () => {
    const w = makeWorkout();
    expect(dedupeHKWorkouts([w])).toEqual([w]);
  });

  it("preserves two items with different ids", () => {
    const w1 = makeWorkout({ id: "aaa" });
    const w2 = makeWorkout({ id: "bbb" });
    expect(dedupeHKWorkouts([w1, w2])).toHaveLength(2);
  });

  it("deduplicates by id — first occurrence wins", () => {
    const w1 = makeWorkout({ id: "dup", calories: 300 });
    const w2 = makeWorkout({ id: "dup", calories: 400 });
    const result = dedupeHKWorkouts([w1, w2]);
    expect(result).toHaveLength(1);
    expect(result[0].calories).toBe(300);
  });

  it("falls back to start::end key when id is empty string", () => {
    const w1 = makeWorkout({ id: "", start: "2024-06-01T10:00:00Z", end: "2024-06-01T11:00:00Z" });
    const w2 = makeWorkout({ id: "", start: "2024-06-01T10:00:00Z", end: "2024-06-01T11:00:00Z" });
    expect(dedupeHKWorkouts([w1, w2])).toHaveLength(1);
  });

  it("treats distinct start::end as different workouts when id is empty", () => {
    const w1 = makeWorkout({ id: "", start: "2024-06-01T10:00:00Z", end: "2024-06-01T11:00:00Z" });
    const w2 = makeWorkout({ id: "", start: "2024-06-02T10:00:00Z", end: "2024-06-02T11:00:00Z" });
    expect(dedupeHKWorkouts([w1, w2])).toHaveLength(2);
  });

  it("is idempotent on an already-deduped list", () => {
    const workouts = [
      makeWorkout({ id: "a" }),
      makeWorkout({ id: "b" }),
      makeWorkout({ id: "c" }),
    ];
    const once = dedupeHKWorkouts(workouts);
    const twice = dedupeHKWorkouts(once);
    expect(twice).toHaveLength(3);
  });

  it("collapses retry-duplicate scenario (same list appended to itself)", () => {
    const w1 = makeWorkout({ id: "x1" });
    const w2 = makeWorkout({ id: "x2" });
    expect(dedupeHKWorkouts([w1, w2, w1, w2])).toHaveLength(2);
  });

  it("preserves full workout metadata on deduped records", () => {
    const w = makeWorkout({ activityName: "HIIT", calories: 450, duration: 2700 });
    const result = dedupeHKWorkouts([w]);
    expect(result[0].activityName).toBe("HIIT");
    expect(result[0].calories).toBe(450);
    expect(result[0].duration).toBe(2700);
  });
});

// ---------------------------------------------------------------------------
// HS-18  withRetry — onRetry receives error as third argument
// ---------------------------------------------------------------------------
describe("HS-18 — withRetry passes error to onRetry (3-param callback)", () => {
  it("onRetry receives the triggering error as the third argument", async () => {
    const errors: unknown[] = [];
    const targetError = new Error("transient network error");
    let calls = 0;
    const fn = vi.fn().mockImplementation(async () => {
      if (++calls < 3) throw targetError;
      return "ok";
    });
    await withRetry(fn, {
      maxAttempts: 3,
      baseDelayMs: 0,
      label: "test",
      onRetry: (_attempt, _delay, err) => errors.push(err),
    });
    expect(errors).toHaveLength(2);
    expect(errors[0]).toBe(targetError);
    expect(errors[1]).toBe(targetError);
  });

  it("onRetry receives a HealthSyncError with the correct code", async () => {
    const capturedErrors: unknown[] = [];
    const hkErr = new HealthSyncError(HEALTH_ERROR.READ_TIMEOUT, "timed out");
    const fn = vi.fn().mockRejectedValue(hkErr);
    await withRetry(fn, {
      maxAttempts: 2,
      baseDelayMs: 0,
      label: "test",
      onRetry: (_a, _d, err) => capturedErrors.push(err),
    }).catch(() => {});
    expect(capturedErrors[0]).toBeInstanceOf(HealthSyncError);
    expect((capturedErrors[0] as HealthSyncError).code).toBe(HEALTH_ERROR.READ_TIMEOUT);
  });

  it("onRetry with 2-param callback still works (backwards compat — extra arg is ignored)", async () => {
    const retries: { attempt: number; delay: number }[] = [];
    let calls = 0;
    const fn = vi.fn().mockImplementation(async () => {
      if (++calls === 1) throw new Error("fail");
      return "done";
    });
    await withRetry(fn, {
      maxAttempts: 2,
      baseDelayMs: 0,
      label: "test",
      onRetry: (attempt, delay) => retries.push({ attempt, delay }),
    });
    expect(retries).toHaveLength(1);
    expect(retries[0].attempt).toBe(1);
  });

  it("each retry receives the error from that specific failed attempt", async () => {
    const errors: Error[] = [];
    const err1 = new Error("attempt 1 failed");
    const err2 = new Error("attempt 2 failed");
    const errSeq = [err1, err2];
    let calls = 0;
    const fn = vi.fn().mockImplementation(async () => {
      const e = errSeq[calls++];
      if (e) throw e;
      return "done";
    });
    await withRetry(fn, {
      maxAttempts: 3,
      baseDelayMs: 0,
      label: "test",
      onRetry: (_a, _d, err) => errors.push(err as Error),
    });
    expect(errors[0]).toBe(err1);
    expect(errors[1]).toBe(err2);
  });
});

// ---------------------------------------------------------------------------
// HS-19  AUTH_READ_PERMISSION_KEYS integrity checks
// ---------------------------------------------------------------------------
describe("HS-19 — AUTH_READ_PERMISSION_KEYS structural integrity", () => {
  it("is frozen / readonly (cannot be mutated at runtime)", () => {
    const original = [...AUTH_READ_PERMISSION_KEYS];
    try {
      (AUTH_READ_PERMISSION_KEYS as any).push("HeartRate");
    } catch {
      // readonly arrays throw in strict mode — expected
    }
    expect([...AUTH_READ_PERMISSION_KEYS]).toEqual(original);
  });

  it("Workout is the first category (stable index 0)", () => {
    expect(AUTH_READ_PERMISSION_KEYS[0]).toBe("Workout");
  });

  it("Steps is the second category (stable index 1)", () => {
    expect(AUTH_READ_PERMISSION_KEYS[1]).toBe("Steps");
  });

  it("ActiveEnergyBurned is the third category (stable index 2)", () => {
    expect(AUTH_READ_PERMISSION_KEYS[2]).toBe("ActiveEnergyBurned");
  });

  it("total count matches expected 3 permissions for this release", () => {
    expect(AUTH_READ_PERMISSION_KEYS.length).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// HS-20  WORKOUT_ANCHOR_STORAGE_KEY — format and uniqueness
// ---------------------------------------------------------------------------
describe("HS-20 — WORKOUT_ANCHOR_STORAGE_KEY format and uniqueness", () => {
  it("is a non-empty string", () => {
    expect(typeof WORKOUT_ANCHOR_STORAGE_KEY).toBe("string");
    expect(WORKOUT_ANCHOR_STORAGE_KEY.length).toBeGreaterThan(0);
  });

  it("follows the @name_vN convention used by this app's storage keys", () => {
    expect(WORKOUT_ANCHOR_STORAGE_KEY).toMatch(/^@[a-z_]+_v\d+$/);
  });

  it("is distinct from DIAG_STORAGE_KEY to prevent key collision", () => {
    expect(WORKOUT_ANCHOR_STORAGE_KEY).not.toBe(DIAG_STORAGE_KEY);
  });

  it("contains 'anchor' in the key name for discoverability", () => {
    expect(WORKOUT_ANCHOR_STORAGE_KEY.toLowerCase()).toContain("anchor");
  });
});

// ---------------------------------------------------------------------------
// HS-21  isAnchorInvalidationError — detects anchor-related error messages
// ---------------------------------------------------------------------------
describe("HS-21 — isAnchorInvalidationError detects anchor error messages", () => {
  it("returns true for a message that contains 'anchor' (lowercase)", () => {
    expect(isAnchorInvalidationError("anchor is invalid")).toBe(true);
  });

  it("returns true for a message that contains 'Anchor' (capital A)", () => {
    expect(isAnchorInvalidationError("Anchor token expired")).toBe(true);
  });

  it("returns true for a message that contains 'ANCHOR' (all caps)", () => {
    expect(isAnchorInvalidationError("ANCHOR_INVALIDATED")).toBe(true);
  });

  it("returns true for a realistic HealthKit anchor invalidation message", () => {
    expect(
      isAnchorInvalidationError(
        "The anchor provided to HKAnchoredObjectQuery is no longer valid."
      )
    ).toBe(true);
  });

  it("returns false for a generic read error unrelated to anchors", () => {
    expect(isAnchorInvalidationError("Health data unavailable")).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(isAnchorInvalidationError("")).toBe(false);
  });

  it("returns false for a permission-related message", () => {
    expect(isAnchorInvalidationError("Authorization denied by the user")).toBe(false);
  });

  it("returns false for a timeout message", () => {
    expect(isAnchorInvalidationError("Timed out after 10000ms (workouts)")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// HS-22  isAnchorInvalidationError — pure function contract
// ---------------------------------------------------------------------------
describe("HS-22 — isAnchorInvalidationError is a pure function", () => {
  it("returns the same result for the same input (idempotent)", () => {
    const msg = "The anchor object has been invalidated";
    expect(isAnchorInvalidationError(msg)).toBe(isAnchorInvalidationError(msg));
  });

  it("does not mutate its argument", () => {
    const original = "The anchor is stale";
    const copy = original;
    isAnchorInvalidationError(original);
    expect(original).toBe(copy);
  });

  it("handles special regex characters in the message without throwing", () => {
    const weirdMsg = "Error [anchor]: ($invalid.*)";
    expect(() => isAnchorInvalidationError(weirdMsg)).not.toThrow();
    expect(isAnchorInvalidationError(weirdMsg)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// HS-23  SyncMode — type values anchor and full
// ---------------------------------------------------------------------------
describe("HS-23 — SyncMode type values are 'anchor' and 'full'", () => {
  it("'anchor' is a valid SyncMode value", () => {
    const mode: SyncMode = "anchor";
    expect(mode).toBe("anchor");
  });

  it("'full' is a valid SyncMode value", () => {
    const mode: SyncMode = "full";
    expect(mode).toBe("full");
  });

  it("SyncMode values are distinct", () => {
    const anchor: SyncMode = "anchor";
    const full: SyncMode = "full";
    expect(anchor).not.toBe(full);
  });
});

// ---------------------------------------------------------------------------
// HS-24  Anchor lifecycle semantics — null/undefined safe helpers
// ---------------------------------------------------------------------------
describe("HS-24 — anchor lifecycle logic and edge cases", () => {
  it("WORKOUT_ANCHOR_STORAGE_KEY is stable across multiple accesses", () => {
    const first  = WORKOUT_ANCHOR_STORAGE_KEY;
    const second = WORKOUT_ANCHOR_STORAGE_KEY;
    expect(first).toBe(second);
  });

  it("isAnchorInvalidationError returns boolean (never throws)", () => {
    const inputs = ["", "anchor", "normal error", "Anchor problem", "abc123"];
    for (const input of inputs) {
      expect(() => isAnchorInvalidationError(input)).not.toThrow();
      expect(typeof isAnchorInvalidationError(input)).toBe("boolean");
    }
  });

  it("full-sync path is chosen when storedAnchor is null (logical check)", () => {
    const storedAnchor: string | null = null;
    const syncMode: SyncMode = storedAnchor ? "anchor" : "full";
    expect(syncMode).toBe("full");
  });

  it("anchor-sync path is chosen when storedAnchor is a non-empty string", () => {
    const storedAnchor: string | null = "some-opaque-anchor-token";
    const syncMode: SyncMode = storedAnchor ? "anchor" : "full";
    expect(syncMode).toBe("anchor");
  });

  it("falls back to full when storedAnchor is empty string (falsy)", () => {
    const storedAnchor: string | null = "";
    const syncMode: SyncMode = storedAnchor ? "anchor" : "full";
    expect(syncMode).toBe("full");
  });
});

// ---------------------------------------------------------------------------
// HS-25  Anchor fallback detection — real vs non-real invalidation errors
// ---------------------------------------------------------------------------
describe("HS-25 — anchor fallback detection boundary cases", () => {
  const SHOULD_TRIGGER = [
    "HKAnchoredObjectQuery anchor is no longer valid",
    "anchor object expired",
    "Invalid anchor provided",
    "Anchor has been reset due to backup restore",
    "The ANCHOR_TOKEN is stale",
  ];

  const SHOULD_NOT_TRIGGER = [
    "Health data read failed",
    "Permission denied",
    "HealthKit not available",
    "Sync timed out",
    "Network error",
    "Unable to complete request",
  ];

  for (const msg of SHOULD_TRIGGER) {
    it(`triggers fallback for: "${msg}"`, () => {
      expect(isAnchorInvalidationError(msg)).toBe(true);
    });
  }

  for (const msg of SHOULD_NOT_TRIGGER) {
    it(`does NOT trigger fallback for: "${msg}"`, () => {
      expect(isAnchorInvalidationError(msg)).toBe(false);
    });
  }
});

// ---------------------------------------------------------------------------
// HS-26  Anchor storage key versioning
// ---------------------------------------------------------------------------
describe("HS-26 — anchor storage key versioning", () => {
  it("includes a version suffix (_v1) to allow future schema migrations", () => {
    expect(WORKOUT_ANCHOR_STORAGE_KEY).toMatch(/_v\d+$/);
  });

  it("current version is v1", () => {
    expect(WORKOUT_ANCHOR_STORAGE_KEY).toMatch(/_v1$/);
  });

  it("key does not collide with health sync state key", () => {
    expect(WORKOUT_ANCHOR_STORAGE_KEY).not.toBe("@health_sync_state_v1");
  });

  it("key does not collide with diagnostic storage key", () => {
    expect(WORKOUT_ANCHOR_STORAGE_KEY).not.toBe("@health_diag_v1");
  });
});

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
  dedupeWorkouts,
  formatLastSynced,
  localDayEnd,
  localDayStart,
  log,
  logError,
  sleep,
  toLocalDateString,
  withRetry,
  withTimeout,
  type DiagnosticState,
  type HKSample,
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

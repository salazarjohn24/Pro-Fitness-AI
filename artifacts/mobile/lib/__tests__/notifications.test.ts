/**
 * notifications.test.ts — Scheduling behavior for daily / weekly / off
 *
 * Tests that applyNotifPrefs() calls the Expo Notifications API with the
 * correct trigger shape for each insightFrequency value, and that the
 * weekly trigger uses a weekday field (so it fires once a week, not daily).
 *
 * Timezone note:
 *   The CALENDAR trigger fires at the device's LOCAL time — Expo translates
 *   the hour/minute/weekday into the system timezone automatically.  We do
 *   NOT set a `timezone` field in the trigger; doing so would pin firing to
 *   a fixed zone and break users in other regions.  Tests assert that no
 *   `timezone` field is present.
 *
 * Bug fixed (L03):
 *   Before the fix, `applyNotifPrefs` called `scheduleDaily()` for BOTH
 *   "daily" and "weekly", so "weekly" fired every day.  After the fix, it
 *   calls `scheduleWeekly()` (CALENDAR + weekday) for "weekly".
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// Native module mocks — hoisted before any imports.
//
// expo-notifications:  scheduleNotificationAsync / cancelScheduledNotificationAsync
//                      are the only APIs under test; everything else is stubbed.
// react-native:        Platform.OS must be "ios" so the Platform.OS === "web"
//                      guards in notifications.ts do not short-circuit the logic.
// async-storage:       getItem returns null (no saved prefs); setItem is a no-op.
// ---------------------------------------------------------------------------
vi.mock("expo-notifications", () => ({
  SchedulableTriggerInputTypes: {
    CALENDAR: "calendar",
    TIME_INTERVAL: "timeInterval",
  },
  setNotificationHandler: vi.fn(),
  scheduleNotificationAsync: vi.fn().mockResolvedValue("mock-notification-id"),
  cancelScheduledNotificationAsync: vi.fn().mockResolvedValue(undefined),
  getPermissionsAsync: vi.fn().mockResolvedValue({ status: "granted" }),
  requestPermissionsAsync: vi.fn().mockResolvedValue({ status: "granted" }),
}));

vi.mock("react-native", () => ({
  Platform: { OS: "ios" },
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
  },
}));

import * as Notifications from "expo-notifications";
import { applyNotifPrefs, DEFAULT_NOTIF_PREFS, type NotifPrefs } from "../notifications";

const scheduleAsync = Notifications.scheduleNotificationAsync as ReturnType<typeof vi.fn>;
const cancelAsync = Notifications.cancelScheduledNotificationAsync as ReturnType<typeof vi.fn>;

function basePrefs(overrides: Partial<NotifPrefs> = {}): NotifPrefs {
  return {
    ...DEFAULT_NOTIF_PREFS,
    checkInEnabled: false,
    workoutEnabled: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// NOTIF-1 — daily: schedules with no weekday in the trigger
// ---------------------------------------------------------------------------
describe("NOTIF-1 — insightFrequency: daily", () => {
  it("calls scheduleNotificationAsync with a CALENDAR trigger (no weekday)", async () => {
    await applyNotifPrefs(basePrefs({ insightFrequency: "daily", insightHour: 9, insightMinute: 30 }));

    expect(scheduleAsync).toHaveBeenCalledOnce();
    const call = scheduleAsync.mock.calls[0][0];
    expect(call.identifier).toBe("insight-notification");
    expect(call.trigger.type).toBe("calendar");
    expect(call.trigger.hour).toBe(9);
    expect(call.trigger.minute).toBe(30);
    expect(call.trigger.repeats).toBe(true);
    expect(call.trigger.weekday).toBeUndefined();   // daily → no weekday constraint
  });

  it("daily trigger does not set a timezone field (fires in device-local time)", async () => {
    await applyNotifPrefs(basePrefs({ insightFrequency: "daily" }));

    const trigger = scheduleAsync.mock.calls[0][0].trigger;
    expect(trigger.timezone).toBeUndefined();
  });

  it("schedules (not only cancels) the insight notification — net effect is active", async () => {
    // scheduleDaily calls cancelById internally before re-scheduling, so
    // cancelAsync will fire for "insight-notification" as a side effect.
    // What matters is that scheduleAsync is also called — the net effect is
    // an active recurring notification, not a disabled one.
    await applyNotifPrefs(basePrefs({ insightFrequency: "daily" }));

    const insightScheduleCalls = scheduleAsync.mock.calls.filter(
      (c) => c[0].identifier === "insight-notification",
    );
    expect(insightScheduleCalls).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// NOTIF-2 — weekly: schedules with weekday in the trigger (the L03 bug fix)
// ---------------------------------------------------------------------------
describe("NOTIF-2 — insightFrequency: weekly", () => {
  it("calls scheduleNotificationAsync with a CALENDAR trigger that includes weekday", async () => {
    await applyNotifPrefs(
      basePrefs({ insightFrequency: "weekly", insightHour: 10, insightMinute: 0, insightWeekday: 1 }),
    );

    expect(scheduleAsync).toHaveBeenCalledOnce();
    const call = scheduleAsync.mock.calls[0][0];
    expect(call.identifier).toBe("insight-notification");
    expect(call.trigger.type).toBe("calendar");
    expect(call.trigger.hour).toBe(10);
    expect(call.trigger.minute).toBe(0);
    expect(call.trigger.weekday).toBe(1);  // Sunday — fires weekly, NOT daily
    expect(call.trigger.repeats).toBe(true);
  });

  it("weekly trigger fires on the configured weekday (Monday=2, Friday=6)", async () => {
    for (const weekday of [2, 6]) {
      vi.clearAllMocks();
      await applyNotifPrefs(basePrefs({ insightFrequency: "weekly", insightWeekday: weekday }));
      const trigger = scheduleAsync.mock.calls[0][0].trigger;
      expect(trigger.weekday).toBe(weekday);
    }
  });

  it("weekly trigger does not set a timezone field (fires in device-local time)", async () => {
    await applyNotifPrefs(
      basePrefs({ insightFrequency: "weekly", insightWeekday: 1 }),
    );

    const trigger = scheduleAsync.mock.calls[0][0].trigger;
    expect(trigger.timezone).toBeUndefined();
  });

  it("L03 regression: weekly trigger has weekday field (not absent like a daily trigger)", async () => {
    await applyNotifPrefs(
      basePrefs({ insightFrequency: "weekly", insightWeekday: 1 }),
    );
    const weeklyTrigger = scheduleAsync.mock.calls[0][0].trigger;
    expect(weeklyTrigger.weekday).toBeDefined();

    vi.clearAllMocks();

    await applyNotifPrefs(basePrefs({ insightFrequency: "daily" }));
    const dailyTrigger = scheduleAsync.mock.calls[0][0].trigger;
    expect(dailyTrigger.weekday).toBeUndefined();

    // The two triggers must differ in exactly the weekday field.
    expect(weeklyTrigger.type).toBe(dailyTrigger.type);
    expect(weeklyTrigger.hour).toBe(dailyTrigger.hour);
    expect(weeklyTrigger.minute).toBe(dailyTrigger.minute);
  });

  it("schedules (not only cancels) the insight notification — net effect is active", async () => {
    // scheduleWeekly calls cancelById internally before re-scheduling.
    // What matters is that scheduleAsync is also called with the insight
    // identifier — the net effect is an active weekly notification.
    await applyNotifPrefs(basePrefs({ insightFrequency: "weekly", insightWeekday: 1 }));

    const insightScheduleCalls = scheduleAsync.mock.calls.filter(
      (c) => c[0].identifier === "insight-notification",
    );
    expect(insightScheduleCalls).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// NOTIF-3 — off: cancels and does not schedule
// ---------------------------------------------------------------------------
describe("NOTIF-3 — insightFrequency: off", () => {
  it("calls cancelScheduledNotificationAsync for the insight notification", async () => {
    await applyNotifPrefs(basePrefs({ insightFrequency: "off" }));

    const cancelCalls = cancelAsync.mock.calls.map((c) => c[0]);
    expect(cancelCalls).toContain("insight-notification");
  });

  it("does not call scheduleNotificationAsync", async () => {
    await applyNotifPrefs(basePrefs({ insightFrequency: "off" }));

    // scheduleAsync may be called for check-in/workout (both disabled in basePrefs),
    // but must NOT be called for insight.
    const insightScheduleCalls = scheduleAsync.mock.calls.filter(
      (c) => c[0].identifier === "insight-notification",
    );
    expect(insightScheduleCalls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// NOTIF-4 — timezone handling: CALENDAR triggers use device-local time
// ---------------------------------------------------------------------------
describe("NOTIF-4 — timezone handling", () => {
  it("daily trigger type is CALENDAR (device-local, not a UTC timestamp)", async () => {
    await applyNotifPrefs(basePrefs({ insightFrequency: "daily" }));
    expect(scheduleAsync.mock.calls[0][0].trigger.type).toBe("calendar");
  });

  it("weekly trigger type is CALENDAR (device-local, not a UTC timestamp)", async () => {
    await applyNotifPrefs(basePrefs({ insightFrequency: "weekly", insightWeekday: 1 }));
    expect(scheduleAsync.mock.calls[0][0].trigger.type).toBe("calendar");
  });

  it("neither daily nor weekly trigger contains a timezone field", async () => {
    for (const frequency of ["daily", "weekly"] as const) {
      vi.clearAllMocks();
      await applyNotifPrefs(
        basePrefs({ insightFrequency: frequency, insightWeekday: 1 }),
      );
      const trigger = scheduleAsync.mock.calls[0][0].trigger;
      expect(trigger.timezone).toBeUndefined();
    }
  });

  it("hour and minute in the trigger match the configured local values exactly", async () => {
    await applyNotifPrefs(
      basePrefs({ insightFrequency: "daily", insightHour: 7, insightMinute: 45 }),
    );
    const trigger = scheduleAsync.mock.calls[0][0].trigger;
    expect(trigger.hour).toBe(7);
    expect(trigger.minute).toBe(45);
  });
});

// ---------------------------------------------------------------------------
// NOTIF-6 — weekday picker: DEFAULT_NOTIF_PREFS and per-weekday scheduling
// ---------------------------------------------------------------------------
describe("NOTIF-6 — weekday picker defaults and per-day scheduling", () => {
  it("DEFAULT_NOTIF_PREFS has insightWeekday=1 (Sunday)", async () => {
    const { DEFAULT_NOTIF_PREFS: prefs } = await import("../notifications");
    expect(prefs.insightWeekday).toBe(1);
  });

  it("each weekday 1-7 produces a CALENDAR trigger with that exact weekday", async () => {
    for (const wd of [1, 2, 3, 4, 5, 6, 7]) {
      vi.clearAllMocks();
      await applyNotifPrefs(basePrefs({ insightFrequency: "weekly", insightWeekday: wd }));
      const trigger = scheduleAsync.mock.calls[0][0].trigger;
      expect(trigger.weekday, `weekday ${wd}`).toBe(wd);
    }
  });

  it("changing weekday via picker (simulated state update) produces correct trigger", async () => {
    // Simulate user changing from Sunday (1) to Monday (2) in the UI.
    const afterPick = basePrefs({ insightFrequency: "weekly", insightWeekday: 2 });
    await applyNotifPrefs(afterPick);
    expect(scheduleAsync.mock.calls[0][0].trigger.weekday).toBe(2);
  });

  it("weekday picker change produces CALENDAR type, not TIME_INTERVAL", async () => {
    await applyNotifPrefs(basePrefs({ insightFrequency: "weekly", insightWeekday: 5 }));
    expect(scheduleAsync.mock.calls[0][0].trigger.type).toBe("calendar");
  });
});

// ---------------------------------------------------------------------------
// NOTIF-5 — check-in and workout scheduling not broken by the fix
// ---------------------------------------------------------------------------
describe("NOTIF-5 — check-in and workout scheduling unaffected", () => {
  it("check-in enabled: schedules with daily CALENDAR trigger", async () => {
    await applyNotifPrefs(
      basePrefs({ checkInEnabled: true, checkInHour: 8, checkInMinute: 0, insightFrequency: "off" }),
    );

    const checkInCall = scheduleAsync.mock.calls.find(
      (c) => c[0].identifier === "daily-checkin-reminder",
    );
    expect(checkInCall).toBeDefined();
    expect(checkInCall![0].trigger.type).toBe("calendar");
    expect(checkInCall![0].trigger.weekday).toBeUndefined();
  });

  it("workout enabled: schedules with daily CALENDAR trigger", async () => {
    await applyNotifPrefs(
      basePrefs({ workoutEnabled: true, workoutHour: 18, workoutMinute: 0, insightFrequency: "off" }),
    );

    const workoutCall = scheduleAsync.mock.calls.find(
      (c) => c[0].identifier === "daily-workout-reminder",
    );
    expect(workoutCall).toBeDefined();
    expect(workoutCall![0].trigger.type).toBe("calendar");
    expect(workoutCall![0].trigger.weekday).toBeUndefined();
  });
});

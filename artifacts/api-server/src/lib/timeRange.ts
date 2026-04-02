/**
 * timeRange.ts — Date range filtering helpers for Step 4 history rollup.
 *
 * Pure module: no side effects, no profile lookups. All functions accept an
 * optional `referenceDate` (defaults to `new Date()`) so they are fully
 * deterministic in tests.
 *
 * SCOPE: Step 4 only. No physiology. No fatigue signals.
 */

import type { TimeRangePreset, CustomTimeRange, HistoricalWorkoutInput } from "./historyScoringTypes";

// ---------------------------------------------------------------------------
// Preset cutoff computation
// ---------------------------------------------------------------------------

/** Days back for each named preset. */
const PRESET_DAYS: Record<Exclude<TimeRangePreset, "all">, number> = {
  week:    7,
  month:   30,
  quarter: 90,
  year:    365,
};

/**
 * Return the start Date for a preset relative to `referenceDate`.
 * Returns `null` for "all" (no lower bound).
 *
 * The returned Date is the start of the day `daysBack` ago at 00:00:00 UTC
 * so that filters are inclusive and predictable.
 */
export function getPresetStart(
  preset: TimeRangePreset,
  referenceDate: Date = new Date()
): Date | null {
  if (preset === "all") return null;
  const days = PRESET_DAYS[preset];
  const cutoff = new Date(referenceDate);
  cutoff.setUTCDate(cutoff.getUTCDate() - days);
  cutoff.setUTCHours(0, 0, 0, 0);
  return cutoff;
}

// ---------------------------------------------------------------------------
// Day-level math
// ---------------------------------------------------------------------------

/**
 * Compute how many whole days ago `targetDate` was relative to `referenceDate`.
 * Returns 0 if targetDate is the same day or in the future.
 */
export function daysAgo(targetDate: Date, referenceDate: Date = new Date()): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const diffMs = referenceDate.getTime() - targetDate.getTime();
  return Math.max(0, Math.floor(diffMs / msPerDay));
}

// ---------------------------------------------------------------------------
// Filter
// ---------------------------------------------------------------------------

/**
 * Filter a collection of historical workouts to those within the given range.
 *
 * @param workouts      - Full collection of historical workouts
 * @param range         - Preset string ("week", "month", …, "all") or CustomTimeRange
 * @param referenceDate - Reference "now" (defaults to actual now; injectable for tests)
 * @returns             - Workouts within the range, sorted ascending by performedAt
 */
export function filterByTimeRange(
  workouts: HistoricalWorkoutInput[],
  range: TimeRangePreset | CustomTimeRange,
  referenceDate: Date = new Date()
): HistoricalWorkoutInput[] {
  let start: Date | null;
  let end: Date;

  if (typeof range === "string") {
    start = getPresetStart(range, referenceDate);
    end = referenceDate;
  } else {
    start = range.start;
    end = range.end;
  }

  const filtered = workouts.filter((w) => {
    const t = w.performedAt.getTime();
    const afterStart = start === null || t >= start.getTime();
    const beforeEnd = t <= end.getTime();
    return afterStart && beforeEnd;
  });

  // Sort ascending (oldest first) for deterministic iteration order
  return filtered.sort((a, b) => a.performedAt.getTime() - b.performedAt.getTime());
}

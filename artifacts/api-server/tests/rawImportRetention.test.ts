/**
 * rawImportRetention.test.ts
 *
 * Alignment Item 3 — verifies the rawImportText retention policy:
 *
 *   1. After the purge runs, rawImportText is NULL on workouts older than 30 days.
 *   2. All other workout columns (label, workoutType, movements, etc.) are preserved.
 *   3. Recent workouts (< 30 days old) are NOT touched.
 *   4. Workouts that already have rawImportText = NULL are not affected.
 *
 * The test executes the same UPDATE logic as scripts/src/purge-raw-import-text.ts
 * without importing the script (which calls process.exit). This ensures the
 * logic is correct and independently verifiable.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db, externalWorkoutsTable, usersTable } from "@workspace/db";
import { eq, and, lt, isNotNull } from "drizzle-orm";

const TEST_USER_ID = "__retention_test_user__";
const RETENTION_DAYS = 30;

async function runPurge(): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

  const updated = await db
    .update(externalWorkoutsTable)
    .set({ rawImportText: null })
    .where(
      and(
        lt(externalWorkoutsTable.createdAt, cutoff),
        isNotNull(externalWorkoutsTable.rawImportText)
      )
    )
    .returning({ id: externalWorkoutsTable.id });

  return updated.length;
}

let oldWorkoutId: number;
let recentWorkoutId: number;
let alreadyNullWorkoutId: number;

beforeAll(async () => {
  await db
    .insert(usersTable)
    .values({
      id: TEST_USER_ID,
      email: "retention@test.internal",
      name: "Retention Test",
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoNothing();

  // Insert an old workout (45 days ago) WITH rawImportText
  const oldDate = new Date();
  oldDate.setDate(oldDate.getDate() - 45);

  const [old] = await db
    .insert(externalWorkoutsTable)
    .values({
      userId: TEST_USER_ID,
      label: "Old Imported Workout",
      workoutType: "Strength",
      duration: 40,
      source: "external",
      movements: [{ name: "Squat", volume: "3x5", movementType: "strength" }],
      rawImportText: "3x5 squat @185lbs",
      createdAt: oldDate,
    })
    .returning({ id: externalWorkoutsTable.id });
  oldWorkoutId = old.id;

  // Insert a recent workout (5 days ago) WITH rawImportText — should NOT be purged
  const recentDate = new Date();
  recentDate.setDate(recentDate.getDate() - 5);

  const [recent] = await db
    .insert(externalWorkoutsTable)
    .values({
      userId: TEST_USER_ID,
      label: "Recent Imported Workout",
      workoutType: "Cardio",
      duration: 30,
      source: "external",
      movements: [],
      rawImportText: "30 min run",
      createdAt: recentDate,
    })
    .returning({ id: externalWorkoutsTable.id });
  recentWorkoutId = recent.id;

  // Insert an old workout that already has rawImportText = NULL
  const [alreadyNull] = await db
    .insert(externalWorkoutsTable)
    .values({
      userId: TEST_USER_ID,
      label: "Old Workout No Text",
      workoutType: "Yoga",
      duration: 60,
      source: "manual",
      movements: [],
      rawImportText: null,
      createdAt: oldDate,
    })
    .returning({ id: externalWorkoutsTable.id });
  alreadyNullWorkoutId = alreadyNull.id;
});

afterAll(async () => {
  await db.delete(externalWorkoutsTable).where(eq(externalWorkoutsTable.userId, TEST_USER_ID));
  await db.delete(usersTable).where(eq(usersTable.id, TEST_USER_ID));
});

describe("R1: rawImportText retention purge", () => {
  it("R1.1 — purge removes rawImportText from workouts older than 30 days", async () => {
    const count = await runPurge();
    expect(count).toBeGreaterThanOrEqual(1);

    const [row] = await db
      .select({
        rawImportText: externalWorkoutsTable.rawImportText,
        label: externalWorkoutsTable.label,
        workoutType: externalWorkoutsTable.workoutType,
        duration: externalWorkoutsTable.duration,
        movements: externalWorkoutsTable.movements,
      })
      .from(externalWorkoutsTable)
      .where(eq(externalWorkoutsTable.id, oldWorkoutId));

    expect(row.rawImportText).toBeNull();
  });

  it("R1.2 — all other workout metadata is preserved after purge", async () => {
    const [row] = await db
      .select({
        label: externalWorkoutsTable.label,
        workoutType: externalWorkoutsTable.workoutType,
        duration: externalWorkoutsTable.duration,
        movements: externalWorkoutsTable.movements,
      })
      .from(externalWorkoutsTable)
      .where(eq(externalWorkoutsTable.id, oldWorkoutId));

    expect(row.label).toBe("Old Imported Workout");
    expect(row.workoutType).toBe("Strength");
    expect(row.duration).toBe(40);
    expect(row.movements).toHaveLength(1);
  });

  it("R1.3 — recent workouts (< 30 days) are NOT purged", async () => {
    const [row] = await db
      .select({ rawImportText: externalWorkoutsTable.rawImportText })
      .from(externalWorkoutsTable)
      .where(eq(externalWorkoutsTable.id, recentWorkoutId));

    expect(row.rawImportText).toBe("30 min run");
  });

  it("R1.4 — purge is idempotent on already-null rows (no error on re-run)", async () => {
    const count = await runPurge();
    // oldWorkoutId already purged; alreadyNullWorkoutId was always null — both excluded
    expect(count).toBe(0);
  });

  it("R1.5 — already-null workouts remain null (not touched)", async () => {
    const [row] = await db
      .select({ rawImportText: externalWorkoutsTable.rawImportText, label: externalWorkoutsTable.label })
      .from(externalWorkoutsTable)
      .where(eq(externalWorkoutsTable.id, alreadyNullWorkoutId));

    expect(row.rawImportText).toBeNull();
    expect(row.label).toBe("Old Workout No Text");
  });
});

/**
 * vaultIngestionFailure.test.ts
 *
 * Alignment Item 1 — proves transaction atomicity on vault ingestion failure.
 * When vault ingestion throws, the entire db.transaction() rolls back:
 *   - No external_workouts row is committed
 *   - POST returns HTTP 500 with structured retryable error payload
 *   - Non-movement workouts (rest days) remain unaffected
 *
 * Verifies:
 *   1. POST /api/workouts/external returns 500 when vault ingestion throws
 *   2. The external_workouts row is NOT committed (full rollback)
 *   3. Error payload has { code: "VAULT_INGESTION_FAILED", retryable: true }
 *   4. Rest-day POST (no movements) still succeeds — ingestion never called
 *
 * Auth mock inlines the user ID literal (hoisting requirement for vi.mock).
 * Vault ingestion mock throws on every call to ingestMovementsToVault.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";

// ---------------------------------------------------------------------------
// Auth mock
// ---------------------------------------------------------------------------
vi.mock("../src/lib/auth", () => ({
  getSessionId: () => "vault-failure-test-session",
  getSession: () => ({
    user: {
      id: "__vault_failure_test_user__",
      email: "vaultfail@test.internal",
      name: "Vault Failure Test",
    },
    access_token: "vault-failure-test-token",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
  }),
  clearSession: vi.fn(),
  updateSession: vi.fn(),
  getOidcConfig: vi.fn(),
}));

// ---------------------------------------------------------------------------
// AI service mock
// ---------------------------------------------------------------------------
vi.mock("../src/services/aiService", () => ({
  parseWorkoutDescriptionAI: vi.fn().mockResolvedValue({
    label: "Fail test",
    muscleGroups: [],
    movements: [],
    isMetcon: false,
    metconFormat: null,
    stimulusPoints: null,
    intensity: null,
    parserConfidence: null,
    parserWarnings: [],
    workoutFormat: null,
  }),
  generateRecoveryInsights: vi.fn().mockResolvedValue({ insights: "ok" }),
}));

// ---------------------------------------------------------------------------
// Vault ingestion mock — ingestMovementsToVault always throws to simulate
// a DB error mid-transaction; checkExerciseMatches is a no-op read.
// ---------------------------------------------------------------------------
vi.mock("../src/lib/vaultIngestion.js", () => ({
  ingestMovementsToVault: vi.fn().mockRejectedValue(new Error("Simulated vault DB failure")),
  deleteVaultEntriesForExternalWorkout: vi.fn().mockResolvedValue(undefined),
  checkExerciseMatches: vi.fn().mockResolvedValue([]),
}));

import app from "../src/app";
import { db, usersTable, externalWorkoutsTable } from "@workspace/db";
import { eq, and, gte } from "drizzle-orm";

const TEST_USER_ID = "__vault_failure_test_user__";

beforeAll(async () => {
  await db
    .insert(usersTable)
    .values({
      id: TEST_USER_ID,
      email: "vaultfail@test.internal",
      name: "Vault Failure Test",
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoNothing();
});

afterAll(async () => {
  await db.delete(externalWorkoutsTable).where(eq(externalWorkoutsTable.userId, TEST_USER_ID));
  await db.delete(usersTable).where(eq(usersTable.id, TEST_USER_ID));
});

// ---------------------------------------------------------------------------
// Alignment Item 1 — Hard-fail with transaction rollback
// ---------------------------------------------------------------------------
describe("P4.1-D: Failed vault ingestion returns 500 and rolls back the workout row", () => {
  const testStart = new Date(Date.now() - 5000);

  it("POST /api/workouts/external returns 500 when vault ingestion throws", async () => {
    const res = await request(app)
      .post("/api/workouts/external")
      .set("Cookie", "sid=vault-failure-test-session")
      .send({
        label: "Failure test workout",
        workoutType: "Strength",
        duration: 30,
        movements: [
          {
            name: "Barbell Squat",
            movementType: "strength",
            setRows: [{ reps: 5, weight: "185" }],
          },
        ],
      });

    expect(res.status).toBe(500);
    expect(res.body.code).toBe("VAULT_INGESTION_FAILED");
    expect(res.body.retryable).toBe(true);
    expect(res.body.error).toMatch(/try again/i);
    // No workout id in the error response (row was rolled back)
    expect(res.body.id).toBeUndefined();
  });

  it("workout row is NOT committed after vault failure (transaction atomicity)", async () => {
    const rows = await db
      .select({ id: externalWorkoutsTable.id })
      .from(externalWorkoutsTable)
      .where(
        and(
          eq(externalWorkoutsTable.userId, TEST_USER_ID),
          gte(externalWorkoutsTable.createdAt, testStart)
        )
      );

    // Transaction must have rolled back — zero rows from this test user
    expect(rows.length).toBe(0);
  });

  it("POST without movements (rest day) still succeeds — ingestion never called", async () => {
    const res = await request(app)
      .post("/api/workouts/external")
      .set("Cookie", "sid=vault-failure-test-session")
      .send({
        label: "Rest Day",
        workoutType: "rest",
        duration: 0,
        movements: [],
      });

    expect(res.status).toBe(200);
    expect(res.body.id).toBeDefined();
    expect(res.body.label).toBe("Rest Day");
  });
});

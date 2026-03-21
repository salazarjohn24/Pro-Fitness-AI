/**
 * vaultIngestionFailure.test.ts
 *
 * A8 reliability — proves that vault ingestion failures surface as HTTP 207
 * Multi-Status (not silent 200 or 500). The workout row IS committed; only
 * the exercise-vault step failed. Client receives:
 *   { ...workout, ingestionError: { code: "VAULT_INGESTION_FAILED", retryable: true } }
 *
 * Verifies:
 *   1. POST /api/workouts/external returns 207 when vault ingestion throws
 *   2. The external_workouts row WAS committed (workout is saved, vault partial)
 *   3. ingestionError payload has the expected shape
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
// Vault ingestion mock — always throws to simulate a DB error mid-transaction
// ---------------------------------------------------------------------------
vi.mock("../src/lib/vaultIngestion.js", () => ({
  ingestMovementsToVault: vi.fn().mockRejectedValue(new Error("Simulated vault DB failure")),
  deleteVaultEntriesForExternalWorkout: vi.fn().mockResolvedValue(undefined),
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
  await db.delete(usersTable).where(eq(usersTable.id, TEST_USER_ID));
});

// ---------------------------------------------------------------------------
// A8  Failed ingestion returns 207 Multi-Status (workout saved, vault partial)
// ---------------------------------------------------------------------------
describe("P4.1-D: Failed vault ingestion surfaces as HTTP 500", () => {
  it("POST /api/workouts/external returns 207 when vault ingestion throws", async () => {
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

    // A8: workout saved, vault failed → 207 with structured ingestionError
    expect(res.status).toBe(207);
    expect(res.body.ingestionError).toBeDefined();
    expect(res.body.ingestionError.code).toBe("VAULT_INGESTION_FAILED");
    expect(res.body.ingestionError.retryable).toBe(true);
    expect(res.body.id).toBeDefined();
  });

  it("workout row IS committed after vault failure (A8: workout saved, vault partial)", async () => {
    const testStart = new Date(Date.now() - 10000);

    const rows = await db
      .select({ id: externalWorkoutsTable.id })
      .from(externalWorkoutsTable)
      .where(
        and(
          eq(externalWorkoutsTable.userId, TEST_USER_ID),
          gte(externalWorkoutsTable.createdAt, testStart)
        )
      );

    // The workout must be committed even though vault ingestion failed
    expect(rows.length).toBeGreaterThanOrEqual(1);

    // Cleanup
    for (const row of rows) {
      await db.delete(externalWorkoutsTable).where(eq(externalWorkoutsTable.id, row.id));
    }
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

    await db
      .delete(externalWorkoutsTable)
      .where(eq(externalWorkoutsTable.userId, TEST_USER_ID));
  });
});

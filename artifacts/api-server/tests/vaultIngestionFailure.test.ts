/**
 * vaultIngestionFailure.test.ts
 *
 * P4.1 reliability — proves that vault ingestion failures surface as HTTP 500,
 * not as silent 200 responses. Uses a mocked vault ingestion module so the DB
 * insert inside db.transaction() throws BEFORE committing, verifying that:
 *   1. POST /api/workouts/external returns 500
 *   2. The external_workouts row was rolled back (no orphaned row in DB)
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
// P4.1-D  Failed ingestion returns 500, not silent 200
// ---------------------------------------------------------------------------
describe("P4.1-D: Failed vault ingestion surfaces as HTTP 500", () => {
  it("POST /api/workouts/external returns 500 when vault ingestion throws", async () => {
    const testStart = new Date();

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
  });

  it("transaction rollback: no external_workouts row committed after 500", async () => {
    const testStart = new Date(Date.now() - 5000);

    const rows = await db
      .select({ id: externalWorkoutsTable.id })
      .from(externalWorkoutsTable)
      .where(
        and(
          eq(externalWorkoutsTable.userId, TEST_USER_ID),
          gte(externalWorkoutsTable.createdAt, testStart)
        )
      );

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

    await db
      .delete(externalWorkoutsTable)
      .where(eq(externalWorkoutsTable.userId, TEST_USER_ID));
  });
});

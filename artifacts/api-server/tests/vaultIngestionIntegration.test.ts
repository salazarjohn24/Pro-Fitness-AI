/**
 * vaultIngestionIntegration.test.ts
 *
 * Integration tests for P4.1 vault ingestion — cardio, hold, and strength
 * movements through the full HTTP stack with real DB.
 *
 * User: "__vault_p41_test_user__" (isolated from main integration test user)
 * Cleanup: afterAll deletes test user (cascades workoutHistory / exercisePerformance)
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import request from "supertest";

// ---------------------------------------------------------------------------
// Auth mock — factory inlines the test user ID (vi.mock is hoisted)
// ---------------------------------------------------------------------------
vi.mock("../src/lib/auth", () => ({
  getSessionId: () => "vault-p41-test-session",
  getSession: () => ({
    user: {
      id: "__vault_p41_test_user__",
      email: "vaultp41@test.internal",
      name: "Vault P4.1 Test",
    },
    access_token: "vault-p41-test-token",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
  }),
  clearSession: vi.fn(),
  updateSession: vi.fn(),
  getOidcConfig: vi.fn(),
}));

// ---------------------------------------------------------------------------
// AI service mock — never called in these tests but mock to avoid side effects
// ---------------------------------------------------------------------------
vi.mock("../src/services/aiService", () => ({
  parseWorkoutDescriptionAI: vi.fn().mockResolvedValue({
    label: "Vault test",
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

import app from "../src/app";
import { db, usersTable, externalWorkoutsTable, exerciseLibraryTable, workoutHistoryTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const TEST_USER_ID = "__vault_p41_test_user__";

beforeAll(async () => {
  await db
    .insert(usersTable)
    .values({
      id: TEST_USER_ID,
      email: "vaultp41@test.internal",
      name: "Vault P4.1 Test",
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoNothing();
});

afterAll(async () => {
  await db.delete(usersTable).where(eq(usersTable.id, TEST_USER_ID));
});

// ---------------------------------------------------------------------------
// Helper: look up exerciseId by name (created by vault ingestion)
// ---------------------------------------------------------------------------
async function findExerciseId(name: string): Promise<number | null> {
  const [row] = await db
    .select({ id: exerciseLibraryTable.id })
    .from(exerciseLibraryTable)
    .where(eq(exerciseLibraryTable.name, name))
    .limit(1);
  return row?.id ?? null;
}

// ---------------------------------------------------------------------------
// Helper: look up workout_history rows for a user + exercise
// ---------------------------------------------------------------------------
async function getHistoryRows(userId: string, exerciseId: number) {
  return db
    .select()
    .from(workoutHistoryTable)
    .where(and(eq(workoutHistoryTable.userId, userId), eq(workoutHistoryTable.exerciseId, exerciseId)));
}

// ---------------------------------------------------------------------------
// P4.1-A  Cardio → workout_history with durationSeconds + distanceMeters
// ---------------------------------------------------------------------------
describe("P4.1-A: Cardio movement writes to workout_history", () => {
  const exerciseName = `__p41_cardio_run_${Date.now()}__`;
  let workoutId: number;

  afterAll(async () => {
    if (workoutId) {
      await db.delete(externalWorkoutsTable).where(eq(externalWorkoutsTable.id, workoutId));
    }
    await db
      .delete(exerciseLibraryTable)
      .where(eq(exerciseLibraryTable.name, exerciseName));
  });

  it("POST /api/workouts/external with cardio returns 200 and creates vault entry", async () => {
    const res = await request(app)
      .post("/api/workouts/external")
      .set("Cookie", "sid=vault-p41-test-session")
      .send({
        label: "P4.1 Cardio Test",
        workoutType: "Cardio",
        duration: 30,
        movements: [
          {
            name: exerciseName,
            movementType: "cardio",
            setRows: [{ durationSeconds: 1800, distance: 5000 }],
          },
        ],
      });

    expect(res.status).toBe(200);
    workoutId = res.body.id;
    expect(workoutId).toBeTypeOf("number");
  });

  it("cardio exercise appears in workout_history with weight=0, reps=0, sets=1", async () => {
    const exerciseId = await findExerciseId(exerciseName);
    expect(exerciseId).not.toBeNull();

    const rows = await getHistoryRows(TEST_USER_ID, exerciseId!);
    expect(rows.length).toBeGreaterThanOrEqual(1);

    const row = rows[0];
    expect(row.weight).toBe(0);
    expect(row.reps).toBe(0);
    expect(row.sets).toBe(1);
    expect(row.source).toBe("external");
  });

  it("cardio workout_history row has durationSeconds and distanceMeters", async () => {
    const exerciseId = await findExerciseId(exerciseName);
    const rows = await getHistoryRows(TEST_USER_ID, exerciseId!);
    const row = rows[0] as any;

    expect(row.durationSeconds).toBe(1800);
    expect(row.distanceMeters).toBe(5000);
  });

  it("GET /api/exercises/:id/history returns cardio entry with totalVolume = distanceMeters", async () => {
    const exerciseId = await findExerciseId(exerciseName);
    const res = await request(app)
      .get(`/api/exercises/${exerciseId}/history`)
      .set("Cookie", "sid=vault-p41-test-session");

    expect(res.status).toBe(200);
    expect(res.body.sessions).toBeDefined();
    const session = res.body.sessions[0];
    expect(session.distanceMeters).toBe(5000);
    expect(session.totalVolume).toBe(5000);
    expect(session.durationSeconds).toBe(1800);
  });

  it("GET history for cardio exercise has estimated1RM = null (no fake 1RM)", async () => {
    const exerciseId = await findExerciseId(exerciseName);
    const res = await request(app)
      .get(`/api/exercises/${exerciseId}/history`)
      .set("Cookie", "sid=vault-p41-test-session");

    expect(res.status).toBe(200);
    expect(res.body.estimated1RM).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// P4.1-B  Hold regression — durationSeconds, totalVolume = total hold time
// ---------------------------------------------------------------------------
describe("P4.1-B: Hold regression — workout_history with durationSeconds", () => {
  const exerciseName = `__p41_hold_plank_${Date.now()}__`;
  let workoutId: number;

  afterAll(async () => {
    if (workoutId) {
      await db.delete(externalWorkoutsTable).where(eq(externalWorkoutsTable.id, workoutId));
    }
    await db
      .delete(exerciseLibraryTable)
      .where(eq(exerciseLibraryTable.name, exerciseName));
  });

  it("POST with hold movement writes durationSeconds and weight=0", async () => {
    const res = await request(app)
      .post("/api/workouts/external")
      .set("Cookie", "sid=vault-p41-test-session")
      .send({
        label: "P4.1 Hold Test",
        workoutType: "Strength",
        duration: 10,
        movements: [
          {
            name: exerciseName,
            movementType: "hold",
            setRows: [
              { durationSeconds: 45 },
              { durationSeconds: 45 },
              { durationSeconds: 45 },
            ],
          },
        ],
      });

    expect(res.status).toBe(200);
    workoutId = res.body.id;

    const exerciseId = await findExerciseId(exerciseName);
    expect(exerciseId).not.toBeNull();

    const rows = await getHistoryRows(TEST_USER_ID, exerciseId!);
    expect(rows.length).toBeGreaterThanOrEqual(1);

    const row = rows[0] as any;
    expect(row.weight).toBe(0);
    expect(row.durationSeconds).toBe(135);
    expect(row.source).toBe("external");
  });

  it("GET history returns totalVolume = 135 (total hold seconds)", async () => {
    const exerciseId = await findExerciseId(exerciseName);
    const res = await request(app)
      .get(`/api/exercises/${exerciseId}/history`)
      .set("Cookie", "sid=vault-p41-test-session");

    expect(res.status).toBe(200);
    const session = res.body.sessions[0];
    expect(session.totalVolume).toBe(135);
    expect(session.durationSeconds).toBe(135);
  });
});

// ---------------------------------------------------------------------------
// P4.1-C  Strength regression — weight/reps/sets intact, estimated1RM present
// ---------------------------------------------------------------------------
describe("P4.1-C: Strength regression — weight * reps * sets, estimated1RM", () => {
  const exerciseName = `__p41_strength_deadlift_${Date.now()}__`;
  let workoutId: number;

  afterAll(async () => {
    if (workoutId) {
      await db.delete(externalWorkoutsTable).where(eq(externalWorkoutsTable.id, workoutId));
    }
    await db
      .delete(exerciseLibraryTable)
      .where(eq(exerciseLibraryTable.name, exerciseName));
  });

  it("POST with strength movement writes weight=220, reps=5, sets=5", async () => {
    const res = await request(app)
      .post("/api/workouts/external")
      .set("Cookie", "sid=vault-p41-test-session")
      .send({
        label: "P4.1 Strength Test",
        workoutType: "Strength",
        duration: 60,
        movements: [
          {
            name: exerciseName,
            movementType: "strength",
            setRows: [
              { reps: 5, weight: "220" },
              { reps: 5, weight: "220" },
              { reps: 5, weight: "220" },
              { reps: 5, weight: "220" },
              { reps: 5, weight: "220" },
            ],
          },
        ],
      });

    expect(res.status).toBe(200);
    workoutId = res.body.id;

    const exerciseId = await findExerciseId(exerciseName);
    const rows = await getHistoryRows(TEST_USER_ID, exerciseId!);
    const row = rows[0];
    expect(row.weight).toBe(220);
    expect(row.reps).toBe(5);
    expect(row.sets).toBe(5);
    expect(row.source).toBe("external");
  });

  it("GET history returns totalVolume = 5500 and estimated1RM > 0", async () => {
    const exerciseId = await findExerciseId(exerciseName);
    const res = await request(app)
      .get(`/api/exercises/${exerciseId}/history`)
      .set("Cookie", "sid=vault-p41-test-session");

    expect(res.status).toBe(200);
    expect(res.body.sessions[0].totalVolume).toBe(5500);
    expect(res.body.estimated1RM).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// MI-1 → MI-7  matched_by field in check-exercise-matches
//
// Verifies the diagnostic matched_by field returned by POST
// /api/workouts/check-exercise-matches for each of the four paths:
//   exact      → library has the exact name (case-insensitive)
//   normalized → library has the name after stripping equipment prefix
//   partial    → library has a name that contains the first word (>= 4 chars)
//   created    → no library entry found, willCreate=true, suggestion=null
//
// Bench / Deadlift / Squat sample paths are covered in MI-3 → MI-5.
// ---------------------------------------------------------------------------
describe("MI-1 → MI-7: matched_by diagnostic field in check-exercise-matches", () => {
  // Seed a unique "Bench Press" exercise so we can test exact + normalized paths
  const BENCH_NAME = `__mi_bench_press_${Date.now()}__`;
  let seededBenchId: number | null = null;

  beforeAll(async () => {
    const [row] = await db
      .insert(exerciseLibraryTable)
      .values({
        name: BENCH_NAME,
        muscleGroup: "Chest",
        equipment: "Barbell",
        goal: "strength",
        difficulty: "intermediate",
      })
      .returning({ id: exerciseLibraryTable.id });
    seededBenchId = row.id;
  });

  afterAll(async () => {
    if (seededBenchId) {
      await db.delete(exerciseLibraryTable).where(eq(exerciseLibraryTable.id, seededBenchId));
    }
  });

  it("MI-1: exact match returns matched_by='exact', willCreate=false", async () => {
    const res = await request(app)
      .post("/api/workouts/check-exercise-matches")
      .set("Cookie", "sid=vault-p41-test-session")
      .send({ movements: [{ name: BENCH_NAME }] });

    expect(res.status).toBe(200);
    const [check] = res.body.checks;
    expect(check.matched_by).toBe("exact");
    expect(check.willCreate).toBe(false);
    expect(check.matchedId).toBe(seededBenchId);
  });

  it("MI-2: normalized match returns matched_by='normalized', willCreate=false", async () => {
    // "Barbell __mi_bench_press_..." strips "Barbell " → matches BENCH_NAME
    const res = await request(app)
      .post("/api/workouts/check-exercise-matches")
      .set("Cookie", "sid=vault-p41-test-session")
      .send({ movements: [{ name: `Barbell ${BENCH_NAME}` }] });

    expect(res.status).toBe(200);
    const [check] = res.body.checks;
    expect(check.matched_by).toBe("normalized");
    expect(check.willCreate).toBe(false);
  });

  it("MI-3: Bench Press (exactly in library) → matched_by is 'exact' or 'partial' (real library)", async () => {
    // Real exercise library should have "Bench Press". If it does, matched_by=exact.
    // If not yet seeded, matched_by=partial (first word "Bench" length=5 >= 4).
    const res = await request(app)
      .post("/api/workouts/check-exercise-matches")
      .set("Cookie", "sid=vault-p41-test-session")
      .send({ movements: [{ name: "Bench Press" }] });

    expect(res.status).toBe(200);
    const [check] = res.body.checks;
    expect(["exact", "normalized", "partial", "created"]).toContain(check.matched_by);
    // If matched, willCreate must be false
    if (!check.willCreate) {
      expect(check.matched_by).toMatch(/^(exact|normalized)$/);
    }
  });

  it("MI-4: Deadlift → matched_by is 'exact' or 'partial' (never 'normalized')", async () => {
    // "Deadlift" has no equipment prefix — normalizeExerciseName returns "deadlift" unchanged
    // → normalized path is SKIPPED, only exact + partial are attempted
    const res = await request(app)
      .post("/api/workouts/check-exercise-matches")
      .set("Cookie", "sid=vault-p41-test-session")
      .send({ movements: [{ name: "Deadlift" }] });

    expect(res.status).toBe(200);
    const [check] = res.body.checks;
    expect(check.matched_by).not.toBe("normalized");
    expect(["exact", "partial", "created"]).toContain(check.matched_by);
  });

  it("MI-5: Squat → matched_by is 'exact' or 'partial' (never 'normalized')", async () => {
    const res = await request(app)
      .post("/api/workouts/check-exercise-matches")
      .set("Cookie", "sid=vault-p41-test-session")
      .send({ movements: [{ name: "Squat" }] });

    expect(res.status).toBe(200);
    const [check] = res.body.checks;
    expect(check.matched_by).not.toBe("normalized");
  });

  it("MI-6: unknown name returns matched_by='created', willCreate=true, suggestion=null", async () => {
    const uniqueName = `__mi_no_match_${Date.now()}__`;
    const res = await request(app)
      .post("/api/workouts/check-exercise-matches")
      .set("Cookie", "sid=vault-p41-test-session")
      .send({ movements: [{ name: uniqueName }] });

    expect(res.status).toBe(200);
    const [check] = res.body.checks;
    expect(check.matched_by).toBe("created");
    expect(check.willCreate).toBe(true);
    expect(check.suggestion).toBeNull();
  });

  it("MI-7: batch request returns correct matched_by for each item independently", async () => {
    const uniqueName = `__mi_batch_no_match_${Date.now()}__`;
    const res = await request(app)
      .post("/api/workouts/check-exercise-matches")
      .set("Cookie", "sid=vault-p41-test-session")
      .send({
        movements: [
          { name: BENCH_NAME },      // exact
          { name: uniqueName },       // created
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.checks).toHaveLength(2);
    expect(res.body.checks[0].matched_by).toBe("exact");
    expect(res.body.checks[1].matched_by).toBe("created");
  });
});

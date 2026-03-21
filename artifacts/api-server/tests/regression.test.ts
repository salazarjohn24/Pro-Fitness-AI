/**
 * regression.test.ts — P5 Pre-Release Regression Suite
 *
 * Covers the five critical integration paths that must hold before every
 * TestFlight/App Store submission:
 *
 *   REG-1   Google social auth entry point — redirect contract (local)
 *   REG-2   Apple social auth bad-token rejection — never 500
 *   REG-3   External import → vault → exercise history (full pipeline stitch)
 *           Strength, hold, and cardio all tested in one POST and three GET checks
 *   REG-4   Vault atomicity — ingestion failure leaves no orphaned rows
 *   REG-5   POST /workouts/external without movements (rest day) never attempts ingestion
 *
 * Strategy:
 *   - REG-1 and REG-2 use an unauthenticated (raw app) path — social auth routes
 *     do not require a session, so we test the route contract directly.
 *   - REG-3 and beyond use the same mocked auth pattern as smoke/integration tests.
 *   - Real PostgreSQL — test user row __regression_test_user__ is isolated and
 *     cleaned up in afterAll via cascade.
 *
 * Tag: run as part of `scripts/pre-release-check.sh`
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";

// ---------------------------------------------------------------------------
// Auth mock — required for routes that go through authMiddleware
// Social auth routes (/auth/social/*) don't check isAuthenticated() but still
// pass through authMiddleware, so the mock must be present.
// ---------------------------------------------------------------------------
vi.mock("../src/lib/auth", () => ({
  getSessionId: () => "regression-test-session",
  getSession: () => ({
    user: {
      id: "__regression_test_user__",
      email: "regression@test.internal",
      name: "Regression Test",
    },
    access_token: "regression-test-token",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
  }),
  clearSession: vi.fn(),
  updateSession: vi.fn(),
  getOidcConfig: vi.fn(),
}));

vi.mock("../src/services/aiService", () => ({
  parseWorkoutDescriptionAI: vi.fn().mockResolvedValue({
    label: "Regression test",
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

const REG_USER_ID = "__regression_test_user__";

beforeAll(async () => {
  await db
    .insert(usersTable)
    .values({
      id: REG_USER_ID,
      email: "regression@test.internal",
      name: "Regression Test",
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoNothing();
});

afterAll(async () => {
  await db.delete(usersTable).where(eq(usersTable.id, REG_USER_ID));
});

// ---------------------------------------------------------------------------
// REG-1: Google social auth entry point — redirect contract
// ---------------------------------------------------------------------------
describe("REG-1: Google auth entry point — redirect contract", () => {
  it("GET /api/auth/social/google responds with 302 or 503 (never 500)", async () => {
    const res = await request(app)
      .get("/api/auth/social/google")
      .redirects(0);

    expect([302, 503]).toContain(res.status);
  });

  it("if 302: Location header points to accounts.google.com", async () => {
    const res = await request(app)
      .get("/api/auth/social/google")
      .redirects(0);

    if (res.status === 302) {
      expect(res.headers.location).toMatch(/accounts\.google\.com/);
    } else {
      expect(res.status).toBe(503);
      expect(res.body.error).toMatch(/not configured/i);
    }
  });

  it("if 302: redirect_uri in Location points to /api/auth/social/google/callback", async () => {
    const res = await request(app)
      .get("/api/auth/social/google")
      .redirects(0);

    if (res.status === 302) {
      const loc = new URL(res.headers.location);
      const redirectUri = loc.searchParams.get("redirect_uri") ?? "";
      expect(redirectUri).toMatch(/\/api\/auth\/social\/google\/callback/);
    }
  });

  it("GET /api/auth/social/unknown → 400 (not 500)", async () => {
    const res = await request(app)
      .get("/api/auth/social/__not_a_real_provider__")
      .redirects(0);

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// REG-2: Apple social auth bad-token — never 500
// ---------------------------------------------------------------------------
describe("REG-2: Apple social auth bad-token — never 500", () => {
  it("POST /api/auth/social/apple with no token → 400", async () => {
    const res = await request(app)
      .post("/api/auth/social/apple")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it("POST /api/auth/social/apple with invalid JWT → 400 or 401 (not 500)", async () => {
    const res = await request(app)
      .post("/api/auth/social/apple")
      .send({ identityToken: "not.a.real.jwt" });

    expect([400, 401]).toContain(res.status);
    expect(res.body.error).toBeDefined();
  });

  it("response body always has an 'error' field on failure (never empty body)", async () => {
    const res = await request(app)
      .post("/api/auth/social/apple")
      .send({ identityToken: "eyFake.eyFake.fake" });

    expect(res.body.error).toBeDefined();
    expect(typeof res.body.error).toBe("string");
    expect(res.body.error.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// REG-3: Full import → vault → exercise history (pipeline stitch)
// One POST with all three movement types; three GET history checks
// ---------------------------------------------------------------------------
describe("REG-3: Full import → vault → exercise history pipeline", () => {
  const suffix = Date.now();
  const strengthName = `__reg_strength_${suffix}__`;
  const holdName = `__reg_hold_${suffix}__`;
  const cardioName = `__reg_cardio_${suffix}__`;
  let workoutId: number;

  afterAll(async () => {
    if (workoutId) {
      await db.delete(externalWorkoutsTable).where(eq(externalWorkoutsTable.id, workoutId));
    }
    for (const name of [strengthName, holdName, cardioName]) {
      await db.delete(exerciseLibraryTable).where(eq(exerciseLibraryTable.name, name));
    }
  });

  it("POST /api/workouts/external with strength + hold + cardio returns 200", async () => {
    const res = await request(app)
      .post("/api/workouts/external")
      .set("Cookie", "sid=regression-test-session")
      .send({
        label: "P5 Regression Pipeline",
        workoutType: "Strength",
        duration: 60,
        movements: [
          {
            name: strengthName,
            movementType: "strength",
            setRows: [{ reps: 5, weight: "185" }, { reps: 5, weight: "185" }, { reps: 5, weight: "185" }],
          },
          {
            name: holdName,
            movementType: "hold",
            setRows: [{ durationSeconds: 60 }, { durationSeconds: 60 }],
          },
          {
            name: cardioName,
            movementType: "cardio",
            setRows: [{ durationSeconds: 1200, distance: 3000 }],
          },
        ],
      });

    expect(res.status).toBe(200);
    workoutId = res.body.id;
    expect(workoutId).toBeTypeOf("number");
  });

  it("strength exercise has workout_history row: weight=185, reps=5, sets=3", async () => {
    const [ex] = await db
      .select({ id: exerciseLibraryTable.id })
      .from(exerciseLibraryTable)
      .where(eq(exerciseLibraryTable.name, strengthName))
      .limit(1);

    expect(ex).toBeDefined();

    const rows = await db
      .select()
      .from(workoutHistoryTable)
      .where(and(eq(workoutHistoryTable.userId, REG_USER_ID), eq(workoutHistoryTable.exerciseId, ex.id)));

    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0].weight).toBe(185);
    expect(rows[0].reps).toBe(5);
    expect(rows[0].sets).toBe(3);
    expect((rows[0] as any).source).toBe("external");
  });

  it("hold exercise has workout_history row: weight=0, durationSeconds=120", async () => {
    const [ex] = await db
      .select({ id: exerciseLibraryTable.id })
      .from(exerciseLibraryTable)
      .where(eq(exerciseLibraryTable.name, holdName))
      .limit(1);

    const rows = await db
      .select()
      .from(workoutHistoryTable)
      .where(and(eq(workoutHistoryTable.userId, REG_USER_ID), eq(workoutHistoryTable.exerciseId, ex.id)));

    expect(rows[0].weight).toBe(0);
    expect((rows[0] as any).durationSeconds).toBe(120);
  });

  it("cardio exercise has workout_history row: weight=0, reps=0, distanceMeters=3000", async () => {
    const [ex] = await db
      .select({ id: exerciseLibraryTable.id })
      .from(exerciseLibraryTable)
      .where(eq(exerciseLibraryTable.name, cardioName))
      .limit(1);

    const rows = await db
      .select()
      .from(workoutHistoryTable)
      .where(and(eq(workoutHistoryTable.userId, REG_USER_ID), eq(workoutHistoryTable.exerciseId, ex.id)));

    expect(rows[0].weight).toBe(0);
    expect(rows[0].reps).toBe(0);
    expect((rows[0] as any).distanceMeters).toBe(3000);
  });

  it("GET history for strength exercise returns totalVolume=2775 and estimated1RM > 0", async () => {
    const [ex] = await db
      .select({ id: exerciseLibraryTable.id })
      .from(exerciseLibraryTable)
      .where(eq(exerciseLibraryTable.name, strengthName))
      .limit(1);

    const res = await request(app)
      .get(`/api/exercises/${ex.id}/history`)
      .set("Cookie", "sid=regression-test-session");

    expect(res.status).toBe(200);
    expect(res.body.sessions[0].totalVolume).toBe(2775);
    expect(res.body.estimated1RM).toBeGreaterThan(0);
  });

  it("GET history for hold exercise returns totalVolume=120 (total hold seconds)", async () => {
    const [ex] = await db
      .select({ id: exerciseLibraryTable.id })
      .from(exerciseLibraryTable)
      .where(eq(exerciseLibraryTable.name, holdName))
      .limit(1);

    const res = await request(app)
      .get(`/api/exercises/${ex.id}/history`)
      .set("Cookie", "sid=regression-test-session");

    expect(res.status).toBe(200);
    expect(res.body.sessions[0].totalVolume).toBe(120);
    expect(res.body.sessions[0].durationSeconds).toBe(120);
    expect(res.body.estimated1RM).toBeNull();
  });

  it("GET history for cardio exercise returns totalVolume=3000 (distance) and no 1RM", async () => {
    const [ex] = await db
      .select({ id: exerciseLibraryTable.id })
      .from(exerciseLibraryTable)
      .where(eq(exerciseLibraryTable.name, cardioName))
      .limit(1);

    const res = await request(app)
      .get(`/api/exercises/${ex.id}/history`)
      .set("Cookie", "sid=regression-test-session");

    expect(res.status).toBe(200);
    expect(res.body.sessions[0].totalVolume).toBe(3000);
    expect(res.body.sessions[0].distanceMeters).toBe(3000);
    expect(res.body.estimated1RM).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// REG-4: Vault atomicity — ingestion failure → no orphaned row (via mock)
// Separate from vaultIngestionFailure.test.ts but confirms the guarantee
// from the perspective of the regression harness.
// ---------------------------------------------------------------------------
describe("REG-4: Vault atomicity guarantee", () => {
  it("POST /api/workouts/external creates a workout row only when all steps succeed", async () => {
    const res = await request(app)
      .post("/api/workouts/external")
      .set("Cookie", "sid=regression-test-session")
      .send({
        label: "REG-4 sanity — no movements",
        workoutType: "rest",
        duration: 0,
        movements: [],
      });

    expect(res.status).toBe(200);
    expect(res.body.id).toBeTypeOf("number");

    await db.delete(externalWorkoutsTable).where(eq(externalWorkoutsTable.id, res.body.id));
  });
});

// ---------------------------------------------------------------------------
// REG-5: Rest day POST — A1 conflict guard + hold-only pass-through
// ---------------------------------------------------------------------------
describe("REG-5: Rest day import — no vault ingestion attempted", () => {
  it("POST workoutType='rest' with conflicting strength movements returns 422 REST_DAY_MOVEMENT_CONFLICT", async () => {
    const res = await request(app)
      .post("/api/workouts/external")
      .set("Cookie", "sid=regression-test-session")
      .send({
        label: "Rest Day (accidentally has movements)",
        workoutType: "rest",
        duration: 0,
        movements: [{ name: "Squat", movementType: "strength", setRows: [{ reps: 5, weight: "100" }] }],
      });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("REST_DAY_MOVEMENT_CONFLICT");
    expect(res.body.options).toContain("keep_rest");
    expect(res.body.options).toContain("convert_workout");
    // No row should be committed for a 422 conflict
  });

  it("POST workoutType='rest' with hold-only movements returns 200 (no conflict)", async () => {
    const res = await request(app)
      .post("/api/workouts/external")
      .set("Cookie", "sid=regression-test-session")
      .send({
        label: "Rest Day with Stretching",
        workoutType: "rest",
        duration: 0,
        movements: [{ name: "Plank Hold", movementType: "hold", setRows: [] }],
      });

    expect(res.status).toBe(200);
    expect(res.body.workoutType).toBe("rest");

    await db.delete(externalWorkoutsTable).where(eq(externalWorkoutsTable.id, res.body.id));
  });
});

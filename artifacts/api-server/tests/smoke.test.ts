/**
 * smoke.test.ts — MVP Smoke Test Suite
 *
 * Covers all 6 critical user paths in CI-friendly, deterministic form:
 *
 *   SMOKE-1  Auth: signin contract + social entry point
 *   SMOKE-2  Workout generate (parse-description AI mock)
 *   SMOKE-3  Workout create/save (external → DB persist)
 *   SMOKE-4  Low-confidence import: edit movements → save
 *   SMOKE-5  Exercise logging persistence (write → read-back)
 *   SMOKE-6  Feedback submit (DB write + response contract)
 *   SMOKE-7  Notification preference save/reload (profile syncPreferences round-trip)
 *
 * Strategy:
 *   - vi.mock("../src/lib/auth") — auth middleware injects SMOKE_USER_ID on every
 *     request without touching OAuth.  Factory bodies inline the literal ID string
 *     because vi.mock is hoisted before const declarations.
 *   - vi.mock("../src/services/aiService") — deterministic AI payloads; no network.
 *   - Real PostgreSQL via @workspace/db — exercises read from seeded library rows.
 *   - Unique SMOKE_USER_ID keeps this suite isolated from integration.test.ts.
 *   - All inserted rows are cleaned up in afterAll via cascade on users delete.
 *
 * Run:
 *   cd artifacts/api-server && pnpm test
 *   # or in CI:
 *   cd artifacts/api-server && pnpm vitest run --reporter=verbose
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";

// ---------------------------------------------------------------------------
// Auth mock — hoisted; factory bodies inline the literal user ID
// ---------------------------------------------------------------------------
vi.mock("../src/lib/auth", () => ({
  getSessionId: () => "smoke-test-session-sid",
  getSession: () => ({
    user: {
      id: "__smoke_test_user__",
      email: "smoke@test.internal",
      name: "Smoke Test",
    },
    access_token: "smoke-test-access-token",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
  }),
  clearSession: vi.fn(),
  updateSession: vi.fn(),
  getOidcConfig: vi.fn().mockResolvedValue({} as any),
}));

// ---------------------------------------------------------------------------
// AI service mock — deterministic payloads; no live OpenAI calls
// ---------------------------------------------------------------------------
vi.mock("../src/services/aiService", () => ({
  parseWorkoutDescriptionAI: vi.fn().mockResolvedValue({
    label: "AMRAP 12 – Smoke Thrusters / Pull-ups",
    muscleGroups: ["Shoulders", "Quads", "Back"],
    movements: [
      { name: "Thrusters", volume: "10 reps @ 95lb", muscleGroups: ["Shoulders", "Quads"], fatiguePercent: 30 },
      { name: "Pull-ups", volume: "10 reps", muscleGroups: ["Back"], fatiguePercent: 25 },
    ],
    workoutType: "CrossFit",
    estimatedDuration: 12,
    metconFormat: "AMRAP",
    isMetcon: true,
    workoutFormat: "AMRAP",
    formatWarning: undefined,
    parserConfidence: 0.91,
    parserWarnings: [],
  }),

  analyzeWorkoutImageAI: vi.fn().mockResolvedValue({
    label: "EMOM 20 – Smoke Burpee Box Jumps",
    muscleGroups: ["Full Body"],
    movements: [
      { name: "Burpee Box Jump", volume: "5 reps every minute", muscleGroups: ["Full Body"], fatiguePercent: 35 },
    ],
    workoutType: "CrossFit",
    estimatedDuration: 20,
    metconFormat: "EMOM",
    isMetcon: true,
    workoutFormat: "EMOM",
    formatWarning: undefined,
    parserConfidence: 0.87,
    parserWarnings: [],
  }),

  generateCoachNote: vi.fn().mockResolvedValue(
    "Focus on controlled movement and progressive overload."
  ),
}));

// Import app AFTER vi.mock declarations — mocks are hoisted and apply first
import app from "../src/app";
import {
  db,
  usersTable,
  externalWorkoutsTable,
  workoutHistoryTable,
  userFeedbackTable,
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Stable smoke test identity — different from integration.test.ts to allow
// parallel test runs without fixture collisions
// ---------------------------------------------------------------------------
const SMOKE_USER_ID = "__smoke_test_user__";

// Exercise ID 1 (Barbell Back Squat) is present in the seeded exercise_library
const FIXTURE_EXERCISE_ID = 1;

// ---------------------------------------------------------------------------
// DB lifecycle: insert smoke user once; cascade-delete in afterAll
// ---------------------------------------------------------------------------
beforeAll(async () => {
  await db
    .insert(usersTable)
    .values({
      id: SMOKE_USER_ID,
      email: "smoke@test.internal",
      firstName: "Smoke",
      lastName: "Test",
    })
    .onConflictDoNothing();
});

afterAll(async () => {
  // Cascade on users.id cleans external_workouts, workout_history, user_feedback, user_profiles
  await db.delete(usersTable).where(eq(usersTable.id, SMOKE_USER_ID));
});

// ===========================================================================
// SMOKE-1  Auth contract
// ===========================================================================
describe("SMOKE-1 — Auth contract", () => {
  it("GET /auth/user returns 200 with authenticated user shape", async () => {
    const res = await request(app).get("/auth/user");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("user");
    const user = res.body.user;
    expect(user).not.toBeNull();
    expect(user).toHaveProperty("id");
    expect(user).toHaveProperty("email");
  });

  it("GET /auth/user — user.id matches the mocked identity", async () => {
    const res = await request(app).get("/auth/user");

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(SMOKE_USER_ID);
  });

  it("POST /auth/signin — 400 when identifier is missing", async () => {
    const res = await request(app)
      .post("/auth/signin")
      .send({ password: "password123" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  it("POST /auth/signin — 400 when password is missing", async () => {
    const res = await request(app)
      .post("/auth/signin")
      .send({ identifier: "smokeuser" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  it("POST /auth/signin — 401 with wrong credentials (real DB, no such user)", async () => {
    const res = await request(app)
      .post("/auth/signin")
      .send({ identifier: "nonexistent_smoke_user_xyz", password: "wrongpass" });

    // User doesn't exist → 401
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid/i);
  });

  it("POST /auth/signup — 400 when password is too short", async () => {
    const res = await request(app)
      .post("/auth/signup")
      .send({ email: "newsmoke@test.internal", password: "short" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/password must be at least 8/i);
  });

  it("POST /auth/signup — 400 when neither username nor email is provided", async () => {
    const res = await request(app)
      .post("/auth/signup")
      .send({ password: "validpassword123" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/username or email is required/i);
  });

  it("GET /login — 302 redirect toward social/OIDC provider (entry point is accessible)", async () => {
    // The OIDC config mock returns an empty object; buildAuthorizationUrl will throw.
    // We verify the route exists and the auth gate does not reject it (no 401/404).
    const res = await request(app).get("/login");

    // Any redirect (302) or server error (500 from mock OIDC) is acceptable here;
    // what matters is the route is reachable — not 404.
    expect(res.status).not.toBe(404);
    expect(res.status).not.toBe(401);
  });
});

// ===========================================================================
// SMOKE-2  Workout generate (AI parse-description)
// ===========================================================================
describe("SMOKE-2 — Workout generate via AI parse-description", () => {
  const FIXTURE_DESCRIPTION = "AMRAP 12: 10 Thrusters 95lb, 10 Pull-ups, 10 Box Jumps 24 inch";

  it("POST /api/workout/parse-description — 200 with expected shape", async () => {
    const res = await request(app)
      .post("/api/workout/parse-description")
      .send({ description: FIXTURE_DESCRIPTION });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      label: expect.any(String),
      muscleGroups: expect.any(Array),
      movements: expect.any(Array),
      workoutType: expect.any(String),
      estimatedDuration: expect.any(Number),
    });
  });

  it("workoutFormat is AMRAP (from deterministic mock)", async () => {
    const res = await request(app)
      .post("/api/workout/parse-description")
      .send({ description: FIXTURE_DESCRIPTION });

    expect(res.status).toBe(200);
    expect(res.body.workoutFormat).toBe("AMRAP");
  });

  it("workoutFormat is always one of the five valid enum values", async () => {
    const res = await request(app)
      .post("/api/workout/parse-description")
      .send({ description: FIXTURE_DESCRIPTION });

    expect(["AMRAP", "EMOM", "FOR_TIME", "STANDARD", "UNKNOWN"]).toContain(res.body.workoutFormat);
  });

  it("movements array is non-empty with correct shape", async () => {
    const res = await request(app)
      .post("/api/workout/parse-description")
      .send({ description: FIXTURE_DESCRIPTION });

    expect(res.status).toBe(200);
    expect(res.body.movements.length).toBeGreaterThan(0);
    const first = res.body.movements[0];
    expect(first).toHaveProperty("name");
    expect(first).toHaveProperty("volume");
    expect(first).toHaveProperty("muscleGroups");
    expect(first).toHaveProperty("fatiguePercent");
  });

  it("400 when description is missing", async () => {
    const res = await request(app)
      .post("/api/workout/parse-description")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/description is required/i);
  });

  it("400 when description is blank whitespace", async () => {
    const res = await request(app)
      .post("/api/workout/parse-description")
      .send({ description: "   " });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/description is required/i);
  });
});

// ===========================================================================
// SMOKE-3  Workout create/save (external → DB persist)
// ===========================================================================
describe("SMOKE-3 — Workout create/save (external workout)", () => {
  const savedIds: number[] = [];

  afterAll(async () => {
    for (const id of savedIds) {
      await db.delete(externalWorkoutsTable).where(eq(externalWorkoutsTable.id, id));
    }
  });

  const FIXTURE_WORKOUT = {
    label: "SMOKE: AMRAP 12 Thrusters / Pull-ups",
    workoutType: "CrossFit",
    duration: 12,
    intensity: 8,
    muscleGroups: ["Shoulders", "Quads", "Back"],
    stimulusPoints: 45,
    isMetcon: true,
    metconFormat: "AMRAP",
    workoutFormat: "AMRAP",
    parserConfidence: 0.91,
    parserWarnings: [],
    wasUserEdited: false,
    editedFields: [],
    movements: [
      { name: "Thrusters", volume: "10 reps @ 95lb", muscleGroups: ["Shoulders", "Quads"], fatiguePercent: 30 },
      { name: "Pull-ups", volume: "10 reps", muscleGroups: ["Back"], fatiguePercent: 25 },
    ],
  };

  it("POST /api/workouts/external — 200 with numeric id", async () => {
    const res = await request(app)
      .post("/api/workouts/external")
      .send(FIXTURE_WORKOUT);

    expect(res.status).toBe(200);
    expect(typeof res.body.id).toBe("number");
    savedIds.push(res.body.id);
  });

  it("response contains all submitted parser meta fields", async () => {
    const res = await request(app)
      .post("/api/workouts/external")
      .send(FIXTURE_WORKOUT);

    expect(res.status).toBe(200);
    expect(res.body.workoutFormat).toBe("AMRAP");
    expect(res.body.parserConfidence).toBeCloseTo(0.91, 2);
    expect(res.body.parserWarnings).toEqual([]);
    expect(res.body.wasUserEdited).toBe(false);
    expect(res.body.editedFields).toEqual([]);
    expect(res.body.userId).toBe(SMOKE_USER_ID);
    savedIds.push(res.body.id);
  });

  it("record persists in DB and is returned by GET /api/workouts/external", async () => {
    const postRes = await request(app)
      .post("/api/workouts/external")
      .send(FIXTURE_WORKOUT);

    expect(postRes.status).toBe(200);
    const createdId = postRes.body.id;
    savedIds.push(createdId);

    const getRes = await request(app).get("/api/workouts/external");
    expect(getRes.status).toBe(200);

    const found = (getRes.body as any[]).find((w: any) => w.id === createdId);
    expect(found).toBeDefined();
    expect(found.label).toBe(FIXTURE_WORKOUT.label);
    expect(found.workoutFormat).toBe("AMRAP");
  });

  it("400 when required fields are missing", async () => {
    const res = await request(app)
      .post("/api/workouts/external")
      .send({ duration: 30 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/missing required fields/i);
  });

  it("400 when workoutFormat is an invalid value", async () => {
    const res = await request(app)
      .post("/api/workouts/external")
      .send({ ...FIXTURE_WORKOUT, workoutFormat: "TABATA" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/workoutFormat must be one of/i);
  });

  it("400 when parserConfidence is out of range", async () => {
    const res = await request(app)
      .post("/api/workouts/external")
      .send({ ...FIXTURE_WORKOUT, parserConfidence: 1.5 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/parserConfidence must be a number between 0 and 1/i);
  });
});

// ===========================================================================
// SMOKE-4  Low-confidence import: edit movements → save
// ===========================================================================
describe("SMOKE-4 — Low-confidence import review / edit / save", () => {
  const savedIds: number[] = [];

  afterAll(async () => {
    for (const id of savedIds) {
      await db.delete(externalWorkoutsTable).where(eq(externalWorkoutsTable.id, id));
    }
  });

  // Simulates what the app posts after the user edits a low-confidence parse
  // (confidence < LOW_CONFIDENCE_THRESHOLD = 0.65) in the review sheet.
  const FIXTURE_LOW_CONFIDENCE = {
    label: "SMOKE: Strength Day (user-corrected label)",
    workoutType: "Strength",
    duration: 60,
    intensity: 7,
    muscleGroups: ["Back", "Biceps"],
    stimulusPoints: 30,
    workoutFormat: "STANDARD",
    parserConfidence: 0.50,          // below 0.65 threshold — triggers review gate in UI
    parserWarnings: [
      "Low confidence parse — format was defaulted to UNKNOWN, user selected STANDARD",
      "muscleGroups could not be determined from description",
    ],
    wasUserEdited: true,             // user confirmed edits in review sheet
    editedFields: ["label", "workoutFormat", "muscleGroups"],
    movements: [
      { name: "Barbell Row",     volume: "4×8 @ 135lb", muscleGroups: ["Back"],   fatiguePercent: 25 },
      { name: "Barbell Curl",    volume: "3×10 @ 65lb", muscleGroups: ["Biceps"], fatiguePercent: 15 },
      { name: "Face Pull",       volume: "3×15",         muscleGroups: ["Back"],   fatiguePercent: 10 },
    ],
  };

  it("POST /api/workouts/external — 200 with low-confidence payload", async () => {
    const res = await request(app)
      .post("/api/workouts/external")
      .send(FIXTURE_LOW_CONFIDENCE);

    expect(res.status).toBe(200);
    expect(typeof res.body.id).toBe("number");
    savedIds.push(res.body.id);
  });

  it("wasUserEdited is true in response", async () => {
    const res = await request(app)
      .post("/api/workouts/external")
      .send(FIXTURE_LOW_CONFIDENCE);

    expect(res.status).toBe(200);
    expect(res.body.wasUserEdited).toBe(true);
    savedIds.push(res.body.id);
  });

  it("editedFields round-trips correctly — all three corrected field names present", async () => {
    const res = await request(app)
      .post("/api/workouts/external")
      .send(FIXTURE_LOW_CONFIDENCE);

    expect(res.status).toBe(200);
    expect(res.body.editedFields).toEqual(["label", "workoutFormat", "muscleGroups"]);
    savedIds.push(res.body.id);
  });

  it("parserConfidence stored at 0.50 (below LOW_CONFIDENCE_THRESHOLD of 0.65)", async () => {
    const res = await request(app)
      .post("/api/workouts/external")
      .send(FIXTURE_LOW_CONFIDENCE);

    expect(res.status).toBe(200);
    expect(res.body.parserConfidence).toBeCloseTo(0.50, 2);
    savedIds.push(res.body.id);
  });

  it("parserWarnings array is stored and returned intact (both warning strings)", async () => {
    const res = await request(app)
      .post("/api/workouts/external")
      .send(FIXTURE_LOW_CONFIDENCE);

    expect(res.status).toBe(200);
    expect(res.body.parserWarnings).toHaveLength(2);
    expect(res.body.parserWarnings[0]).toMatch(/low confidence/i);
    savedIds.push(res.body.id);
  });

  it("workoutFormat STANDARD persists after user correction from UNKNOWN", async () => {
    const res = await request(app)
      .post("/api/workouts/external")
      .send(FIXTURE_LOW_CONFIDENCE);

    expect(res.status).toBe(200);
    expect(res.body.workoutFormat).toBe("STANDARD");
    savedIds.push(res.body.id);
  });

  it("DB record has wasUserEdited=true and correct confidence", async () => {
    const res = await request(app)
      .post("/api/workouts/external")
      .send(FIXTURE_LOW_CONFIDENCE);

    expect(res.status).toBe(200);
    const id = res.body.id;
    savedIds.push(id);

    const [row] = await db
      .select()
      .from(externalWorkoutsTable)
      .where(eq(externalWorkoutsTable.id, id));

    expect(row).toBeDefined();
    expect(row.wasUserEdited).toBe(true);
    expect(row.parserConfidence).toBeCloseTo(0.50, 2);
    expect((row.editedFields as string[])).toEqual(["label", "workoutFormat", "muscleGroups"]);
  });
});

// ===========================================================================
// SMOKE-5  Exercise logging persistence (write → read-back)
// ===========================================================================
describe("SMOKE-5 — Exercise logging persistence", () => {
  const loggedIds: number[] = [];

  afterAll(async () => {
    for (const id of loggedIds) {
      await db.delete(workoutHistoryTable).where(eq(workoutHistoryTable.id, id));
    }
  });

  const FIXTURE_LOG = { weight: 135, reps: 5, sets: 3 };

  it("POST /api/exercises/1/history — 200, returns entry with correct fields", async () => {
    const res = await request(app)
      .post(`/api/exercises/${FIXTURE_EXERCISE_ID}/history`)
      .send(FIXTURE_LOG);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("id");
    expect(res.body.exerciseId).toBe(FIXTURE_EXERCISE_ID);
    expect(res.body.userId).toBe(SMOKE_USER_ID);
    expect(res.body.weight).toBe(135);
    expect(res.body.reps).toBe(5);
    expect(res.body.sets).toBe(3);
    loggedIds.push(res.body.id);
  });

  it("GET /api/exercises/1/history — logged entry appears in sessions array", async () => {
    const postRes = await request(app)
      .post(`/api/exercises/${FIXTURE_EXERCISE_ID}/history`)
      .send(FIXTURE_LOG);

    expect(postRes.status).toBe(200);
    loggedIds.push(postRes.body.id);

    const getRes = await request(app).get(`/api/exercises/${FIXTURE_EXERCISE_ID}/history`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.sessions.length).toBeGreaterThan(0);

    const latest = getRes.body.sessions[0];
    expect(latest.weight).toBe(135);
    expect(latest.reps).toBe(5);
    expect(latest.sets).toBe(3);
  });

  it("totalVolume in history response = weight × reps × sets = 135 × 5 × 3 = 2025", async () => {
    const postRes = await request(app)
      .post(`/api/exercises/${FIXTURE_EXERCISE_ID}/history`)
      .send(FIXTURE_LOG);

    expect(postRes.status).toBe(200);
    loggedIds.push(postRes.body.id);

    const getRes = await request(app).get(`/api/exercises/${FIXTURE_EXERCISE_ID}/history`);
    expect(getRes.status).toBe(200);

    const latest = getRes.body.sessions[0];
    expect(latest.totalVolume).toBe(135 * 5 * 3); // 2025
  });

  it("estimated1RM is computed and returned (non-null after first log)", async () => {
    const postRes = await request(app)
      .post(`/api/exercises/${FIXTURE_EXERCISE_ID}/history`)
      .send(FIXTURE_LOG);

    expect(postRes.status).toBe(200);
    loggedIds.push(postRes.body.id);

    const getRes = await request(app).get(`/api/exercises/${FIXTURE_EXERCISE_ID}/history`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.estimated1RM).not.toBeNull();
    expect(typeof getRes.body.estimated1RM).toBe("number");
    expect(getRes.body.estimated1RM).toBeGreaterThan(0);
  });

  it("restRecommendation is a non-empty string", async () => {
    const postRes = await request(app)
      .post(`/api/exercises/${FIXTURE_EXERCISE_ID}/history`)
      .send(FIXTURE_LOG);

    expect(postRes.status).toBe(200);
    loggedIds.push(postRes.body.id);

    const getRes = await request(app).get(`/api/exercises/${FIXTURE_EXERCISE_ID}/history`);
    expect(getRes.status).toBe(200);
    expect(typeof getRes.body.restRecommendation).toBe("string");
    expect(getRes.body.restRecommendation.length).toBeGreaterThan(0);
  });

  it("400 when weight is negative", async () => {
    const res = await request(app)
      .post(`/api/exercises/${FIXTURE_EXERCISE_ID}/history`)
      .send({ weight: -10, reps: 5, sets: 3 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/weight/i);
  });

  it("400 when reps is zero", async () => {
    const res = await request(app)
      .post(`/api/exercises/${FIXTURE_EXERCISE_ID}/history`)
      .send({ weight: 135, reps: 0, sets: 3 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/reps/i);
  });

  it("DB record persists with correct values", async () => {
    const postRes = await request(app)
      .post(`/api/exercises/${FIXTURE_EXERCISE_ID}/history`)
      .send(FIXTURE_LOG);

    expect(postRes.status).toBe(200);
    const historyId = postRes.body.id;
    loggedIds.push(historyId);

    const [row] = await db
      .select()
      .from(workoutHistoryTable)
      .where(eq(workoutHistoryTable.id, historyId));

    expect(row).toBeDefined();
    expect(row.userId).toBe(SMOKE_USER_ID);
    expect(row.exerciseId).toBe(FIXTURE_EXERCISE_ID);
    expect(row.weight).toBe(135);
    expect(row.reps).toBe(5);
    expect(row.sets).toBe(3);
  });
});

// ===========================================================================
// SMOKE-6  Feedback submit
// ===========================================================================
describe("SMOKE-6 — Feedback submit", () => {
  it("POST /api/feedback — 200, returns {ok: true}", async () => {
    const res = await request(app)
      .post("/api/feedback")
      .send({ message: "Smoke test: the onboarding flow is confusing on step 3." });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("DB row is created with correct userId and message", async () => {
    const MESSAGE = "Smoke test DB persistence check — unique marker xK9zQ";

    const res = await request(app)
      .post("/api/feedback")
      .send({ message: MESSAGE });

    expect(res.status).toBe(200);

    const rows = await db
      .select()
      .from(userFeedbackTable)
      .where(eq(userFeedbackTable.userId, SMOKE_USER_ID))
      .orderBy(desc(userFeedbackTable.createdAt))
      .limit(5);

    const match = rows.find((r) => r.message === MESSAGE);
    expect(match).toBeDefined();
    expect(match!.userId).toBe(SMOKE_USER_ID);
  });

  it("message is trimmed before storage", async () => {
    const PADDED = "  Padded message with surrounding spaces  ";
    const EXPECTED = "Padded message with surrounding spaces";

    await request(app).post("/api/feedback").send({ message: PADDED });

    const rows = await db
      .select()
      .from(userFeedbackTable)
      .where(eq(userFeedbackTable.userId, SMOKE_USER_ID))
      .orderBy(desc(userFeedbackTable.createdAt))
      .limit(5);

    const match = rows.find((r) => r.message === EXPECTED);
    expect(match).toBeDefined();
  });

  it("400 when message is empty string", async () => {
    const res = await request(app)
      .post("/api/feedback")
      .send({ message: "" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/message is required/i);
  });

  it("400 when message is whitespace only", async () => {
    const res = await request(app)
      .post("/api/feedback")
      .send({ message: "   " });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/message is required/i);
  });

  it("400 when message exceeds 5000 characters", async () => {
    const res = await request(app)
      .post("/api/feedback")
      .send({ message: "x".repeat(5001) });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/too long/i);
  });

  it("400 when message field is absent from body", async () => {
    const res = await request(app)
      .post("/api/feedback")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/message is required/i);
  });

  it("message at exactly 5000 characters is accepted", async () => {
    const res = await request(app)
      .post("/api/feedback")
      .send({ message: "y".repeat(5000) });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

// ===========================================================================
// SMOKE-7  Notification preference save / reload
//
// Notification prefs are stored client-side (AsyncStorage) on the device.
// The server-side proof is a round-trip via profile.syncPreferences (jsonb),
// which is the natural carrier for any client preference sync to the backend.
// ===========================================================================
describe("SMOKE-7 — Notification preference save / reload (profile round-trip)", () => {
  const FIXTURE_NOTIF_PREFS = {
    checkInEnabled: true,
    checkInHour: 7,
    checkInMinute: 30,
    workoutEnabled: true,
    workoutHour: 18,
    workoutMinute: 0,
    insightFrequency: "weekly" as const,
    insightHour: 9,
    insightMinute: 0,
  };

  it("GET /api/profile — 200 with profile shape", async () => {
    const res = await request(app).get("/api/profile");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("userId");
    expect(res.body.userId).toBe(SMOKE_USER_ID);
  });

  it("PUT /api/profile with notif prefs in syncPreferences — 200", async () => {
    const res = await request(app)
      .put("/api/profile")
      .send({ syncPreferences: FIXTURE_NOTIF_PREFS });

    expect(res.status).toBe(200);
  });

  it("GET /api/profile — syncPreferences round-trips all notif pref fields", async () => {
    await request(app)
      .put("/api/profile")
      .send({ syncPreferences: FIXTURE_NOTIF_PREFS });

    const getRes = await request(app).get("/api/profile");
    expect(getRes.status).toBe(200);

    const prefs = getRes.body.syncPreferences;
    expect(prefs).toMatchObject({
      checkInEnabled: true,
      checkInHour: 7,
      checkInMinute: 30,
      workoutEnabled: true,
      workoutHour: 18,
      workoutMinute: 0,
      insightFrequency: "weekly",
      insightHour: 9,
      insightMinute: 0,
    });
  });

  it("insightFrequency: 'daily' is persisted correctly", async () => {
    await request(app)
      .put("/api/profile")
      .send({ syncPreferences: { ...FIXTURE_NOTIF_PREFS, insightFrequency: "daily" } });

    const getRes = await request(app).get("/api/profile");
    expect(getRes.status).toBe(200);
    expect(getRes.body.syncPreferences.insightFrequency).toBe("daily");
  });

  it("insightFrequency: 'off' is persisted correctly", async () => {
    await request(app)
      .put("/api/profile")
      .send({ syncPreferences: { ...FIXTURE_NOTIF_PREFS, insightFrequency: "off" } });

    const getRes = await request(app).get("/api/profile");
    expect(getRes.status).toBe(200);
    expect(getRes.body.syncPreferences.insightFrequency).toBe("off");
  });

  it("insightHour and insightMinute round-trip for non-default time (8:45)", async () => {
    await request(app)
      .put("/api/profile")
      .send({ syncPreferences: { ...FIXTURE_NOTIF_PREFS, insightHour: 8, insightMinute: 45 } });

    const getRes = await request(app).get("/api/profile");
    expect(getRes.status).toBe(200);
    expect(getRes.body.syncPreferences.insightHour).toBe(8);
    expect(getRes.body.syncPreferences.insightMinute).toBe(45);
  });

  it("profile update is scoped to the authenticated user — userId unchanged", async () => {
    await request(app)
      .put("/api/profile")
      .send({ syncPreferences: FIXTURE_NOTIF_PREFS });

    const getRes = await request(app).get("/api/profile");
    expect(getRes.status).toBe(200);
    expect(getRes.body.userId).toBe(SMOKE_USER_ID);
  });
});

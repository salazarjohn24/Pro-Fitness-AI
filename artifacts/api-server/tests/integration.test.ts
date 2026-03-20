/**
 * integration.test.ts — authenticated HTTP integration tests
 *
 * Strategy:
 *   - vi.mock("../src/lib/auth") → authMiddleware sees a valid session for
 *     TEST_USER_ID on every request; no real OAuth needed.
 *   - vi.mock("../src/services/aiService") → no live OpenAI calls; deterministic
 *     payloads with workoutFormat + formatWarning included.
 *   - Real PostgreSQL via @workspace/db → external workout create and deload-check
 *     run against the actual DB. A test user row is inserted in beforeAll and
 *     deleted (cascade) in afterAll.
 *   - supertest → full HTTP stack (middleware → router → DB → JSON response).
 *
 * NOTE: vi.mock factory functions are hoisted before const declarations, so
 * TEST_USER_ID is inlined as a string literal inside the factory bodies rather
 * than referencing the const. Both resolve to the same value.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";

// ---------------------------------------------------------------------------
// Auth mock — hoisted before all imports; factory inlines the test user ID
// ---------------------------------------------------------------------------
vi.mock("../src/lib/auth", () => ({
  getSessionId: () => "integration-test-session-sid",
  getSession: () => ({
    user: {
      id: "__integration_test_user__",
      email: "integration@test.internal",
      name: "Integration Test",
    },
    access_token: "integration-test-access-token",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
  }),
  clearSession: vi.fn(),
  updateSession: vi.fn(),
  getOidcConfig: vi.fn(),
}));

// ---------------------------------------------------------------------------
// AI service mock — deterministic payloads; no network calls
// ---------------------------------------------------------------------------
vi.mock("../src/services/aiService", () => ({
  parseWorkoutDescriptionAI: vi.fn().mockResolvedValue({
    label: "AMRAP 12 – Thrusters / Pull-ups / Box Jumps",
    muscleGroups: ["Shoulders", "Quads", "Back", "Calves"],
    movements: [
      {
        name: "Thrusters",
        volume: "10 reps @ 95lb",
        muscleGroups: ["Shoulders", "Quads"],
        fatiguePercent: 30,
      },
      {
        name: "Pull-ups",
        volume: "10 reps",
        muscleGroups: ["Back"],
        fatiguePercent: 25,
      },
    ],
    workoutType: "CrossFit",
    estimatedDuration: 12,
    metconFormat: "AMRAP",
    isMetcon: true,
    workoutFormat: "AMRAP",
    formatWarning: undefined,
  }),

  analyzeWorkoutImageAI: vi.fn().mockResolvedValue({
    label: "EMOM 20 – Burpee Box Jumps / Chest-to-Bar",
    muscleGroups: ["Full Body", "Back", "Legs"],
    movements: [
      {
        name: "Burpee Box Jump",
        volume: "5 reps every minute",
        muscleGroups: ["Full Body"],
        fatiguePercent: 35,
      },
    ],
    workoutType: "CrossFit",
    estimatedDuration: 20,
    metconFormat: "EMOM",
    isMetcon: true,
    workoutFormat: "EMOM",
    formatWarning: undefined,
  }),
}));

// Import app AFTER vi.mock declarations — mocks are hoisted so they apply
import app from "../src/app";
import { db, usersTable, externalWorkoutsTable, dailyCheckInsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Stable test identity
// ---------------------------------------------------------------------------
const TEST_USER_ID = "__integration_test_user__";

// ---------------------------------------------------------------------------
// DB lifecycle: insert test user once; cascade-delete everything after all tests
// ---------------------------------------------------------------------------
beforeAll(async () => {
  await db
    .insert(usersTable)
    .values({
      id: TEST_USER_ID,
      email: "integration@test.internal",
      firstName: "Integration",
      lastName: "Test",
    })
    .onConflictDoNothing();
});

afterAll(async () => {
  await db.delete(usersTable).where(eq(usersTable.id, TEST_USER_ID));
});

// ===========================================================================
// 1. POST /api/workout/parse-description
// ===========================================================================
describe("POST /api/workout/parse-description — authenticated", () => {
  it("returns 400 when description is missing", async () => {
    const res = await request(app)
      .post("/api/workout/parse-description")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/description is required/i);
  });

  it("returns 400 when description is empty string", async () => {
    const res = await request(app)
      .post("/api/workout/parse-description")
      .send({ description: "   " });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/description is required/i);
  });

  it("returns 200 with workoutFormat for valid AMRAP description", async () => {
    const res = await request(app)
      .post("/api/workout/parse-description")
      .send({ description: "AMRAP 12: 10 Thrusters 95lb, 10 Pull-ups, 10 Box Jumps 24 inch" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      label: expect.any(String),
      muscleGroups: expect.arrayContaining([expect.any(String)]),
      movements: expect.any(Array),
      workoutType: expect.any(String),
      estimatedDuration: expect.any(Number),
      workoutFormat: "AMRAP",
    });
  });

  it("workoutFormat is always one of the five valid enum values", async () => {
    const res = await request(app)
      .post("/api/workout/parse-description")
      .send({ description: "AMRAP 12: 10 Thrusters 95lb, 10 Pull-ups" });

    expect(res.status).toBe(200);
    expect(["AMRAP", "EMOM", "FOR_TIME", "STANDARD", "UNKNOWN"]).toContain(
      res.body.workoutFormat,
    );
  });

  it("formatWarning is absent (undefined) when format is clearly detected", async () => {
    const res = await request(app)
      .post("/api/workout/parse-description")
      .send({ description: "AMRAP 12: 10 Thrusters 95lb" });

    expect(res.status).toBe(200);
    expect(res.body.formatWarning).toBeUndefined();
  });

  it("movements array contains objects with expected shape", async () => {
    const res = await request(app)
      .post("/api/workout/parse-description")
      .send({ description: "AMRAP 12: 10 Thrusters 95lb, 10 Pull-ups" });

    expect(res.status).toBe(200);
    expect(res.body.movements.length).toBeGreaterThan(0);
    const first = res.body.movements[0];
    expect(first).toHaveProperty("name");
    expect(first).toHaveProperty("volume");
    expect(first).toHaveProperty("muscleGroups");
    expect(first).toHaveProperty("fatiguePercent");
  });
});

// ===========================================================================
// 2. POST /api/workout/analyze-image
// ===========================================================================
describe("POST /api/workout/analyze-image — authenticated", () => {
  it("returns 400 when base64Image is missing", async () => {
    const res = await request(app)
      .post("/api/workout/analyze-image")
      .send({ mimeType: "image/jpeg" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/base64Image is required/i);
  });

  it("returns 200 with workoutFormat and expected fields for valid base64 input", async () => {
    const res = await request(app)
      .post("/api/workout/analyze-image")
      .send({
        base64Image: "data:image/jpeg;base64,/9j/4AAQSkZJRgAB",
        mimeType: "image/jpeg",
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      label: expect.any(String),
      muscleGroups: expect.any(Array),
      movements: expect.any(Array),
      workoutType: expect.any(String),
      workoutFormat: "EMOM",
    });
  });

  it("workoutFormat is always one of the five valid enum values", async () => {
    const res = await request(app)
      .post("/api/workout/analyze-image")
      .send({ base64Image: "data:image/jpeg;base64,abc" });

    expect(res.status).toBe(200);
    expect(["AMRAP", "EMOM", "FOR_TIME", "STANDARD", "UNKNOWN"]).toContain(
      res.body.workoutFormat,
    );
  });

  it("formatWarning is absent when format is clearly detected", async () => {
    const res = await request(app)
      .post("/api/workout/analyze-image")
      .send({ base64Image: "data:image/jpeg;base64,abc" });

    expect(res.status).toBe(200);
    expect(res.body.formatWarning).toBeUndefined();
  });
});

// ===========================================================================
// 3. POST /api/workouts/external — create with parser meta fields (real DB)
// ===========================================================================
describe("POST /api/workouts/external — authenticated (real DB)", () => {
  const idsToClean: number[] = [];

  afterAll(async () => {
    for (const id of idsToClean) {
      await db.delete(externalWorkoutsTable).where(eq(externalWorkoutsTable.id, id));
    }
  });

  it("returns 400 when required fields are missing", async () => {
    const res = await request(app)
      .post("/api/workouts/external")
      .send({ duration: 30 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Missing required fields/i);
  });

  it("returns 400 when workoutFormat is an unrecognized value", async () => {
    const res = await request(app)
      .post("/api/workouts/external")
      .send({
        label: "Test",
        workoutType: "CrossFit",
        duration: 12,
        intensity: 7,
        muscleGroups: ["Full Body"],
        stimulusPoints: 20,
        workoutFormat: "TABATA",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/workoutFormat must be one of: AMRAP, EMOM, FOR_TIME, STANDARD, UNKNOWN/i);
  });

  it("returns 400 when parserConfidence exceeds 1.0", async () => {
    const res = await request(app)
      .post("/api/workouts/external")
      .send({
        label: "Test",
        workoutType: "CrossFit",
        duration: 12,
        intensity: 7,
        muscleGroups: ["Full Body"],
        stimulusPoints: 20,
        parserConfidence: 1.5,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/parserConfidence must be a number between 0 and 1/i);
  });

  it("creates record with all parser meta fields; response contains them", async () => {
    const res = await request(app)
      .post("/api/workouts/external")
      .send({
        label: "AMRAP 12 – Integration Test",
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
      });

    expect(res.status).toBe(200);
    expect(res.body.workoutFormat).toBe("AMRAP");
    expect(res.body.parserConfidence).toBeCloseTo(0.91, 2);
    expect(res.body.parserWarnings).toEqual([]);
    expect(res.body.wasUserEdited).toBe(false);
    expect(res.body.editedFields).toEqual([]);
    expect(res.body.userId).toBe(TEST_USER_ID);
    expect(typeof res.body.id).toBe("number");

    idsToClean.push(res.body.id);
  });

  it("wasUserEdited=true and non-empty editedFields are stored and returned", async () => {
    const res = await request(app)
      .post("/api/workouts/external")
      .send({
        label: "Strength Day – user edited label",
        workoutType: "Strength",
        duration: 60,
        intensity: 7,
        muscleGroups: ["Back", "Biceps"],
        stimulusPoints: 30,
        workoutFormat: "STANDARD",
        parserConfidence: 0.55,
        parserWarnings: ["Low confidence parse — workoutType was defaulted to Other"],
        wasUserEdited: true,
        editedFields: ["label", "workoutType", "workoutFormat"],
      });

    expect(res.status).toBe(200);
    expect(res.body.wasUserEdited).toBe(true);
    expect(res.body.editedFields).toEqual(["label", "workoutType", "workoutFormat"]);
    expect(res.body.parserConfidence).toBeCloseTo(0.55, 2);
    expect(res.body.parserWarnings).toEqual([
      "Low confidence parse — workoutType was defaulted to Other",
    ]);

    idsToClean.push(res.body.id);
  });

  it("workoutFormat=UNKNOWN is accepted without error", async () => {
    const res = await request(app)
      .post("/api/workouts/external")
      .send({
        label: "Yoga Flow",
        workoutType: "Yoga",
        duration: 45,
        intensity: 4,
        muscleGroups: ["Full Body"],
        stimulusPoints: 10,
        workoutFormat: "UNKNOWN",
        parserConfidence: 0.40,
        parserWarnings: ["Format could not be determined. Please select the correct format."],
        wasUserEdited: true,
        editedFields: ["workoutFormat"],
      });

    expect(res.status).toBe(200);
    expect(res.body.workoutFormat).toBe("UNKNOWN");
    expect(res.body.wasUserEdited).toBe(true);

    idsToClean.push(res.body.id);
  });
});

// ===========================================================================
// 4. GET /api/workout/deload-check
// ===========================================================================
describe("GET /api/workout/deload-check — authenticated (real DB)", () => {
  it("returns 200 with recommended=false when fewer than 3 checkins exist", async () => {
    const res = await request(app).get("/api/workout/deload-check");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ recommended: false, reason: null });
  });

  describe("with 3 high-fatigue checkins + 2 external workouts", () => {
    let externalId1: number;
    let externalId2: number;

    beforeAll(async () => {
      const d = (offset: number) => {
        const dt = new Date();
        dt.setDate(dt.getDate() - offset);
        return dt.toISOString().slice(0, 10);
      };

      await db
        .insert(dailyCheckInsTable)
        .values([
          { userId: TEST_USER_ID, date: d(0), energyLevel: 2, sleepQuality: 2, stressLevel: 5, sorenessScore: 5 },
          { userId: TEST_USER_ID, date: d(1), energyLevel: 2, sleepQuality: 2, stressLevel: 5, sorenessScore: 5 },
          { userId: TEST_USER_ID, date: d(2), energyLevel: 2, sleepQuality: 2, stressLevel: 5, sorenessScore: 5 },
        ])
        .onConflictDoNothing();

      const [ext1] = await db
        .insert(externalWorkoutsTable)
        .values({
          userId: TEST_USER_ID,
          label: "Integration External 1",
          workoutType: "CrossFit",
          duration: 30,
          intensity: 8,
          muscleGroups: ["Full Body"],
          stimulusPoints: 60,
          workoutDate: d(0),
          workoutFormat: "AMRAP",
          parserConfidence: 0.91,
          parserWarnings: [],
          wasUserEdited: false,
          editedFields: [],
        })
        .returning({ id: externalWorkoutsTable.id });

      const [ext2] = await db
        .insert(externalWorkoutsTable)
        .values({
          userId: TEST_USER_ID,
          label: "Integration External 2",
          workoutType: "CrossFit",
          duration: 25,
          intensity: 9,
          muscleGroups: ["Back", "Legs"],
          stimulusPoints: 55,
          workoutDate: d(1),
          workoutFormat: "FOR_TIME",
          parserConfidence: 0.88,
          parserWarnings: [],
          wasUserEdited: false,
          editedFields: [],
        })
        .returning({ id: externalWorkoutsTable.id });

      externalId1 = ext1.id;
      externalId2 = ext2.id;
    });

    afterAll(async () => {
      await db.delete(externalWorkoutsTable).where(eq(externalWorkoutsTable.id, externalId1));
      await db.delete(externalWorkoutsTable).where(eq(externalWorkoutsTable.id, externalId2));
      await db.delete(dailyCheckInsTable).where(eq(dailyCheckInsTable.userId, TEST_USER_ID));
    });

    it("returns 200 and all new response fields are present", async () => {
      const res = await request(app).get("/api/workout/deload-check");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("recommended");
      expect(res.body).toHaveProperty("reason");
      expect(res.body).toHaveProperty("avgFatigue");
      expect(res.body).toHaveProperty("weeklyVolume");
      expect(res.body).toHaveProperty("sessionCount");
      expect(res.body).toHaveProperty("internalSessionCount");
      expect(res.body).toHaveProperty("externalSessionCount");
    });

    it("externalSessionCount = 2 (both inserted workouts within 7 days)", async () => {
      const res = await request(app).get("/api/workout/deload-check");

      expect(res.status).toBe(200);
      expect(res.body.externalSessionCount).toBe(2);
    });

    it("internalSessionCount = 0 (no internal sessions for test user)", async () => {
      const res = await request(app).get("/api/workout/deload-check");

      expect(res.status).toBe(200);
      expect(res.body.internalSessionCount).toBe(0);
    });

    it("sessionCount = internalSessionCount + externalSessionCount", async () => {
      const res = await request(app).get("/api/workout/deload-check");

      expect(res.status).toBe(200);
      expect(res.body.sessionCount).toBe(
        res.body.internalSessionCount + res.body.externalSessionCount,
      );
    });

    it("weeklyVolume = 11500 (stimulusPoints 60+55, each × LOAD_TO_VOLUME_EQUIV=100)", async () => {
      const res = await request(app).get("/api/workout/deload-check");

      expect(res.status).toBe(200);
      // externalSessionLoad(60)=60 → sessionLoadToVolumeEquiv(60)=6000
      // externalSessionLoad(55)=55 → sessionLoadToVolumeEquiv(55)=5500
      // weeklyVolume = 0 (internal) + 6000 + 5500 = 11500
      expect(res.body.weeklyVolume).toBe(11500);
    });

    it("avgFatigue > 65 with energy=2 / soreness=5 / stress=5 on all 3 days", async () => {
      const res = await request(app).get("/api/workout/deload-check");

      expect(res.status).toBe(200);
      expect(res.body.avgFatigue).toBeGreaterThan(65);
    });

    it("recommended=true because allHighFatigue (every fatigue score >= 65)", async () => {
      const res = await request(app).get("/api/workout/deload-check");

      expect(res.status).toBe(200);
      expect(res.body.recommended).toBe(true);
    });

    it("reason string is non-null and references fatigue (allHighFatigue path)", async () => {
      const res = await request(app).get("/api/workout/deload-check");

      expect(res.status).toBe(200);
      expect(res.body.reason).not.toBeNull();
      expect(res.body.reason).toMatch(/fatigue/i);
    });
  });
});

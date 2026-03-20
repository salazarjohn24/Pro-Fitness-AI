/**
 * metrics.test.ts — Security gate tests for GET /api/metrics
 *
 * Three required cases (per hardening spec):
 *   METRICS-1  missing METRICS_SECRET in production    → 503 (fail-closed)
 *   METRICS-2  wrong secret (any env)                  → 401
 *   METRICS-3  correct secret (any env)                → 200
 *
 * resolveSecret() is evaluated per-request, so manipulating process.env
 * within a test takes effect without module cache invalidation.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";

// ---------------------------------------------------------------------------
// Auth mock — required to suppress OIDC client initialisation at import time.
// The metrics route does not check req.isAuthenticated(); getSession returns
// null here so req.user is never set (no session cookie present in tests).
// ---------------------------------------------------------------------------
vi.mock("../src/lib/auth", () => ({
  getSessionId: () => null,
  getSession: () => null,
  clearSession: vi.fn(),
  updateSession: vi.fn(),
  getOidcConfig: vi.fn(),
}));

import app from "../src/app";

// ---------------------------------------------------------------------------
// Save and restore process.env across tests so mutations don't leak.
// ---------------------------------------------------------------------------
let _origNodeEnv: string | undefined;
let _origMetricsSecret: string | undefined;

beforeEach(() => {
  _origNodeEnv = process.env.NODE_ENV;
  _origMetricsSecret = process.env.METRICS_SECRET;
});

afterEach(() => {
  if (_origNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = _origNodeEnv;
  }
  if (_origMetricsSecret === undefined) {
    delete process.env.METRICS_SECRET;
  } else {
    process.env.METRICS_SECRET = _origMetricsSecret;
  }
});

// ---------------------------------------------------------------------------
// METRICS-1 — fail-closed: missing secret in production → 503
// ---------------------------------------------------------------------------
describe("METRICS-1 — production without METRICS_SECRET → 503", () => {
  it("returns 503 when NODE_ENV=production and METRICS_SECRET is absent", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.METRICS_SECRET;

    const res = await request(app).get("/api/metrics");

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ error: expect.stringContaining("not configured") });
  });

  it("503 body does not leak secret values or internal paths", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.METRICS_SECRET;

    const res = await request(app).get("/api/metrics");

    const body = JSON.stringify(res.body);
    expect(body).not.toContain("dev-metrics-secret");
    expect(body).not.toContain("process.env");
  });

  it("returns 200 in production when METRICS_SECRET IS set and provided correctly", async () => {
    process.env.NODE_ENV = "production";
    process.env.METRICS_SECRET = "prod-test-secret-xK9z";

    const res = await request(app)
      .get("/api/metrics")
      .set("X-Metrics-Secret", "prod-test-secret-xK9z");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("uptimeSecs");
  });
});

// ---------------------------------------------------------------------------
// METRICS-2 — wrong secret → 401
// ---------------------------------------------------------------------------
describe("METRICS-2 — wrong or missing secret header → 401", () => {
  beforeEach(() => {
    // Non-production env with an explicit secret configured.
    process.env.NODE_ENV = "test";
    process.env.METRICS_SECRET = "correct-secret-abc123";
  });

  it("returns 401 when X-Metrics-Secret header is wrong", async () => {
    const res = await request(app)
      .get("/api/metrics")
      .set("X-Metrics-Secret", "wrong-secret");

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: expect.stringContaining("Invalid") });
  });

  it("returns 401 when X-Metrics-Secret header is absent", async () => {
    const res = await request(app).get("/api/metrics");

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: expect.stringContaining("Invalid") });
  });

  it("returns 401 when X-Metrics-Secret is empty string", async () => {
    const res = await request(app)
      .get("/api/metrics")
      .set("X-Metrics-Secret", "");

    expect(res.status).toBe(401);
  });

  it("dev fallback 'dev-metrics-secret' is rejected when explicit METRICS_SECRET is set", async () => {
    // Ensures explicit config takes precedence — dev fallback can't bypass a real secret.
    const res = await request(app)
      .get("/api/metrics")
      .set("X-Metrics-Secret", "dev-metrics-secret");

    expect(res.status).toBe(401);
  });

  it("returns 401 in production even with no METRICS_SECRET if a header is provided", async () => {
    // In production, if METRICS_SECRET is absent, 503 beats 401 — but this
    // tests that the secret check is not bypassed by sending any value.
    process.env.NODE_ENV = "production";
    delete process.env.METRICS_SECRET;

    const res = await request(app)
      .get("/api/metrics")
      .set("X-Metrics-Secret", "dev-metrics-secret");

    // 503 because secret is not configured — cannot be bypassed by guessing.
    expect(res.status).toBe(503);
  });
});

// ---------------------------------------------------------------------------
// METRICS-3 — correct secret → 200
// ---------------------------------------------------------------------------
describe("METRICS-3 — correct secret → 200", () => {
  it("returns 200 with full snapshot when dev fallback is used (non-production, no env var)", async () => {
    process.env.NODE_ENV = "test";
    delete process.env.METRICS_SECRET;

    const res = await request(app)
      .get("/api/metrics")
      .set("X-Metrics-Secret", "dev-metrics-secret");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("uptimeSecs");
    expect(res.body).toHaveProperty("requestsTotal");
    expect(res.body).toHaveProperty("aiCallsTotal");
    expect(res.body).toHaveProperty("aiFallbacksTotal");
    expect(res.body).toHaveProperty("endpoints");
    expect(Array.isArray(res.body.endpoints)).toBe(true);
  });

  it("returns 200 with explicit METRICS_SECRET set and provided correctly", async () => {
    process.env.NODE_ENV = "test";
    process.env.METRICS_SECRET = "my-explicit-secret-789";

    const res = await request(app)
      .get("/api/metrics")
      .set("X-Metrics-Secret", "my-explicit-secret-789");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("snapshotAt");
  });

  it("snapshot body contains all required MetricsSnapshot fields", async () => {
    process.env.NODE_ENV = "test";
    delete process.env.METRICS_SECRET;

    const res = await request(app)
      .get("/api/metrics")
      .set("X-Metrics-Secret", "dev-metrics-secret");

    expect(res.status).toBe(200);
    const requiredFields = [
      "uptimeSecs", "processStartedAt", "snapshotAt",
      "requestsTotal", "errorsTotal", "errors4xx", "errors5xx",
      "authFailuresTotal", "aiCallsTotal", "aiFallbacksTotal",
      "aiFallbacksByFn", "endpoints", "errorsByStatus",
    ];
    for (const field of requiredFields) {
      expect(res.body, `missing field: ${field}`).toHaveProperty(field);
    }
  });
});

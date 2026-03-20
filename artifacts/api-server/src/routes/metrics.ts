/**
 * metrics.ts — GET /api/metrics
 *
 * Returns a JSON snapshot of all in-process metrics.
 * Protected by X-Metrics-Secret header.
 *
 * Secret resolution (evaluated per-request for testability):
 *   - NODE_ENV === "production":  METRICS_SECRET env var is REQUIRED.
 *     If absent, route returns 503 — fail-closed, no fallback.
 *   - NODE_ENV !== "production":  Falls back to "dev-metrics-secret" when
 *     METRICS_SECRET is not set. Explicit and environment-gated.
 *
 * Startup warning is emitted once at module load when production config is
 * missing so it appears in deployment logs.
 *
 * Post-deploy verification (replace $METRICS_SECRET with the real value):
 *   curl -s -o /dev/null -w "%{http_code}" \
 *     -H "X-Metrics-Secret: wrong" \
 *     https://pro-fitness-ai.replit.app/api/metrics
 *   # expect: 401
 *
 *   curl -s -o /dev/null -w "%{http_code}" \
 *     https://pro-fitness-ai.replit.app/api/metrics
 *   # expect: 401 (no header)
 *
 *   curl -s -o /dev/null -w "%{http_code}" \
 *     -H "X-Metrics-Secret: $METRICS_SECRET" \
 *     https://pro-fitness-ai.replit.app/api/metrics
 *   # expect: 200
 */

import { Router } from "express";
import { getSnapshot } from "../lib/metrics";

const router = Router();

// Emit once at startup so it appears in deployment logs.
if (process.env.NODE_ENV === "production" && !process.env.METRICS_SECRET) {
  console.error(
    "[metrics] CRITICAL: METRICS_SECRET is not set. " +
    "GET /api/metrics will return 503 until the secret is configured in production."
  );
}

/**
 * Resolve the effective secret for the current environment.
 * Evaluated per-request so integration tests can control process.env without
 * module cache invalidation.
 *
 * Returns null when production config is missing (triggers 503).
 */
function resolveSecret(): string | null {
  const configured = process.env.METRICS_SECRET;
  if (process.env.NODE_ENV === "production") {
    return configured ?? null;
  }
  return configured ?? "dev-metrics-secret";
}

router.get("/api/metrics", (req, res) => {
  const secret = resolveSecret();

  if (secret === null) {
    res.status(503).json({
      error: "Metrics endpoint is not configured. Set METRICS_SECRET in production.",
    });
    return;
  }

  const provided = req.headers["x-metrics-secret"];
  if (provided !== secret) {
    res.status(401).json({ error: "Invalid or missing X-Metrics-Secret header" });
    return;
  }

  res.json(getSnapshot());
});

export default router;

/**
 * metrics.ts — GET /api/metrics
 *
 * Returns a JSON snapshot of all in-process metrics.
 * Protected by X-Metrics-Secret header (compared against METRICS_SECRET env
 * var; defaults to "dev-metrics-secret" when not set — set a strong value in
 * production).
 *
 * Usage by health-summary script:
 *   curl -s -H "X-Metrics-Secret: $METRICS_SECRET" http://localhost:8080/api/metrics
 */

import { Router } from "express";
import { getSnapshot } from "../lib/metrics";

const router = Router();

const SECRET = process.env.METRICS_SECRET ?? "dev-metrics-secret";

router.get("/api/metrics", (req, res) => {
  const provided = req.headers["x-metrics-secret"];
  if (provided !== SECRET) {
    res.status(401).json({ error: "Invalid or missing X-Metrics-Secret header" });
    return;
  }

  res.json(getSnapshot());
});

export default router;

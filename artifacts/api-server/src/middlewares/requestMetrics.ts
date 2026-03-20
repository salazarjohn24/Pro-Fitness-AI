/**
 * requestMetrics.ts — Express middleware
 *
 * Intercepts every response to:
 *   1. Match the request against the tracked endpoint registry
 *   2. Measure latency from request start to response finish
 *   3. Call recordLatency + incrementCounter in the metrics store
 *
 * Untracked endpoints are still counted in the global requestsTotal /
 * errorsByStatus buckets via incrementCounter, but do not contribute
 * to per-endpoint latency percentiles.
 */

import type { Request, Response, NextFunction } from "express";
import { TRACKED_ENDPOINTS, recordLatency, incrementCounter, incrementAuthFailure } from "../lib/metrics";

export function requestMetrics(req: Request, res: Response, next: NextFunction) {
  const startMs = Date.now();

  res.on("finish", () => {
    const latencyMs = Date.now() - startMs;
    const { statusCode } = res;

    incrementCounter(statusCode);

    if (statusCode === 401) {
      incrementAuthFailure();
    }

    // Match against the MVP endpoint registry (method + path)
    const path = req.path;
    const method = req.method.toUpperCase();

    for (const ep of TRACKED_ENDPOINTS) {
      if (ep.method === method && ep.pattern.test(path)) {
        recordLatency(ep.key, statusCode, latencyMs);
        break;
      }
    }
  });

  next();
}

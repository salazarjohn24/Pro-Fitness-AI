/**
 * metrics.ts — In-process production guardrails store
 *
 * All state is in-memory and resets on server restart.  Each metric line is
 * also emitted to stdout as a structured [metrics] JSON event so that
 * deployment logs capture the full lifetime of the process.
 *
 * Consumers:
 *   - requestMetrics middleware  → recordLatency / incrementCounter
 *   - aiService                 → incrementAiFallback
 *   - auth routes               → incrementAuthFailure
 *   - GET /api/metrics          → getSnapshot()
 *   - scripts/health-summary.sh → GET /api/metrics
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LatencyBucket {
  count: number;
  sumMs: number;
  p50: number | null;
  p95: number | null;
  p99: number | null;
  minMs: number | null;
  maxMs: number | null;
}

export interface EndpointStats {
  key: string;
  method: string;
  pathPattern: string;
  ok: LatencyBucket;   // 2xx
  err: LatencyBucket;  // 4xx + 5xx
}

export interface MetricsSnapshot {
  uptimeSecs: number;
  processStartedAt: string;
  snapshotAt: string;
  requestsTotal: number;
  errorsTotal: number;
  errors4xx: number;
  errors5xx: number;
  authFailuresTotal: number;
  aiCallsTotal: number;
  aiFallbacksTotal: number;
  aiFallbacksByFn: Record<string, number>;
  endpoints: EndpointStats[];
  errorsByStatus: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

const PROCESS_STARTED_AT = new Date();
const ROLLING_WINDOW = 200; // keep last N samples per bucket

let requestsTotal = 0;
let errorsTotal = 0;
let errors4xx = 0;
let errors5xx = 0;
let authFailuresTotal = 0;
let aiCallsTotal = 0;
let aiFallbacksTotal = 0;
const aiFallbacksByFn: Record<string, number> = {};
const errorsByStatus: Record<string, number> = {};

// ---------------------------------------------------------------------------
// Endpoint registry
// ---------------------------------------------------------------------------

export const TRACKED_ENDPOINTS: { method: string; pattern: RegExp; key: string; pathPattern: string }[] = [
  { method: "POST", pattern: /^\/api\/workout\/parse-description$/, key: "ai.parseDescription",    pathPattern: "POST /api/workout/parse-description" },
  { method: "POST", pattern: /^\/api\/workout\/analyze-image$/,     key: "ai.analyzeImage",        pathPattern: "POST /api/workout/analyze-image" },
  { method: "GET",  pattern: /^\/api\/workout\/deload-check$/,      key: "workout.deloadCheck",    pathPattern: "GET /api/workout/deload-check" },
  { method: "POST", pattern: /^\/api\/workouts\/external$/,         key: "workouts.saveExternal",  pathPattern: "POST /api/workouts/external" },
  { method: "GET",  pattern: /^\/api\/workouts\/external$/,         key: "workouts.listExternal",  pathPattern: "GET /api/workouts/external" },
  { method: "POST", pattern: /^\/api\/feedback$/,                   key: "feedback.submit",        pathPattern: "POST /api/feedback" },
  { method: "GET",  pattern: /^\/api\/profile$/,                    key: "profile.get",            pathPattern: "GET /api/profile" },
  { method: "PUT",  pattern: /^\/api\/profile$/,                    key: "profile.update",         pathPattern: "PUT /api/profile" },
  { method: "POST", pattern: /^\/api\/exercises\/\d+\/history$/,    key: "exercises.logHistory",   pathPattern: "POST /api/exercises/:id/history" },
  { method: "GET",  pattern: /^\/api\/exercises\/\d+\/history$/,    key: "exercises.getHistory",   pathPattern: "GET /api/exercises/:id/history" },
  { method: "POST", pattern: /^\/api\/checkins$/,                   key: "checkins.create",        pathPattern: "POST /api/checkins" },
  { method: "GET",  pattern: /^\/api\/checkins\/latest$/,           key: "checkins.latest",        pathPattern: "GET /api/checkins/latest" },
  { method: "POST", pattern: /^\/api\/workout\/generate$/,          key: "workout.generate",       pathPattern: "POST /api/workout/generate" },
];

type RollingBucket = {
  samples: number[];  // latency in ms, capped at ROLLING_WINDOW
  sumMs: number;
  count: number;
};

const endpointSamples: Record<string, { ok: RollingBucket; err: RollingBucket }> = {};

for (const ep of TRACKED_ENDPOINTS) {
  endpointSamples[ep.key] = {
    ok:  { samples: [], sumMs: 0, count: 0 },
    err: { samples: [], sumMs: 0, count: 0 },
  };
}

// ---------------------------------------------------------------------------
// Percentile helper
// ---------------------------------------------------------------------------

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function bucketStats(rb: RollingBucket): LatencyBucket {
  if (rb.count === 0) {
    return { count: 0, sumMs: 0, p50: null, p95: null, p99: null, minMs: null, maxMs: null };
  }
  const sorted = [...rb.samples].sort((a, b) => a - b);
  return {
    count: rb.count,
    sumMs: Math.round(rb.sumMs),
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    minMs: sorted[0],
    maxMs: sorted[sorted.length - 1],
  };
}

function pushSample(rb: RollingBucket, ms: number) {
  if (rb.samples.length >= ROLLING_WINDOW) {
    const evicted = rb.samples.shift()!;
    rb.sumMs -= evicted;
  }
  rb.samples.push(ms);
  rb.sumMs += ms;
  rb.count++;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function recordLatency(endpointKey: string, statusCode: number, latencyMs: number) {
  const bucket = endpointSamples[endpointKey];
  if (!bucket) return;

  const is2xx = statusCode >= 200 && statusCode < 300;
  pushSample(is2xx ? bucket.ok : bucket.err, latencyMs);

  console.log(JSON.stringify({
    t: "metrics",
    event: "request_complete",
    endpoint: endpointKey,
    status: statusCode,
    latencyMs,
  }));
}

export function incrementCounter(statusCode: number) {
  requestsTotal++;
  const key = String(statusCode);
  errorsByStatus[key] = (errorsByStatus[key] ?? 0) + 1;

  if (statusCode >= 400 && statusCode < 500) {
    errorsTotal++;
    errors4xx++;
  } else if (statusCode >= 500) {
    errorsTotal++;
    errors5xx++;
  }
}

export function incrementAuthFailure() {
  authFailuresTotal++;
  console.log(JSON.stringify({ t: "metrics", event: "auth_failure" }));
}

export function incrementAiCall() {
  aiCallsTotal++;
}

export function incrementAiFallback(fnName: string) {
  aiFallbacksTotal++;
  aiFallbacksByFn[fnName] = (aiFallbacksByFn[fnName] ?? 0) + 1;
  console.log(JSON.stringify({ t: "metrics", event: "ai_fallback", fn: fnName }));
}

export function getSnapshot(): MetricsSnapshot {
  const now = new Date();
  const uptimeSecs = Math.round((now.getTime() - PROCESS_STARTED_AT.getTime()) / 1000);

  const endpoints: EndpointStats[] = TRACKED_ENDPOINTS.map((ep) => {
    const s = endpointSamples[ep.key];
    return {
      key: ep.key,
      method: ep.method,
      pathPattern: ep.pathPattern,
      ok: bucketStats(s.ok),
      err: bucketStats(s.err),
    };
  });

  return {
    uptimeSecs,
    processStartedAt: PROCESS_STARTED_AT.toISOString(),
    snapshotAt: now.toISOString(),
    requestsTotal,
    errorsTotal,
    errors4xx,
    errors5xx,
    authFailuresTotal,
    aiCallsTotal,
    aiFallbacksTotal,
    aiFallbacksByFn: { ...aiFallbacksByFn },
    endpoints,
    errorsByStatus: { ...errorsByStatus },
  };
}

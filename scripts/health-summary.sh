#!/usr/bin/env bash
# health-summary.sh — Print a human-readable snapshot of the API server metrics.
# Usage: METRICS_SECRET=<secret> bash scripts/health-summary.sh [host]
#
# Defaults:
#   host  = http://localhost:8080
#   METRICS_SECRET = dev-metrics-secret

set -euo pipefail

HOST="${1:-http://localhost:8080}"
SECRET="${METRICS_SECRET:-dev-metrics-secret}"
ENDPOINT="${HOST}/api/metrics"

echo "=== Pro Fitness AI — Health Summary ==="
echo "  Endpoint : ${ENDPOINT}"
echo "  Timestamp: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo ""

RAW=$(curl -sf -H "X-Metrics-Secret: ${SECRET}" "${ENDPOINT}") || {
  echo "ERROR: Could not reach ${ENDPOINT}" >&2
  echo "  • Make sure the API server is running and METRICS_SECRET is correct." >&2
  exit 1
}

node --input-type=module <<EOF
const d = ${RAW};

const hr = (t) => console.log('── ' + t + ' ' + '─'.repeat(Math.max(0, 70 - t.length - 4)));
const pad = (s, n) => String(s).padEnd(n);
const lpad = (s, n) => String(s).padStart(n);

hr('Overview');
console.log('  Uptime             : ' + d.uptimeSecs + 's  (started ' + d.processStartedAt + ')');
console.log('  Requests total     : ' + d.requestsTotal);
console.log('  Errors (4xx/5xx)   : ' + d.errors4xx + ' / ' + d.errors5xx);
console.log('  Auth failures (401): ' + d.authFailuresTotal);
console.log('  AI calls           : ' + d.aiCallsTotal);
console.log('  AI fallbacks       : ' + d.aiFallbacksTotal);
console.log('');

hr('HTTP Status Counts');
const counts = d.errorsByStatus || {};
const codes = Object.keys(counts).sort();
if (codes.length) {
  codes.forEach(code => {
    const tag = code.startsWith('2') ? '(ok)' : code.startsWith('4') ? '(warn)' : code.startsWith('5') ? '(err)' : '';
    console.log('  HTTP ' + code + ': ' + lpad(counts[code], 6) + '  ' + tag);
  });
} else {
  console.log('  (no requests recorded yet)');
}
console.log('');

hr('Endpoint Latency — 2xx (ms)');
console.log('  ' + pad('Endpoint', 45) + lpad('P50', 6) + lpad('P95', 6) + lpad('P99', 6) + lpad('N', 6));
(d.endpoints || []).forEach(ep => {
  const ok = ep.ok || {};
  const label = ep.pathPattern || ep.key || '?';
  const p50 = ok.p50 != null ? ok.p50 : '-';
  const p95 = ok.p95 != null ? ok.p95 : '-';
  const p99 = ok.p99 != null ? ok.p99 : '-';
  const n   = ok.count || 0;
  console.log('  ' + pad(label, 45) + lpad(p50, 6) + lpad(p95, 6) + lpad(p99, 6) + lpad(n, 6));
});
console.log('');

hr('AI Fallback Breakdown');
const fb = d.aiFallbacksByFn || {};
const fns = Object.keys(fb).sort((a, b) => fb[b] - fb[a]);
if (fns.length) {
  fns.forEach(fn => console.log('  ' + fn + ': ' + fb[fn]));
} else {
  console.log('  (no fallbacks recorded)');
}
console.log('');

console.log('Done.');
EOF

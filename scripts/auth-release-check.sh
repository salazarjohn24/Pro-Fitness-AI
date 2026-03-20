#!/usr/bin/env bash
# auth-release-check.sh — Pre-release gate for every TestFlight build.
# Run from repo root: bash scripts/auth-release-check.sh
# Exit 0 = all checks pass. Exit 1 = one or more failures.
#
# Checks (5 total):
#   1. EXPO_PUBLIC_DOMAIN matches canonical production domain in eas.json
#   2. ascAppId is present in eas.json submit profile
#   3. iOS buildNumber was incremented vs the previous git commit
#   4. GET /api/healthz returns HTTP 200
#   5. GET /api/auth/social/google returns HTTP 302 → accounts.google.com
#      with redirect_uri pointing at the canonical domain

set -euo pipefail

PROD_DOMAIN="pro-fitness-ai.replit.app"
EXPECTED_EXPO_PUBLIC_DOMAIN="pro-fitness-ai.replit.app"
EXPECTED_ASC_APP_ID="6760667643"
EAS_JSON="artifacts/mobile/eas.json"
APP_JSON="artifacts/mobile/app.json"
PASS="✅ PASS"
FAIL="❌ FAIL"
failures=0

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║         Pro Fitness AI — Auth Release Check              ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ── CHECK 1: EXPO_PUBLIC_DOMAIN ───────────────────────────────────────────────
echo "[1/5] EXPO_PUBLIC_DOMAIN in eas.json"
actual_domain=$(node -e "process.stdout.write(require('./${EAS_JSON}').build.production.env.EXPO_PUBLIC_DOMAIN || '')")
if [ "$actual_domain" = "$EXPECTED_EXPO_PUBLIC_DOMAIN" ]; then
  echo "      $PASS  EXPO_PUBLIC_DOMAIN=${actual_domain}"
else
  echo "      $FAIL  Expected '${EXPECTED_EXPO_PUBLIC_DOMAIN}', got '${actual_domain}'"
  echo "             Fix: update build.production.env.EXPO_PUBLIC_DOMAIN in ${EAS_JSON}"
  failures=$((failures + 1))
fi

# ── CHECK 2: ascAppId in submit profile ───────────────────────────────────────
echo ""
echo "[2/5] ascAppId in eas.json submit profile"
actual_asc=$(node -e "
  const j = require('./${EAS_JSON}');
  const id = (j.submit && j.submit.production && j.submit.production.ios && j.submit.production.ios.ascAppId) || '';
  process.stdout.write(id);
")
if [ "$actual_asc" = "$EXPECTED_ASC_APP_ID" ]; then
  echo "      $PASS  ascAppId=${actual_asc}"
else
  echo "      $FAIL  Expected ascAppId='${EXPECTED_ASC_APP_ID}', got '${actual_asc:-<not set>}'"
  echo "             Fix: set submit.production.ios.ascAppId in ${EAS_JSON}"
  failures=$((failures + 1))
fi

# ── CHECK 3: iOS buildNumber incremented vs last git commit ───────────────────
echo ""
echo "[3/5] iOS buildNumber in app.json"
current_build=$(node -e "process.stdout.write(require('./${APP_JSON}').expo.ios.buildNumber || '')")
prev_build=$(git show HEAD~1:"${APP_JSON}" 2>/dev/null | node -e "
  let d=''; process.stdin.on('data',c=>d+=c).on('end',()=>{
    try{ process.stdout.write(JSON.parse(d).expo.ios.buildNumber||'0') }catch{ process.stdout.write('0') }
  });
" 2>/dev/null || echo "0")

echo "      Current buildNumber : ${current_build}"
echo "      Previous buildNumber: ${prev_build}"

if [ -z "$current_build" ]; then
  echo "      $FAIL  buildNumber is not set in ${APP_JSON}"
  failures=$((failures + 1))
elif [ "$current_build" -gt "$prev_build" ] 2>/dev/null; then
  echo "      $PASS  buildNumber incremented (${prev_build} → ${current_build})"
elif [ "$current_build" = "$prev_build" ]; then
  echo "      $FAIL  buildNumber NOT incremented — still ${current_build} (same as last commit)"
  echo "             Fix: increment ios.buildNumber in ${APP_JSON} before building"
  failures=$((failures + 1))
else
  echo "      $FAIL  buildNumber appears to have decreased (${prev_build} → ${current_build})"
  failures=$((failures + 1))
fi

# ── CHECK 4: /api/healthz returns 200 ─────────────────────────────────────────
echo ""
echo "[4/5] GET https://${PROD_DOMAIN}/api/healthz"
healthz_status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
  "https://${PROD_DOMAIN}/api/healthz" 2>/dev/null || echo "000")
healthz_body=$(curl -s --max-time 10 \
  "https://${PROD_DOMAIN}/api/healthz" 2>/dev/null || echo "(no response)")

if [ "$healthz_status" = "200" ]; then
  echo "      $PASS  HTTP ${healthz_status} — ${healthz_body}"
else
  echo "      $FAIL  HTTP ${healthz_status} (expected 200)"
  echo "             Body: ${healthz_body}"
  echo "             Fix: check production deployment is live at https://${PROD_DOMAIN}"
  failures=$((failures + 1))
fi

# ── CHECK 5: /api/auth/social/google returns 302 to accounts.google.com ───────
echo ""
echo "[5/5] GET https://${PROD_DOMAIN}/api/auth/social/google"
google_status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
  "https://${PROD_DOMAIN}/api/auth/social/google" 2>/dev/null || echo "000")
google_location=$(curl -s -o /dev/null -w "%{redirect_url}" --max-time 10 \
  "https://${PROD_DOMAIN}/api/auth/social/google" 2>/dev/null || echo "")

if [ "$google_status" = "302" ] && echo "$google_location" | grep -q "accounts.google.com"; then
  echo "      $PASS  HTTP ${google_status} → accounts.google.com"

  encoded_domain=$(node -e "process.stdout.write(encodeURIComponent('https://${PROD_DOMAIN}'))" 2>/dev/null || echo "")
  if echo "$google_location" | grep -qE "${PROD_DOMAIN}|${encoded_domain}"; then
    decoded_uri=$(node -e "
      const url = '${google_location}';
      const m = url.match(/redirect_uri=([^&]+)/);
      process.stdout.write(m ? decodeURIComponent(m[1]) : '(not found)');
    " 2>/dev/null || echo "(parse error)")
    echo "      $PASS  Callback domain matches ${PROD_DOMAIN}"
    echo "             redirect_uri: ${decoded_uri}"
  else
    echo "      $FAIL  Callback domain does NOT match ${PROD_DOMAIN}"
    echo "             Location: ${google_location}"
    echo "             Fix: check PRODUCTION_ORIGIN env var and x-forwarded-host in getOrigin()"
    failures=$((failures + 1))
  fi
else
  echo "      $FAIL  HTTP ${google_status} (expected 302 → accounts.google.com)"
  echo "             Location: ${google_location}"
  echo "             Fix: check GOOGLE_CLIENT_ID/SECRET are set and api-server is deployed"
  failures=$((failures + 1))
fi

# ── SUMMARY ───────────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════════"
if [ "$failures" -eq 0 ]; then
  echo "  ✅  ALL CHECKS PASSED — safe to build and submit to TestFlight"
  echo "      Build number: ${current_build}"
  echo "      Domain:       ${actual_domain}"
  echo "      ascAppId:     ${actual_asc}"
  echo "══════════════════════════════════════════════════════════"
  echo ""
  exit 0
else
  echo "  ❌  ${failures} CHECK(S) FAILED — do not submit to TestFlight"
  echo "      Fix the failures above, then re-run: bash scripts/auth-release-check.sh"
  echo "══════════════════════════════════════════════════════════"
  echo ""
  exit 1
fi

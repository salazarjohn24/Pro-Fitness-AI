#!/usr/bin/env bash
# pre-release-check.sh — Single command for every TestFlight / closed-beta release.
#
# Usage (from repo root):
#   bash scripts/pre-release-check.sh
#
# Exit codes:
#   0 = ALL gates passed (safe to build and submit)
#   1 = One or more gates failed (do NOT submit)
#
# Gates (in order):
#   1. Auth release check   — prod domain, ascAppId, buildNumber, /healthz, Google OAuth
#   2. API test suite       — vitest; must be 100 % pass
#   3. Mobile test suite    — vitest; must be 100 % pass

set -euo pipefail

PASS="✅ PASS"
FAIL="❌ FAIL"
gate_failures=0

# ── colours (safe to disable if terminal doesn't support them) ──────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

banner() {
  echo ""
  echo -e "${YELLOW}╔══════════════════════════════════════════════════════════╗${NC}"
  echo -e "${YELLOW}║     Pro Fitness AI — Pre-Release Check                   ║${NC}"
  echo -e "${YELLOW}╚══════════════════════════════════════════════════════════╝${NC}"
  echo ""
}

section() {
  echo ""
  echo -e "${YELLOW}──────────────────────────────────────────────────────────${NC}"
  echo -e "${YELLOW} $1${NC}"
  echo -e "${YELLOW}──────────────────────────────────────────────────────────${NC}"
}

banner

# ── GATE 1: Auth release check ────────────────────────────────────────────────
section "GATE 1/3 — Auth Release Check (prod domain + OAuth)"

if bash scripts/auth-release-check.sh; then
  echo ""
  echo -e "  ${GREEN}${PASS}  Auth release check${NC}"
  AUTH_RESULT="PASS"
else
  echo ""
  echo -e "  ${RED}${FAIL}  Auth release check — see output above for details${NC}"
  AUTH_RESULT="FAIL"
  gate_failures=$((gate_failures + 1))
fi

# ── GATE 2: API test suite ────────────────────────────────────────────────────
section "GATE 2/3 — API Test Suite"

API_OUTPUT=$(cd artifacts/api-server && pnpm vitest run --reporter=verbose 2>&1)
API_EXIT=$?

# extract pass/fail summary line
API_SUMMARY=$(echo "$API_OUTPUT" | grep -E "Tests.*passed|Test Files.*passed" | tail -2 | tr '\n' ' ')

if [ $API_EXIT -eq 0 ]; then
  echo -e "  ${GREEN}${PASS}  $API_SUMMARY${NC}"
  API_RESULT="PASS"
else
  echo "$API_OUTPUT" | grep -E "FAIL|Error|×" | head -20
  echo ""
  echo -e "  ${RED}${FAIL}  API tests failed${NC}"
  echo -e "  ${RED}       $API_SUMMARY${NC}"
  API_RESULT="FAIL"
  gate_failures=$((gate_failures + 1))
fi

# ── GATE 3: Mobile test suite ─────────────────────────────────────────────────
section "GATE 3/3 — Mobile Test Suite"

MOB_OUTPUT=$(cd artifacts/mobile && pnpm vitest run --reporter=verbose 2>&1)
MOB_EXIT=$?

MOB_SUMMARY=$(echo "$MOB_OUTPUT" | grep -E "Tests.*passed|Test Files.*passed" | tail -2 | tr '\n' ' ')

if [ $MOB_EXIT -eq 0 ]; then
  echo -e "  ${GREEN}${PASS}  $MOB_SUMMARY${NC}"
  MOB_RESULT="PASS"
else
  echo "$MOB_OUTPUT" | grep -E "FAIL|Error|×" | head -20
  echo ""
  echo -e "  ${RED}${FAIL}  Mobile tests failed${NC}"
  echo -e "  ${RED}       $MOB_SUMMARY${NC}"
  MOB_RESULT="FAIL"
  gate_failures=$((gate_failures + 1))
fi

# ── FINAL SUMMARY ─────────────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  Pre-Release Summary${NC}"
echo -e "${YELLOW}══════════════════════════════════════════════════════════${NC}"
printf "  %-28s %s\n" "Auth release check:" "$( [ "$AUTH_RESULT" = "PASS" ] && echo -e "${GREEN}${PASS}${NC}" || echo -e "${RED}${FAIL}${NC}" )"
printf "  %-28s %s\n" "API test suite:" "$( [ "$API_RESULT" = "PASS" ] && echo -e "${GREEN}${PASS}${NC}" || echo -e "${RED}${FAIL}${NC}" )"
printf "  %-28s %s\n" "Mobile test suite:" "$( [ "$MOB_RESULT" = "PASS" ] && echo -e "${GREEN}${PASS}${NC}" || echo -e "${RED}${FAIL}${NC}" )"
echo ""

if [ "$gate_failures" -eq 0 ]; then
  echo -e "${GREEN}  ✅  ALL GATES PASSED — safe to bump buildNumber and trigger EAS build${NC}"
  echo -e "${GREEN}      Next step: increment ios.buildNumber in artifacts/mobile/app.json${NC}"
  echo -e "${GREEN}               then: eas build --platform ios --profile production${NC}"
  echo ""
  exit 0
else
  echo -e "${RED}  ❌  ${gate_failures} GATE(S) FAILED — do not submit to TestFlight${NC}"
  echo -e "${RED}      Fix all failures above, then re-run: bash scripts/pre-release-check.sh${NC}"
  echo ""
  exit 1
fi

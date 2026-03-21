# Pro Fitness AI — Release Checklist (Closed Beta, April 2026)

> **How to use this doc:** Work through each section top-to-bottom before triggering an EAS build.
> Every gate must be **GO** before submission. A single **NO-GO** blocks the release.
> Run automated checks first; manual smoke checks are the final sign-off.

---

## Pre-flight command (run this first)

```bash
bash scripts/pre-release-check.sh
```

Expected output: `✅ ALL GATES PASSED`. If any gate fails, fix it and re-run before continuing.

---

## Section 1 — Build Config Gates

These are automated by `auth-release-check.sh` (included in pre-flight). Listed here for manual verification if the script is unavailable.

| # | Check | Expected | Status |
|---|---|---|---|
| 1.1 | `EXPO_PUBLIC_DOMAIN` in `artifacts/mobile/eas.json` → `build.production.env` | `pro-fitness-ai.replit.app` | ☐ |
| 1.2 | `ascAppId` in `artifacts/mobile/eas.json` → `submit.production.ios` | `6760667643` | ☐ |
| 1.3 | `ios.bundleIdentifier` in `app.json` | `app.replit.profitnessai` | ☐ |
| 1.4 | `ios.buildNumber` in `app.json` | Higher than previous commit | ☐ |
| 1.5 | `expo.version` (semantic) matches release notes | e.g. `1.0.0` | ☐ |

**GO criteria:** All five are correct before triggering `eas build`.

---

## Section 2 — Endpoint Gates (Production)

Verified by `auth-release-check.sh`. Run manually if needed:

```bash
curl -s -o /dev/null -w "%{http_code}" https://pro-fitness-ai.replit.app/api/healthz
curl -s -o /dev/null -w "%{http_code}" https://pro-fitness-ai.replit.app/api/auth/social/google
```

| # | Endpoint | Expected | Status |
|---|---|---|---|
| 2.1 | `GET /api/healthz` | HTTP 200 | ☐ |
| 2.2 | `GET /api/auth/social/google` | HTTP 302 → `accounts.google.com` | ☐ |
| 2.3 | Google OAuth `redirect_uri` contains `pro-fitness-ai.replit.app` | Must match canonical domain | ☐ |
| 2.4 | `POST /api/auth/social/apple` (no body) | HTTP 400, body `{ error: "..." }` | ☐ |
| 2.5 | `GET /api/workouts/external` (with valid session) | HTTP 200, JSON array | ☐ |
| 2.6 | `POST /api/workouts/external` (strength movement) | HTTP 200, `id` present | ☐ |
| 2.7 | Rate limiter: 6+ rapid requests to `/api/auth/social/google` | HTTP 429 on 6th | ☐ |

**GO criteria:** All seven return expected status codes against the production deployment.

---

## Section 3 — On-Device Smoke Checks (TestFlight device)

Perform on a physical iOS device running the beta build. Android (if applicable) follows same flow.

### 3.1 Authentication

| # | Action | Expected |
|---|---|---|
| A1 | Cold launch → tap Sign in with Apple | Apple auth sheet appears; completes successfully |
| A2 | Cold launch → tap Sign in with Google | In-app browser opens `accounts.google.com`; completes successfully |
| A3 | After sign-in: navigate to Profile | Name and email visible; no blank fields |
| A4 | Sign out → sign back in | No duplicate user records; data preserved |

**GO criteria:** A1–A4 all pass.

### 3.2 Apple Health Sync

| # | Action | Expected |
|---|---|---|
| H1 | First launch: tap "Connect Apple Health" | Permission sheet appears |
| H2 | Grant all permissions → wait for sync | Sync completes; no spinner stuck; last-synced timestamp updates |
| H3 | Force-close app → reopen → observe sync | Re-sync does not duplicate workouts (deduplication working) |
| H4 | Put device in Airplane mode → trigger sync | Shows user-friendly error (not crash); retry option visible |
| H5 | Re-enable network → retry | Sync recovers successfully |

**GO criteria:** H1–H5 all pass. H4 is the retry/timeout gate — a crash here is a hard NO-GO.

### 3.3 Keyboard / Input UX

| # | Screen | Action | Expected |
|---|---|---|---|
| K1 | Log Workout (Set Editor) | Tap weight field → type weight | Keyboard slides up; input visible above keyboard |
| K2 | Log Workout (Set Editor) | Dismiss keyboard by tapping outside | Weight value preserved; no reset |
| K3 | Import Workout (text box) | Paste multi-line workout text → Submit | No crash; parsing starts; confidence banner appears |
| K4 | Import Workout (set rows) | Edit set rows after import | Per-set weight/reps editable; keyboard does not obscure Done button |
| K5 | Daily Check-in form | Tab through all fields | Each field is reachable; no fields hidden behind keyboard |

**GO criteria:** K1–K5 all pass. A field reset on keyboard dismiss (K2) is a hard NO-GO.

### 3.4 External Workout Import (Set Editor)

| # | Action | Expected |
|---|---|---|
| I1 | Paste a Crossfit AMRAP description → Parse | Movements listed; confidence banner shows percentage |
| I2 | Change a movement type chip (e.g., Run → Cardio) | Set rows update to show distance/duration fields |
| I3 | Edit weight on a strength set row | Weight saves; generateVolumeString updates in header |
| I4 | Tap Save | Workout appears in history; vault ingestion runs |
| I5 | Re-open the workout in history | All movements, types, and set data intact |

**GO criteria:** I1–I5 all pass. I4 failing silently (no vault entry) is a hard NO-GO.

### 3.5 AI Workout Generation

| # | Action | Expected |
|---|---|---|
| W1 | Tap "Generate Workout" → submit description | AI response within 10 seconds; no timeout crash |
| W2 | Generated workout has at least 3 movements | Each movement has correct type chip inferred |
| W3 | Tap "Log This Workout" → complete all sets | Workout saved; exercise history updated |

**GO criteria:** W1–W3 all pass.

---

## Section 4 — Data Integrity Checks (Vault)

Run via the API after completing Section 3 smoke checks.

```bash
# Get an auth token by signing in through the app and copying the session cookie
# Then run:

# 4.1 Check vault entries exist after import
curl -s -H "Cookie: sid=<your_sid>" \
  https://pro-fitness-ai.replit.app/api/workouts/external | jq 'length'
# Expected: >= 1

# 4.2 Check exercise history for a known imported exercise
curl -s -H "Cookie: sid=<your_sid>" \
  https://pro-fitness-ai.replit.app/api/exercises/<exercise_id>/history
# Expected: { sessions: [...], estimated1RM: <number or null> }

# 4.3 Verify cardio history has no estimated1RM
# Find a cardio exercise ID from the exercise list, then:
curl -s -H "Cookie: sid=<your_sid>" \
  https://pro-fitness-ai.replit.app/api/exercises/<cardio_id>/history | jq '.estimated1RM'
# Expected: null
```

| # | Check | Expected | Status |
|---|---|---|---|
| V1 | External workouts list is non-empty after import | `length >= 1` | ☐ |
| V2 | Strength exercise history: `sessions[0].totalVolume > 0` | Yes | ☐ |
| V3 | Hold exercise history: `sessions[0].durationSeconds > 0` | Yes | ☐ |
| V4 | Cardio exercise history: `estimated1RM === null` | Yes | ☐ |
| V5 | Re-submitting same workout (PUT with same movements) does NOT double vault entries | Single set of history rows | ☐ |

**GO criteria:** V1–V5 all pass.

---

## Section 5 — Rollback Plan

### 5.1 Feature flags
There are **no feature flags** in the current codebase. All features ship as one bundle. To disable a specific feature fast:

| Feature | Rollback method | Time estimate |
|---|---|---|
| Vault ingestion | In `workouts.ts`, remove the `await ingestMovementsToVault(...)` call from the transaction, commit, and redeploy | ~5 min (deploy only) |
| Apple Health sync | In `useHealthSync.ts`, set `enabled = false` at the top of the hook; rebuild and submit hotfix | ~30 min (EAS build + TF processing) |
| AI workout generation | Remove the `/api/generate` route from `index.ts`; redeploy | ~5 min |
| Google auth | Set `GOOGLE_CLIENT_ID=""` in production env; the route returns 503 automatically | < 1 min (env var change, no redeploy) |

### 5.2 Database rollback
If a schema migration caused data loss or corruption:

1. The last safe checkpoint commit is in git. Identify the commit hash using `git log --oneline -20`.
2. Revert the schema file: `git show <safe-commit>:lib/db/src/schema/fitness.ts > lib/db/src/schema/fitness.ts`
3. Drop added columns manually (they are always nullable, so safe):
   ```sql
   ALTER TABLE workout_history DROP COLUMN IF EXISTS distance_meters;
   ```
4. Redeploy the API server.

Schema columns added in P4/P4.1 (all nullable, safe to drop without data loss):
- `workout_history.distance_meters`
- `workout_history.duration_seconds`
- `workout_history.external_workout_id`
- `workout_history.source`
- `exercise_performance.external_workout_id`
- `exercise_performance.source`

### 5.3 Full app rollback
If the build is critically broken after TestFlight release:
1. In App Store Connect → TestFlight → stop distribution of the affected build.
2. The previous build remains available in TestFlight — re-invite testers to that build.
3. No app store review needed for TestFlight rollback.

---

## Section 6 — First 24h Post-Release Monitoring

### What to watch

| Signal | Tool | Alert threshold |
|---|---|---|
| API error rate | Production logs (`fetch_deployment_logs`) | >1% 5xx on `/api/workouts/external` |
| Vault ingestion failures | Search logs for `[vault-ingestion]` | Any occurrence in first hour |
| Auth failures | Search logs for `401`, `OAuth error` | >5 in first 30 min |
| Apple Health sync errors | Search logs for `[health-sync]` or `HEALTH_ERROR` | Any `PERMISSION_DENIED` or `READ_TIMEOUT` |
| DB connection errors | Search logs for `ECONNREFUSED`, `max client` | Any occurrence |

### Log commands

```bash
# In the Replit deployment logs tool — filter by:
# message: "vault-ingestion"        → P4.1 atomicity failures
# message: "OAuth error"            → social auth failures
# message: "HEALTH_ERROR"           → Apple Health sync failures
# message: "parser-telemetry"       → AI parser confidence distribution
```

### Escalation
- **Any vault ingestion 500 in first hour** → rollback vault ingestion (5.1) immediately; diagnose in staging.
- **Any auth 500** → check `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` env vars on production; redeploy if rotated.
- **Apple Health sync crash reports** → check Crashlytics / Sentry for stack trace; hotfix build.

---

## Sign-off

| Role | Name | Date | Sign |
|---|---|---|---|
| Engineer (API) | | | ☐ |
| Engineer (Mobile) | | | ☐ |
| PM / QA | | | ☐ |

**Final verdict:** ☐ GO &nbsp;&nbsp;&nbsp; ☐ NO-GO

> All three gates in `pre-release-check.sh` must be PASS, all four sections above must be GO, and all three sign-offs must be complete before submitting to TestFlight.

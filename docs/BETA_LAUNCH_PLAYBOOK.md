# Pro Fitness AI — Beta Launch Playbook

**Target**: April 2026 closed beta · 20–30 users  
**Platform**: iOS (primary) · Bundle ID `app.replit.profitnessai` · ASC App ID `6760667643`  
**Production domain**: `pro-fitness-ai.replit.app`  
**Playbook version**: 1.0 · Last updated: 2026-03-20  

---

## Table of Contents

1. [Test Script — 20–30 User Beta](#1-test-script--2030-user-beta)
2. [Bug Severity Rubric (P0–P3)](#2-bug-severity-rubric-p0p3)
3. [Bug Reproduction Template](#3-bug-reproduction-template)
4. [Release Rollback Checklist](#4-release-rollback-checklist)
5. [Known Limitations](#5-known-limitations)
6. [Go / No-Go Checklist — April Beta Cut](#6-go--no-go-checklist--april-beta-cut)

---

## 1. Test Script — 20–30 User Beta

### Participant Profile

Recruit across four segments to get diverse signal:

| Segment | Target count | Criteria |
|---------|-------------|----------|
| Experienced lifters | 8–10 | 3+ years lifting, uses structured programs |
| CrossFit / metcon athletes | 5–8 | Logs WODs, familiar with EMOM / AMRAP / RFT |
| Casual gym-goers | 5–8 | 1–3 sessions/week, minimal logging experience |
| Recovery-focused users | 3–5 | Prioritizes sleep, HRV, deload weeks |

### Onboarding Session (Day 1, 15–20 min — facilitated or async)

Provide each tester with:
- TestFlight invite link
- A brief (2-paragraph) plain-English description of the app — no feature list, no UI hints
- The feedback form link (`FEEDBACK_EMAIL` recipient)
- Instruction: **"Use the app as you would any fitness tool. Log at least 3 workouts over the beta period."**

Do not provide walkthroughs. Observe where users get stuck without guidance.

---

### Task Script

Run each task in order. Allow up to 5 minutes per task before moving on. Record outcome as **Pass**, **Partial**, or **Fail**.

#### TASK-01 — Account Creation & First Launch

> "Open the app and get set up."

- [ ] User completes Google OAuth flow without assistance
- [ ] Profile screen loads with empty state (no workouts yet)
- [ ] No crash or blank screen on first authenticated load

**Acceptance**: User reaches the home tab within 3 minutes of install.

---

#### TASK-02 — AI Workout Generation

> "Ask the app to build you a workout for today."

- [ ] User finds the generate workout entry point without prompting
- [ ] Selects muscle groups (or accepts defaults)
- [ ] AI returns a structured workout within 15 seconds
- [ ] User can read and understand the exercise list + rationale text

**Watch for**: Users who expect to specify equipment, duration, or fitness goal and cannot find where to do so.

---

#### TASK-03 — Log the Generated Workout

> "Do (or simulate doing) the workout the app gave you, then log it."

- [ ] User taps into at least one exercise and logs sets/reps/weight
- [ ] Coach note appears on exercise detail screen
- [ ] User saves the workout session
- [ ] Confirmation state is clear (no ambiguity about whether session was saved)

**Watch for**: Users who are confused about the difference between "generate" and "save/log".

---

#### TASK-04 — Import an External Workout (Text)

> "You did a workout outside the app yesterday — maybe a run, a CrossFit class, or a gym session. Try logging it using the import feature."

Provide a sample prompt if needed: *"5 rounds: 10 pull-ups, 15 push-ups, 20 air squats"*

- [ ] User finds the external workout import entry point
- [ ] Types or pastes a workout description
- [ ] AI parses it and returns a structured form
- [ ] Confidence score is visible (or low-confidence review sheet appears if < 65%)
- [ ] User saves the imported workout

**Watch for**:
- Users who do not notice the editable fields and save without reviewing
- Confusion about what "fatigue percent" means per movement

---

#### TASK-05 — Import a Workout from a Screenshot

> "Take a screenshot of a workout (whiteboard photo, app screenshot, etc.) and import it."

Provide a sample image if tester does not have one handy.

- [ ] User finds the image import option
- [ ] Image is analyzed and returns a parsed form
- [ ] Format tag (AMRAP / EMOM / FOR_TIME / STANDARD) is visible and editable
- [ ] User saves without error

**Watch for**: Confusion when the analyzed result is obviously wrong — does the user know they can edit it?

---

#### TASK-06 — Daily Check-In

> "Check in with the app today — how you're feeling, sleep, energy."

- [ ] User finds the check-in entry point
- [ ] Completes all check-in fields (sleep, soreness, stress, energy)
- [ ] Recovery insights / tip cards appear after submission
- [ ] User can identify which tip is most relevant to them

**Watch for**: Users who skip the check-in because they do not understand its purpose.

---

#### TASK-07 — Deload Recommendation

> "The app is recommending you take it easy today. What would you do?"

Trigger this task only for users who have ≥ 3 logged sessions, or seed the deload condition in a test account.

- [ ] User reads the deload card and understands the reason
- [ ] User knows they can accept or override the recommendation
- [ ] Chosen action is clearly confirmed to the user

---

#### TASK-08 — Notification Preferences

> "Set up how often you want the app to send you insights."

- [ ] User navigates to Profile → Notifications
- [ ] Locates the "Insight Digest" row
- [ ] Changes frequency (Daily / Weekly / Off)
- [ ] Time picker appears when a schedule is selected

---

#### TASK-09 — Send Feedback

> "Tell us one thing you'd change about the app."

- [ ] User finds the feedback button on Profile
- [ ] Bottom sheet opens with text input
- [ ] User types feedback and submits
- [ ] Confirmation message appears
- [ ] Verify server-side: check `user_feedback` table for the row

---

#### TASK-10 — Open-Ended (10 min)

> "Use the app however you want for the next 10 minutes."

Observe without intervention. Note:
- Which features users return to
- Which screens they linger on or abandon
- Any errors or UI confusion not covered by tasks 1–9

---

### Post-Session Survey (async, sent after Day 7)

1. On a scale of 1–5, how often did you open the app unprompted? (1 = never, 5 = daily)
2. Which feature was most useful to you personally?
3. Which feature was most confusing?
4. Did you trust the AI workout suggestions? Why or why not?
5. What one thing would make you recommend this app to a training partner?
6. Were there moments you wanted to do something the app wouldn't let you?

---

### Metrics to Collect During Beta

Monitor via `GET /api/metrics` (header `X-Metrics-Secret`):

| Metric | Target | Alert threshold |
|--------|--------|----------------|
| AI calls total | Growing week-over-week | — |
| AI fallback rate | < 5% of AI calls | > 10% = investigate |
| Auth failures (401) | < 2% of requests | > 5% = auth regression |
| `POST /api/workout/generate` P95 latency | < 12 s | > 20 s = degrade alert |
| `POST /api/workout/parse-description` P95 | < 8 s | > 15 s = degrade alert |
| `POST /api/checkins` P95 | < 2 s | > 5 s = investigate |

Run `bash scripts/health-summary.sh` daily during the beta window.

---

## 2. Bug Severity Rubric (P0–P3)

### P0 — Critical / Ship Blocker

**Definition**: Data loss, security vulnerability, auth bypass, crash on primary happy path, or any issue that makes the app unusable for > 50% of users.

**Response time**: Fix + hotfix build within **4 hours** of confirmed report.  
**Escalation**: Notify all beta testers. Pause new invitations until resolved.

| Example | Notes |
|---------|-------|
| App crashes on launch for any iOS version in the target range | All users blocked |
| Authentication token exposed in client-side logs or network response | Security — P0 regardless of reproduction rate |
| Workout session data silently not saved (no error shown, row not in DB) | Core data loss |
| API returns 500 for `POST /api/workout/generate` 100% of the time | Primary AI flow broken |
| User can access another user's data | Auth bypass |

---

### P1 — High / Fix Before Beta Ends

**Definition**: A core MVP flow is broken for a subset of users, or a significant feature is completely non-functional. No workaround available.

**Response time**: Fix within **48 hours**. Build update within the same release cycle.  
**Escalation**: Direct message affected testers with workaround (if any). Log in risk register.

| Example | Notes |
|---------|-------|
| AI workout generation fails for users with > 20 logged sessions | Subset broken |
| Low-confidence review sheet does not open (submit goes straight through) | Safety gate bypassed |
| Check-in submission returns 400 or 500 intermittently | Blocks daily loop |
| Insight notification never fires despite prefs set to Daily | Feature non-functional |
| Feedback submission fails silently (POST 500, no user error shown) | Data lost, user confused |

---

### P2 — Medium / Fix Before GA

**Definition**: A feature works but with a meaningful UX or accuracy problem. A workaround exists but is not obvious. No data loss.

**Response time**: Triaged within **72 hours**. Scheduled for next sprint.  
**Escalation**: Log in issue tracker with reproduction steps. Communicate ETA to affected testers if they reported it directly.

| Example | Notes |
|---------|-------|
| "Weekly" insight notification delivers daily (R03) | Known — wrong OS schedule type |
| Format chip shows UNKNOWN for a clear AMRAP workout | Parser accuracy |
| Coach note is generic / not personalized despite history existing | AI quality |
| Deload card reappears after user already accepted / overrode today | AsyncStorage miss |
| Profile avatar does not load on first sign-in | Visual only |

---

### P3 — Low / Backlog

**Definition**: Polish, copy, minor visual inconsistency, or edge-case behavior. No functional impact.

**Response time**: Logged and reviewed at end of beta sprint. Fixed opportunistically.  
**Escalation**: None required. Acknowledge receipt to reporter.

| Example | Notes |
|---------|-------|
| Button tap feedback (ripple/highlight) missing on one screen | Cosmetic |
| Fatigue percentage shows 0 for a parsed movement when it should be non-zero | Minor accuracy |
| Confidence badge text wraps awkwardly on small screen (SE) | Layout |
| "Send test" insight notification subject line typo | Copy |
| Tab bar icon not highlighted on first load for a split second | Flicker |

---

## 3. Bug Reproduction Template

Copy this template into every bug report. Fill in all fields — incomplete reports are deprioritized.

```
## Bug Report

**Reporter**: [Name / tester ID]
**Date**: [YYYY-MM-DD]
**App build**: [TestFlight build number, visible in Settings → App]
**Device**: [e.g. iPhone 15 Pro, iOS 18.3.1]
**Account**: [User email or test account ID — never paste tokens]

---

### Summary
[One sentence: what went wrong]

### Severity (P0–P3)
[ ] P0  [ ] P1  [ ] P2  [ ] P3

### Steps to Reproduce
1. [Exact starting state — e.g. "Signed in as user X, 5 workouts logged"]
2. [Action 1]
3. [Action 2]
4. [...]

### Expected Behaviour
[What should have happened]

### Actual Behaviour
[What actually happened — be specific: error message text, wrong value, crash, blank screen]

### Reproduction Rate
[ ] Always (100%)  [ ] Often (> 50%)  [ ] Sometimes (10–50%)  [ ] Rarely (< 10%)

### Workaround Available?
[ ] Yes — describe: _______________
[ ] No

### Evidence
- [ ] Screenshot / screen recording attached
- [ ] API error response pasted below (redact auth tokens)
- [ ] Relevant console log lines pasted below
- [ ] Health summary output (`bash scripts/health-summary.sh`) attached if server-side

### API / Server Context (if applicable)
```json
{
  "endpoint": "POST /api/...",
  "statusCode": 500,
  "responseBody": "...",
  "requestId": "..."
}
```

### Additional Context
[Anything else relevant — recent app update, unusual account state, network conditions]
```

---

## 4. Release Rollback Checklist

Use this checklist if a P0 is confirmed in production and a hotfix cannot be ready within the SLA.

### Decision Gate

Before initiating a rollback, confirm:

- [ ] Issue is confirmed P0 (data loss, security, > 50% of users blocked)
- [ ] A hotfix cannot be ready and tested within 4 hours
- [ ] Rolling back will actually resolve the issue (i.e. the previous build did not have the bug)
- [ ] The rollback target build number is known and the IPA is available in App Store Connect

---

### Step 1 — Alert Testers

- [ ] Post in the beta tester channel: *"We've identified an issue and are rolling back to the previous build. You may need to reinstall from TestFlight. We'll update you when the fix is live."*
- [ ] Do NOT describe the bug publicly — only the impact and ETA

---

### Step 2 — Roll Back the API Server

The API is deployed at `pro-fitness-ai.replit.app`. Replit deployments are checkpoint-based.

- [ ] Identify the last stable checkpoint commit hash (check `replit.md` or git log)
- [ ] In Replit: open the project → Checkpoints → select the stable checkpoint → "Restore"
- [ ] Wait for the deployment health check to pass (green status in Replit dashboard)
- [ ] Verify `GET /api/metrics` responds with HTTP 200:
  ```bash
  curl -sf -H "X-Metrics-Secret: $METRICS_SECRET" https://pro-fitness-ai.replit.app/api/metrics | node -e "let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>console.log('uptime:', JSON.parse(d).uptimeSecs))"
  ```
- [ ] Run `bash scripts/health-summary.sh https://pro-fitness-ai.replit.app` and confirm no 5xx errors

---

### Step 3 — Roll Back the Mobile Build

- [ ] Log in to [App Store Connect](https://appstoreconnect.apple.com) → TestFlight → Pro Fitness AI
- [ ] Locate the last known-good build (check build number in `artifacts/mobile/app.json` git history)
- [ ] Under that build → "Stop Testing" the broken build to prevent new installs
- [ ] Re-enable the previous build for testing
- [ ] Post updated TestFlight link if testers need to manually reinstall

---

### Step 4 — Validate the Rollback

- [ ] Fresh install on a clean device (or simulator) from the restored TestFlight build
- [ ] Complete TASK-01 through TASK-03 from the test script above
- [ ] Confirm the P0 symptom is gone
- [ ] Run smoke test suite against the restored API:
  ```bash
  cd artifacts/api-server && pnpm test
  ```
  Expected: **264/264 tests pass**

---

### Step 5 — Database Considerations

The DB schema is append-only (additive migrations only). Rolling back the API does not require a schema rollback unless the new migration added columns that the old API code errors on.

- [ ] Check the migration history: `cd lib/db && pnpm push --dry-run` (on the restored commit)
- [ ] If columns added by the failed release need removal, schedule a separate migration window — **do not drop columns during a live rollback**
- [ ] If a new table was added (e.g. `user_feedback`), it is safe to leave in place — old API ignores unknown tables

---

### Step 6 — Post-Mortem

- [ ] Document the incident in `docs/` with timeline, root cause, and fix
- [ ] Add a new risk entry in `MVP_VERIFICATION_REPORT.md` if a systemic gap was exposed
- [ ] Update this playbook if the rollback revealed a gap in the process

---

## 5. Known Limitations

These are accepted limitations for the April beta. Each is tracked in the risk register (`MVP_VERIFICATION_REPORT.md § 8`). None are P0/P1 at current scale.

### L01 — Weekly Insight Notification Fires Daily (R03)

**What happens**: Selecting "Weekly" frequency for Insight Digest schedules a `daily` OS-level notification trigger. The user receives a daily push notification regardless of their "Weekly" selection.  
**Impact**: Annoying for users who chose weekly; may increase notification dismissal rates.  
**Workaround**: Users can select "Off" to suppress notifications entirely.  
**Fix target**: Before GA. Requires a weekly-cadence trigger in `notifications.ts`.

---

### L02 — No Rate Limiting on Feedback Endpoint (R07)

**What happens**: `POST /api/feedback` accepts unlimited requests from any authenticated user. A determined tester could flood the `user_feedback` table.  
**Impact**: DB storage; no security risk (requires valid session).  
**Workaround**: Monitor row count; manually purge if spam is detected.  
**Fix target**: Before public launch. Add per-user rate limit (10 req/min).

---

### L03 — No Integration Test for Feedback Submission (R09)

**What happens**: `POST /api/feedback` is only verified by code review and the smoke test. There is no dedicated integration test with auth mock.  
**Impact**: Regressions in the feedback flow may not be caught by CI.  
**Workaround**: Smoke test SMOKE-6 covers the happy path at the HTTP level.  
**Fix target**: Before GA.

---

### L04 — Parser Confidence Float Precision (R08)

**What happens**: `parserConfidence` is stored as `real` (4-byte float) in Postgres. A value of `0.65` may read back as `0.6500000059604645`. The UI threshold check (`< 0.65`) is performed on the raw float and may behave inconsistently on the boundary.  
**Impact**: A workout parsed at exactly 0.65 confidence may or may not trigger the low-confidence review gate depending on floating-point rounding.  
**Workaround**: Threshold is `< 0.65` (strict less-than), so boundary cases display the normal submit button. Acceptable for beta.  
**Fix target**: Before GA. Change column type to `numeric(4,3)`.

---

### L05 — Telemetry Event Names Were Renamed (R06)

**What happens**: `recommendation_shown` and `recommendation_accepted/overridden` events were renamed to `readiness_recommendation_*` in commit `156e358`. Any analytics pipeline or dashboard consuming the old event names will see a gap from that commit forward.  
**Impact**: Data continuity break for any downstream analytics. No user-facing impact.  
**Workaround**: If a pipeline exists, update it to consume the new event names. If no pipeline is wired yet (beta phase), no action needed.  
**Fix target**: Coordinate with analytics before GA store submission.

---

### L06 — Mid-Review State Not Persisted (R04)

**What happens**: If the app is backgrounded while the low-confidence review sheet is open and iOS terminates the process, the review sheet state is lost. The user returns to the import form (not the review sheet).  
**Impact**: User must re-open the review sheet on next launch. Edits made in the sheet before backgrounding are lost.  
**Workaround**: Save or cancel the review before switching apps.  
**Fix target**: Next sprint if user research shows meaningful drop-off.

---

### L07 — No Real-Time Progress Indicator for AI Calls

**What happens**: Workout generation (`POST /api/workout/generate`) and image analysis can take 5–15 seconds. The UI shows a loading state, but there is no streaming progress or estimated wait time.  
**Impact**: Users may assume the app has frozen and tap away.  
**Workaround**: Copy on the loading screen reads "Building your workout…" but does not communicate time.  
**Fix target**: Next sprint. Consider skeleton UI or a "this usually takes ~10 seconds" note.

---

### L08 — `FEEDBACK_EMAIL` Not Set Alerts to Console Only (R01)

**What happens**: If the `FEEDBACK_EMAIL` environment variable is not set in production, submitted feedback is saved to the `user_feedback` table, but no email notification is sent to the team. The server logs `"FEEDBACK_EMAIL env var not set"`.  
**Impact**: Feedback goes unread unless someone queries the DB directly.  
**Workaround**: Set `FEEDBACK_EMAIL` before beta launch (see Go/No-Go checklist item ENV-3).

---

### L09 — Metrics Store Resets on Server Restart

**What happens**: All counters in `GET /api/metrics` are in-process memory. A server restart (Replit deployment, crash recovery) resets all counters to zero.  
**Impact**: Metrics cannot provide lifetime totals across restarts. Latency percentiles are computed from the last 200 samples per endpoint only.  
**Workaround**: Structured `[metrics]` JSON events are emitted to stdout on every AI call, fallback, and latency record. Deployment logs capture the full history.  
**Fix target**: Before GA if durable metrics are needed. Consider writing periodic snapshots to the DB.

---

## 6. Go / No-Go Checklist — April Beta Cut

**Decision meeting**: Schedule for the week before invitations go out.  
**Owner**: One person signs off on each section. All items must be checked before invites are sent.

---

### AUTH — Authentication & Security

- [ ] **AUTH-1**: `bash scripts/auth-release-check.sh` exits 0 (currently in failed state — R10, must be cleared)
- [ ] **AUTH-2**: `POST /auth/signin` returns 401 on invalid credentials, 200 + session cookie on valid Google OAuth
- [ ] **AUTH-3**: All protected endpoints return 401 without a valid session (verified by smoke test SMOKE-1)
- [ ] **AUTH-4**: No auth tokens or session secrets appear in client-side JS bundles or API responses
- [ ] **AUTH-5**: `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set and correct in the production environment

---

### ENV — Environment Variables

- [ ] **ENV-1**: `METRICS_SECRET` is set to a strong random value (not `"dev-metrics-secret"`) in production
- [ ] **ENV-2**: `DATABASE_URL` points to the production DB (not a dev or staging instance)
- [ ] **ENV-3**: `FEEDBACK_EMAIL` is set to the team inbox that will monitor beta feedback
- [ ] **ENV-4**: `EXPO_PUBLIC_DOMAIN` is set to `pro-fitness-ai.replit.app` in the mobile build
- [ ] **ENV-5**: `PRODUCTION_ORIGIN` is set to `https://pro-fitness-ai.replit.app` in the API config

---

### BUILD — Mobile Build

- [ ] **BUILD-1**: `buildNumber` in `artifacts/mobile/app.json` has been incremented (current: 15 → bump to 16 before submission)
- [ ] **BUILD-2**: EAS build completes without errors on the `production` profile
- [ ] **BUILD-3**: TestFlight build passes Apple's automated review checks (no rejections)
- [ ] **BUILD-4**: App installs cleanly on a fresh device (no prior install) from TestFlight
- [ ] **BUILD-5**: Bundle ID `app.replit.profitnessai` matches the provisioning profile and App Store Connect entry

---

### API — Server Health

- [ ] **API-1**: `GET /api/metrics` returns HTTP 200 with a valid JSON snapshot from `https://pro-fitness-ai.replit.app/api/metrics`
- [ ] **API-2**: `bash scripts/health-summary.sh https://pro-fitness-ai.replit.app` shows 0 errors and uptime > 60 seconds
- [ ] **API-3**: `POST /api/workout/generate` succeeds end-to-end with a real user account (not a smoke test account)
- [ ] **API-4**: `POST /api/checkins` succeeds end-to-end with a real user account
- [ ] **API-5**: `POST /api/feedback` stores a row in the `user_feedback` table and the `FEEDBACK_EMAIL` notification fires

---

### TEST — Test Coverage

- [ ] **TEST-1**: Full test suite passes: `cd artifacts/api-server && pnpm test` → **264/264 tests, 0 failures**
- [ ] **TEST-2**: All 7 smoke test groups (SMOKE-1 through SMOKE-7) pass against the production API
- [ ] **TEST-3**: Manual walkthrough of TASK-01 through TASK-07 completed on a physical iOS device with a real Google account

---

### DB — Database

- [ ] **DB-1**: `user_feedback` table exists and has the correct schema (`id`, `user_id`, `message`, `created_at`)
- [ ] **DB-2**: No pending schema migrations are outstanding (`cd lib/db && pnpm push` reports nothing to do)
- [ ] **DB-3**: A production DB backup exists and the restore procedure has been tested within the last 30 days

---

### MONITOR — Observability

- [ ] **MON-1**: `METRICS_SECRET` is documented in the team's secrets manager (not just in the Replit env)
- [ ] **MON-2**: `bash scripts/health-summary.sh` is scheduled to run daily (cron or manual) and output is reviewed
- [ ] **MON-3**: Deployment log alerts are configured for `[metrics] event: "ai_fallback"` patterns
- [ ] **MON-4**: Someone on the team has access to the production DB to query `user_feedback` and diagnose live issues

---

### LEGAL / COMMS

- [ ] **LEGAL-1**: Beta testers have agreed to a non-disclosure agreement or the beta is explicitly "friends and family" with implicit NDA
- [ ] **LEGAL-2**: App Store listing is marked "Not for Sale" or hidden — beta testers access via TestFlight only
- [ ] **LEGAL-3**: Privacy policy URL is set in App Store Connect (required for TestFlight external testing)
- [ ] **COMMS-1**: A Slack / Discord / group channel is set up for beta testers to report issues
- [ ] **COMMS-2**: An expected response time for bug reports has been communicated to testers (recommend: P0 same day, P1 48h, P2 next sprint)

---

### Final Sign-Off

| Area | Owner | Signed off | Date |
|------|-------|-----------|------|
| AUTH | | | |
| ENV | | | |
| BUILD | | | |
| API | | | |
| TEST | | | |
| DB | | | |
| MONITOR | | | |
| LEGAL / COMMS | | | |

**Go / No-Go decision**: `[ ] GO` `[ ] NO-GO`

**Decision rationale** (required if NO-GO):

> _________________

**Minimum bar to flip to GO** (list blocking items):

> _________________

---

*This document should be reviewed and updated after the beta period closes. Carry forward any confirmed bugs that were not fixed into the GA readiness checklist.*

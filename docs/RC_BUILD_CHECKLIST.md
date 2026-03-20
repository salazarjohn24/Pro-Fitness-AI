# Pro Fitness AI — RC Build Checklist

**RC target**: Build 16 · Version 1.0.0 · April 2026 closed beta  
**Bundle ID**: `app.replit.profitnessai` · **ASC App ID**: `6760667643`  
**Canonical domain**: `pro-fitness-ai.replit.app`  

Run every step in order. Do not submit to TestFlight until all boxes are checked.  
All commands run from the **repo root** unless noted otherwise.

---

## Phase 0 — Prerequisites

Before starting, confirm you have:

- [ ] **Replit project access** — you can open the workspace
- [ ] **App Store Connect access** — `appstoreconnect.apple.com` with Admin or App Manager role
- [ ] **EAS CLI authenticated** — `eas whoami` returns the correct Apple Developer account
- [ ] **Git working tree is clean** — `git status` shows no uncommitted changes (the buildNumber bump must be committed before the auth-release-check build-number diff check passes)

```bash
git status
# Expected: nothing to commit, working tree clean
```

---

## Phase 1 — Verify Canonical Domain & Environment Variables

### 1a. Mobile build env — `eas.json`

```bash
node -e "const e=require('./artifacts/mobile/eas.json').build.production.env; console.table(e)"
```

**Expected output:**
```
┌──────────────────────┬────────────────────────────────────┐
│ (index)              │ Values                             │
├──────────────────────┼────────────────────────────────────┤
│ EXPO_PUBLIC_DOMAIN   │ 'pro-fitness-ai.replit.app'        │
└──────────────────────┴────────────────────────────────────┘
```

If `EXPO_PUBLIC_DOMAIN` is wrong or missing:
```bash
# Fix: open artifacts/mobile/eas.json and set:
# "env": { "EXPO_PUBLIC_DOMAIN": "pro-fitness-ai.replit.app" }
```

---

### 1b. iOS bundle identifier & ASC App ID — `app.json` + `eas.json`

```bash
node -e "
const app = require('./artifacts/mobile/app.json').expo;
const eas = require('./artifacts/mobile/eas.json').submit.production.ios;
console.log('bundleIdentifier:', app.ios.bundleIdentifier);
console.log('ascAppId:        ', eas.ascAppId);
console.log('EAS projectId:   ', app.extra.eas.projectId);
"
```

**Expected output:**
```
bundleIdentifier:  app.replit.profitnessai
ascAppId:          6760667643
EAS projectId:     3f93f71c-bfa3-43b3-96c5-070d97b2ce4e
```

---

### 1c. Server-side secrets — verify set in Replit environment

These cannot be read programmatically (they are write-only secrets). Confirm visually in the Replit Secrets panel, or probe the deployed API for the observable side-effects listed below.

| Secret | How to confirm it is set |
|--------|--------------------------|
| `GOOGLE_CLIENT_ID` | Phase 3 auth check → `302 → accounts.google.com` passes |
| `GOOGLE_CLIENT_SECRET` | Phase 3 auth check → `302 → accounts.google.com` passes |
| `METRICS_SECRET` | Phase 4 health check → `/api/metrics` returns `200` |
| `FEEDBACK_EMAIL` | Submit feedback in-app → check server logs for `Feedback received` entry |
| `DATABASE_URL` | Phase 4 health check → `{"status":"ok"}` (DB query succeeds) |
| `PRODUCTION_ORIGIN` | Phase 3 auth check → callback URL matches production domain |

**`METRICS_SECRET` must not be the dev default.** Verify it differs from `"dev-metrics-secret"`:

```bash
# This should return 401, not 200
curl -s -o /dev/null -w "%{http_code}" \
  -H "X-Metrics-Secret: dev-metrics-secret" \
  https://pro-fitness-ai.replit.app/api/metrics
# Expected: 401   ← confirms strong secret is set in production
# If 200: the dev default secret is still active — rotate METRICS_SECRET immediately
```

---

## Phase 2 — Bump iOS Build Number

**Current RC build number: 16**  
(Bumped from 15 as part of this RC preparation. Already committed.)

Verify the file and the last commit reflect the bump:

```bash
node -e "console.log('buildNumber:', require('./artifacts/mobile/app.json').expo.ios.buildNumber)"
# Expected: buildNumber: 16

git log --oneline -3
# Most recent commit should include the buildNumber bump
```

**Rule**: `buildNumber` must be a strictly greater integer than the last TestFlight build Apple has on record. Never reuse a build number — Apple rejects duplicates silently.

For any subsequent RC attempt in the same sprint, bump again before building:

```bash
# If you need to re-build after a failed EAS build:
# Edit artifacts/mobile/app.json → ios.buildNumber → increment by 1
# Commit: git add artifacts/mobile/app.json && git commit -m "chore: bump iOS buildNumber to <N>"
```

---

## Phase 3 — Run Auth Release Gate

This is the authoritative pre-submit gate. It must exit 0.

```bash
bash scripts/auth-release-check.sh
```

**Expected output (all 4 checks must be ✅):**
```
╔══════════════════════════════════════════════════════════╗
║         Pro Fitness AI — Auth Release Check              ║
╚══════════════════════════════════════════════════════════╝

[1/4] EXPO_PUBLIC_DOMAIN in eas.json
      ✅ PASS  EXPO_PUBLIC_DOMAIN=pro-fitness-ai.replit.app

[2/4] iOS buildNumber in app.json
      Current buildNumber : 16
      Previous buildNumber: 15
      ✅ PASS  buildNumber incremented (15 → 16)

[3/4] GET https://pro-fitness-ai.replit.app/api/healthz
      ✅ PASS  HTTP 200 — {"status":"ok"}

[4/4] GET https://pro-fitness-ai.replit.app/api/auth/social/google
      ✅ PASS  HTTP 302 → accounts.google.com
      ✅ PASS  Callback domain matches pro-fitness-ai.replit.app
             redirect_uri: https://pro-fitness-ai.replit.app/api/auth/social/google/callback

══════════════════════════════════════════════════════════
  ✅  ALL CHECKS PASSED — safe to build and submit to TestFlight
      Build number: 16
      Domain:       pro-fitness-ai.replit.app
══════════════════════════════════════════════════════════
```

**Exit code must be 0:**
```bash
echo $?
# Expected: 0
```

### If a check fails:

| Failing check | Likely cause | Fix |
|--------------|-------------|-----|
| [1/4] `EXPO_PUBLIC_DOMAIN` | Wrong value in `eas.json` | Edit `artifacts/mobile/eas.json` → `build.production.env.EXPO_PUBLIC_DOMAIN` |
| [2/4] `buildNumber` not incremented | Forgot to bump or didn't commit | Edit `app.json`, increment, commit |
| [3/4] `/api/healthz` not 200 | Production deployment is down | Check Replit deployment status; redeploy |
| [4/4] Google OAuth not 302 | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` not set, or OIDC config pointing at wrong domain | Check secrets in Replit panel; verify `PRODUCTION_ORIGIN` |

Do not proceed past this point if any check shows ❌.

---

## Phase 4 — Run Full Test Suite

Run against the local API server (not production). This catches regressions before the EAS build.

```bash
cd artifacts/api-server && pnpm test
```

**Expected output:**
```
 RUN  v4.1.0 /home/runner/workspace/artifacts/api-server

 Test Files  7 passed (7)
      Tests  264 passed (264)
   Start at  HH:MM:SS
   Duration  ~4s
```

**Any failure here is a ship blocker.** Do not proceed until `264 passed (264)` is shown.

To see which specific tests are failing if the count is wrong:
```bash
cd artifacts/api-server && pnpm test -- --reporter=verbose 2>&1 | grep -E "FAIL|✕|×"
```

---

## Phase 5 — Production Health Check

Verify the deployed API is alive, accepting requests, and metrics are flowing.

### 5a. Healthz

```bash
curl -s https://pro-fitness-ai.replit.app/api/healthz
```

**Expected:**
```json
{"status":"ok"}
```

### 5b. Metrics snapshot (use your production `METRICS_SECRET`)

```bash
curl -s \
  -H "X-Metrics-Secret: $METRICS_SECRET" \
  https://pro-fitness-ai.replit.app/api/metrics \
  | node -e "
    let d=''; process.stdin.on('data',c=>d+=c).on('end',()=>{
      const j=JSON.parse(d);
      console.log('uptime (s):    ', j.uptimeSecs);
      console.log('requests total:', j.requestsTotal);
      console.log('errors 5xx:    ', j.errors5xx);
      console.log('auth failures: ', j.authFailuresTotal);
      console.log('AI calls:      ', j.aiCallsTotal);
      console.log('AI fallbacks:  ', j.aiFallbacksTotal);
    });
  "
```

**Expected (values will vary; watch for red flags):**
```
uptime (s):     <positive number>
requests total: <any>
errors 5xx:     0          ← must be 0 on a freshly deployed server
auth failures:  0          ← must be 0 before any real users hit it
AI calls:       0          ← 0 until real users trigger AI
AI fallbacks:   0          ← must be 0
```

If `errors 5xx > 0` on a fresh deployment, check deployment logs before proceeding.

### 5c. Full health summary

```bash
METRICS_SECRET=$METRICS_SECRET bash scripts/health-summary.sh https://pro-fitness-ai.replit.app
```

**Expected (abbreviated):**
```
=== Pro Fitness AI — Health Summary ===
  Endpoint : https://pro-fitness-ai.replit.app/api/metrics
  Timestamp: <ISO-8601>

── Overview ──────────────────────────────────────────────────────────
  Uptime             : <N>s  (started <ISO timestamp>)
  Requests total     : <any>
  Errors (4xx/5xx)   : 0 / 0
  Auth failures (401): 0
  AI calls           : 0
  AI fallbacks       : 0
...
Done.
```

---

## Phase 6 — Verify Submit Profile & ASC Configuration

### 6a. Confirm `eas.json` submit profile

```bash
node -e "
const s = require('./artifacts/mobile/eas.json').submit.production.ios;
console.log('ascAppId:', s.ascAppId);
"
```

**Expected:**
```
ascAppId: 6760667643
```

### 6b. Confirm in App Store Connect

1. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. Select **Pro Fitness AI** (App ID `6760667643`)
3. Confirm:
   - [ ] App status is **"Prepare for Submission"** or equivalent (not "Ready for Sale" — beta only)
   - [ ] **Bundle ID** matches `app.replit.profitnessai`
   - [ ] **TestFlight** → External Testing → your tester group exists
   - [ ] **Privacy Policy URL** is set (required for external TestFlight testers)
   - [ ] **Export Compliance** — `ITSAppUsesNonExemptEncryption: false` is set in `app.json` (already present ✓ — no annual export compliance form needed)

### 6c. Confirm EAS credentials are valid

```bash
cd artifacts/mobile && eas credentials --platform ios
```

This lists the provisioning profile and distribution certificate attached to this bundle ID. Confirm:
- [ ] Distribution certificate is not expired
- [ ] Provisioning profile type is **App Store Distribution** (not AdHoc)
- [ ] Profile is not expired

---

## Phase 7 — EAS Build + Submit

**Only proceed once Phases 1–6 are all green.**

### 7a. Build production IPA

```bash
cd artifacts/mobile && eas build --platform ios --profile production
```

**Watch for:**
- Build queued → building → succeeded
- Note the build UUID printed by EAS (e.g. `Build started: https://expo.dev/...`)
- **Expected duration**: 10–25 minutes depending on EAS queue

**Success indicator:**
```
✅ Build finished.
```

If the build fails:
```bash
# View build logs from EAS dashboard, or:
cd artifacts/mobile && eas build:list --platform ios --limit 1
```

### 7b. Submit to TestFlight

```bash
cd artifacts/mobile && eas submit --platform ios --profile production --latest
```

This uses `ascAppId: 6760667643` from `eas.json` automatically.

**Expected:**
```
✅ Submission finished.
```

Apple processing takes 5–30 minutes. Monitor in App Store Connect → TestFlight → Builds.

### 7c. Distribute to beta testers

Once the build shows **"Ready to Test"** in TestFlight:

1. Select the build in TestFlight
2. Add it to your internal or external tester group
3. TestFlight sends an email invitation automatically

---

## Phase 8 — Release Notes for Testers

Copy the following into the TestFlight **"What to Test"** field before distributing.

---

**Build 16 — Pro Fitness AI Closed Beta**

Thank you for testing! Here's what's new in this build and what we'd love your feedback on:

**What's in this build**

- **AI Workout Builder** — Tell the app which muscles you want to hit (or let it decide based on your history) and get a personalized workout in seconds. Coach notes explain the reasoning for each exercise.

- **External Workout Import** — Logged a run, CrossFit class, or any workout outside the app? Paste a description or upload a screenshot and the app will parse and log it automatically. If the AI isn't confident in its reading, it will ask you to review before saving.

- **Daily Check-In & Recovery Insights** — Tell the app how you're feeling (sleep, soreness, energy, stress). It generates four personalized recovery tips based on what you just logged and your check-in responses.

- **Deload Recommendation** — After enough sessions, the app may suggest you take it easy. You can accept the recommendation or override it and train as planned — either way is recorded.

- **Notification Preferences** — Set how often you want Insight Digest notifications (Daily, Weekly, or Off) and what time they arrive. Find this in Profile → Notifications.

- **Feedback Button** — Tell us directly from the app what you'd change. Profile → Send Feedback.

**What we'd love to know**

1. Did you trust the AI workout suggestions? Did they feel right for your training level?
2. When you imported an external workout, was the parsed result accurate?
3. Were the recovery tips relevant to what you actually did that day?
4. Was there anything you wanted to do but couldn't find?

**Known quirks in this build**

- If you set notifications to "Weekly," they will currently arrive daily. This is a known issue and will be fixed before the public release.
- The AI occasionally takes 10–15 seconds to generate a workout. If the screen looks frozen, it's still thinking — please wait.

**How to report bugs**

Post in the beta tester channel with: your device model, iOS version, what you were doing, and what happened. A screenshot or screen recording is very helpful.

---

## RC Sign-Off

Complete this table before distributing to testers. All items must be checked.

| Phase | Check | Owner | Passed | Date |
|-------|-------|-------|--------|------|
| 1a | `EXPO_PUBLIC_DOMAIN` correct in `eas.json` | | | |
| 1b | `bundleIdentifier` + `ascAppId` confirmed | | | |
| 1c | All server secrets set in production | | | |
| 2 | `buildNumber` = 16, committed | | | |
| 3 | `auth-release-check.sh` exits 0 (all 4 ✅) | | | |
| 4 | Test suite: 264/264 passed | | | |
| 5a | `/api/healthz` → `{"status":"ok"}` | | | |
| 5b | Metrics snapshot: `errors5xx = 0`, `aiFallbacks = 0` | | | |
| 6a | `ascAppId: 6760667643` in `eas.json` | | | |
| 6b | ASC: bundle ID, privacy policy, tester group confirmed | | | |
| 6c | EAS cert + provisioning profile not expired | | | |
| 7a | EAS build succeeded (build UUID: ___________) | | | |
| 7b | EAS submit succeeded, build in TestFlight | | | |
| 8 | Release notes copied into TestFlight "What to Test" | | | |

**RC approved by**: ________________________  **Date**: ____________

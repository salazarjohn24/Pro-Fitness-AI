# Auth Release SOP — Pro Fitness AI

> Last updated: P0 auth safety hardening (build 18)

---

## 1. Canonical Auth Contract

| Parameter | Value | Source of Truth |
|---|---|---|
| Production domain | `pro-fitness-ai.replit.app` | `artifacts/mobile/eas.json` → `build.production.env.EXPO_PUBLIC_DOMAIN` |
| API base URL | `https://pro-fitness-ai.replit.app` | Same, prefixed with `https://` |
| Google callback URI | `https://pro-fitness-ai.replit.app/api/auth/social/google/callback` | Built dynamically by `callbackUrl()` in `socialAuth.ts` |
| Apple endpoint | `https://pro-fitness-ai.replit.app/api/auth/social/apple` (POST) | Same domain |
| Deep-link scheme | `mobile` | `artifacts/mobile/app.json` → `expo.scheme` |
| Deep-link callback | `mobile://auth-callback` | `DEEP_LINK_SCHEME` constant in `socialAuth.ts` |
| Health check path | `/api/healthz` | `artifact.toml` → `services.production.health.startup.path` |
| Session storage | PostgreSQL `sessions` table, 7-day TTL | `artifacts/api-server/src/lib/auth.ts` |
| Token transport (mobile) | `Authorization: Bearer <sid>` header | `artifacts/mobile/hooks/apiHelpers.ts` → `getAuthHeaders()` |
| App Store Connect App ID | `6760667643` | `artifacts/mobile/eas.json` → `submit.production.ios.ascAppId` |

### Registered Google OAuth redirect URIs

Both must remain registered in Google Cloud Console at all times:
- `https://pro-fitness-ai.replit.app/api/auth/social/google/callback`
- `https://salazarjohn24-workspace.replit.app/api/auth/social/google/callback`

---

## 2. P0 Security Contract (established build 18)

These invariants were hardened in the P0 auth safety sprint and must not regress.

### 2a. Session cookie attributes

All session cookies set by the API must carry all three attributes:

```
Set-Cookie: sid=<hex>; Path=/; HttpOnly; Secure; SameSite=Strict
```

**Enforced by:** `setSessionCookie()` in `artifacts/api-server/src/routes/auth.ts`.  
**Verified by:** `AUTH-1` tests in `artifacts/api-server/tests/auth.test.ts`.

Routes that set the `sid` cookie — confirm each uses `setSessionCookie()`, not an inline `res.cookie()`:
- `POST /auth/signup`
- `POST /auth/signin`
- `GET /auth/web-complete` (social/web flow)

### 2b. Rate limits on auth endpoints

| Endpoint | Limit | Window | Key |
|---|---|---|---|
| `POST /auth/signin` | 10 attempts | 15 min | IP |
| `POST /auth/signup` | 5 accounts | 60 min | IP |
| `GET /auth/social/:provider` | 20 requests | 5 min | IP |
| `POST /auth/social/apple` | 20 requests | 5 min | IP |

Rate limiters skip automatically in `NODE_ENV=test`. In production all four are active.  
**Enforced by:** `authSigninLimit`, `authSignupLimit`, `authOAuthLimit` in `rateLimitMiddleware.ts`.  
**Verified by:** `AUTH-2` tests.

### 2c. postMessage target origin

The `GET /auth/web-complete` response HTML must send postMessage to `window.location.origin`, never `'*'`.

```javascript
// CORRECT
window.opener.postMessage(payload, window.location.origin);

// FORBIDDEN — sends session token to any listening frame
window.opener.postMessage(payload, '*');
```

**Enforced by:** `socialAuth.ts` → `GET /auth/web-complete` handler.  
**Verified by:** `AUTH-3` tests.

---

## 3. Auth-Sensitive Files

Changes to any of these files require the full release checklist and explicit smoke test evidence before merge.

| File | Why it is sensitive |
|---|---|
| `artifacts/api-server/src/routes/auth.ts` | `setSessionCookie()` cookie attributes; signup/signin cookie paths; rate limiter attachment |
| `artifacts/api-server/src/routes/socialAuth.ts` | All OAuth routes; `getOrigin()` callback URL logic; postMessage target origin; Apple JWT validation |
| `artifacts/api-server/src/middlewares/rateLimitMiddleware.ts` | Auth rate limiter configs — changes affect brute-force exposure |
| `artifacts/api-server/src/middlewares/authMiddleware.ts` | Session population; token refresh; error logging |
| `artifacts/api-server/src/lib/auth.ts` | Session creation/deletion; Bearer token parsing; `SESSION_TTL` |
| `artifacts/api-server/src/app.ts` | Route mounting — dual `app.use("/api", router)` + `app.use(router)` required |
| `artifacts/api-server/.replit-artifact/artifact.toml` | `PORT`, `NODE_ENV=production`, health check path |
| `artifacts/mobile/app.json` | `scheme`, `bundleIdentifier`, `buildNumber`, `usesAppleSignIn` |
| `artifacts/mobile/eas.json` | `EXPO_PUBLIC_DOMAIN` (baked into binary), `ascAppId`, `autoIncrement` |
| `.replit` / env vars | `PRODUCTION_ORIGIN` (fallback for `getOrigin()`) |

---

## 4. Merge Gate — Auth-Sensitive PRs

Any PR touching a file from Section 3 must satisfy **all** of the following before merge.

### 4a. Automated checks

```bash
# Must exit 0 on the PR branch pointed at the production API
bash scripts/auth-release-check.sh

# Auth unit + integration suite must be fully green
cd artifacts/api-server && pnpm test
```

### 4b. Structural invariants

1. **Cookie security preserved** — `setSessionCookie()` must be used on every path that creates a session. No inline `res.cookie()` with `sameSite: "lax"` or missing `secure: true`.

2. **Rate limiters attached** — `authSigninLimit` on `POST /auth/signin`, `authSignupLimit` on `POST /auth/signup`, `authOAuthLimit` on `GET /auth/social/:provider` and `POST /auth/social/apple`.

3. **postMessage origin not wildcard** — `window.opener.postMessage(...)` in the `web-complete` HTML must use `window.location.origin`.

4. **`getOrigin()` contract preserved** — `socialAuth.ts` must:
   - Prefer `x-forwarded-host` when present and not an internal IP
   - Fall back to `PRODUCTION_ORIGIN` env var otherwise
   - Never use bare `req.headers.host` without the internal-IP guard

5. **Dual route mount preserved** — `app.ts` must keep both:
   ```typescript
   app.use("/api", router);
   app.use(router);
   ```

6. **Deep-link scheme unchanged** — `app.json` `scheme` must remain `"mobile"` and `DEEP_LINK_SCHEME` in `socialAuth.ts` must remain `"mobile://auth-callback"`.

7. **`buildNumber` incremented** — required for any PR that produces a new TestFlight binary.

8. **`EXPO_PUBLIC_DOMAIN` unchanged or explicitly approved** — baked into the binary at build time; a change requires a full TestFlight regression before promotion.

### 4c. Required smoke test evidence — Google + Apple

**Before merging any auth-sensitive PR, the author must supply evidence of both:**

**Google sign-in smoke test** — capture device log lines showing:
```
[auth-diag] provider=google  api_status=200  token_present=true
```
or a screenshot of the app reaching the authenticated home screen after Google sign-in.

**Apple sign-in smoke test** — capture device log lines showing:
```
[auth-diag] provider=apple  api_status=200  token_present=true
```
or a screenshot of the app reaching the authenticated home screen after Apple sign-in.

Both must be from a **physical iPhone** running the PR build (Simulator does not support Apple Sign In and has limited Google flow fidelity). Paste the log evidence or screenshots into the PR description.

A PR that only touches backend routes (no `app.json`, no `eas.json`) may satisfy this requirement with a `curl` trace instead of a device test:
```bash
# Google callback contract — must return 302 → accounts.google.com
curl -si -o /dev/null -w "HTTP %{http_code}\nLocation: %{redirect_url}\n" \
  https://pro-fitness-ai.replit.app/api/auth/social/google

# Apple endpoint contract — must return 400 for missing token (not 500)
curl -si -X POST https://pro-fitness-ai.replit.app/api/auth/social/apple \
  -H "Content-Type: application/json" -d '{}'
```

---

## 5. Pre-Release Checklist — Every TestFlight Build

Run the automated check first, then complete this manual checklist:

```
[ ] bash scripts/auth-release-check.sh — exits 0 (all 5 checks pass)
[ ] cd artifacts/api-server && pnpm test — all tests pass (target: 331+)
[ ] EXPO_PUBLIC_DOMAIN=pro-fitness-ai.replit.app confirmed in eas.json
[ ] ascAppId=6760667643 confirmed in eas.json submit.production.ios
[ ] PRODUCTION_ORIGIN=https://pro-fitness-ai.replit.app confirmed in env vars
[ ] iOS buildNumber in app.json is HIGHER than the last submitted TestFlight build
[ ] Deep-link scheme in app.json is still "mobile"
[ ] Google callback URI registered in Google Cloud Console:
      https://pro-fitness-ai.replit.app/api/auth/social/google/callback
[ ] api-server rebuilt and deployed: pnpm --filter @workspace/api-server run build
[ ] Google sign-in smoke-tested on device — log shows token_present=true
[ ] Apple sign-in smoke-tested on device — log shows token_present=true
[ ] No GITHUB_CLIENT_ID / TWITTER_CLIENT_ID changes (providers not configured)
```

---

## 6. Pre-Release Verification Script

File: `scripts/auth-release-check.sh`  
Run before every release:

```bash
bash scripts/auth-release-check.sh
```

**Checks performed (5 total):**

| # | Check | Pass condition |
|---|---|---|
| 1 | `EXPO_PUBLIC_DOMAIN` in `eas.json` | Equals `pro-fitness-ai.replit.app` |
| 2 | `ascAppId` in `eas.json` submit profile | Equals `6760667643` |
| 3 | iOS `buildNumber` in `app.json` | Strictly greater than previous git commit |
| 4 | `GET /api/healthz` | HTTP 200 |
| 5 | `GET /api/auth/social/google` | HTTP 302 → `accounts.google.com` with `redirect_uri` on canonical domain |

**Sample PASS output:**

```
╔══════════════════════════════════════════════════════════╗
║         Pro Fitness AI — Auth Release Check              ║
╚══════════════════════════════════════════════════════════╝

[1/5] EXPO_PUBLIC_DOMAIN in eas.json
      ✅ PASS  EXPO_PUBLIC_DOMAIN=pro-fitness-ai.replit.app

[2/5] ascAppId in eas.json submit profile
      ✅ PASS  ascAppId=6760667643

[3/5] iOS buildNumber in app.json
      Current buildNumber : 18
      Previous buildNumber: 17
      ✅ PASS  buildNumber incremented (17 → 18)

[4/5] GET https://pro-fitness-ai.replit.app/api/healthz
      ✅ PASS  HTTP 200 — {"status":"ok"}

[5/5] GET https://pro-fitness-ai.replit.app/api/auth/social/google
      ✅ PASS  HTTP 302 → accounts.google.com
      ✅ PASS  Callback domain matches pro-fitness-ai.replit.app
             redirect_uri: https://pro-fitness-ai.replit.app/api/auth/social/google/callback

══════════════════════════════════════════════════════════
  ✅  ALL CHECKS PASSED — safe to build and submit to TestFlight
      Build number: 18
      Domain:       pro-fitness-ai.replit.app
      ascAppId:     6760667643
══════════════════════════════════════════════════════════
```

Exit 0 = all pass. Exit 1 = one or more failures; each failure prints the fix.

---

## 7. Incident Playbook — Auth Failures in Production

### Symptom: `/api/healthz` returns 404 or 503

**Probable causes:**
1. Production dist is stale.  
   Fix: `pnpm --filter @workspace/api-server run build`, then redeploy.
2. `app.use("/api", router)` mount removed from `app.ts`.  
   Fix: Restore dual mount, rebuild, redeploy.
3. API server crashed at startup.  
   Fix: Check deployment logs in Replit dashboard → Deployments → Logs.

### Symptom: Google sign-in opens browser, returns `cancel` or never returns `success`

**Probable causes:**
1. `EXPO_PUBLIC_DOMAIN` baked into the binary points to the wrong domain.  
   Fix: Correct `eas.json`, increment `buildNumber`, rebuild and resubmit.
2. Google callback redirect URI not registered in Google Cloud Console.  
   Fix: Add `https://pro-fitness-ai.replit.app/api/auth/social/google/callback`.
3. `getOrigin()` generating wrong callback URL.  
   Fix: Check `[auth-diag]` device logs for `callback_scheme` and `redirect_uri` values.

### Symptom: Google sign-in returns `success` but `token_present=false`

**Probable causes:**
1. Backend failed to exchange the authorization code.  
   Fix: Check production deployment logs for the `/api/auth/social/google/callback` handler.
2. `GOOGLE_CLIENT_SECRET` not set in production.  
   Fix: Verify secret via Replit Secrets panel.
3. State token expired (server restarted mid-flow).  
   Fix: Retry sign-in.

### Symptom: Apple sign-in shows `api_status=401` or `api_status=500`

**Probable causes:**
1. Apple identity token validation failing (clock skew, wrong audience).  
   Fix: Check `[auth-diag] provider=apple api_error_body=` in device logs for the exact error.
2. `apiBase` empty — `EXPO_PUBLIC_DOMAIN` not baked into the binary.  
   Fix: Check `[auth-diag] module_init EXPO_PUBLIC_DOMAIN=` log line on device startup.

### Symptom: User gets 429 on sign-in (unexpected rate limit)

**Probable causes:**
1. Single IP hitting the limit legitimately (shared NAT / corporate proxy).  
   Current limit: 10 attempts / 15 minutes / IP.  
   Fix: Wait 15 minutes; rate limit window resets automatically.
2. Rate limit misconfigured or accidentally lowered.  
   Fix: Check `authSigninLimit` in `rateLimitMiddleware.ts` — `max` must be 10, `windowMs` must be 900000.

### Symptom: Auth works in dev but fails in TestFlight

**First three things to check:**
1. Run `scripts/auth-release-check.sh` — confirms production API reachable and configured.
2. Check device logs for `[auth-diag] module_init EXPO_PUBLIC_DOMAIN=` — must be `pro-fitness-ai.replit.app`.
3. Confirm the TestFlight build number matches `app.json` — if different, wrong binary was submitted.

### Emergency rollback

1. Replit dashboard → Deployments → revert to previous deployment.
2. App Store Connect → remove broken build from TestFlight testing.
3. Previous build (N-1) remains available; testers can downgrade manually.
4. Fix root cause, increment `buildNumber`, rerun `scripts/auth-release-check.sh`, rebuild.

---

## 8. Key Commands Reference

```bash
# Run pre-release check (5 automated gates)
bash scripts/auth-release-check.sh

# Run auth + full API test suite
cd artifacts/api-server && pnpm test

# Rebuild api-server dist
pnpm --filter @workspace/api-server run build

# Build + submit TestFlight binary (requires: npx eas login first)
cd artifacts/mobile
npx eas build --platform ios --profile production --non-interactive
npx eas submit --platform ios --latest --non-interactive

# Check EAS build status
npx eas build:list --platform ios --limit 5

# Submit a specific finished build
npx eas submit --platform ios --id <BUILD_ID>

# Live smoke tests (production)
curl -si https://pro-fitness-ai.replit.app/api/healthz

curl -si -o /dev/null -w "HTTP %{http_code}\nLocation: %{redirect_url}\n" \
  https://pro-fitness-ai.replit.app/api/auth/social/google

# Apple endpoint contract check (must return 400, not 500)
curl -si -X POST https://pro-fitness-ai.replit.app/api/auth/social/apple \
  -H "Content-Type: application/json" -d '{}'

# Verify session cookie flags on signin (look for Secure; HttpOnly; SameSite=Strict)
curl -si -X POST https://pro-fitness-ai.replit.app/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"identifier":"test@example.com","password":"wrongpassword"}' \
  | grep -i set-cookie
```

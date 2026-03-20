# Auth Release SOP — Pro Fitness AI

## 1. Canonical Auth Contract

| Parameter | Value | Source of Truth |
|---|---|---|
| Production domain | `pro-fitness-ai.replit.app` | `artifacts/mobile/eas.json` → `build.production.env.EXPO_PUBLIC_DOMAIN` |
| API base URL | `https://pro-fitness-ai.replit.app` | Same as above, prefixed with `https://` |
| Google callback URI | `https://pro-fitness-ai.replit.app/api/auth/social/google/callback` | Dynamically built by `callbackUrl()` in `socialAuth.ts` |
| Apple endpoint | `https://pro-fitness-ai.replit.app/api/auth/social/apple` (POST) | Same domain |
| Deep-link scheme | `mobile` | `artifacts/mobile/app.json` → `expo.scheme` |
| Deep-link callback | `mobile://auth-callback` | `artifacts/mobile/lib/auth.tsx` → `loginWithSocial()` |
| Health check path | `/api/healthz` | `artifacts/api-server/.replit-artifact/artifact.toml` → `services.production.health.startup.path` |
| Session storage | PostgreSQL `sessions` table, 7-day TTL | `artifacts/api-server/src/lib/auth.ts` |
| Token transport (mobile) | `Authorization: Bearer <token>` header | `artifacts/mobile/lib/auth.tsx` → `fetchUser()` |

### Registered Google OAuth redirect URIs
Both of these must remain registered in Google Cloud Console at all times:
- `https://pro-fitness-ai.replit.app/api/auth/social/google/callback`
- `https://salazarjohn24-workspace.replit.app/api/auth/social/google/callback`

---

## 2. Auth-Sensitive Files

Changes to any of the following files require the full pre-release checklist and an additional manual OAuth flow test before merge.

| File | Why it is sensitive |
|---|---|
| `artifacts/api-server/src/routes/socialAuth.ts` | All OAuth routes, `getOrigin()` callback URL logic, `PRODUCTION_ORIGIN_FALLBACK` |
| `artifacts/api-server/src/lib/auth.ts` | Session creation, token issuance, Bearer token validation |
| `artifacts/api-server/src/app.ts` | Route mounting — dual `app.use("/api", router)` + `app.use(router)` required |
| `artifacts/api-server/.replit-artifact/artifact.toml` | `PORT`, `NODE_ENV=production`, health check path, production run command |
| `artifacts/mobile/lib/auth.tsx` | `getApiBaseUrl()`, `loginWithSocial()`, `loginWithApple()`, deep-link handling |
| `artifacts/mobile/app.json` | `scheme`, `bundleIdentifier`, `buildNumber`, `usesAppleSignIn` |
| `artifacts/mobile/eas.json` | `EXPO_PUBLIC_DOMAIN` (baked into binary), `ascAppId`, `autoIncrement` |
| `.replit` / env vars | `PRODUCTION_ORIGIN` (shared env var, fallback for `getOrigin()`) |

---

## 3. Pre-Release Checklist — Every TestFlight Build

Run the automated check first (see Section 5), then complete this manual checklist:

```
[ ] scripts/auth-release-check.sh passes with zero failures
[ ] EXPO_PUBLIC_DOMAIN=pro-fitness-ai.replit.app confirmed in eas.json
[ ] PRODUCTION_ORIGIN=https://pro-fitness-ai.replit.app confirmed in env vars
[ ] iOS buildNumber in app.json is HIGHER than the last submitted TestFlight build
[ ] Deep-link scheme in app.json is still "mobile"
[ ] Google callback URI registered: https://pro-fitness-ai.replit.app/api/auth/social/google/callback
[ ] api-server dist rebuilt: pnpm --filter @workspace/api-server run build
[ ] api-server dist manually smoke-tested: curl https://pro-fitness-ai.replit.app/api/healthz → 200
[ ] Google OAuth smoke-tested: curl https://pro-fitness-ai.replit.app/api/auth/social/google → 302 to accounts.google.com
[ ] ascAppId=6760667643 confirmed in eas.json submit.production.ios
[ ] No GITHUB_CLIENT_ID / TWITTER_CLIENT_ID changes (these OAuth providers are not configured)
```

---

## 4. Merge Gate Requirements for Auth-Sensitive PRs

Any PR that modifies a file listed in Section 2 must satisfy all of the following before merge:

1. **Automated check passes** — `scripts/auth-release-check.sh` exits 0 on the PR branch against the production API.

2. **`getOrigin()` contract preserved** — `socialAuth.ts` must still:
   - Prefer `x-forwarded-host` when it is present and not an internal IP
   - Fall back to `PRODUCTION_ORIGIN` env var when `x-forwarded-host` is absent or internal (`127.x`, `10.x`, `172.16–31.x`, `192.168.x`, `localhost`)
   - Never fall back to a bare `req.headers.host` without the internal-IP guard

3. **Dual route mount preserved** — `app.ts` must keep both:
   ```typescript
   app.use("/api", router);
   app.use(router);
   ```
   Removing either mount breaks either the Replit router path or the health check startup path.

4. **Deep-link scheme unchanged** — `app.json` `scheme` must remain `"mobile"` and `loginWithSocial()` redirect must remain `"mobile://auth-callback"`.

5. **`buildNumber` incremented** — any PR that will produce a new TestFlight binary must increment `ios.buildNumber` in `app.json`. Apple rejects duplicate build numbers.

6. **`EXPO_PUBLIC_DOMAIN` unchanged or explicitly approved** — this value is baked into the binary at EAS build time. A change requires a full TestFlight regression test before the build is promoted to production.

7. **Manual device test** — at least one successful Google or Apple sign-in on a physical iPhone running the new binary before promoting to external TestFlight.

---

## 5. Pre-Release Verification Script

File: `scripts/auth-release-check.sh`

Run before every release:
```bash
bash scripts/auth-release-check.sh
```

The script checks all four automated gates. Exit 0 = all pass. Exit 1 = one or more failures; output identifies which check failed and why.

---

## 6. Incident Playbook — Auth Failures in Production

### Symptom: `/api/healthz` returns 404

**Probable causes (in order):**
1. Production dist is stale — the compiled `dist/index.cjs` does not include the current route changes.
   - Fix: `pnpm --filter @workspace/api-server run build`, then redeploy.
2. `app.use("/api", router)` mount removed from `app.ts`.
   - Fix: Restore dual mount, rebuild, redeploy.
3. API server not deployed / crashed at startup.
   - Fix: Check deployment logs in Replit dashboard → Deployments → Logs.

### Symptom: Google sign-in opens browser then returns `cancel` or `dismiss` (never `success`)

**Probable causes:**
1. `EXPO_PUBLIC_DOMAIN` baked into the binary points to the wrong domain (e.g., `salazarjohn24-workspace.replit.app` instead of `pro-fitness-ai.replit.app`).
   - Fix: Correct `eas.json`, increment `buildNumber`, rebuild and resubmit to TestFlight.
2. Google callback redirect URI not registered in Google Cloud Console.
   - Fix: Add `https://pro-fitness-ai.replit.app/api/auth/social/google/callback` to Authorized Redirect URIs.
3. `getOrigin()` generating wrong callback URL (internal IP fallback not triggering correctly).
   - Fix: Check `[auth-diag]` device logs for `callback_scheme` and `redirect_uri` values.

### Symptom: Google sign-in returns `success` but `token_present=false`

**Probable causes:**
1. Backend failed to exchange the authorization code with Google.
   - Fix: Check production deployment logs for errors in `/api/auth/social/google/callback` handler.
2. `GOOGLE_CLIENT_SECRET` not set in production environment.
   - Fix: Verify secret is set via Replit Secrets panel.
3. State token expired (OAuth state map cleared) — rare, happens if server restarted mid-flow.
   - Fix: Retry sign-in.

### Symptom: Apple sign-in shows `api_status=401` or `api_status=500` in device logs

**Probable causes:**
1. Apple identity token validation failing — usually a clock skew or wrong audience in `jwtVerify`.
   - Fix: Check `[auth-diag] provider=apple api_error_body=` in device logs for exact error.
2. `apiBase` empty — `EXPO_PUBLIC_DOMAIN` not set in the binary.
   - Fix: Check `[auth-diag] module_init EXPO_PUBLIC_DOMAIN=` log line on device startup.

### Symptom: Auth works in dev but fails in TestFlight

**First three things to check:**
1. Run `scripts/auth-release-check.sh` — confirms production API is reachable and responding correctly.
2. Check device logs for `[auth-diag] module_init EXPO_PUBLIC_DOMAIN=` — if it shows `salazarjohn24-workspace.replit.app` or `(not set)`, the binary was built with wrong config.
3. Confirm the build number in TestFlight matches what is in `app.json` — if they differ, the wrong binary was submitted.

### Emergency rollback

1. In Replit dashboard → Deployments, revert to the previous deployment.
2. In App Store Connect, remove the broken build from TestFlight testing.
3. The previous build (build N-1) remains available in TestFlight; testers can downgrade manually.
4. Fix root cause, increment `buildNumber` again, rerun `scripts/auth-release-check.sh`, rebuild.

---

## 7. Key Commands Reference

```bash
# Run pre-release check
bash scripts/auth-release-check.sh

# Rebuild api-server dist
pnpm --filter @workspace/api-server run build

# Build + submit TestFlight binary (from Shell tab, not agent)
cd artifacts/mobile
npx eas-cli@latest build --platform ios --profile production --non-interactive --auto-submit

# Check EAS build status
npx eas-cli@latest build:list --platform ios --limit 5

# Submit a finished build manually
npx eas-cli@latest submit --platform ios --id <BUILD_ID>

# Submit the most recent finished build
npx eas-cli@latest submit --platform ios --latest

# Live smoke test (production)
curl -si https://pro-fitness-ai.replit.app/api/healthz
curl -si -o /dev/null -w "HTTP %{http_code}\nLocation: %{redirect_url}\n" \
  https://pro-fitness-ai.replit.app/api/auth/social/google
```

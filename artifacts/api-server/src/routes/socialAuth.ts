import crypto from "crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { db, usersTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { createSession } from "../lib/auth";

const router: IRouter = Router();

const DEEP_LINK_SCHEME = "mobile://auth-callback";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID;
const TWITTER_CLIENT_SECRET = process.env.TWITTER_CLIENT_SECRET;

const oauthStates = new Map<string, { provider: string; expiresAt: number }>();
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of oauthStates) {
    if (val.expiresAt < now) oauthStates.delete(key);
  }
}, 60_000);

const PRODUCTION_ORIGIN_FALLBACK = process.env.PRODUCTION_ORIGIN;

function isInternalHost(host: string): boolean {
  const h = host.split(":")[0];
  if (h === "localhost" || h === "127.0.0.1") return true;
  if (/^10\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  return false;
}

function getOrigin(req: Request): string {
  const proto = (req.headers["x-forwarded-proto"] as string | undefined) || "https";
  const forwardedHost = req.headers["x-forwarded-host"] as string | undefined;

  if (!forwardedHost || isInternalHost(forwardedHost)) {
    if (PRODUCTION_ORIGIN_FALLBACK) return PRODUCTION_ORIGIN_FALLBACK;
  }

  const host = forwardedHost || (req.headers["host"] as string | undefined) || "localhost";
  return `${proto}://${host}`;
}

function callbackUrl(req: Request, provider: string): string {
  return `${getOrigin(req)}/api/auth/social/${provider}/callback`;
}

async function upsertSocialUser(params: {
  providerId: string;
  provider: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
  emailVerified?: boolean;
}) {
  const compositeId = `${params.provider}:${params.providerId}`;

  const [byProvider] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.providerId, compositeId))
    .limit(1);

  if (byProvider) {
    const [user] = await db
      .update(usersTable)
      .set({
        email: params.email ?? byProvider.email,
        firstName: params.firstName ?? byProvider.firstName,
        lastName: params.lastName ?? byProvider.lastName,
        profileImageUrl: params.profileImageUrl ?? byProvider.profileImageUrl,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, byProvider.id))
      .returning();
    return user;
  }

  if (params.email) {
    const [byEmail] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, params.email))
      .limit(1);

    if (byEmail) {
      if (!params.emailVerified) {
        throw new Error("Cannot link accounts: your email address has not been verified by the sign-in provider.");
      }
      const [linked] = await db
        .update(usersTable)
        .set({
          authProvider: params.provider,
          providerId: compositeId,
          firstName: params.firstName ?? byEmail.firstName,
          lastName: params.lastName ?? byEmail.lastName,
          profileImageUrl: params.profileImageUrl ?? byEmail.profileImageUrl,
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, byEmail.id))
        .returning();
      return linked;
    }
  }

  const [user] = await db
    .insert(usersTable)
    .values({
      email: params.email ?? null,
      firstName: params.firstName ?? null,
      lastName: params.lastName ?? null,
      profileImageUrl: params.profileImageUrl ?? null,
      authProvider: params.provider,
      providerId: compositeId,
    })
    .returning();
  return user;
}

async function createSocialSession(user: { id: string; email: string | null; firstName: string | null; lastName: string | null; profileImageUrl: string | null }) {
  return createSession({
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
    },
    access_token: "",
  });
}

function redirectToApp(res: Response, token: string, platform: string = "mobile", origin: string = "") {
  if (platform === "web") {
    res.redirect(`${origin}/api/auth/web-complete?token=${encodeURIComponent(token)}`);
  } else {
    res.redirect(`${DEEP_LINK_SCHEME}?token=${encodeURIComponent(token)}`);
  }
}

function redirectError(res: Response, message: string, platform: string = "mobile", origin: string = "") {
  if (platform === "web") {
    res.redirect(`${origin}/api/auth/web-complete?error=${encodeURIComponent(message)}`);
  } else {
    res.redirect(`${DEEP_LINK_SCHEME}?error=${encodeURIComponent(message)}`);
  }
}

router.get("/auth/web-complete", (req: Request, res: Response) => {
  const { token, error } = req.query as Record<string, string>;
  if (token && !error) {
    res.cookie("sid", token, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }
  const payload = JSON.stringify({ success: !error, error: error ?? null });
  const html = `<!DOCTYPE html><html><head><script>
    if (window.opener) {
      window.opener.postMessage(${payload}, '*');
      window.close();
    } else {
      window.location.href = '/';
    }
  </script></head><body></body></html>`;
  res.setHeader("Content-Type", "text/html");
  res.send(html);
});

router.get("/auth/social/:provider", (req: Request, res: Response) => {
  const { provider } = req.params;
  const platform = req.query.platform === "web" ? "web" : "mobile";
  const state = crypto.randomBytes(16).toString("hex");
  oauthStates.set(state, { provider, platform, expiresAt: Date.now() + 10 * 60_000 });

  const cb = callbackUrl(req, provider);

  if (provider === "google") {
    if (!GOOGLE_CLIENT_ID) { res.status(503).json({ error: "Google auth not configured" }); return; }
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", GOOGLE_CLIENT_ID);
    url.searchParams.set("redirect_uri", cb);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", state);
    url.searchParams.set("access_type", "offline");
    res.redirect(url.toString());
    return;
  }

  if (provider === "github") {
    if (!GITHUB_CLIENT_ID) { res.status(503).json({ error: "GitHub auth not configured" }); return; }
    const url = new URL("https://github.com/login/oauth/authorize");
    url.searchParams.set("client_id", GITHUB_CLIENT_ID);
    url.searchParams.set("redirect_uri", cb);
    url.searchParams.set("scope", "read:user user:email");
    url.searchParams.set("state", state);
    res.redirect(url.toString());
    return;
  }

  if (provider === "twitter") {
    if (!TWITTER_CLIENT_ID) { res.status(503).json({ error: "X/Twitter auth not configured" }); return; }
    const codeVerifier = crypto.randomBytes(32).toString("base64url");
    const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");
    oauthStates.set(state, { provider, expiresAt: Date.now() + 10 * 60_000, codeVerifier } as any);
    const url = new URL("https://twitter.com/i/oauth2/authorize");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", TWITTER_CLIENT_ID);
    url.searchParams.set("redirect_uri", cb);
    url.searchParams.set("scope", "tweet.read users.read offline.access");
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    res.redirect(url.toString());
    return;
  }

  res.status(400).json({ error: "Unknown provider" });
});

router.get("/auth/social/:provider/callback", async (req: Request, res: Response) => {
  const { provider } = req.params;
  const { code, state, error } = req.query as Record<string, string>;

  if (error) {
    redirectError(res, "Authorization was denied");
    return;
  }

  const stateData = oauthStates.get(state);
  if (!stateData || stateData.provider !== provider || stateData.expiresAt < Date.now()) {
    redirectError(res, "Invalid or expired state");
    return;
  }
  oauthStates.delete(state);

  const platform: string = (stateData as any).platform ?? "mobile";
  const origin = `${req.headers["x-forwarded-proto"] || "https"}://${req.headers["x-forwarded-host"] || req.headers.host}`;
  const cb = callbackUrl(req, provider);

  try {
    if (provider === "google") {
      if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
        redirectError(res, "Google auth not configured", platform, origin); return;
      }
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code, client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: cb, grant_type: "authorization_code",
        }),
      });
      const tokens = await tokenRes.json() as any;
      if (!tokenRes.ok || !tokens.id_token) {
        redirectError(res, "Failed to exchange Google code", platform, origin); return;
      }
      const infoRes = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=${tokens.id_token}`);
      const info = await infoRes.json() as any;
      if (!infoRes.ok) { redirectError(res, "Failed to get Google user", platform, origin); return; }
      if (!info.email_verified) { redirectError(res, "Google account email is not verified", platform, origin); return; }
      const user = await upsertSocialUser({
        provider: "google", providerId: info.sub,
        email: info.email, firstName: info.given_name,
        lastName: info.family_name, profileImageUrl: info.picture,
        emailVerified: true,
      });
      const sid = await createSocialSession(user);
      redirectToApp(res, sid, platform, origin);
      return;
    }

    if (provider === "github") {
      if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
        redirectError(res, "GitHub auth not configured", platform, origin); return;
      }
      const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ client_id: GITHUB_CLIENT_ID, client_secret: GITHUB_CLIENT_SECRET, code, redirect_uri: cb }),
      });
      const tokens = await tokenRes.json() as any;
      if (!tokens.access_token) { redirectError(res, "Failed to exchange GitHub code", platform, origin); return; }
      const userRes = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${tokens.access_token}`, "User-Agent": "ProFitnessAI" },
      });
      const ghUser = await userRes.json() as any;
      let email = ghUser.email as string | null;
      if (!email) {
        const emailsRes = await fetch("https://api.github.com/user/emails", {
          headers: { Authorization: `Bearer ${tokens.access_token}`, "User-Agent": "ProFitnessAI" },
        });
        const emails = await emailsRes.json() as any[];
        const primary = emails.find((e: any) => e.primary && e.verified);
        email = primary?.email ?? null;
      }
      const nameParts = ((ghUser.name as string) ?? "").split(" ");
      const user = await upsertSocialUser({
        provider: "github", providerId: String(ghUser.id),
        email, firstName: nameParts[0] ?? ghUser.login,
        lastName: nameParts.slice(1).join(" ") || null,
        profileImageUrl: ghUser.avatar_url,
      });
      const sid = await createSocialSession(user);
      redirectToApp(res, sid, platform, origin);
      return;
    }

    if (provider === "twitter") {
      if (!TWITTER_CLIENT_ID || !TWITTER_CLIENT_SECRET) {
        redirectError(res, "X/Twitter auth not configured", platform, origin); return;
      }
      const codeVerifier = (stateData as any).codeVerifier ?? "";
      const credentials = Buffer.from(`${TWITTER_CLIENT_ID}:${TWITTER_CLIENT_SECRET}`).toString("base64");
      const tokenRes = await fetch("https://api.twitter.com/2/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${credentials}` },
        body: new URLSearchParams({
          code, grant_type: "authorization_code",
          client_id: TWITTER_CLIENT_ID, redirect_uri: cb,
          code_verifier: codeVerifier,
        }),
      });
      const tokens = await tokenRes.json() as any;
      if (!tokens.access_token) { redirectError(res, "Failed to exchange X token", platform, origin); return; }
      const meRes = await fetch("https://api.twitter.com/2/users/me?user.fields=name,profile_image_url", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const meData = await meRes.json() as any;
      const twUser = meData.data;
      if (!twUser) { redirectError(res, "Failed to get X user", platform, origin); return; }
      const nameParts = ((twUser.name as string) ?? "").split(" ");
      const user = await upsertSocialUser({
        provider: "twitter", providerId: twUser.id,
        email: null, firstName: nameParts[0] ?? twUser.username,
        lastName: nameParts.slice(1).join(" ") || null,
        profileImageUrl: twUser.profile_image_url,
      });
      const sid = await createSocialSession(user);
      redirectToApp(res, sid, platform, origin);
      return;
    }

    res.status(400).json({ error: "Unknown provider" });
  } catch (err) {
    console.error(`Social auth callback error (${provider}):`, err);
    const message = err instanceof Error ? err.message : "Authentication failed";
    redirectError(res, message, platform, origin);
  }
});

const appleJWKS = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

router.post("/auth/social/apple", async (req: Request, res: Response) => {
  const { identityToken, fullName, authorizationCode } = req.body;

  if (!identityToken) {
    res.status(400).json({ error: "Missing Apple identity token" });
    return;
  }

  try {
    const { payload } = await jwtVerify(identityToken, appleJWKS, {
      issuer: "https://appleid.apple.com",
    });

    const sub = payload.sub as string;
    const email = (payload.email as string) ?? null;
    const firstName = fullName?.givenName ?? null;
    const lastName = fullName?.familyName ?? null;

    const user = await upsertSocialUser({
      provider: "apple", providerId: sub,
      email, firstName, lastName, profileImageUrl: null,
      emailVerified: true,
    });

    const sid = await createSocialSession(user);
    res.json({ token: sid });
  } catch (err) {
    console.error("Apple auth error:", err);
    res.status(401).json({ error: "Invalid Apple identity token" });
  }
});

export default router;

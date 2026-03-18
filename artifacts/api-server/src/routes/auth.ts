import * as oidc from "openid-client";
import bcrypt from "bcryptjs";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  GetCurrentAuthUserResponse,
  LogoutMobileSessionResponse,
} from "@workspace/api-zod";
import { db, usersTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import {
  clearSession,
  getOidcConfig,
  getSessionId,
  createSession,
  deleteSession,
  SESSION_COOKIE,
  SESSION_TTL,
  ISSUER_URL,
  type SessionData,
} from "../lib/auth";

const OIDC_COOKIE_TTL = 10 * 60 * 1000;
const SALT_ROUNDS = 12;

const router: IRouter = Router();

function getOrigin(req: Request): string {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host =
    req.headers["x-forwarded-host"] || req.headers["host"] || "localhost";
  return `${proto}://${host}`;
}

function setSessionCookie(res: Response, sid: string) {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

function setOidcCookie(res: Response, name: string, value: string) {
  res.cookie(name, value, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: OIDC_COOKIE_TTL,
  });
}

function getSafeReturnTo(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  return value;
}

async function upsertUser(claims: Record<string, unknown>) {
  const userData = {
    id: claims.sub as string,
    email: (claims.email as string) || null,
    firstName: (claims.first_name as string) || null,
    lastName: (claims.last_name as string) || null,
    profileImageUrl: (claims.profile_image_url || claims.picture) as
      | string
      | null,
    authProvider: "oidc",
  };

  const [user] = await db
    .insert(usersTable)
    .values(userData)
    .onConflictDoUpdate({
      target: usersTable.id,
      set: {
        ...userData,
        updatedAt: new Date(),
      },
    })
    .returning();
  return user;
}

router.get("/auth/user", (req: Request, res: Response) => {
  res.json(
    GetCurrentAuthUserResponse.parse({
      user: req.isAuthenticated() ? req.user : null,
    }),
  );
});

router.post("/auth/signup", async (req: Request, res: Response) => {
  const { username, email, password, firstName, lastName } = req.body;

  if (!password || password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  if (!username && !email) {
    res.status(400).json({ error: "Username or email is required" });
    return;
  }

  const identifier = username?.trim().toLowerCase() || email?.trim().toLowerCase();

  try {
    const existing = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(
        or(
          username ? eq(usersTable.username, identifier) : undefined,
          email ? eq(usersTable.email, identifier) : undefined,
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      const taken = existing[0] as any;
      const providerLabel = taken.authProvider && taken.authProvider !== "email"
        ? `Please sign in with ${taken.authProvider} instead.`
        : "Please sign in or use a different email.";
      const field = username && taken.username === identifier ? "username" : "email";
      res.status(409).json({ error: `That ${field} is already registered. ${providerLabel}` });
      return;
    }

    if (email && !email.includes("@")) {
      res.status(400).json({ error: "Please enter a valid email address." });
      return;
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const [user] = await db
      .insert(usersTable)
      .values({
        email: email?.trim().toLowerCase() || null,
        username: username?.trim().toLowerCase() || null,
        passwordHash,
        firstName: firstName?.trim() || null,
        lastName: lastName?.trim() || null,
        authProvider: "email",
      })
      .returning();

    const sessionData: SessionData = {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
      },
      access_token: "",
    };

    const sid = await createSession(sessionData);
    res.json({ token: sid });
  } catch (err: any) {
    console.error("Signup error:", err);
    if (err?.cause?.code === "23505") {
      if (err.cause.constraint?.includes("email")) {
        res.status(409).json({ error: "That email is already registered. Please sign in or use a different email." });
      } else if (err.cause.constraint?.includes("username")) {
        res.status(409).json({ error: "That username is already taken. Please choose a different one." });
      } else {
        res.status(409).json({ error: "An account with those details already exists." });
      }
    } else {
      res.status(500).json({ error: "Something went wrong creating your account. Please try again." });
    }
  }
});

router.post("/auth/signin", async (req: Request, res: Response) => {
  const { identifier, password } = req.body;

  if (!identifier || !password) {
    res.status(400).json({ error: "Username/email and password are required" });
    return;
  }

  const normalized = identifier.trim().toLowerCase();

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(
        or(
          eq(usersTable.username, normalized),
          eq(usersTable.email, normalized),
        ),
      )
      .limit(1);

    if (!user || !user.passwordHash) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }

    const sessionData: SessionData = {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
      },
      access_token: "",
    };

    const sid = await createSession(sessionData);
    res.json({ token: sid });
  } catch (err) {
    console.error("Signin error:", err);
    res.status(500).json({ error: "Failed to sign in" });
  }
});

router.get("/login", async (req: Request, res: Response) => {
  const config = await getOidcConfig();
  const callbackUrl = `${getOrigin(req)}/api/callback`;

  const returnTo = getSafeReturnTo(req.query.returnTo);

  const state = oidc.randomState();
  const nonce = oidc.randomNonce();
  const codeVerifier = oidc.randomPKCECodeVerifier();
  const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);

  const redirectTo = oidc.buildAuthorizationUrl(config, {
    redirect_uri: callbackUrl,
    scope: "openid email profile offline_access",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    prompt: "login consent",
    state,
    nonce,
  });

  setOidcCookie(res, "code_verifier", codeVerifier);
  setOidcCookie(res, "nonce", nonce);
  setOidcCookie(res, "state", state);
  setOidcCookie(res, "return_to", returnTo);

  res.redirect(redirectTo.href);
});

router.get("/callback", async (req: Request, res: Response) => {
  const config = await getOidcConfig();
  const callbackUrl = `${getOrigin(req)}/api/callback`;

  const codeVerifier = req.cookies?.code_verifier;
  const nonce = req.cookies?.nonce;
  const expectedState = req.cookies?.state;

  if (!codeVerifier || !expectedState) {
    res.redirect("/api/login");
    return;
  }

  const currentUrl = new URL(
    `${callbackUrl}?${new URL(req.url, `http://${req.headers.host}`).searchParams}`,
  );

  let tokens: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers;
  try {
    tokens = await oidc.authorizationCodeGrant(config, currentUrl, {
      pkceCodeVerifier: codeVerifier,
      expectedNonce: nonce,
      expectedState,
      idTokenExpected: true,
    });
  } catch {
    res.redirect("/api/login");
    return;
  }

  const returnTo = getSafeReturnTo(req.cookies?.return_to);

  res.clearCookie("code_verifier", { path: "/" });
  res.clearCookie("nonce", { path: "/" });
  res.clearCookie("state", { path: "/" });
  res.clearCookie("return_to", { path: "/" });

  const claims = tokens.claims();
  if (!claims) {
    res.redirect("/api/login");
    return;
  }

  const dbUser = await upsertUser(
    claims as unknown as Record<string, unknown>,
  );

  const now = Math.floor(Date.now() / 1000);
  const sessionData: SessionData = {
    user: {
      id: dbUser.id,
      email: dbUser.email,
      firstName: dbUser.firstName,
      lastName: dbUser.lastName,
      profileImageUrl: dbUser.profileImageUrl,
    },
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: tokens.expiresIn() ? now + tokens.expiresIn()! : claims.exp,
  };

  const sid = await createSession(sessionData);
  setSessionCookie(res, sid);
  res.redirect(returnTo);
});

router.get("/logout", async (req: Request, res: Response) => {
  const config = await getOidcConfig();
  const origin = getOrigin(req);

  const sid = getSessionId(req);
  await clearSession(res, sid);

  const endSessionUrl = oidc.buildEndSessionUrl(config, {
    client_id: process.env.REPL_ID!,
    post_logout_redirect_uri: origin,
  });

  res.redirect(endSessionUrl.href);
});

router.post("/mobile-auth/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  if (sid) {
    await deleteSession(sid);
  }
  res.json(LogoutMobileSessionResponse.parse({ success: true }));
});

router.delete("/auth/account", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const userId = req.user.id;

  const sid = getSessionId(req);
  if (sid) {
    await clearSession(res, sid);
  }

  await db.delete(usersTable).where(eq(usersTable.id, userId));

  res.json({ success: true });
});

export default router;

import rateLimit from "express-rate-limit";
import type { Request } from "express";

/** Skip rate limiting entirely in the test environment. */
const skipInTest = (_req: Request) => process.env.NODE_ENV === "test";

/** AI generation endpoints — keyed by authenticated user ID, 10 req/min. */
export const aiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req: Request) => req.user?.id ?? "anonymous",
  validate: { ip: false },
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please wait a moment before trying again." },
});

/**
 * Credential sign-in — keyed by IP, 10 attempts per 15 minutes.
 * Prevents brute-force / credential-stuffing attacks.
 */
export const authSigninLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req: Request) => req.ip ?? "unknown",
  validate: { ip: false, keyGeneratorIpFallback: false },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  message: { error: "Too many sign-in attempts. Please wait 15 minutes before trying again." },
});

/**
 * Account creation — keyed by IP, 5 accounts per hour.
 * Prevents registration spam.
 */
export const authSignupLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: (req: Request) => req.ip ?? "unknown",
  validate: { ip: false, keyGeneratorIpFallback: false },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  message: { error: "Too many accounts created from this IP. Please try again in an hour." },
});

/**
 * OAuth initiation (Google / GitHub / Twitter / Apple) — keyed by IP,
 * 20 requests per 5 minutes.
 * Prevents OAuth flow abuse and token-exchange flooding.
 */
export const authOAuthLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  keyGenerator: (req: Request) => req.ip ?? "unknown",
  validate: { ip: false, keyGeneratorIpFallback: false },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  message: { error: "Too many authentication requests. Please wait before trying again." },
});

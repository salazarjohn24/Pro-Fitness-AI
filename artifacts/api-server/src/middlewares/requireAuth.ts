import { type Request, type Response, type NextFunction } from "express";

/**
 * Express middleware that rejects unauthenticated requests with 401.
 *
 * Usage (future — do not migrate existing inline guards yet):
 *   router.get("/protected", requireAuth, handler);
 *
 * Existing routes use inline `if (!req.isAuthenticated())` guards.
 * Migrate those incrementally in post-beta sprint 1 — one route at a time,
 * with a test confirming the 401 contract after each migration.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

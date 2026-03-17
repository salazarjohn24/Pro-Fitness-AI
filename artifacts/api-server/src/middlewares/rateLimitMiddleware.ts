import rateLimit from "express-rate-limit";
import type { Request } from "express";

export const aiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req: Request) => req.user?.id ?? "anonymous",
  validate: { ip: false },
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please wait a moment before trying again." },
});

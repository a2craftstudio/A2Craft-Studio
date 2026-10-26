import type { Request, RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { Config } from '../config.js';

export const RATE_MESSAGE = 'Too many requests. Please wait a moment and try again.';
export const MINUTE = 60_000;
export const HOUR = 3_600_000;

/** Per-IP limiter. Each call creates its own counter, so limits are independent per route group. */
export function limiter(config: Config, limit: number, windowMs: number): RequestHandler {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => !config.rateLimit,
    handler: (_req, res) => {
      res.status(429).json({ error: RATE_MESSAGE });
    },
  });
}

/** Per-user limiter for signed-in routes (mount after requireUser). */
export function userLimiter(config: Config, limit: number, windowMs: number): RequestHandler {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => !config.rateLimit,
    keyGenerator: (req: Request) => `user:${req.user?.id ?? 'anon'}`,
    validate: { keyGeneratorIpFallback: false },
    handler: (_req, res) => {
      res.status(429).json({ error: RATE_MESSAGE });
    },
  });
}

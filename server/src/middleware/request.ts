import type { NextFunction, Request, Response } from 'express';
import crypto from 'node:crypto';
import type { Config } from '../config.js';
import { isProduction } from '../config.js';
import { HttpError } from '../errors.js';

export function requestId(req: Request, res: Response, next: NextFunction) {
  const id = crypto.randomBytes(6).toString('hex');
  (req as { id?: string }).id = id;
  res.setHeader('X-Request-Id', id);
  next();
}

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

function sameHost(origin: string, host: string | undefined) {
  try {
    return !!host && new URL(origin).host === host;
  } catch {
    return false;
  }
}
const isLocal = (origin: string) => {
  try {
    const h = new URL(origin).hostname;
    return h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
  } catch {
    return false;
  }
};

/**
 * Defence in depth against CSRF (SameSite=Lax already blocks cross-site cookies on POST): a state-changing request that
 * carries an Origin header must come from this site. Outside production, any localhost origin is accepted so the Angular
 * dev server (a different port) keeps working. Requests without an Origin header (curl, server-to-server) pass.
 */
export const originCheck = (config: Config) => (req: Request, _res: Response, next: NextFunction) => {
  if (SAFE.has(req.method)) return next();
  const origin = req.headers.origin;
  if (!origin) return next();
  const allowed = [config.siteOrigin, ...config.allowedOrigins];
  if (allowed.includes(origin) || sameHost(origin, req.headers.host) || (!isProduction(config) && isLocal(origin))) return next();
  throw new HttpError(403, 'Cross-site requests are not allowed.');
};

/** Routes that legitimately accept multipart bodies (uploads). Everything else must be JSON. Paths are relative to /api. */
const MULTIPART_ROUTES = [/^\/uploads\/?$/, /^\/admin\/orders\/[^/]+\/deliverables\/[^/]+\/?$/];

/**
 * State-changing requests that carry a body must be application/json. HTML forms and `text/plain` "simple requests"
 * (the classic CSRF vectors) are therefore rejected. Mounted on /api, so `req.path` has no /api prefix.
 */
export const requireJson = (req: Request, _res: Response, next: NextFunction) => {
  if (SAFE.has(req.method)) return next();
  const hasBody = Number(req.headers['content-length'] ?? 0) > 0 || req.headers['transfer-encoding'] !== undefined;
  if (!hasBody) return next();
  const type = String(req.headers['content-type'] ?? '').toLowerCase();
  if (type.startsWith('application/json')) return next();
  if (type.startsWith('multipart/form-data') && MULTIPART_ROUTES.some((r) => r.test(req.path))) return next();
  throw new HttpError(400, 'Requests must be sent as JSON.');
};

export function noStore(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('Cache-Control', 'no-store');
  next();
}

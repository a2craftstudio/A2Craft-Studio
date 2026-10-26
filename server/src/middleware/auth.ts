import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { userFromRequest, type UserRow } from '../auth.js';
import type { Ctx } from '../context.js';
import { forbidden, unauthorized } from '../errors.js';

declare module 'express-serve-static-core' {
  interface Request {
    user?: UserRow | null;
  }
}

/** Populates req.user (or null) on every request. Never rejects. */
export const attachUser = (ctx: Ctx): RequestHandler => (req: Request, _res: Response, next: NextFunction) => {
  userFromRequest(ctx, req).then(
    (u) => {
      req.user = u;
      next();
    },
    next,
  );
};

export const requireUser: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(unauthorized());
  next();
};

/** 401 for anonymous callers, 403 for signed-in customers. Mounted once on /api/admin so no admin route can miss it. */
export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(unauthorized());
  if (req.user.role !== 'admin') return next(forbidden('Admin access required.'));
  next();
};

/** The signed-in user (callers sit behind requireUser, so this never throws in practice). */
export const me = (req: Request): UserRow => {
  if (!req.user) throw unauthorized();
  return req.user;
};

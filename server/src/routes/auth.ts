import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { checkPassword, clearSession, createUser, dummyCompare, hashPassword, issueSession, toSession, type UserRow } from '../auth.js';
import type { Ctx } from '../context.js';
import { isUniqueError, nowIso } from '../db.js';
import { HttpError, badRequest } from '../errors.js';
import { ah } from '../middleware/async.js';
import { me, requireUser } from '../middleware/auth.js';
import { limiter, MINUTE } from '../middleware/rate.js';
import { validateBody } from '../middleware/validate.js';
import { email, password, text } from '../schemas.js';
import { sendPasswordReset } from '../services/mail.js';
import { sha256Hex } from '../util.js';

const signupBody = z.object({ name: text(80, 1, 'Please enter your name.'), email, password }).strict();
const loginBody = z.object({ email, password: z.string().min(1).max(200) }).strict();
const forgotBody = z.object({ email }).strict();
const resetBody = z.object({ token: z.string().trim().regex(/^[0-9a-f]{64}$/, 'This reset link is invalid or has expired.'), password }).strict();
const profileBody = z.object({ name: text(80, 1, 'Please enter your name.') }).strict();
const passwordBody = z.object({ password }).strict();

const RESET_TTL_MS = 60 * 60 * 1000;
const WRONG = 'Incorrect email or password.';

export function authRoutes(ctx: Ctx): Router {
  const { db, config } = ctx;
  const r = Router();
  const authLimit = limiter(config, 10, MINUTE);

  r.get('/auth/me', (req, res) => {
    res.json({ user: req.user ? toSession(req.user, config.superAdminEmail) : null });
  });

  r.post(
    '/auth/signup',
    authLimit,
    validateBody(signupBody),
    ah(async (req, res) => {
      const b = req.body as z.infer<typeof signupBody>;
      if (await db.get('SELECT 1 AS x FROM users WHERE email = ?', b.email)) throw new HttpError(409, 'An account with this email already exists.');
      let user: UserRow;
      try {
        user = await createUser(ctx, { email: b.email, name: b.name, password: b.password, role: 'customer' });
      } catch (e) {
        if (isUniqueError(e)) throw new HttpError(409, 'An account with this email already exists.');
        throw e;
      }
      issueSession(config, res, user);
      res.json({ user: toSession(user, config.superAdminEmail) });
    }),
  );

  r.post(
    '/auth/login',
    authLimit,
    validateBody(loginBody),
    ah(async (req, res) => {
      const b = req.body as z.infer<typeof loginBody>;
      const user = await db.get<UserRow>('SELECT * FROM users WHERE email = ?', b.email);
      if (!user) {
        await dummyCompare(config, b.password);
        throw new HttpError(401, WRONG);
      }
      if (!(await checkPassword(b.password, user.password_hash))) throw new HttpError(401, WRONG);
      issueSession(config, res, user);
      res.json({ user: toSession(user, config.superAdminEmail) });
    }),
  );

  r.post('/auth/logout', (_req, res) => {
    clearSession(config, res);
    res.status(204).end();
  });

  r.post(
    '/auth/forgot',
    authLimit,
    validateBody(forgotBody),
    ah(async (req, res) => {
      const { email: addr } = req.body as z.infer<typeof forgotBody>;
      const user = await db.get<UserRow>('SELECT * FROM users WHERE email = ?', addr);
      if (user) {
        // At most one fresh link per minute per account (stops mail-bombing a victim); the response is identical either way.
        const recent = await db.get('SELECT 1 AS x FROM password_resets WHERE user_id = ? AND created_at > ?', user.id, new Date(Date.now() - 60_000).toISOString());
        if (!recent) {
          const token = crypto.randomBytes(32).toString('hex');
          await db.run(
            'INSERT INTO password_resets (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)',
            sha256Hex(token),
            user.id,
            new Date(Date.now() + RESET_TTL_MS).toISOString(),
            nowIso(),
          );
          sendPasswordReset(config, ctx.mail, user.email, user.name, token);
        }
      }
      res.status(204).end();
    }),
  );

  r.post(
    '/auth/reset',
    authLimit,
    validateBody(resetBody),
    ah(async (req, res) => {
      const b = req.body as z.infer<typeof resetBody>;
      const hash = sha256Hex(b.token);
      const row = await db.get<{ user_id: string }>('SELECT user_id FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?', hash, nowIso());
      if (!row) throw badRequest('This reset link is invalid or has expired.');
      const pwHash = await hashPassword(config, b.password);
      const user = await db.tx(async () => {
        // Single use: the UPDATE only succeeds for the first caller.
        const claimed = await db.run('UPDATE password_resets SET used_at = ? WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?', nowIso(), hash, nowIso());
        if (claimed.changes !== 1) throw badRequest('This reset link is invalid or has expired.');
        await db.run('UPDATE password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL', nowIso(), row.user_id);
        await db.run('UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?', pwHash, row.user_id);
        return (await db.get<UserRow>('SELECT * FROM users WHERE id = ?', row.user_id))!;
      });
      issueSession(config, res, user);
      res.json({ user: toSession(user, config.superAdminEmail) });
    }),
  );

  r.patch('/me', requireUser, validateBody(profileBody), ah(async (req, res) => {
    const u = me(req);
    const b = req.body as z.infer<typeof profileBody>;
    await db.run('UPDATE users SET name = ? WHERE id = ?', b.name, u.id);
    res.json({ user: toSession({ ...u, name: b.name }, config.superAdminEmail) });
  }));

  r.post(
    '/me/password',
    requireUser,
    validateBody(passwordBody),
    ah(async (req, res) => {
      const u = me(req);
      const b = req.body as z.infer<typeof passwordBody>;
      const hash = await hashPassword(config, b.password);
      await db.run('UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?', hash, u.id);
      // Other devices are signed out; this one gets a fresh cookie.
      issueSession(config, res, { id: u.id, token_version: u.token_version + 1 });
      res.status(204).end();
    }),
  );

  return r;
}

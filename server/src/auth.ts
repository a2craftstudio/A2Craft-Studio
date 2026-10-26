import bcrypt from 'bcryptjs';
import type { CookieOptions, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { Config } from './config.js';
import type { Ctx } from './context.js';
import { nowIso } from './db.js';
import { uuid } from './util.js';

export const COOKIE_NAME = 'a2_session';
const SESSION_DAYS = 7;

export interface UserRow {
  id: string;
  email: string;
  name: string;
  role: 'customer' | 'admin';
  password_hash: string;
  token_version: number;
  created_at: string;
}
export interface UserSession {
  id: string;
  email: string;
  name: string;
  role: 'customer' | 'admin';
}
export const toSession = (u: Pick<UserRow, 'id' | 'email' | 'name' | 'role'>): UserSession => ({ id: u.id, email: u.email, name: u.name, role: u.role });

// ---------------------------------------------------------------- passwords
export const hashPassword = (config: Config, password: string) => bcrypt.hash(password, config.bcryptCost);

let dummyHash: { cost: number; hash: string } | null = null;
/** Burns the same bcrypt time for unknown emails so response time does not reveal whether an account exists. */
export async function dummyCompare(config: Config, password: string): Promise<void> {
  if (!dummyHash || dummyHash.cost !== config.bcryptCost) dummyHash = { cost: config.bcryptCost, hash: bcrypt.hashSync('not-a-real-password', config.bcryptCost) };
  await bcrypt.compare(password, dummyHash.hash);
}
export const checkPassword = (password: string, hash: string) => bcrypt.compare(password, hash);

// ---------------------------------------------------------------- session cookie (signed JWT)
const cookieOptions = (config: Config): CookieOptions => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: config.cookieSecure,
  path: '/',
});

export function issueSession(config: Config, res: Response, user: Pick<UserRow, 'id' | 'token_version'>) {
  const token = jwt.sign({ sub: user.id, sv: user.token_version }, config.jwtSecret, { algorithm: 'HS256', expiresIn: `${SESSION_DAYS}d` });
  res.cookie(COOKIE_NAME, token, { ...cookieOptions(config), maxAge: SESSION_DAYS * 24 * 3600 * 1000 });
}
export function clearSession(config: Config, res: Response) {
  res.clearCookie(COOKIE_NAME, cookieOptions(config));
}

/** Resolves the signed-in user from the cookie, or null. Role always comes from the database, never from the token. */
export async function userFromRequest(ctx: Ctx, req: Request): Promise<UserRow | null> {
  const token = (req.cookies as Record<string, string> | undefined)?.[COOKIE_NAME];
  if (!token || typeof token !== 'string') return null;
  let p: { sub?: string; sv?: number };
  try {
    p = jwt.verify(token, ctx.config.jwtSecret, { algorithms: ['HS256'] }) as { sub?: string; sv?: number };
  } catch {
    return null; // bad or expired token: anonymous
  }
  if (!p.sub) return null;
  // Database errors are NOT swallowed: an outage must not look like "signed out".
  const u = await ctx.db.get<UserRow>('SELECT * FROM users WHERE id = ?', p.sub);
  if (!u || u.token_version !== p.sv) return null;
  return u;
}

// ---------------------------------------------------------------- users and admin bootstrap
export async function createUser(ctx: Ctx, input: { email: string; name: string; password: string; role: 'customer' | 'admin' }): Promise<UserRow> {
  const id = uuid();
  const hash = await hashPassword(ctx.config, input.password);
  await ctx.db.run('INSERT INTO users (id, email, name, role, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)', id, input.email.toLowerCase(), input.name, input.role, hash, nowIso());
  return (await ctx.db.get<UserRow>('SELECT * FROM users WHERE id = ?', id))!;
}

/** Creates the admin from ADMIN_EMAIL / ADMIN_PASSWORD, only when no admin exists yet. Returns what happened. */
export async function bootstrapAdmin(ctx: Ctx): Promise<'created' | 'promoted' | 'skipped'> {
  const { email, password, name } = ctx.config.admin;
  if (!email || !password) return 'skipped';
  if (await ctx.db.get('SELECT id FROM users WHERE role = ? LIMIT 1', 'admin')) return 'skipped';
  if (password.length < 8) {
    ctx.log.warn('[admin] ADMIN_PASSWORD is shorter than 8 characters: admin was not created.');
    return 'skipped';
  }
  const existing = await ctx.db.get<UserRow>('SELECT * FROM users WHERE email = ?', email);
  if (existing) {
    await ctx.db.run("UPDATE users SET role = 'admin' WHERE id = ?", existing.id);
    ctx.log.info(`[admin] promoted existing account ${email} to admin.`);
    return 'promoted';
  }
  await createUser(ctx, { email, name, password, role: 'admin' });
  ctx.log.info(`[admin] created admin account ${email}.`);
  return 'created';
}

/** Used by the create-admin CLI: creates the admin, or promotes an existing account and resets its password. */
export async function upsertAdmin(ctx: Ctx, email: string, password: string, name?: string): Promise<'created' | 'updated'> {
  const e = email.trim().toLowerCase();
  const existing = await ctx.db.get<UserRow>('SELECT * FROM users WHERE email = ?', e);
  if (!existing) {
    await createUser(ctx, { email: e, name: name?.trim() || e.split('@')[0]!, password, role: 'admin' });
    return 'created';
  }
  const hash = await hashPassword(ctx.config, password);
  await ctx.db.run("UPDATE users SET role = 'admin', password_hash = ?, token_version = token_version + 1, name = COALESCE(NULLIF(?, ''), name) WHERE id = ?", hash, name?.trim() ?? '', existing.id);
  return 'updated';
}

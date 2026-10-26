import { Router } from 'express';
import { z } from 'zod';
import type { Ctx } from '../context.js';
import { nowIso } from '../db.js';
import { ah } from '../middleware/async.js';
import { MINUTE, limiter } from '../middleware/rate.js';
import { validateBody } from '../middleware/validate.js';
import { uuidStr } from '../schemas.js';
import { uuid } from '../util.js';

const eventBody = z
  .object({
    visitorId: z.string().trim().regex(/^[A-Za-z0-9_-]{4,40}$/, 'Invalid visitor id.'),
    type: z.enum(['page', 'product', 'like']),
    path: z.string().trim().min(1).max(300, 'The path is too long.').startsWith('/', 'The path must start with /.'),
    productId: uuidStr.nullish(),
  })
  .strict();

/** Pages that are never tracked (private areas). Prefix match, case-insensitive. */
export const UNTRACKED = /^\/(admin|checkout|order)/i;

export function eventRoutes(ctx: Ctx): Router {
  const { db, config } = ctx;
  const r = Router();

  // Opt-in is decided in the browser (the client only calls this after consent). The server additionally refuses to
  // record admins and private pages, whatever the client sends.
  r.post('/events', limiter(config, 120, MINUTE), validateBody(eventBody), ah(async (req, res) => {
    const b = req.body as z.infer<typeof eventBody>;
    if (req.user?.role === 'admin' || UNTRACKED.test(b.path)) return void res.status(204).end();
    const productId = b.productId && (await db.get('SELECT 1 AS x FROM products WHERE id = ?', b.productId)) ? b.productId : null;
    await db.run('INSERT INTO visit_events (id, visitor_id, user_id, type, path, product_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', uuid(), b.visitorId, req.user?.id ?? null, b.type, b.path, productId, nowIso());
    res.status(204).end();
  }));

  return r;
}

export function adminEventRoutes(ctx: Ctx): Router {
  const { db } = ctx;
  const r = Router();

  r.get('/events', ah(async (_req, res) => {
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const rows = await db.all<{ id: string; visitor_id: string; user_id: string | null; type: string; path: string; product_id: string | null; created_at: string; email: string | null }>(
      `SELECT e.id, e.visitor_id, e.user_id, e.type, e.path, e.product_id, e.created_at, u.email
         FROM visit_events e LEFT JOIN users u ON u.id = e.user_id
        WHERE e.created_at >= ? ORDER BY e.created_at DESC, e.seq DESC LIMIT 5000`,
      since,
    );
    res.json(
      rows.map((e) => ({
        id: e.id,
        visitorId: e.visitor_id,
        ...(e.user_id ? { userId: e.user_id, userLabel: e.email ?? undefined } : {}),
        type: e.type,
        path: e.path,
        ...(e.product_id ? { productId: e.product_id } : {}),
        at: e.created_at,
      })),
    );
  }));

  return r;
}

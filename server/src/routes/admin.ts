import { Router } from 'express';
import { z } from 'zod';
import type { Ctx } from '../context.js';
import { nowIso } from '../db.js';
import { badRequest, conflict, forbidden, notFound } from '../errors.js';
import { ah } from '../middleware/async.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { email, emailOrEmpty, isoDate, text, textOpt, uuidStr } from '../schemas.js';
import { couponFromRow } from '../services/pricing.js';
import { REVIEW_SELECT, inquiryList, readSettings, reviewOut } from './engagement.js';

// ---------------------------------------------------------------- schemas
const couponBody = z
  .object({
    code: z.string().optional(),
    percent: z.number().int().min(1, 'Percent must be between 1 and 100.').max(100, 'Percent must be between 1 and 100.').nullish(),
    flatInr: z.number().int().min(0).max(10_000_000).nullish(),
    minSubtotal: z.number().int().min(0, 'The minimum subtotal cannot be negative.').max(10_000_000).nullish().default(0),
    active: z.boolean().default(true),
    endsAt: z.union([z.literal(''), isoDate]).nullish(),
    maxUses: z.number().int().min(0).max(10_000_000).nullish(),
    used: z.number().optional(), // read-only: ignored
  })
  .strict();

const roleBody = z.object({ role: z.enum(['customer', 'admin']) }).strict();

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const dayHours = z
  .object({ open: z.string().regex(HHMM, 'Hours must look like 09:30.'), close: z.string().regex(HHMM, 'Hours must look like 18:00.') })
  .strict()
  .refine((d) => toMin(d.close) > toMin(d.open), 'Closing time must be after opening time.')
  .nullable();
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const hours = z.object(Object.fromEntries(DAYS.map((d) => [d, dayHours])) as Record<(typeof DAYS)[number], typeof dayHours>).strict();

const settingsBody = z
  .object({
    announcement: textOpt(300),
    whatsapp: z.string().trim().max(30).regex(/^[0-9+\s()-]*$/, 'Use digits, spaces, + and - only for WhatsApp.').optional().default(''),
    supportEmail: emailOrEmpty.optional().default(''),
    business: z
      .object({
        legalName: text(200),
        address: text(500),
        gstin: text(30),
        supportEmail: emailOrEmpty,
        grievanceOfficer: text(120),
        grievanceEmail: emailOrEmpty,
        jurisdiction: text(200),
      })
      .partial()
      .strict()
      .optional(),
    hours: hours.optional(),
    faq: z.array(z.object({ label: text(100), items: z.array(z.object({ q: text(300), a: text(2000) }).strict()).max(50) }).strict()).max(30).optional(),
    about: z.array(z.object({ h: text(200), p: z.array(text(3000)).max(20) }).strict()).max(30).optional(),
  })
  .strict();

const reviewPatch = z.object({ approved: z.boolean() }).strict();
const contactPatch = z.object({ status: z.enum(['new', 'replied']) }).strict();
const inquiryPatch = z.object({ status: z.enum(['new', 'in_progress', 'quoted', 'completed', 'declined']) }).strict();
const noteBody = z.object({ note: z.string().trim().max(2000, 'Notes can be at most 2000 characters.') }).strict();
const callbackPatch = z
  .object({ status: z.enum(['new', 'called', 'no_answer']).optional(), adminNote: z.string().trim().max(2000).optional() })
  .strict()
  .refine((v) => v.status !== undefined || v.adminNote !== undefined, 'Nothing to update.');
const subscriberQuery = z.object({ email });

export function adminRoutes(ctx: Ctx): Router {
  const { db, config } = ctx;
  const r = Router();

  // ---- reviews
  r.get('/reviews', ah(async (_req, res) => {
    res.json((await db.all<Parameters<typeof reviewOut>[0]>(`${REVIEW_SELECT} ORDER BY r.created_at DESC, r.seq DESC LIMIT 5000`)).map(reviewOut));
  }));
  r.patch('/reviews/:id', validateBody(reviewPatch), ah(async (req, res) => {
    const id = uuidStr.safeParse(req.params['id']);
    const row = id.success ? await db.get<{ consent_to_publish: number }>('SELECT consent_to_publish FROM reviews WHERE id = ?', id.data) : undefined;
    if (!id.success || !row) throw notFound('Review not found.');
    const { approved } = req.body as z.infer<typeof reviewPatch>;
    if (approved && !row.consent_to_publish) throw conflict('This review cannot be published because the customer did not give consent.');
    await db.run('UPDATE reviews SET approved = ? WHERE id = ?', approved ? 1 : 0, id.data);
    res.status(204).end();
  }));

  // ---- coupons
  const couponOut = async (code: string) => {
    const row = (await db.get<Parameters<typeof couponFromRow>[0]>('SELECT * FROM coupons WHERE code = ?', code))!;
    const c = couponFromRow(row);
    return {
      code: c.code,
      ...(c.percent ? { percent: c.percent } : {}),
      ...(c.flatInr ? { flatInr: c.flatInr } : {}),
      minSubtotal: c.minSubtotal ?? 0,
      active: c.active,
      ...(c.endsAt ? { endsAt: c.endsAt } : {}),
      ...(c.maxUses != null ? { maxUses: c.maxUses } : {}),
      used: c.used ?? 0,
    };
  };
  r.get('/coupons', ah(async (_req, res) => {
    res.json(await Promise.all((await db.all<{ code: string }>('SELECT code FROM coupons ORDER BY code')).map((c) => couponOut(c.code))));
  }));
  r.put('/coupons/:code', validateBody(couponBody), ah(async (req, res) => {
    const code = String(req.params['code']).trim().toUpperCase();
    if (!/^[A-Z0-9_-]{2,32}$/.test(code)) throw badRequest('Coupon codes use 2 to 32 letters, numbers, dashes or underscores.');
    const b = req.body as z.infer<typeof couponBody>;
    const percent = b.percent || null;
    const flat = b.flatInr || null;
    if (!percent && !flat) throw badRequest('A coupon needs either a percent (1 to 100) or a flat amount above 0.');
    if (percent && flat) throw badRequest('Choose either a percent or a flat amount, not both.');
    // `used` is read-only: updates keep the existing counter.
    await db.run(
      `INSERT INTO coupons (code, percent, flat_inr, min_subtotal, active, ends_at, max_uses, used_count) VALUES (?, ?, ?, ?, ?, ?, ?, 0)
       ON CONFLICT(code) DO UPDATE SET percent = excluded.percent, flat_inr = excluded.flat_inr, min_subtotal = excluded.min_subtotal,
         active = excluded.active, ends_at = excluded.ends_at, max_uses = excluded.max_uses`,
      code, percent, flat, b.minSubtotal ?? 0, b.active ? 1 : 0, b.endsAt || null, b.maxUses || null,
    );
    res.json(await couponOut(code));
  }));
  r.delete('/coupons/:code', ah(async (req, res) => {
    const code = String(req.params['code']).trim().toUpperCase();
    if ((await db.run('DELETE FROM coupons WHERE code = ?', code)).changes === 0) throw notFound('Coupon not found.');
    res.status(204).end();
  }));

  // ---- customers (every account; order counts and spend cover paid, non-refunded orders only)
  r.get('/customers', ah(async (_req, res) => {
    const rows = await db.all<{ id: string; email: string; name: string; role: 'customer' | 'admin'; created_at: string; orders: number; spent: number }>(
      `SELECT u.id, u.email, u.name, u.role, u.created_at,
              COUNT(o.id) AS orders, COALESCE(SUM(o.total), 0) AS spent
         FROM users u
         LEFT JOIN orders o ON o.user_id = u.id AND o.payment_verified = 1 AND o.status <> 'refunded'
        GROUP BY u.id ORDER BY u.created_at DESC LIMIT 5000`,
    );
    res.json(rows.map((u) => ({ id: u.id, email: u.email, name: u.name, role: u.role, orders: u.orders, spent: u.spent, joined: u.created_at })));
  }));

  // ---- roles: only the super admin (the ADMIN_EMAIL account) may promote or demote
  r.put('/users/:id/role', validateBody(roleBody), ah(async (req, res) => {
    const actor = req.user!;
    if (!config.admin.email || actor.email.toLowerCase() !== config.admin.email.toLowerCase()) throw forbidden('Only the super admin can change roles.');
    const id = uuidStr.safeParse(req.params['id']);
    const target = id.success ? await db.get<{ id: string; email: string }>('SELECT id, email FROM users WHERE id = ?', id.data) : undefined;
    if (!id.success || !target) throw notFound('User not found.');
    if (target.email.toLowerCase() === config.admin.email.toLowerCase()) throw conflict('The super admin role cannot be changed.');
    const { role } = req.body as z.infer<typeof roleBody>;
    await db.run('UPDATE users SET role = ? WHERE id = ?', role, target.id);
    res.json({ id: target.id, role });
  }));

  // ---- settings
  r.put('/settings', validateBody(settingsBody), ah(async (req, res) => {
    await db.run('UPDATE site_settings SET data = ? WHERE id = 1', JSON.stringify(req.body));
    res.json(await readSettings(db));
  }));

  // ---- contact messages
  r.get('/contacts', ah(async (_req, res) => {
    const rows = await db.all<{ id: string; created_at: string; name: string; email: string; message: string; status: string }>('SELECT * FROM contact_messages ORDER BY created_at DESC, seq DESC LIMIT 5000');
    res.json(rows.map((c) => ({ id: c.id, createdAt: c.created_at, name: c.name, email: c.email, message: c.message, status: c.status })));
  }));
  r.patch('/contacts/:id', validateBody(contactPatch), ah(async (req, res) => {
    const { status } = req.body as z.infer<typeof contactPatch>;
    if ((await db.run('UPDATE contact_messages SET status = ? WHERE id = ?', status, String(req.params['id']))).changes === 0) throw notFound('Message not found.');
    res.status(204).end();
  }));

  // ---- inquiries
  r.get('/inquiries', ah(async (_req, res) => {
    res.json(await inquiryList(db, '', [], true));
  }));
  r.patch('/inquiries/:id', validateBody(inquiryPatch), ah(async (req, res) => {
    const { status } = req.body as z.infer<typeof inquiryPatch>;
    if ((await db.run('UPDATE inquiries SET status = ? WHERE id = ?', status, String(req.params['id']))).changes === 0) throw notFound('Inquiry not found.');
    res.status(204).end();
  }));
  r.put('/inquiries/:id/note', validateBody(noteBody), ah(async (req, res) => {
    const id = String(req.params['id']);
    if (!(await db.get('SELECT 1 AS x FROM inquiries WHERE id = ?', id))) throw notFound('Inquiry not found.');
    const { note } = req.body as z.infer<typeof noteBody>;
    await db.run("INSERT INTO admin_notes (kind, target_id, note, updated_at) VALUES ('inquiry', ?, ?, ?) ON CONFLICT(kind, target_id) DO UPDATE SET note = excluded.note, updated_at = excluded.updated_at", id, note, nowIso());
    res.status(204).end();
  }));

  // ---- call-back requests (the only place phone numbers are ever returned)
  r.get('/callbacks', ah(async (_req, res) => {
    const rows = await db.all<{ id: string; created_at: string; name: string; phone: string; topic: string; preferred: string; note: string; status: string; admin_note: string | null }>(
      'SELECT * FROM callback_requests ORDER BY created_at DESC, seq DESC LIMIT 5000',
    );
    res.json(rows.map((c) => ({ id: c.id, createdAt: c.created_at, name: c.name, phone: c.phone, topic: c.topic, preferred: c.preferred, note: c.note, status: c.status, ...(c.admin_note ? { adminNote: c.admin_note } : {}) })));
  }));
  r.patch('/callbacks/:id', validateBody(callbackPatch), ah(async (req, res) => {
    const b = req.body as z.infer<typeof callbackPatch>;
    const id = String(req.params['id']);
    if (!(await db.get('SELECT 1 AS x FROM callback_requests WHERE id = ?', id))) throw notFound('Call-back request not found.');
    await db.tx(async () => {
      if (b.status !== undefined) await db.run('UPDATE callback_requests SET status = ? WHERE id = ?', b.status, id);
      if (b.adminNote !== undefined) await db.run('UPDATE callback_requests SET admin_note = ? WHERE id = ?', b.adminNote, id);
    });
    res.status(204).end();
  }));

  // ---- newsletter subscribers
  r.get('/subscribers', ah(async (_req, res) => {
    res.json((await db.all<{ email: string; created_at: string }>('SELECT email, created_at FROM newsletter_subscribers ORDER BY created_at DESC LIMIT 20000')).map((s) => ({ email: s.email, createdAt: s.created_at })));
  }));
  r.delete('/subscribers', validateQuery(subscriberQuery), ah(async (req, res) => {
    await db.run('DELETE FROM newsletter_subscribers WHERE email = ?', (req.query as { email: string }).email);
    res.status(204).end();
  }));

  return r;
}

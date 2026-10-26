import { Router } from 'express';
import { z } from 'zod';
import type { Ctx } from '../context.js';
import { isUniqueError, nowIso, type Db } from '../db.js';
import { HttpError, forbidden, notFound } from '../errors.js';
import { ah } from '../middleware/async.js';
import { me, requireUser } from '../middleware/auth.js';
import { HOUR, limiter } from '../middleware/rate.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { email, isoDate, privatePath, text, textOpt, uuidStr } from '../schemas.js';
import { notifyCallback, notifyContact, notifyInquiry } from '../services/mail.js';
import { bool, shortId, uuid } from '../util.js';

export const SETTINGS_DEFAULTS = { announcement: '', whatsapp: '', supportEmail: '' };

export async function readSettings(db: Db) {
  const row = await db.get<{ data: string }>('SELECT data FROM site_settings WHERE id = 1');
  return { ...SETTINGS_DEFAULTS, ...(row ? (JSON.parse(row.data) as Record<string, unknown>) : {}) };
}

/** First name only; never an email address. Used so a reviewer is never fully identified. */
export function firstName(name: string | null | undefined): string {
  const first = (name ?? '').trim().split(/\s+/)[0] ?? '';
  return !first || first.includes('@') ? 'Customer' : first.slice(0, 40);
}

interface ReviewRow {
  id: string;
  product_id: string;
  rating: number;
  body: string;
  consent_to_publish: number;
  approved: number;
  created_at: string;
  user_name: string | null;
}
export const reviewOut = (r: ReviewRow) => ({
  id: r.id,
  productId: r.product_id,
  authorName: firstName(r.user_name),
  rating: r.rating,
  body: r.body,
  consentToPublish: bool(r.consent_to_publish),
  approved: bool(r.approved),
  createdAt: r.created_at,
});
export const REVIEW_SELECT = 'SELECT r.id, r.product_id, r.rating, r.body, r.consent_to_publish, r.approved, r.created_at, u.name AS user_name FROM reviews r LEFT JOIN users u ON u.id = r.user_id';

const reviewsQuery = z.object({ productId: uuidStr.optional() });
const eligibilityQuery = z.object({ productId: uuidStr });
const reviewBody = z
  .object({
    productId: uuidStr,
    rating: z.number().int('Please choose a rating from 1 to 5.').min(1, 'Please choose a rating from 1 to 5.').max(5, 'Please choose a rating from 1 to 5.'),
    body: text(600, 5, 'Please write between 5 and 600 characters.'),
    consentToPublish: z.boolean(),
  })
  .strict();

const contactBody = z.object({ name: text(120, 1, 'Please enter your name.'), email, message: text(2000, 10, 'Please write at least 10 characters.') }).strict();

const inquiryBody = z
  .object({
    name: text(120, 1, 'Please enter your name.'),
    email,
    productType: text(120, 1, 'Please tell us what you would like made.'),
    occasion: textOpt(120),
    deadline: z.union([z.literal(''), isoDate]).optional().default(''),
    budget: textOpt(60),
    style: textOpt(300),
    description: text(2000, 20, 'Please describe your idea in at least 20 characters.'),
    referenceImages: z.array(privatePath).max(5, 'You can attach up to 5 reference images.').optional().default([]),
    adminNote: z.unknown().optional(), // part of the TS input type; always ignored, never stored from a customer
  })
  .strict();

const PHONE_CHARS = /^[0-9+()\s-]{7,20}$/;
const callbackBody = z
  .object({
    name: text(80, 1, 'Please enter your name.'),
    phone: z
      .string()
      .trim()
      .regex(PHONE_CHARS, 'Please enter a valid phone number (10 to 13 digits).')
      .refine((v) => {
        const n = v.replace(/\D/g, '').length;
        return n >= 10 && n <= 13;
      }, 'Please enter a valid phone number (10 to 13 digits).'),
    topic: textOpt(60),
    preferred: textOpt(60),
    note: textOpt(500),
  })
  .strict();

const newsletterBody = z
  .object({ email, consent: z.literal(true, { errorMap: () => ({ message: 'Please confirm that you agree to receive emails.' }) }) })
  .strict();

async function uniqueId(db: Db, table: string, prefix: string): Promise<string> {
  // `table` is always one of our own literals (see the callers), never user input.
  for (let i = 0; i < 20; i++) {
    const id = shortId(prefix);
    if (!(await db.get(`SELECT 1 AS x FROM ${table} WHERE id = ?`, id))) return id;
  }
  throw new HttpError(500, 'Could not create a reference number. Please try again.');
}

/** Public and signed-in engagement routes. Admin lists live in admin.ts. */
export function engagementRoutes(ctx: Ctx): Router {
  const { db, config } = ctx;
  const r = Router();
  const contactLimit = limiter(config, 8, HOUR);
  const inquiryLimit = limiter(config, 8, HOUR);
  const callbackLimit = limiter(config, 8, HOUR);
  const newsletterLimit = limiter(config, 8, HOUR);

  // ---- reviews
  r.get('/reviews', validateQuery(reviewsQuery), ah(async (req, res) => {
    const { productId } = req.query as { productId?: string };
    const rows = await db.all<ReviewRow>(
      `${REVIEW_SELECT} WHERE r.approved = 1 AND r.consent_to_publish = 1 ${productId ? 'AND r.product_id = ?' : ''} ORDER BY r.created_at DESC, r.seq DESC LIMIT 500`,
      ...(productId ? [productId] : []),
    );
    res.json(rows.map(reviewOut));
  }));

  const canReview = async (userId: string, productId: string) =>
    !!(await db.get('SELECT 1 AS x FROM orders o JOIN order_items oi ON oi.order_id = o.id WHERE o.user_id = ? AND o.payment_verified = 1 AND oi.product_id = ? LIMIT 1', userId, productId)) &&
    !(await db.get('SELECT 1 AS x FROM reviews WHERE user_id = ? AND product_id = ?', userId, productId));

  r.get('/reviews/eligibility', requireUser, validateQuery(eligibilityQuery), ah(async (req, res) => {
    res.json({ canReview: await canReview(me(req).id, (req.query as { productId: string }).productId) });
  }));

  r.post('/reviews', requireUser, validateBody(reviewBody), ah(async (req, res) => {
    const u = me(req);
    const b = req.body as z.infer<typeof reviewBody>;
    if (!(await canReview(u.id, b.productId))) throw forbidden('Only verified buyers can review a product, once.');
    try {
      await db.run('INSERT INTO reviews (id, product_id, user_id, rating, body, consent_to_publish, approved, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)', uuid(), b.productId, u.id, b.rating, b.body, b.consentToPublish ? 1 : 0, nowIso());
    } catch (e) {
      if (isUniqueError(e)) throw forbidden('Only verified buyers can review a product, once.');
      throw e;
    }
    res.status(204).end();
  }));

  // ---- settings (public by design: never store secrets there)
  r.get('/settings', ah(async (_req, res) => {
    res.json(await readSettings(db));
  }));

  // ---- contact
  r.post('/contact', contactLimit, validateBody(contactBody), ah(async (req, res) => {
    const b = req.body as z.infer<typeof contactBody>;
    await db.run('INSERT INTO contact_messages (id, name, email, message, status, created_at) VALUES (?, ?, ?, ?, ?, ?)', await uniqueId(db, 'contact_messages', 'MSG'), b.name, b.email, b.message, 'new', nowIso());
    notifyContact(config, ctx.mail, b);
    res.status(204).end();
  }));

  // ---- inquiries (custom orders)
  r.post('/inquiries', inquiryLimit, validateBody(inquiryBody), ah(async (req, res) => {
    const b = req.body as z.infer<typeof inquiryBody>;
    const id = await uniqueId(db, 'inquiries', 'INQ');
    await db.run(
      `INSERT INTO inquiries (id, user_id, name, email, product_type, occasion, deadline, budget, style, description, reference_images, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?)`,
      id, req.user?.id ?? null, b.name, b.email, b.productType, b.occasion, b.deadline, b.budget, b.style, b.description, JSON.stringify(b.referenceImages), nowIso(),
    );
    notifyInquiry(config, ctx.mail, { id, ...b });
    res.json({ id });
  }));

  r.get('/inquiries', requireUser, ah(async (req, res) => {
    res.json(await inquiryList(db, 'WHERE user_id = ?', [me(req).id], false));
  }));

  // ---- call-back requests (the number is only ever returned by the admin route)
  r.post('/callbacks', callbackLimit, validateBody(callbackBody), ah(async (req, res) => {
    const b = req.body as z.infer<typeof callbackBody>;
    await db.run('INSERT INTO callback_requests (id, name, phone, topic, preferred, note, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', await uniqueId(db, 'callback_requests', 'CB'), b.name, b.phone, b.topic, b.preferred, b.note, 'new', nowIso());
    notifyCallback(config, ctx.mail, b);
    res.status(204).end();
  }));

  // ---- newsletter
  r.post('/newsletter', newsletterLimit, validateBody(newsletterBody), ah(async (req, res) => {
    const b = req.body as z.infer<typeof newsletterBody>;
    await db.run('INSERT INTO newsletter_subscribers (email, created_at) VALUES (?, ?) ON CONFLICT DO NOTHING', b.email, nowIso()); // duplicates are ignored, still 204
    res.status(204).end();
  }));

  // ---- favorites
  r.get('/favorites', requireUser, ah(async (req, res) => {
    res.json(
      (await db.all<{ product_id: string }>("SELECT f.product_id FROM favorites f JOIN products p ON p.id = f.product_id WHERE f.user_id = ? AND p.status = 'published' ORDER BY f.created_at DESC", me(req).id)).map((f) => f.product_id),
    );
  }));
  const favParam = z.object({ productId: uuidStr });
  const publishedProduct = async (id: unknown) => {
    const p = favParam.safeParse({ productId: id });
    if (!p.success || !(await db.get("SELECT 1 AS x FROM products WHERE id = ? AND status = 'published'", p.data.productId))) throw notFound('Product not found.');
    return p.data.productId;
  };
  r.put('/favorites/:productId', requireUser, ah(async (req, res) => {
    await db.run('INSERT INTO favorites (user_id, product_id, created_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING', me(req).id, await publishedProduct(req.params['productId']), nowIso());
    res.status(204).end();
  }));
  r.delete('/favorites/:productId', requireUser, ah(async (req, res) => {
    const p = favParam.safeParse({ productId: req.params['productId'] });
    if (p.success) await db.run('DELETE FROM favorites WHERE user_id = ? AND product_id = ?', me(req).id, p.data.productId);
    res.status(204).end();
  }));

  return r;
}

interface InquiryRow {
  id: string;
  created_at: string;
  name: string;
  email: string;
  product_type: string;
  occasion: string;
  deadline: string;
  budget: string;
  style: string;
  description: string;
  reference_images: string;
  status: string;
}

/** Inquiry list in API shape. `adminNote` is joined in only when includeNote is true (admin route). */
export async function inquiryList(db: Db, where: string, params: string[], includeNote: boolean) {
  const rows = await db.all<InquiryRow>(
    `SELECT id, created_at, name, email, product_type, occasion, deadline, budget, style, description, reference_images, status FROM inquiries ${where} ORDER BY created_at DESC, seq DESC LIMIT 5000`,
    ...params,
  );
  const notes = includeNote ? new Map((await db.all<{ target_id: string; note: string }>("SELECT target_id, note FROM admin_notes WHERE kind = 'inquiry'")).map((n) => [n.target_id, n.note])) : null;
  return rows.map((i) => {
    const note = notes?.get(i.id);
    return {
      id: i.id,
      createdAt: i.created_at,
      name: i.name,
      email: i.email,
      productType: i.product_type,
      occasion: i.occasion,
      deadline: i.deadline,
      budget: i.budget,
      style: i.style,
      description: i.description,
      referenceImages: JSON.parse(i.reference_images) as string[],
      status: i.status,
      ...(note ? { adminNote: note } : {}),
    };
  });
}

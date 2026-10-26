import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { razorpayConfigured, simulatorAllowed } from '../config.js';
import type { Ctx } from '../context.js';
import { nowIso } from '../db.js';
import { HttpError, badRequest, conflict, forbidden, notFound } from '../errors.js';
import { ah } from '../middleware/async.js';
import { me, requireUser } from '../middleware/auth.js';
import { MINUTE, userLimiter } from '../middleware/rate.js';
import { validateBody } from '../middleware/validate.js';
import { email, privatePath, text, textOpt, uuidStr } from '../schemas.js';
import { SIGN_TTL_DOWNLOAD, randomName, removeFileQuiet, safeName, signedUrl } from '../services/files.js';
import { notifyDeliveryReady, notifyOrderPaid } from '../services/mail.js';
import { loadOrder, loadOrders, markOrderPaid } from '../services/orders.js';
import { quoteFromDb, type CartLineInput } from '../services/pricing.js';
import { checkoutSignatureValid, createRazorpayOrder, fetchRazorpayPayment } from '../services/razorpay.js';
import { uuid } from '../util.js';
import { LIMITS, makeUploader } from './uploads.js';

// ---------------------------------------------------------------- schemas
const customization = z.object({
  fields: z
    .record(z.string().trim().max(2000))
    .refine((o) => Object.keys(o).length <= 30 && Object.keys(o).every((k) => k.length <= 60), 'Too many customization fields.')
    .default({}),
  paletteId: textOpt(60),
  fontId: textOpt(60),
  photos: z.array(privatePath).max(12).default([]),
  notes: textOpt(2000),
});

// Cart items are NOT strict: a client-sent `price` (or any other extra) is simply ignored; prices come from the database.
const cartItem = z.object({
  key: text(100, 1),
  productId: text(64, 1),
  qty: z.number({ invalid_type_error: 'Quantity must be a number.' }).finite(),
  customization: customization.optional(),
});
const couponField = z.string().trim().max(40).nullish();

const quoteBody = z.object({ items: z.array(cartItem).max(50), coupon: couponField }).strict();

const PHONE_RE = /^\+?[0-9\s-]{10,16}$/;
const checkoutBody = z
  .object({
    items: z.array(cartItem).max(50),
    coupon: couponField,
    customer: z
      .object({
        name: text(120, 1, 'Please enter your name.'),
        email,
        phone: z.string().trim().regex(PHONE_RE, 'Please enter a valid phone number.'),
      })
      .strict(),
    acceptedTerms: z.boolean(),
  })
  .strict();

const verifyBody = z.object({
  outcome: z.enum(['success', 'failed', 'cancelled', 'pending']).optional(),
  razorpay_order_id: z.string().trim().regex(/^[A-Za-z0-9_]{5,64}$/).optional(),
  razorpay_payment_id: z.string().trim().regex(/^[A-Za-z0-9_]{5,64}$/).optional(),
  razorpay_signature: z.string().trim().max(200).optional(),
});

const ORDER_STATUSES = ['pending', 'paid', 'failed', 'cancelled', 'refunded', 'in_progress', 'delivered'] as const;
const statusBody = z.object({ status: z.enum(ORDER_STATUSES) }).strict();
const noteBody = z.object({ note: z.string().trim().max(2000, 'Notes can be at most 2000 characters.') }).strict();

const orderId = (v: unknown) => {
  const r = uuidStr.safeParse(v);
  return r.success ? r.data : null;
};

// ---------------------------------------------------------------- customer routes
export function orderRoutes(ctx: Ctx): Router {
  const { db, config } = ctx;
  const r = Router();
  const createLimit = userLimiter(config, 10, MINUTE);
  const verifyLimit = userLimiter(config, 20, MINUTE);
  const downloadLimit = userLimiter(config, 30, MINUTE);

  r.post('/quote', validateBody(quoteBody), ah(async (req, res) => {
    const b = req.body as z.infer<typeof quoteBody>;
    res.json(await quoteFromDb(db, b.items as CartLineInput[], b.coupon));
  }));

  r.post('/orders', requireUser, createLimit, validateBody(checkoutBody), ah(async (req, res) => {
    const user = me(req);
    const b = req.body as z.infer<typeof checkoutBody>;
    if (!b.acceptedTerms) throw badRequest('Please accept the terms and delivery policy.');
    if (!b.items.length) throw badRequest('Your bag is empty.');

    const provider = razorpayConfigured(config) ? 'razorpay' : simulatorAllowed(config) ? 'simulator' : null;
    if (!provider) throw new HttpError(503, 'Payments are not configured yet.');

    // Every number comes from the database; whatever the browser claims about prices is ignored.
    const q = await quoteFromDb(db, b.items as CartLineInput[], b.coupon);
    if (!q.lines.length) throw badRequest('Your bag has no purchasable items.');
    if (b.coupon?.trim() && !q.couponApplied) throw badRequest(q.couponMessage ?? 'That coupon code is not valid.');
    if (q.total <= 0) throw badRequest('The order total must be at least ₹1.');

    const id = uuid();
    const amountPaise = q.total * 100;
    let providerOrderId: string | null = null;
    if (provider === 'razorpay') providerOrderId = (await createRazorpayOrder(config, { amountPaise, receipt: id })).id;

    // Match each priced line back to the cart entry that produced it (to copy its customization).
    const used = new Set<number>();
    const lineCustomization = q.lines.map((l) => {
      const idx = b.items.findIndex((it, i) => !used.has(i) && it.key === l.key && it.productId === l.productId);
      if (idx >= 0) used.add(idx);
      return idx >= 0 ? b.items[idx]!.customization : undefined;
    });

    await db.tx(async () => {
      await db.run(
        `INSERT INTO orders (id, user_id, email, customer_name, phone, status, payment_verified, subtotal, discount, total, coupon_code, created_at)
         VALUES (?, ?, ?, ?, ?, 'pending', 0, ?, ?, ?, ?, ?)`,
        id, user.id, b.customer.email, b.customer.name, b.customer.phone, q.subtotal, q.discount, q.total, q.couponApplied ?? null, nowIso(),
      );
      for (const [i, l] of q.lines.entries()) {
        const c = lineCustomization[i];
        await db.run('INSERT INTO order_items (order_id, product_id, title, qty, unit_price, customization) VALUES (?, ?, ?, ?, ?, ?)', id, l.productId, l.title, l.qty, l.unit, c ? JSON.stringify(c) : null);
      }
      await db.run(
        `INSERT INTO payments (order_id, provider, provider_order_id, provider_payment_id, status, amount_paise, created_at) VALUES (?, ?, ?, NULL, 'created', ?, ?)`,
        id, provider, providerOrderId, amountPaise, nowIso(),
      );
    });

    if (provider === 'razorpay') res.json({ provider, orderId: id, providerOrderId, amountPaise, keyId: config.razorpay.keyId });
    else res.json({ provider, orderId: id, amountPaise });
  }));

  r.post('/orders/:id/verify', requireUser, verifyLimit, validateBody(verifyBody), ah(async (req, res) => {
    const user = me(req);
    const b = req.body as z.infer<typeof verifyBody>;
    const id = orderId(req.params['id']);
    const order = id ? await db.get<{ id: string; total: number; payment_verified: number }>('SELECT id, total, payment_verified FROM orders WHERE id = ? AND user_id = ?', id, user.id) : undefined;
    if (!order) throw notFound('Order not found.');
    // Idempotent: a verified order is returned unchanged whatever the payload says.
    if (order.payment_verified) return res.json(await loadOrder(db, order.id, false));

    const pay = await db.get<{ provider: 'razorpay' | 'simulator'; provider_order_id: string | null }>(
      "SELECT provider, provider_order_id FROM payments WHERE order_id = ? AND status = 'created' ORDER BY id LIMIT 1", order.id);

    if (b.outcome !== undefined) {
      // ---- simulator (impossible in production: simulatorAllowed() is false whenever NODE_ENV=production)
      if (!simulatorAllowed(config)) throw forbidden('The payment simulator is not available.');
      if (pay?.provider !== 'simulator') throw badRequest('This order is paid through Razorpay.');
      if (b.outcome === 'success') {
        const first = await markOrderPaid(db, { orderId: order.id, provider: 'simulator', providerPaymentId: `sim_${order.id}`, providerOrderId: null, amountPaise: order.total * 100, raw: { simulator: true } });
        if (first) await notifyOrderPaid(config, db, ctx.mail, order.id);
      } else if (b.outcome === 'failed' || b.outcome === 'cancelled') {
        await db.run('UPDATE orders SET status = ? WHERE id = ? AND payment_verified = 0', b.outcome, order.id);
      }
      return res.json(await loadOrder(db, order.id, false));
    }

    // ---- Razorpay
    if (!b.razorpay_order_id || !b.razorpay_payment_id || !b.razorpay_signature) throw badRequest('Missing payment details.');
    if (!razorpayConfigured(config)) throw new HttpError(503, 'Payments are not configured yet.');
    if (pay?.provider !== 'razorpay' || !pay.provider_order_id) throw badRequest('This order is not paid through Razorpay.');
    if (pay.provider_order_id !== b.razorpay_order_id) throw badRequest('Payment does not match this order.');
    if (!checkoutSignatureValid(config.razorpay.keySecret, b.razorpay_order_id, b.razorpay_payment_id, b.razorpay_signature)) {
      throw badRequest('Payment signature could not be verified.');
    }
    const payment = await fetchRazorpayPayment(config, b.razorpay_payment_id);
    if (payment.id !== b.razorpay_payment_id || payment.order_id !== b.razorpay_order_id) throw badRequest('Payment does not match this order.');
    if (payment.status !== 'captured') throw conflict('Payment is not captured yet. If you were charged, it will be reconciled automatically.');
    if (payment.amount !== order.total * 100 || (payment.currency && payment.currency !== 'INR')) throw conflict('Payment amount did not match the order.');

    const first = await markOrderPaid(db, { orderId: order.id, provider: 'razorpay', providerPaymentId: payment.id, providerOrderId: b.razorpay_order_id, amountPaise: payment.amount, raw: payment });
    if (first) await notifyOrderPaid(config, db, ctx.mail, order.id); // only the first verification emails
    res.json(await loadOrder(db, order.id, false));
  }));

  r.get('/orders', requireUser, ah(async (req, res) => {
    res.json(await loadOrders(db, { where: 'user_id = ?', params: [me(req).id], includeNote: false }));
  }));

  r.get('/orders/:id', requireUser, ah(async (req, res) => {
    const user = me(req);
    const id = orderId(req.params['id']);
    const owner = id ? await db.get<{ user_id: string }>('SELECT user_id FROM orders WHERE id = ?', id) : undefined;
    // 404 (not 403) for other people's orders, so ids cannot be probed.
    if (!id || !owner || (owner.user_id !== user.id && user.role !== 'admin')) throw notFound('Order not found.');
    res.json(await loadOrder(db, id, user.role === 'admin'));
  }));

  r.get('/orders/:id/download/:productId', requireUser, downloadLimit, ah(async (req, res) => {
    const user = me(req);
    const id = orderId(req.params['id']);
    const productId = orderId(req.params['productId']);
    const order = id ? await db.get<{ id: string; payment_verified: number }>('SELECT id, payment_verified FROM orders WHERE id = ? AND user_id = ?', id, user.id) : undefined;
    if (!order) throw notFound('Order not found.');
    if (!order.payment_verified) throw forbidden('Downloads unlock only after a verified payment.');
    if (!productId || !(await db.get('SELECT 1 AS x FROM order_items WHERE order_id = ? AND product_id = ?', order.id, productId))) throw notFound('That item is not part of this order.');

    const made = await db.get<{ file_path: string }>('SELECT file_path FROM deliverables WHERE order_id = ? AND product_id = ?', order.id, productId);
    if (made) return void res.json({ url: signedUrl(config, made.file_path, SIGN_TTL_DOWNLOAD, { download: true }) });

    const product = await db.get<{ customizable: number }>('SELECT customizable FROM products WHERE id = ?', productId);
    if (product?.customizable) throw conflict('This item is prepared by hand. We will email you as soon as your files are ready.');
    const file = await db.get<{ file_path: string }>('SELECT file_path FROM product_files WHERE product_id = ?', productId);
    if (!file) throw notFound('No file is attached to this product yet.');
    res.json({ url: signedUrl(config, file.file_path, SIGN_TTL_DOWNLOAD, { download: true }) });
  }));

  return r;
}

// ---------------------------------------------------------------- admin routes (mounted under /api/admin)
export function adminOrderRoutes(ctx: Ctx): Router {
  const { db, config, files } = ctx;
  const r = Router();

  r.get('/orders', ah(async (_req, res) => {
    res.json(await loadOrders(db, { includeNote: true }));
  }));

  r.patch('/orders/:id', validateBody(statusBody), ah(async (req, res) => {
    const id = orderId(req.params['id']);
    const o = id ? await db.get<{ payment_verified: number }>('SELECT payment_verified FROM orders WHERE id = ?', id) : undefined;
    if (!id || !o) throw notFound('Order not found.');
    const { status } = req.body as z.infer<typeof statusBody>;
    const needsPayment = ['paid', 'in_progress', 'delivered', 'refunded'].includes(status);
    if (needsPayment && !o.payment_verified) throw conflict('This order has no verified payment, so it cannot be marked as ' + status.replace('_', ' ') + '.');
    if (o.payment_verified && (status === 'pending' || status === 'failed')) throw conflict('A paid order cannot go back to pending or failed.');
    await db.run('UPDATE orders SET status = ? WHERE id = ?', status, id);
    res.status(204).end();
  }));

  r.put('/orders/:id/note', validateBody(noteBody), ah(async (req, res) => {
    const id = orderId(req.params['id']);
    if (!id || !(await db.get('SELECT 1 AS x FROM orders WHERE id = ?', id))) throw notFound('Order not found.');
    const { note } = req.body as z.infer<typeof noteBody>;
    await db.run("INSERT INTO admin_notes (kind, target_id, note, updated_at) VALUES ('order', ?, ?, ?) ON CONFLICT(kind, target_id) DO UPDATE SET note = excluded.note, updated_at = excluded.updated_at", id, note, nowIso());
    res.status(204).end();
  }));

  // The order is checked BEFORE the (up to 200 MB) body is accepted.
  const preflight: RequestHandler = ah(async (req, _res, next) => {
    const id = orderId(req.params['id']);
    const productId = orderId(req.params['productId']);
    const o = id ? await db.get<{ payment_verified: number }>('SELECT payment_verified FROM orders WHERE id = ?', id) : undefined;
    if (!id || !o) return next(notFound('Order not found.'));
    if (!o.payment_verified) return next(conflict('This order has no verified payment yet.'));
    if (!productId || !(await db.get('SELECT 1 AS x FROM order_items WHERE order_id = ? AND product_id = ?', id, productId))) return next(notFound('That item is not part of this order.'));
    next();
  });
  const receive = makeUploader(ctx, LIMITS.file);

  r.post('/orders/:id/deliverables/:productId', preflight, receive, ah(async (req, res) => {
    const id = orderId(req.params['id'])!;
    const productId = orderId(req.params['productId'])!;
    const file = req.file;
    if (!file) throw badRequest('Choose a file to upload.');
    const stored = `${randomName()}-${safeName(file.originalname)}`;
    const dest = `private/${stored}`;
    try {
      await files.save(dest, file.path);
    } finally {
      removeFileQuiet(file.path);
    }
    let oldPath: string | undefined;
    try {
      await db.tx(async () => {
        oldPath = (await db.get<{ file_path: string }>('SELECT file_path FROM deliverables WHERE order_id = ? AND product_id = ?', id, productId))?.file_path;
        await db.run(
          `INSERT INTO deliverables (order_id, product_id, file_path, file_name, created_at) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(order_id, product_id) DO UPDATE SET file_path = excluded.file_path, file_name = excluded.file_name, created_at = excluded.created_at`,
          id, productId, `private/${stored}`, safeName(file.originalname), nowIso(),
        );
        // Delivered ONLY when every personalized item (customization present) has its final file.
        const personalized = await db.all<{ product_id: string }>('SELECT DISTINCT product_id FROM order_items WHERE order_id = ? AND customization IS NOT NULL', id);
        const have = new Set((await db.all<{ product_id: string }>('SELECT product_id FROM deliverables WHERE order_id = ?', id)).map((d) => d.product_id));
        if (personalized.length && personalized.every((p) => have.has(p.product_id))) {
          await db.run("UPDATE orders SET status = 'delivered' WHERE id = ? AND payment_verified = 1 AND status IN ('paid', 'in_progress')", id);
        }
      });
    } catch (e) {
      await files.remove(dest);
      throw e;
    }
    if (oldPath && oldPath !== dest) await files.remove(oldPath);
    await notifyDeliveryReady(config, db, ctx.mail, id, productId);
    res.status(204).end();
  }));

  return r;
}

import express, { Router } from 'express';
import type { Ctx } from '../context.js';
import { HttpError, badRequest } from '../errors.js';
import { ah } from '../middleware/async.js';
import { notifyOrderPaid } from '../services/mail.js';
import { markOrderPaid } from '../services/orders.js';
import { webhookSignatureValid } from '../services/razorpay.js';

interface WebhookPayment {
  id?: unknown;
  order_id?: unknown;
  status?: unknown;
  amount?: unknown;
}

/**
 * Razorpay webhook. MUST be mounted before express.json(): the HMAC is computed over the exact raw bytes.
 * Authenticated only by that signature (no cookie, no CSRF concerns).
 */
export function paymentWebhookRoutes(ctx: Ctx): Router {
  const { db, config } = ctx;
  const r = Router();

  r.post(
    '/payments/razorpay/webhook',
    express.raw({ type: () => true, limit: '1mb' }),
    ah(async (req, res) => {
      const secret = config.razorpay.webhookSecret;
      if (!secret) throw new HttpError(503, 'Payments are not configured yet.');
      const signature = String(req.headers['x-razorpay-signature'] ?? '');
      const raw = req.body;
      if (!Buffer.isBuffer(raw) || !signature || !webhookSignatureValid(secret, raw, signature)) throw badRequest('Invalid signature.');

      let event: { event?: string; payload?: { payment?: { entity?: WebhookPayment } } };
      try {
        event = JSON.parse(raw.toString('utf8'));
      } catch {
        throw badRequest('The request body is not valid JSON.');
      }
      const payment = event?.payload?.payment?.entity;
      const providerOrderId = typeof payment?.order_id === 'string' ? payment.order_id : null;
      if (!payment || !providerOrderId) return void res.json({ ok: true, ignored: true });

      const row = await db.get<{ order_id: string }>("SELECT order_id FROM payments WHERE provider = 'razorpay' AND provider_order_id = ? LIMIT 1", providerOrderId);
      if (!row) return void res.json({ ok: true, ignored: true });

      if (event.event === 'payment.captured' || event.event === 'order.paid') {
        if (typeof payment.id !== 'string' || typeof payment.amount !== 'number' || payment.status !== 'captured') return void res.json({ ok: true, ignored: true });
        try {
          const first = await markOrderPaid(db, { orderId: row.order_id, provider: 'razorpay', providerPaymentId: payment.id, providerOrderId, amountPaise: payment.amount, raw: payment });
          if (first) await notifyOrderPaid(config, db, ctx.mail, row.order_id);
        } catch (e) {
          if (e instanceof HttpError) {
            // Not retryable (e.g. amount mismatch): acknowledge so Razorpay stops retrying, but leave a trace.
            ctx.log.warn(`[webhook] ignored ${event.event} for order ${row.order_id}: ${e.message}`);
            return void res.json({ ok: true, ignored: true });
          }
          throw e;
        }
      } else if (event.event === 'payment.failed') {
        await db.run("UPDATE orders SET status = 'failed' WHERE id = ? AND payment_verified = 0 AND status = 'pending'", row.order_id);
      }
      res.json({ ok: true }); // duplicates are safe: markOrderPaid is idempotent
    }),
  );

  return r;
}

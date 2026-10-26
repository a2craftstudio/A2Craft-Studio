import type { Db } from '../db.js';
import { nowIso } from '../db.js';
import { HttpError } from '../errors.js';
import { bool } from '../util.js';

interface OrderRow {
  id: string;
  user_id: string;
  email: string;
  customer_name: string;
  status: string;
  payment_verified: number;
  total: number;
  coupon_code: string | null;
  created_at: string;
}

export interface OrderOut {
  id: string;
  createdAt: string;
  status: string;
  paymentVerified: boolean;
  total: number;
  email: string;
  customerName: string;
  adminNote?: string;
  items: { productId: string; title: string; qty: number; unit: number; customization?: unknown; deliverable?: string }[];
}

/**
 * Loads orders in the API shape. `adminNote` is only ever selected when includeNote is true (admin routes), so a customer
 * code path has no way to return it.
 */
export async function loadOrders(db: Db, opts: { where?: string; params?: (string | number)[]; includeNote: boolean; limit?: number }): Promise<OrderOut[]> {
  const params = opts.params ?? [];
  const limit = Math.max(1, Math.min(Math.trunc(opts.limit ?? 5000), 5000)); // a number computed here, never user text
  const rows = await db.all<OrderRow>(
    `SELECT id, user_id, email, customer_name, status, payment_verified, total, coupon_code, created_at FROM orders ${opts.where ? 'WHERE ' + opts.where : ''} ORDER BY created_at DESC, seq DESC LIMIT ${limit}`,
    ...params,
  );
  if (!rows.length) return [];
  const scope = `order_id IN (SELECT id FROM orders ${opts.where ? 'WHERE ' + opts.where : ''} ORDER BY created_at DESC, seq DESC LIMIT ${limit})`;
  const items = await db.all<{ order_id: string; product_id: string; title: string; qty: number; unit_price: number; customization: string | null }>(
    `SELECT order_id, product_id, title, qty, unit_price, customization FROM order_items WHERE ${scope} ORDER BY id`,
    ...params,
  );
  const deliverables = await db.all<{ order_id: string; product_id: string; file_name: string }>(`SELECT order_id, product_id, file_name FROM deliverables WHERE ${scope}`, ...params);
  const notes = opts.includeNote
    ? new Map((await db.all<{ target_id: string; note: string }>("SELECT target_id, note FROM admin_notes WHERE kind = 'order'")).map((n) => [n.target_id, n.note]))
    : null;
  const dmap = new Map(deliverables.map((d) => [`${d.order_id}:${d.product_id}`, d.file_name]));
  const byOrder = new Map<string, OrderOut['items']>();
  for (const i of items) {
    const list = byOrder.get(i.order_id) ?? byOrder.set(i.order_id, []).get(i.order_id)!;
    const d = dmap.get(`${i.order_id}:${i.product_id}`);
    list.push({
      productId: i.product_id,
      title: i.title,
      qty: i.qty,
      unit: i.unit_price,
      ...(i.customization ? { customization: JSON.parse(i.customization) as unknown } : {}),
      ...(d !== undefined ? { deliverable: d } : {}),
    });
  }
  return rows.map((o) => {
    const note = notes?.get(o.id);
    return {
      id: o.id,
      createdAt: o.created_at,
      status: o.status,
      paymentVerified: bool(o.payment_verified),
      total: o.total,
      email: o.email,
      customerName: o.customer_name,
      ...(note ? { adminNote: note } : {}),
      items: byOrder.get(o.id) ?? [],
    };
  });
}

export const loadOrder = async (db: Db, id: string, includeNote: boolean) => (await loadOrders(db, { where: 'id = ?', params: [id], includeNote }))[0];

export interface PaidInput {
  orderId: string;
  provider: 'razorpay' | 'simulator';
  providerPaymentId: string;
  providerOrderId: string | null;
  amountPaise: number;
  raw: unknown;
}

/**
 * The ONE place an order becomes paid. Runs in a single transaction and is idempotent under concurrency:
 *  - the order row is locked (SELECT ... FOR UPDATE), so concurrent verify/webhook calls for the same order run one
 *    after the other and the later ones see it already verified,
 *  - the payment row is unique on provider_payment_id (INSERT ... ON CONFLICT DO NOTHING: a replay inserts nothing, and
 *    the same payment id on a different order is refused),
 *  - an already-verified order is left alone and the coupon is NOT counted again,
 *  - the coupon counter only moves while it is below max_uses (atomic guard). A payment that was already captured is
 *    never refused because a coupon filled up in the meantime; the counter simply stays at its cap.
 * Returns true only for the call that actually flipped the order to paid (that call sends the emails).
 */
export function markOrderPaid(db: Db, p: PaidInput): Promise<boolean> {
  return db.tx(async () => {
    const o = await db.get<{ id: string; total: number; payment_verified: number; coupon_code: string | null }>(
      'SELECT id, total, payment_verified, coupon_code FROM orders WHERE id = ? FOR UPDATE',
      p.orderId,
    );
    if (!o) throw new HttpError(404, 'Order not found.');
    if (p.amountPaise !== o.total * 100) throw new HttpError(409, 'Payment amount did not match the order.');

    const inserted = await db.run(
      `INSERT INTO payments (order_id, provider, provider_order_id, provider_payment_id, status, amount_paise, raw, created_at)
       VALUES (?, ?, ?, ?, 'captured', ?, ?, ?)
       ON CONFLICT (provider_payment_id) DO NOTHING`,
      p.orderId, p.provider, p.providerOrderId, p.providerPaymentId, p.amountPaise, JSON.stringify(p.raw ?? null), nowIso(),
    );
    if (inserted.changes === 0) {
      const existing = await db.get<{ order_id: string }>('SELECT order_id FROM payments WHERE provider_payment_id = ?', p.providerPaymentId);
      if (existing && existing.order_id !== p.orderId) throw new HttpError(409, 'That payment belongs to a different order.');
    }
    if (o.payment_verified) return false;

    const flipped = await db.run("UPDATE orders SET payment_verified = 1, status = 'paid' WHERE id = ? AND payment_verified = 0", p.orderId);
    if (flipped.changes !== 1) return false;
    if (o.coupon_code) {
      await db.run('UPDATE coupons SET used_count = used_count + 1 WHERE code = ? AND (max_uses IS NULL OR used_count < max_uses)', o.coupon_code);
    }
    return true;
  });
}

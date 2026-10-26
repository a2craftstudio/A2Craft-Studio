import type { Db } from '../db.js';

export interface CartLineInput {
  key: string;
  productId: string;
  qty: number;
}
export interface Quote {
  lines: { key: string; productId: string; title: string; unit: number; qty: number; total: number }[];
  subtotal: number;
  discount: number;
  total: number;
  couponApplied?: string;
  couponMessage?: string;
}
export interface PricedProduct {
  id: string;
  title: string;
  priceInr: number;
}
export interface CouponDef {
  code: string;
  percent?: number | null;
  flatInr?: number | null;
  minSubtotal?: number;
  active: boolean;
  endsAt?: string | null;
  maxUses?: number | null;
  used?: number;
}

/**
 * Pure price calculation (port of src/app/core/pricing.ts). Prices come from the catalog passed in, never from the cart.
 * `products` must contain published products only.
 */
export function computeQuote(items: CartLineInput[], products: PricedProduct[], couponCode: string | undefined | null, coupons: CouponDef[], now = Date.now()): Quote {
  const lines: Quote['lines'] = [];
  for (const it of items) {
    const p = products.find((x) => x.id === it.productId);
    if (!p) continue;
    const qty = Math.max(1, Math.min(10, Math.floor(it.qty)));
    lines.push({ key: it.key, productId: p.id, title: p.title, unit: p.priceInr, qty, total: p.priceInr * qty });
  }
  const subtotal = lines.reduce((s, l) => s + l.total, 0);
  let discount = 0;
  let couponApplied: string | undefined;
  let couponMessage: string | undefined;
  if (couponCode?.trim()) {
    const wanted = couponCode.trim().toLowerCase();
    const c = coupons.find((x) => x.code.toLowerCase() === wanted && x.active);
    if (!c) couponMessage = 'That coupon code is not valid.';
    // endsAt is the last valid day, in India time: the coupon works until the end of that day (+05:30).
    else if (c.endsAt && now > new Date(c.endsAt + 'T23:59:59.999+05:30').getTime()) couponMessage = 'This coupon has expired.';
    else if (c.maxUses != null && (c.used ?? 0) >= c.maxUses) couponMessage = 'This coupon has been fully used.';
    else if (c.minSubtotal && subtotal < c.minSubtotal) couponMessage = `This coupon needs a subtotal of at least ₹${c.minSubtotal}.`;
    else {
      discount = c.percent ? Math.floor((subtotal * c.percent) / 100) : Math.min(c.flatInr ?? 0, subtotal);
      couponApplied = c.code.toUpperCase();
      couponMessage = `Coupon ${couponApplied} applied.`;
    }
  }
  const out: Quote = { lines, subtotal, discount, total: Math.max(0, subtotal - discount) };
  if (couponApplied !== undefined) out.couponApplied = couponApplied;
  if (couponMessage !== undefined) out.couponMessage = couponMessage;
  return out;
}

interface CouponRow {
  code: string;
  percent: number | null;
  flat_inr: number | null;
  min_subtotal: number;
  active: number;
  ends_at: string | null;
  max_uses: number | null;
  used_count: number;
}

export const couponFromRow = (r: CouponRow): CouponDef => ({
  code: r.code,
  percent: r.percent,
  flatInr: r.flat_inr,
  minSubtotal: r.min_subtotal,
  active: r.active === 1,
  endsAt: r.ends_at,
  maxUses: r.max_uses,
  used: r.used_count,
});

/** Quote straight from the database: published products only, coupon looked up (case-insensitively) by code. */
export async function quoteFromDb(db: Db, items: CartLineInput[], couponCode?: string | null, now = Date.now()): Promise<Quote> {
  const ids = [...new Set(items.map((i) => i.productId))];
  const products: PricedProduct[] = ids.length
    ? (
        await db.all<{ id: string; title: string; price_inr: number }>(
          `SELECT id, title, price_inr FROM products WHERE status = 'published' AND id IN (${ids.map(() => '?').join(',')})`,
          ...ids,
        )
      ).map((r) => ({ id: r.id, title: r.title, priceInr: r.price_inr }))
    : [];
  const code = couponCode?.trim();
  const coupons = code ? (await db.all<CouponRow>('SELECT * FROM coupons WHERE upper(code) = upper(?)', code)).map(couponFromRow) : [];
  return computeQuote(items, products, couponCode, coupons, now);
}

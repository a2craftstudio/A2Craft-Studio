import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import request from 'supertest';
import { computeQuote, type CouponDef } from '../src/services/pricing.js';
import { addCoupon, adminAgent, cartOf, makeApp, makeProduct, type Agent, type Harness } from './helpers.js';

describe('computeQuote (pure)', () => {
  const products = [
    { id: 'a', title: 'Card', priceInr: 149 },
    { id: 'b', title: 'Book', priceInr: 499 },
  ];
  const coupons: CouponDef[] = [
    { code: 'TEN', percent: 10, active: true },
    { code: 'BIG', flatInr: 500, minSubtotal: 2000, active: true },
    { code: 'OFF', percent: 50, active: false },
  ];
  const line = (productId: string, qty = 1) => ({ key: productId, productId, qty });

  test('clamps quantity to 1..10 and skips unknown products', () => {
    assert.equal(computeQuote([line('a', 99)], products, undefined, coupons).total, 1490);
    assert.equal(computeQuote([line('a', 0)], products, undefined, coupons).total, 149);
    assert.equal(computeQuote([line('a', 2.9)], products, undefined, coupons).total, 298);
    assert.deepEqual(computeQuote([line('zzz')], products, undefined, coupons).lines, []);
  });

  test('percent is floored; coupon match is case-insensitive and trimmed', () => {
    const q = computeQuote([line('b')], products, ' ten ', coupons);
    assert.equal(q.discount, 49);
    assert.equal(q.total, 450);
    assert.equal(q.couponApplied, 'TEN');
    assert.equal(q.couponMessage, 'Coupon TEN applied.');
  });

  test('flat coupon is capped at the subtotal and honours minSubtotal', () => {
    assert.equal(computeQuote([line('a')], products, 'BIG', coupons).couponMessage, 'This coupon needs a subtotal of at least ₹2000.');
    const big = [{ code: 'FLAT', flatInr: 5000, active: true }];
    const q = computeQuote([line('a')], products, 'flat', big);
    assert.equal(q.discount, 149);
    assert.equal(q.total, 0);
  });

  test('inactive and unknown coupons share the same message', () => {
    assert.equal(computeQuote([line('a')], products, 'OFF', coupons).couponMessage, 'That coupon code is not valid.');
    assert.equal(computeQuote([line('a')], products, 'NOPE', coupons).couponMessage, 'That coupon code is not valid.');
  });

  test('endsAt is the end of that day in India time (+05:30)', () => {
    const c: CouponDef[] = [{ code: 'DAY', percent: 10, active: true, endsAt: '2026-03-10' }];
    const lastMoment = Date.parse('2026-03-10T23:59:59.000+05:30');
    assert.equal(computeQuote([line('a')], products, 'DAY', c, lastMoment).couponApplied, 'DAY');
    // 2026-03-10 18:30:00 UTC is exactly midnight IST: the next day.
    assert.equal(computeQuote([line('a')], products, 'DAY', c, Date.parse('2026-03-10T18:30:01Z')).couponMessage, 'This coupon has expired.');
    assert.equal(computeQuote([line('a')], products, 'DAY', c, Date.parse('2026-03-10T18:29:00Z')).couponApplied, 'DAY');
  });

  test('maxUses / used', () => {
    const c: CouponDef[] = [{ code: 'ONE', percent: 10, active: true, maxUses: 2, used: 2 }];
    assert.equal(computeQuote([line('a')], products, 'ONE', c).couponMessage, 'This coupon has been fully used.');
    assert.equal(computeQuote([line('a')], products, 'ONE', [{ ...c[0]!, used: 1 }]).couponApplied, 'ONE');
  });
});

describe('POST /api/quote (from the database)', () => {
  let h: Harness;
  let admin: Agent;
  let card: { id: string };
  let draft: { id: string };
  before(async () => {
    h = await makeApp();
    admin = await adminAgent(h);
    card = await makeProduct(admin, { priceInr: 149 });
    draft = await makeProduct(admin, { priceInr: 100, status: 'draft' });
    await addCoupon(admin, 'TEN', { percent: 10 });
    await addCoupon(admin, 'BIG', { flatInr: 500, minSubtotal: 2000 });
    await addCoupon(admin, 'OLD', { percent: 10, endsAt: '2020-01-01' });
    await addCoupon(admin, 'LASTONE', { percent: 10, maxUses: 1 });
    await h.ctx.db.run("UPDATE coupons SET used_count = 1 WHERE code = 'LASTONE'");
  });
  after(() => h.cleanup());

  const quote = (items: unknown[], coupon?: string) => request(h.app).post('/api/quote').send({ items, ...(coupon !== undefined ? { coupon } : {}) });

  test('uses database prices and ignores a client-sent price', async () => {
    const res = await quote([{ ...cartOf(card.id, 1), price: 1, priceInr: 1, unit: 1 }]);
    assert.equal(res.status, 200);
    assert.equal(res.body.total, 149);
    assert.deepEqual(res.body.lines[0], { key: res.body.lines[0].key, productId: card.id, title: 'Blush wedding invitation', unit: 149, qty: 1, total: 149 });
  });

  test('draft/unknown products are skipped; qty is clamped', async () => {
    assert.deepEqual((await quote([cartOf(draft.id)])).body.lines, []);
    assert.equal((await quote([cartOf(card.id, 500)])).body.total, 1490);
    assert.equal((await quote([cartOf(card.id, -3)])).body.total, 149);
  });

  test('coupon messages: valid, expired, used up, minimum, unknown', async () => {
    const four = cartOf(card.id, 4); // 596
    assert.deepEqual(
      { d: (await quote([four], ' ten ')).body.discount, m: (await quote([four], 'TEN')).body.couponMessage },
      { d: 59, m: 'Coupon TEN applied.' },
    );
    assert.equal((await quote([four], 'OLD')).body.couponMessage, 'This coupon has expired.');
    assert.equal((await quote([four], 'LASTONE')).body.couponMessage, 'This coupon has been fully used.');
    assert.equal((await quote([four], 'BIG')).body.couponMessage, 'This coupon needs a subtotal of at least ₹2000.');
    assert.equal((await quote([four], 'WHAT')).body.couponMessage, 'That coupon code is not valid.');
    const none = await quote([four]);
    assert.equal(none.body.couponMessage, undefined);
    assert.equal(none.body.discount, 0);
  });

  test('flat coupon on a large cart', async () => {
    const res = await quote([cartOf(card.id, 10, { key: 'x' }), { key: 'y', productId: card.id, qty: 10 }], 'BIG');
    assert.equal(res.body.subtotal, 2980);
    assert.equal(res.body.discount, 500);
    assert.equal(res.body.total, 2480);
    assert.equal(res.body.couponApplied, 'BIG');
  });

  test('invalid bodies return 400', async () => {
    assert.equal((await request(h.app).post('/api/quote').send({})).status, 400);
    assert.equal((await quote([{ key: 'k', productId: card.id, qty: 'many' }])).status, 400);
    assert.equal((await request(h.app).post('/api/quote').send({ items: [], extra: 1 })).status, 400);
  });
});

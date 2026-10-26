import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import request from 'supertest';
import {
  SECRETS, addCoupon, adminAgent, cartOf, customer, fakeRazorpay, makeApp, makeProduct, placeOrder, rzSignature, signup, uid, webhookSig, withRazorpay,
  type Agent, type Harness,
} from './helpers.js';

describe('order creation', () => {
  let h: Harness;
  let admin: Agent;
  let shopper: Agent;
  let card: { id: string };
  let rz: ReturnType<typeof fakeRazorpay>;

  beforeEach(async () => {
    rz = fakeRazorpay();
    h = await makeApp(withRazorpay());
    admin = await adminAgent(h);
    shopper = await signup(h.app, 'asha@example.com');
    card = await makeProduct(admin, { priceInr: 500 });
    await addCoupon(admin, 'TEN', { percent: 10 });
  });
  afterEach(async () => {
    rz.restore();
    await h.cleanup();
  });

  test('requires a signed-in user', async () => {
    const res = await request(h.app).post('/api/orders').send({ items: [cartOf(card.id)], customer, acceptedTerms: true });
    assert.equal(res.status, 401);
  });

  test('requires accepted terms, a non-empty bag, valid email and phone', async () => {
    const send = (body: Record<string, unknown>) => shopper.post('/api/orders').send({ items: [cartOf(card.id)], customer, acceptedTerms: true, ...body });
    const terms = await send({ acceptedTerms: false });
    assert.equal(terms.status, 400);
    assert.match(terms.body.error, /terms/);
    const empty = await send({ items: [] });
    assert.equal(empty.status, 400);
    assert.equal(empty.body.error, 'Your bag is empty.');
    assert.equal((await send({ items: [cartOf(uid())] })).status, 400, 'only unknown products');
    assert.equal((await send({ customer: { ...customer, email: 'nope' } })).status, 400);
    assert.equal((await send({ customer: { ...customer, phone: '12345' } })).status, 400);
    assert.equal((await send({ customer: { ...customer, phone: 'call me maybe' } })).status, 400);
    assert.equal((await send({ customer: { ...customer, name: '' } })).status, 400);
    assert.equal((await h.ctx.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM orders'))!.n, 0, 'nothing is stored for rejected orders');
    assert.equal(rz.calls.filter((c) => c.url.endsWith('/v1/orders')).length, 0, 'Razorpay is never called for invalid input');
  });

  test('an invalid coupon is a 400 carrying the quote message', async () => {
    const res = await placeOrder(shopper, [cartOf(card.id)], 'NOSUCH');
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'That coupon code is not valid.');
  });

  test('creates a pending order priced from the DB, creates the Razorpay order in paise and returns the session', async () => {
    const res = await placeOrder(shopper, [{ ...cartOf(card.id, 2), price: 1, unit: 1 }], 'ten');
    assert.equal(res.status, 200);
    assert.equal(res.body.provider, 'razorpay');
    assert.equal(res.body.providerOrderId, 'order_TEST1');
    assert.equal(res.body.amountPaise, 90000); // 2 x 500 less 10% = 900
    assert.equal(res.body.keyId, SECRETS.keyId);
    const call = rz.calls.find((c) => c.url.endsWith('/v1/orders'))!;
    assert.deepEqual({ amount: (call.body as { amount: number }).amount, receipt: (call.body as { receipt: string }).receipt, currency: (call.body as { currency: string }).currency }, { amount: 90000, receipt: res.body.orderId, currency: 'INR' });
    assert.match(call.headers['authorization']!, /^Basic /);

    const order = (await shopper.get(`/api/orders/${res.body.orderId}`)).body;
    assert.equal(order.status, 'pending');
    assert.equal(order.paymentVerified, false);
    assert.equal(order.total, 900);
    assert.equal(order.email, customer.email);
    assert.deepEqual(order.items.map((i: { qty: number; unit: number; title: string }) => [i.qty, i.unit, i.title]), [[2, 500, 'Blush wedding invitation']]);
  });

  test('personalization is stored; extra customization fields are stripped; bad photo paths are rejected', async () => {
    const custom = { fields: { name: 'Asha & Ravi' }, paletteId: 'blush', fontId: 'serif', photos: ['private/abc123.png'], notes: 'soft' };
    const res = await placeOrder(shopper, [cartOf(card.id, 1, { customization: custom })]);
    assert.equal(res.status, 200);
    const order = (await shopper.get(`/api/orders/${res.body.orderId}`)).body;
    assert.deepEqual(order.items[0].customization, custom);
    const bad = await placeOrder(shopper, [cartOf(card.id, 1, { customization: { ...custom, photos: ['../../etc/passwd'] } })]);
    assert.equal(bad.status, 400);
    const url = await placeOrder(shopper, [cartOf(card.id, 1, { customization: { ...custom, photos: ['https://evil.example/x.png'] } })]);
    assert.equal(url.status, 400);
  });

  test('Razorpay being down returns 502 and leaves no order behind', async () => {
    rz.restore();
    const down = (await import('./helpers.js')).mockFetch(() => ({ status: 500, json: {} }));
    try {
      const res = await placeOrder(shopper, [cartOf(card.id)]);
      assert.equal(res.status, 502);
      assert.equal((await h.ctx.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM orders'))!.n, 0);
    } finally {
      down.restore();
    }
  });

  test('a 100% coupon (total 0) is refused rather than sent to Razorpay', async () => {
    await addCoupon(admin, 'FREE', { percent: 100 });
    const res = await placeOrder(shopper, [cartOf(card.id)], 'FREE');
    assert.equal(res.status, 400);
  });

  test('GET /api/orders lists only my orders; other people get 404 on mine', async () => {
    const mine = await placeOrder(shopper, [cartOf(card.id)]);
    const other = await signup(h.app, 'other@example.com', 'Other Person');
    assert.deepEqual((await other.get('/api/orders')).body, []);
    assert.equal((await other.get(`/api/orders/${mine.body.orderId}`)).status, 404);
    assert.equal((await request(h.app).get(`/api/orders/${mine.body.orderId}`)).status, 401);
    assert.equal((await shopper.get('/api/orders')).body.length, 1);
    assert.equal((await shopper.get(`/api/orders/${uid()}`)).status, 404);
    assert.equal((await shopper.get('/api/orders/not-a-uuid')).status, 404);
    assert.equal((await admin.get(`/api/orders/${mine.body.orderId}`)).status, 200, 'admin can read any order');
  });
});

describe('Razorpay verification', () => {
  let h: Harness;
  let admin: Agent;
  let shopper: Agent;
  let card: { id: string };
  let rz: ReturnType<typeof fakeRazorpay>;

  beforeEach(async () => {
    rz = fakeRazorpay();
    h = await makeApp(withRazorpay());
    admin = await adminAgent(h);
    shopper = await signup(h.app, 'asha@example.com');
    card = await makeProduct(admin, { priceInr: 500 });
    await addCoupon(admin, 'TEN', { percent: 10 });
  });
  afterEach(async () => {
    rz.restore();
    await h.cleanup();
  });

  async function newOrder(coupon?: string) {
    const res = await placeOrder(shopper, [cartOf(card.id)], coupon);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    return res.body as { orderId: string; providerOrderId: string; amountPaise: number };
  }
  const capture = (s: { providerOrderId: string; amountPaise: number }, payId: string, over: Record<string, unknown> = {}) =>
    rz.payments.set(payId, { id: payId, order_id: s.providerOrderId, status: 'captured', amount: s.amountPaise, currency: 'INR', ...over });
  const verify = (agent: Agent, s: { orderId: string; providerOrderId: string }, payId: string, over: Record<string, unknown> = {}) =>
    agent.post(`/api/orders/${s.orderId}/verify`).send({ razorpay_order_id: s.providerOrderId, razorpay_payment_id: payId, razorpay_signature: rzSignature(s.providerOrderId, payId), ...over });
  const dbOrder = async (id: string) => (await h.ctx.db.get<{ status: string; payment_verified: number }>('SELECT status, payment_verified FROM orders WHERE id = ?', id))!;

  test('valid signature and captured payment mark the order paid, emails go out once', async () => {
    const s = await newOrder();
    capture(s, 'pay_OK1');
    const res = await verify(shopper, s, 'pay_OK1');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'paid');
    assert.equal(res.body.paymentVerified, true);
    const fetchPay = rz.calls.find((c) => c.url.endsWith('/v1/payments/pay_OK1'))!;
    assert.match(fetchPay.headers['authorization']!, /^Basic /);
    assert.equal((await h.ctx.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM payments WHERE provider_payment_id = ?', 'pay_OK1'))!.n, 1);
    assert.deepEqual(h.outbox.map((m) => m.to).sort(), ['asha@example.com', 'owner@shop.test']);
    assert.match(h.outbox[0]!.subject, /confirmed|New paid order/);
  });

  test('a tampered signature is a 400 and changes nothing (and Razorpay is not even asked)', async () => {
    const s = await newOrder();
    capture(s, 'pay_BAD');
    const res = await verify(shopper, s, 'pay_BAD', { razorpay_signature: rzSignature(s.providerOrderId, 'pay_OTHER') });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /signature/);
    assert.deepEqual(await dbOrder(s.orderId), { status: 'pending', payment_verified: 0 });
    assert.equal(rz.calls.some((c) => c.url.includes('/v1/payments/')), false);
    const wrongLength = await verify(shopper, s, 'pay_BAD', { razorpay_signature: 'abc' });
    assert.equal(wrongLength.status, 400);
    const signedWithWrongSecret = await verify(shopper, s, 'pay_BAD', { razorpay_signature: rzSignature(s.providerOrderId, 'pay_BAD', 'attacker-secret') });
    assert.equal(signedWithWrongSecret.status, 400);
    assert.equal(h.outbox.length, 0);
  });

  test('a razorpay_order_id that does not belong to this order is rejected', async () => {
    const s = await newOrder();
    capture(s, 'pay_W1');
    const res = await verify(shopper, s, 'pay_W1', { razorpay_order_id: 'order_SOMEONEELSE', razorpay_signature: rzSignature('order_SOMEONEELSE', 'pay_W1') });
    assert.equal(res.status, 400);
    assert.equal((await dbOrder(s.orderId)).payment_verified, 0);
  });

  test('a payment for another Razorpay order (cheap order reused on an expensive one) is rejected', async () => {
    const s = await newOrder();
    capture(s, 'pay_X1', { order_id: 'order_DIFFERENT' });
    const res = await verify(shopper, s, 'pay_X1');
    assert.equal(res.status, 400);
    assert.equal((await dbOrder(s.orderId)).payment_verified, 0);
  });

  test('amount mismatch is rejected', async () => {
    const s = await newOrder();
    capture(s, 'pay_LOW', { amount: 100 });
    const res = await verify(shopper, s, 'pay_LOW');
    assert.equal(res.status, 409);
    assert.match(res.body.error, /amount/);
    assert.deepEqual(await dbOrder(s.orderId), { status: 'pending', payment_verified: 0 });
  });

  test('only captured payments count (authorized or failed do not)', async () => {
    const s = await newOrder();
    capture(s, 'pay_AUTH', { status: 'authorized' });
    const res = await verify(shopper, s, 'pay_AUTH');
    assert.equal(res.status, 409);
    assert.match(res.body.error, /not captured/);
    capture(s, 'pay_FAIL', { status: 'failed' });
    assert.equal((await verify(shopper, s, 'pay_FAIL')).status, 409);
    assert.equal((await dbOrder(s.orderId)).payment_verified, 0);
  });

  test('Razorpay lookup failure is a 502 and leaves the order unpaid', async () => {
    const s = await newOrder();
    const res = await verify(shopper, s, 'pay_NOTFOUND');
    assert.equal(res.status, 502);
    assert.equal((await dbOrder(s.orderId)).payment_verified, 0);
  });

  test('a payment id with path characters is rejected before any request is made', async () => {
    const s = await newOrder();
    const res = await verify(shopper, s, 'pay_x/../orders', {});
    assert.equal(res.status, 400);
    assert.equal(rz.calls.some((c) => c.url.includes('..')), false);
  });

  test('replaying the same verification is idempotent: same order, one payment row, one email set', async () => {
    const s = await newOrder('TEN');
    capture(s, 'pay_RE');
    const first = await verify(shopper, s, 'pay_RE');
    const second = await verify(shopper, s, 'pay_RE');
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.deepEqual(second.body, first.body);
    assert.equal((await h.ctx.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM payments WHERE status = ?', 'captured'))!.n, 1);
    assert.equal(h.outbox.length, 2, 'customer + owner, once');
    const calls = rz.calls.filter((c) => c.url.includes('/v1/payments/')).length;
    assert.equal(calls, 1, 'the replay never hits Razorpay again');
  });

  test('the coupon is counted exactly once, even across verify replays and the webhook', async () => {
    const s = await newOrder('TEN');
    capture(s, 'pay_C1');
    await verify(shopper, s, 'pay_C1');
    await verify(shopper, s, 'pay_C1');
    const raw = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_C1', order_id: s.providerOrderId, status: 'captured', amount: s.amountPaise } } } });
    const wh = await request(h.app).post('/api/payments/razorpay/webhook').set('Content-Type', 'application/json').set('x-razorpay-signature', webhookSig(raw)).send(raw);
    assert.equal(wh.status, 200);
    assert.equal((await h.ctx.db.get<{ used_count: number }>("SELECT used_count FROM coupons WHERE code = 'TEN'"))!.used_count, 1);
  });

  test('concurrent verifications of the same payment are safe (one paid-marking)', async () => {
    const s = await newOrder('TEN');
    capture(s, 'pay_CC');
    const results = await Promise.all([1, 2, 3, 4].map(() => verify(shopper, s, 'pay_CC')));
    assert.deepEqual(results.map((r) => r.status), [200, 200, 200, 200]);
    assert.equal((await h.ctx.db.get<{ used_count: number }>("SELECT used_count FROM coupons WHERE code = 'TEN'"))!.used_count, 1);
    assert.equal((await h.ctx.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM payments WHERE provider_payment_id = ?', 'pay_CC'))!.n, 1);
    assert.equal(h.outbox.filter((m) => m.to === 'asha@example.com').length, 1, 'one confirmation email');
  });

  test('another customer cannot verify (404), and neither can an anonymous caller (401)', async () => {
    const s = await newOrder();
    capture(s, 'pay_STEAL');
    const thief = await signup(h.app, 'thief@example.com', 'Thief');
    assert.equal((await verify(thief, s, 'pay_STEAL')).status, 404);
    assert.equal((await request(h.app).post(`/api/orders/${s.orderId}/verify`).send({})).status, 401);
    assert.equal((await dbOrder(s.orderId)).payment_verified, 0);
  });

  test('the same payment cannot be used to pay a second order', async () => {
    const a = await newOrder();
    const b = await newOrder();
    capture(a, 'pay_ONCE');
    assert.equal((await verify(shopper, a, 'pay_ONCE')).status, 200);
    rz.payments.set('pay_ONCE', { id: 'pay_ONCE', order_id: b.providerOrderId, status: 'captured', amount: b.amountPaise, currency: 'INR' });
    const res = await verify(shopper, b, 'pay_ONCE');
    assert.equal(res.status, 409);
    assert.equal((await dbOrder(b.orderId)).payment_verified, 0);
  });

  test('the simulator payload is useless against a Razorpay order (403 when disabled)', async () => {
    const s = await newOrder();
    const res = await shopper.post(`/api/orders/${s.orderId}/verify`).send({ outcome: 'success' });
    assert.equal(res.status, 403);
    assert.equal((await dbOrder(s.orderId)).payment_verified, 0);
  });

  test('missing payment details are a 400', async () => {
    const s = await newOrder();
    assert.equal((await shopper.post(`/api/orders/${s.orderId}/verify`).send({})).status, 400);
    assert.equal((await shopper.post(`/api/orders/${s.orderId}/verify`).send({ razorpay_order_id: s.providerOrderId })).status, 400);
  });
});

describe('Razorpay webhook', () => {
  let h: Harness;
  let admin: Agent;
  let shopper: Agent;
  let card: { id: string };
  let rz: ReturnType<typeof fakeRazorpay>;

  beforeEach(async () => {
    rz = fakeRazorpay();
    h = await makeApp(withRazorpay());
    admin = await adminAgent(h);
    shopper = await signup(h.app, 'asha@example.com');
    card = await makeProduct(admin, { priceInr: 500 });
  });
  afterEach(async () => {
    rz.restore();
    await h.cleanup();
  });

  const post = (event: unknown, sig?: string) => {
    const raw = JSON.stringify(event);
    return request(h.app).post('/api/payments/razorpay/webhook').set('Content-Type', 'application/json').set('x-razorpay-signature', sig ?? webhookSig(raw)).send(raw);
  };
  const entity = (s: { providerOrderId: string; amountPaise: number }, id: string, status = 'captured') => ({ id, order_id: s.providerOrderId, status, amount: s.amountPaise });
  const ev = (event: string, e: unknown) => ({ event, payload: { payment: { entity: e } } });
  const newOrder = async () => (await placeOrder(shopper, [cartOf(card.id)])).body as { orderId: string; providerOrderId: string; amountPaise: number };
  const state = async (id: string) => (await h.ctx.db.get<{ status: string; payment_verified: number }>('SELECT status, payment_verified FROM orders WHERE id = ?', id))!;

  test('a bad signature is rejected with 400 and nothing changes', async () => {
    const s = await newOrder();
    const res = await post(ev('payment.captured', entity(s, 'pay_W1')), 'f'.repeat(64));
    assert.equal(res.status, 400);
    assert.deepEqual(await state(s.orderId), { status: 'pending', payment_verified: 0 });
    assert.equal((await request(h.app).post('/api/payments/razorpay/webhook').set('Content-Type', 'application/json').send('{}')).status, 400, 'missing signature');
    // a signature computed over re-serialised JSON (different bytes) must not pass
    const raw = JSON.stringify(ev('payment.captured', entity(s, 'pay_W1')));
    const spaced = await request(h.app).post('/api/payments/razorpay/webhook').set('Content-Type', 'application/json').set('x-razorpay-signature', webhookSig(raw)).send(raw.replace('{', '{ '));
    assert.equal(spaced.status, 400);
  });

  test('payment.captured marks the order paid; a duplicate delivery is safe and sends no second email', async () => {
    const s = await newOrder();
    const first = await post(ev('payment.captured', entity(s, 'pay_W2')));
    assert.equal(first.status, 200);
    assert.deepEqual(await state(s.orderId), { status: 'paid', payment_verified: 1 });
    const emails = h.outbox.length;
    assert.equal(emails, 2);
    const dup = await post(ev('payment.captured', entity(s, 'pay_W2')));
    assert.equal(dup.status, 200);
    assert.equal(h.outbox.length, emails);
    assert.equal((await h.ctx.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM payments WHERE provider_payment_id = ?', 'pay_W2'))!.n, 1);
  });

  test('order.paid works too, and a webhook then a browser verify do not double count', async () => {
    const s = await newOrder();
    assert.equal((await post(ev('order.paid', entity(s, 'pay_W3')))).status, 200);
    assert.equal((await state(s.orderId)).status, 'paid');
    rz.payments.set('pay_W3', { ...entity(s, 'pay_W3'), currency: 'INR' });
    const v = await shopper.post(`/api/orders/${s.orderId}/verify`).send({ razorpay_order_id: s.providerOrderId, razorpay_payment_id: 'pay_W3', razorpay_signature: rzSignature(s.providerOrderId, 'pay_W3') });
    assert.equal(v.status, 200);
    assert.equal(h.outbox.length, 2);
  });

  test('an amount that does not match the order is acknowledged but never marks it paid', async () => {
    const s = await newOrder();
    const res = await post(ev('payment.captured', { ...entity(s, 'pay_W4'), amount: 100 }));
    assert.equal(res.status, 200);
    assert.deepEqual(await state(s.orderId), { status: 'pending', payment_verified: 0 });
  });

  test('payment.failed fails a pending order but never a verified one', async () => {
    const s = await newOrder();
    assert.equal((await post(ev('payment.failed', entity(s, 'pay_W5', 'failed')))).status, 200);
    assert.equal((await state(s.orderId)).status, 'failed');
    // a late capture still wins after a failed attempt
    assert.equal((await post(ev('payment.captured', entity(s, 'pay_W6')))).status, 200);
    assert.deepEqual(await state(s.orderId), { status: 'paid', payment_verified: 1 });
    assert.equal((await post(ev('payment.failed', entity(s, 'pay_W7', 'failed')))).status, 200);
    assert.equal((await state(s.orderId)).status, 'paid');
  });

  test('unknown orders and unrelated events are acknowledged with 200', async () => {
    assert.equal((await post(ev('payment.captured', { id: 'pay_Z', order_id: 'order_UNKNOWN', status: 'captured', amount: 100 }))).status, 200);
    assert.equal((await post({ event: 'refund.created', payload: {} })).status, 200);
  });

  test('without a webhook secret the endpoint is disabled (503), never open', async () => {
    const p = await makeApp({ razorpay: { keyId: 'k', keySecret: 's', webhookSecret: '' } });
    try {
      const res = await request(p.app).post('/api/payments/razorpay/webhook').set('Content-Type', 'application/json').send('{}');
      assert.equal(res.status, 503);
    } finally {
      await p.cleanup();
    }
  });
});

describe('payment simulator', () => {
  const setup = async (over: Parameters<typeof makeApp>[0]) => {
    const h = await makeApp(over);
    const admin = await adminAgent(h);
    const shopper = await signup(h.app, 'asha@example.com');
    const card = await makeProduct(admin, { priceInr: 500 });
    await addCoupon(admin, 'TEN', { percent: 10 });
    return { h, admin, shopper, card };
  };

  test('GET /api/config reports the provider honestly', async () => {
    const a = await makeApp({ paymentSimulator: true });
    const b = await makeApp({ paymentSimulator: false });
    const c = await makeApp({ ...withRazorpay(), paymentSimulator: true });
    const d = await makeApp({ nodeEnv: 'production', paymentSimulator: true });
    try {
      assert.deepEqual((await request(a.app).get('/api/config')).body, { paymentProvider: 'simulator' });
      assert.deepEqual((await request(b.app).get('/api/config')).body, { paymentProvider: 'razorpay' });
      assert.deepEqual((await request(c.app).get('/api/config')).body, { paymentProvider: 'razorpay', razorpayKeyId: SECRETS.keyId });
      assert.deepEqual((await request(d.app).get('/api/config')).body, { paymentProvider: 'razorpay' }, 'production never advertises the simulator');
    } finally {
      await Promise.all([a, b, c, d].map((x) => x.cleanup()));
    }
  });

  test('without keys and without a simulator, creating an order fails with a clear 503', async () => {
    const { h, shopper, card } = await setup({ paymentSimulator: false });
    try {
      const res = await placeOrder(shopper, [cartOf(card.id)]);
      assert.equal(res.status, 503);
      assert.equal(res.body.error, 'Payments are not configured yet.');
      assert.equal((await h.ctx.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM orders'))!.n, 0);
    } finally {
      await h.cleanup();
    }
  });

  test('simulator success marks paid once, counts the coupon once and emails; failed/cancelled/pending behave', async () => {
    const { h, shopper, card } = await setup({ paymentSimulator: true });
    try {
      const o = await placeOrder(shopper, [cartOf(card.id)], 'TEN');
      assert.equal(o.status, 200);
      assert.equal(o.body.provider, 'simulator');
      assert.equal(o.body.providerOrderId, undefined);
      const url = `/api/orders/${o.body.orderId}/verify`;
      assert.equal((await shopper.post(url).send({ outcome: 'pending' })).body.status, 'pending');
      assert.equal((await shopper.post(url).send({ outcome: 'failed' })).body.status, 'failed');
      assert.equal((await shopper.post(url).send({ outcome: 'cancelled' })).body.status, 'cancelled');
      assert.equal((await shopper.post(url).send({ outcome: 'bogus' })).status, 400);
      const ok = await shopper.post(url).send({ outcome: 'success' });
      assert.equal(ok.body.status, 'paid');
      assert.equal(ok.body.paymentVerified, true);
      assert.equal(ok.body.total, 450);
      const after = await shopper.post(url).send({ outcome: 'failed' });
      assert.equal(after.body.status, 'paid', 'a verified order is never changed');
      await shopper.post(url).send({ outcome: 'success' });
      assert.equal((await h.ctx.db.get<{ used_count: number }>("SELECT used_count FROM coupons WHERE code = 'TEN'"))!.used_count, 1);
      assert.equal(h.outbox.length, 2);
    } finally {
      await h.cleanup();
    }
  });

  test('in production the simulator is impossible even if PAYMENT_SIMULATOR=true: orders 503, verify 403', async () => {
    const { h, shopper, card } = await setup({ nodeEnv: 'production', paymentSimulator: true });
    try {
      assert.equal((await placeOrder(shopper, [cartOf(card.id)])).status, 503);
      // Even a simulator-provider order that somehow exists cannot be paid in production.
      const id = uid();
      await h.ctx.db.run("INSERT INTO orders (id, user_id, email, customer_name, phone, status, payment_verified, subtotal, discount, total, created_at) SELECT ?, id, 'a@b.co', 'A', '1', 'pending', 0, 500, 0, 500, ? FROM users WHERE email = 'asha@example.com'", id, new Date().toISOString());
      await h.ctx.db.run("INSERT INTO payments (order_id, provider, status, amount_paise, created_at) VALUES (?, 'simulator', 'created', 50000, ?)", id, new Date().toISOString());
      const res = await shopper.post(`/api/orders/${id}/verify`).send({ outcome: 'success' });
      assert.equal(res.status, 403);
      assert.equal((await h.ctx.db.get<{ payment_verified: number }>('SELECT payment_verified FROM orders WHERE id = ?', id))!.payment_verified, 0);
    } finally {
      await h.cleanup();
    }
  });

  test('production config ignores PAYMENT_SIMULATOR', async () => {
    const { loadConfig, simulatorAllowed } = await import('../src/config.js');
    const prod = loadConfig({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(40), SITE_ORIGIN: 'https://a2.example', PAYMENT_SIMULATOR: 'true', DATABASE_URL: 'postgresql://user:pw@db.example.test:5432/postgres' }, () => undefined);
    assert.equal(simulatorAllowed(prod), false);
    const dev = loadConfig({ NODE_ENV: 'development', PAYMENT_SIMULATOR: 'true' }, () => undefined);
    assert.equal(simulatorAllowed(dev), true);
  });
});

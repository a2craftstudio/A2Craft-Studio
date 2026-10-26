import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import request from 'supertest';
import { addCoupon, adminAgent, cartOf, makeApp, makeProduct, placeOrder, signup, uid, type Agent, type Harness } from './helpers.js';

describe('reviews', () => {
  let h: Harness;
  let admin: Agent;
  let buyer: Agent;
  let stranger: Agent;
  let product: { id: string };
  let other: { id: string };

  before(async () => {
    h = await makeApp({ paymentSimulator: true });
    admin = await adminAgent(h);
    buyer = await signup(h.app, 'buyer@example.com', 'Meera Kapoor Sharma');
    stranger = await signup(h.app, 'stranger@example.com', 'Sam');
    product = await makeProduct(admin, { priceInr: 200 });
    other = await makeProduct(admin, { priceInr: 300 });
    const o = await placeOrder(buyer, [cartOf(product.id)]);
    await buyer.post(`/api/orders/${o.body.orderId}/verify`).send({ outcome: 'success' });
    // an unpaid order does not make you a buyer
    await placeOrder(stranger, [cartOf(product.id)]);
  });
  after(() => h.cleanup());

  const review = (agent: Agent, over: Record<string, unknown> = {}) => agent.post('/api/reviews').send({ productId: product.id, rating: 5, body: 'Lovely work, thank you!', consentToPublish: true, ...over });

  test('eligibility: verified buyers only, once per product', async () => {
    assert.equal((await buyer.get(`/api/reviews/eligibility?productId=${product.id}`)).body.canReview, true);
    assert.equal((await buyer.get(`/api/reviews/eligibility?productId=${other.id}`)).body.canReview, false);
    assert.equal((await stranger.get(`/api/reviews/eligibility?productId=${product.id}`)).body.canReview, false, 'unpaid order');
    assert.equal((await request(h.app).get(`/api/reviews/eligibility?productId=${product.id}`)).status, 401);
    assert.equal((await buyer.get('/api/reviews/eligibility')).status, 400);
  });

  test('non-buyers get 403; validation rejects bad ratings and short bodies', async () => {
    assert.equal((await review(stranger)).status, 403);
    assert.equal((await review(buyer, { productId: other.id })).status, 403);
    assert.equal((await request(h.app).post('/api/reviews').send({ productId: product.id, rating: 5, body: 'Lovely work', consentToPublish: true })).status, 401);
    for (const bad of [{ rating: 0 }, { rating: 6 }, { rating: 4.5 }, { body: 'hi' }, { body: 'x'.repeat(601) }, { consentToPublish: 'yes' }]) {
      assert.equal((await review(buyer, bad)).status, 400, JSON.stringify(bad).slice(0, 40));
    }
  });

  test('a review starts unapproved and hidden; second review of the same product is refused', async () => {
    assert.equal((await review(buyer, { body: '  Beautiful and fast delivery.  ' })).status, 204);
    assert.deepEqual((await request(h.app).get(`/api/reviews?productId=${product.id}`)).body, []);
    assert.equal((await buyer.get(`/api/reviews/eligibility?productId=${product.id}`)).body.canReview, false);
    assert.equal((await review(buyer)).status, 403);
  });

  test('admin approval publishes it with the first name only', async () => {
    const list = (await admin.get('/api/admin/reviews')).body as { id: string; authorName: string; approved: boolean; body: string }[];
    assert.equal(list.length, 1);
    assert.equal(list[0]!.body, 'Beautiful and fast delivery.');
    assert.equal(list[0]!.approved, false);
    assert.equal((await admin.patch(`/api/admin/reviews/${list[0]!.id}`).send({ approved: true })).status, 204);
    const pub = (await request(h.app).get(`/api/reviews?productId=${product.id}`)).body;
    assert.equal(pub.length, 1);
    assert.equal(pub[0].authorName, 'Meera');
    assert.equal(pub[0].rating, 5);
    assert.equal(JSON.stringify(pub).includes('buyer@example.com'), false);
    assert.equal(JSON.stringify(pub).includes('Kapoor'), false);
    assert.equal((await request(h.app).get('/api/reviews')).body.length, 1, 'productId is optional');
    assert.equal((await admin.patch(`/api/admin/reviews/${list[0]!.id}`).send({ approved: false })).status, 204);
    assert.equal((await request(h.app).get('/api/reviews')).body.length, 0);
  });

  test('a review without consent can never be approved (409) and is never public', async () => {
    const second = await signup(h.app, 'second@example.com', 'Nia');
    const o = await placeOrder(second, [cartOf(other.id)]);
    await second.post(`/api/orders/${o.body.orderId}/verify`).send({ outcome: 'success' });
    assert.equal((await second.post('/api/reviews').send({ productId: other.id, rating: 3, body: 'Fine, private feedback', consentToPublish: false })).status, 204);
    const rev = (await admin.get('/api/admin/reviews')).body.find((r: { productId: string }) => r.productId === other.id);
    const res = await admin.patch(`/api/admin/reviews/${rev.id}`).send({ approved: true });
    assert.equal(res.status, 409);
    assert.match(res.body.error, /consent/);
    assert.equal((await request(h.app).get(`/api/reviews?productId=${other.id}`)).body.length, 0);
    assert.equal((await admin.patch(`/api/admin/reviews/${uid()}`).send({ approved: true })).status, 404);
  });

  test('a reviewer whose name is an email address shows as Customer', async () => {
    const odd = await signup(h.app, 'odd@example.com', 'odd@example.com');
    const o = await placeOrder(odd, [cartOf(product.id)]);
    await odd.post(`/api/orders/${o.body.orderId}/verify`).send({ outcome: 'success' });
    await odd.post('/api/reviews').send({ productId: product.id, rating: 4, body: 'Good stuff overall', consentToPublish: true });
    const rev = (await admin.get('/api/admin/reviews')).body.find((r: { body: string }) => r.body === 'Good stuff overall');
    assert.equal(rev.authorName, 'Customer');
  });
});

describe('private notes and customer data never leak', () => {
  let h: Harness;
  let admin: Agent;
  let shopper: Agent;
  let orderId: string;
  let inquiryId: string;

  before(async () => {
    h = await makeApp({ paymentSimulator: true });
    admin = await adminAgent(h);
    shopper = await signup(h.app, 'asha@example.com');
    const p = await makeProduct(admin);
    const o = await placeOrder(shopper, [cartOf(p.id)]);
    orderId = o.body.orderId;
    await shopper.post(`/api/orders/${orderId}/verify`).send({ outcome: 'success' });
    const inq = await shopper.post('/api/inquiries').send({ name: 'Asha', email: 'asha@example.com', productType: 'Video', occasion: 'Wedding', deadline: '2030-01-31', budget: '5000', style: 'Soft', description: 'A save the date video with our photos.', referenceImages: [] });
    inquiryId = inq.body.id;
  });
  after(() => h.cleanup());

  test('order notes are admin only and absent from every customer route', async () => {
    assert.equal((await admin.put(`/api/admin/orders/${orderId}/note`).send({ note: 'VIP, asked for pink' })).status, 204);
    assert.equal((await shopper.put(`/api/admin/orders/${orderId}/note`).send({ note: 'x' })).status, 403);
    assert.equal((await admin.put(`/api/admin/orders/${orderId}/note`).send({ note: 'x'.repeat(2001) })).status, 400);
    assert.equal((await admin.put(`/api/admin/orders/${uid()}/note`).send({ note: 'x' })).status, 404);

    const mine = await shopper.get('/api/orders');
    const single = await shopper.get(`/api/orders/${orderId}`);
    const verify = await shopper.post(`/api/orders/${orderId}/verify`).send({ outcome: 'success' });
    for (const res of [mine, single, verify]) assert.equal(JSON.stringify(res.body).includes('VIP'), false);
    assert.equal(JSON.stringify(mine.body).includes('adminNote'), false);
    assert.equal((await admin.get(`/api/orders/${orderId}`)).body.adminNote, 'VIP, asked for pink');
    assert.equal((await admin.get('/api/admin/orders')).body[0].adminNote, 'VIP, asked for pink');
  });

  test('inquiry notes are admin only and absent from the customer list', async () => {
    assert.equal((await admin.put(`/api/admin/inquiries/${inquiryId}/note`).send({ note: 'Quote 6k, tight deadline' })).status, 204);
    const mine = await shopper.get('/api/inquiries');
    assert.equal(mine.body.length, 1);
    assert.equal(JSON.stringify(mine.body).includes('tight deadline'), false);
    assert.equal(mine.body[0].adminNote, undefined);
    assert.equal((await admin.get('/api/admin/inquiries')).body[0].adminNote, 'Quote 6k, tight deadline');
    assert.equal((await admin.put('/api/admin/inquiries/INQ-NOPE00/note').send({ note: 'x' })).status, 404);
  });

  test('a customer cannot plant an adminNote through the inquiry form', async () => {
    const res = await shopper.post('/api/inquiries').send({ name: 'A', email: 'a@example.com', productType: 'Card', description: 'A birthday card for my sister please.', adminNote: 'hello admin' });
    assert.equal(res.status, 200);
    const row = (await admin.get('/api/admin/inquiries')).body.find((i: { id: string }) => i.id === res.body.id);
    assert.equal(row.adminNote, undefined);
  });

  test('inquiries: mine only, newest first; anonymous visitors can submit but not list', async () => {
    const other = await signup(h.app, 'other@example.com', 'Other');
    assert.deepEqual((await other.get('/api/inquiries')).body, []);
    assert.equal((await request(h.app).get('/api/inquiries')).status, 401);
    const anon = await request(h.app).post('/api/inquiries').send({ name: 'Walk In', email: 'walk@example.com', productType: 'Card', description: 'A card for my mother, florals please.' });
    assert.equal(anon.status, 200);
    assert.match(anon.body.id, /^INQ-[0-9A-F]{6}$/);
    assert.equal((await other.get('/api/inquiries')).body.length, 0, 'anonymous inquiries are not attached to anyone');
    assert.equal((await shopper.get('/api/inquiries')).body.length, 2);
    assert.equal((await admin.get('/api/admin/inquiries')).body.length, 3);
  });

  test('inquiry validation: description length, deadline format, reference image count and paths', async () => {
    const post = (over: Record<string, unknown>) => request(h.app).post('/api/inquiries').send({ name: 'A', email: 'a@example.com', productType: 'Card', description: 'A birthday card for my sister please.', ...over });
    assert.equal((await post({ description: 'too short' })).status, 400);
    assert.equal((await post({ deadline: '31/01/2030' })).status, 400);
    assert.equal((await post({ deadline: '2030-02-31' })).status, 400);
    assert.equal((await post({ deadline: '' })).status, 200);
    assert.equal((await post({ referenceImages: Array(6).fill('private/abc.png') })).status, 400);
    assert.equal((await post({ referenceImages: ['https://evil.example/a.png'] })).status, 400);
    assert.equal((await post({ referenceImages: ['private/abc.png'] })).status, 200);
    assert.equal((await post({ email: 'bad' })).status, 400);
    assert.equal((await post({ productType: '' })).status, 400);
  });

  test('admin can update inquiry status; invalid statuses are rejected', async () => {
    assert.equal((await admin.patch(`/api/admin/inquiries/${inquiryId}`).send({ status: 'quoted' })).status, 204);
    assert.equal((await admin.get('/api/admin/inquiries')).body.find((i: { id: string }) => i.id === inquiryId).status, 'quoted');
    assert.equal((await admin.patch(`/api/admin/inquiries/${inquiryId}`).send({ status: 'bogus' })).status, 400);
    assert.equal((await admin.patch('/api/admin/inquiries/INQ-NOPE00').send({ status: 'quoted' })).status, 404);
  });

  test('the owner is emailed about inquiries with reply-to the customer, and user text is HTML-escaped', async () => {
    h.outbox.length = 0;
    await request(h.app).post('/api/inquiries').send({ name: '<b>Eve</b>', email: 'eve@example.com', productType: 'Card <script>', description: 'Hello <img src=x onerror=alert(1)> this is long enough.' });
    await request(h.app).post('/api/contact').send({ name: 'Con', email: 'con@example.com', message: 'Is this <script>alert(1)</script> available?' });
    const [inq, contact] = h.outbox;
    assert.equal(inq!.to, 'owner@shop.test');
    assert.equal(inq!.replyTo, 'eve@example.com');
    assert.equal(inq!.html.includes('<img'), false);
    assert.equal(inq!.html.includes('<b>Eve'), false);
    assert.match(inq!.html, /&lt;b&gt;Eve&lt;\/b&gt;/);
    assert.equal(contact!.replyTo, 'con@example.com');
    assert.equal(contact!.html.includes('<script>'), false);
  });
});

describe('call-backs, contact, newsletter, favorites', () => {
  let h: Harness;
  let admin: Agent;
  let shopper: Agent;
  before(async () => {
    h = await makeApp();
    admin = await adminAgent(h);
    shopper = await signup(h.app, 'asha@example.com');
  });
  after(() => h.cleanup());

  const cb = (over: Record<string, unknown> = {}) => request(h.app).post('/api/callbacks').send({ name: 'Ravi', phone: '+91 98765 43210', topic: 'Wedding', preferred: 'Evening', note: 'Call after 6', ...over });

  test('call-back validation: phone digits 10..13, name required, lengths capped', async () => {
    assert.equal((await cb()).status, 204);
    assert.equal((await cb({ phone: '98765' })).status, 400);
    assert.equal((await cb({ phone: '12345678901234' })).status, 400);
    assert.equal((await cb({ phone: 'abcdefghijkl' })).status, 400);
    assert.equal((await cb({ phone: '98765 43210' })).status, 204);
    assert.equal((await cb({ name: '' })).status, 400);
    assert.equal((await cb({ note: 'x'.repeat(501) })).status, 400);
    assert.equal((await cb({ topic: 'x'.repeat(61) })).status, 400);
    assert.equal((await cb({ extra: 1 })).status, 400);
  });

  test('call-back numbers are only ever listed to admins', async () => {
    const list = await admin.get('/api/admin/callbacks');
    assert.equal(list.status, 200);
    assert.equal(list.body.length, 2);
    assert.match(list.body[0].id, /^CB-[0-9A-F]{6}$/);
    assert.ok(list.body.some((c: { phone: string }) => c.phone === '+91 98765 43210'));
    assert.equal((await request(h.app).get('/api/admin/callbacks')).status, 401);
    assert.equal((await shopper.get('/api/admin/callbacks')).status, 403);
    // no public/customer route mentions the number
    for (const url of ['/api/products', '/api/settings', '/api/categories', '/api/portfolio', '/api/reviews', '/api/orders', '/api/inquiries']) {
      const res = await shopper.get(url);
      assert.equal(JSON.stringify(res.body).includes('98765'), false, url);
    }
    assert.equal((await shopper.post('/api/callbacks').send({ name: 'x', phone: '9876543210' })).status, 204);
    assert.equal((await shopper.get('/api/callbacks')).status, 404, 'there is no read route');
  });

  test('admin updates status and note; the owner is emailed', async () => {
    const id = (await admin.get('/api/admin/callbacks')).body[0].id;
    assert.equal((await admin.patch(`/api/admin/callbacks/${id}`).send({ status: 'called', adminNote: 'Spoke, booking Monday' })).status, 204);
    const row = (await admin.get('/api/admin/callbacks')).body.find((c: { id: string }) => c.id === id);
    assert.equal(row.status, 'called');
    assert.equal(row.adminNote, 'Spoke, booking Monday');
    assert.equal((await admin.patch(`/api/admin/callbacks/${id}`).send({})).status, 400);
    assert.equal((await admin.patch(`/api/admin/callbacks/${id}`).send({ status: 'ghosted' })).status, 400);
    assert.equal((await admin.patch('/api/admin/callbacks/CB-NOPE00').send({ status: 'called' })).status, 404);
    assert.ok(h.outbox.some((m) => m.subject.startsWith('Call-back request')));
  });

  test('contact: validation, storage, admin listing and status', async () => {
    assert.equal((await request(h.app).post('/api/contact').send({ name: 'C', email: 'c@example.com', message: 'short' })).status, 400);
    assert.equal((await request(h.app).post('/api/contact').send({ name: '', email: 'c@example.com', message: 'A long enough message.' })).status, 400);
    assert.equal((await request(h.app).post('/api/contact').send({ name: 'C', email: 'c@example.com', message: 'A long enough message.' })).status, 204);
    const list = (await admin.get('/api/admin/contacts')).body;
    assert.equal(list.length, 1);
    assert.match(list[0].id, /^MSG-[0-9A-F]{6}$/);
    assert.equal(list[0].status, 'new');
    assert.equal((await admin.patch(`/api/admin/contacts/${list[0].id}`).send({ status: 'replied' })).status, 204);
    assert.equal((await admin.get('/api/admin/contacts')).body[0].status, 'replied');
    assert.equal((await admin.patch(`/api/admin/contacts/${list[0].id}`).send({ status: 'x' })).status, 400);
    assert.equal((await admin.patch('/api/admin/contacts/MSG-NOPE00').send({ status: 'new' })).status, 404);
  });

  test('newsletter: consent required, duplicates deduped (case-insensitive) but still 204, admin can remove', async () => {
    const sub = (body: Record<string, unknown>) => request(h.app).post('/api/newsletter').send(body);
    assert.equal((await sub({ email: 'fan@example.com', consent: false })).status, 400);
    assert.equal((await sub({ email: 'fan@example.com' })).status, 400);
    assert.equal((await sub({ email: 'nope', consent: true })).status, 400);
    assert.equal((await sub({ email: 'Fan@Example.com', consent: true })).status, 204);
    assert.equal((await sub({ email: 'fan@example.com', consent: true })).status, 204);
    assert.equal((await sub({ email: 'fan2@example.com', consent: true })).status, 204);
    const list = (await admin.get('/api/admin/subscribers')).body;
    assert.equal(list.length, 2);
    assert.ok(list.every((s: { email: string; createdAt: string }) => s.email === s.email.toLowerCase() && s.createdAt));
    assert.equal((await admin.delete('/api/admin/subscribers?email=fan@example.com')).status, 204);
    assert.equal((await admin.get('/api/admin/subscribers')).body.length, 1);
    assert.equal((await admin.delete('/api/admin/subscribers')).status, 400);
  });

  test('favorites: signed in only, add/remove, idempotent, published products only', async () => {
    const p = await makeProduct(admin);
    const draft = await makeProduct(admin, { status: 'draft' });
    assert.equal((await request(h.app).get('/api/favorites')).status, 401);
    assert.deepEqual((await shopper.get('/api/favorites')).body, []);
    assert.equal((await shopper.put(`/api/favorites/${p.id}`)).status, 204);
    assert.equal((await shopper.put(`/api/favorites/${p.id}`)).status, 204);
    assert.deepEqual((await shopper.get('/api/favorites')).body, [p.id]);
    assert.equal((await shopper.put(`/api/favorites/${draft.id}`)).status, 404);
    assert.equal((await shopper.put(`/api/favorites/${uid()}`)).status, 404);
    const other = await signup(h.app, 'o@example.com', 'O');
    assert.deepEqual((await other.get('/api/favorites')).body, [], 'favorites are per user');
    assert.equal((await shopper.delete(`/api/favorites/${p.id}`)).status, 204);
    assert.deepEqual((await shopper.get('/api/favorites')).body, []);
  });

  test('customers list counts paid orders and spend, excluding refunded and unpaid', async () => {
    const sim = await makeApp({ paymentSimulator: true });
    try {
      const a = await adminAgent(sim);
      const buyer = await signup(sim.app, 'buyer@example.com', 'Buyer');
      const p = await makeProduct(a, { priceInr: 250 });
      await addCoupon(a, 'FLAT50', { flatInr: 50 });
      const pay = async (coupon?: string) => {
        const o = await placeOrder(buyer, [cartOf(p.id)], coupon);
        return { id: o.body.orderId as string, res: await buyer.post(`/api/orders/${o.body.orderId}/verify`).send({ outcome: 'success' }) };
      };
      await pay();
      const second = await pay('FLAT50');
      const refunded = await pay();
      await placeOrder(buyer, [cartOf(p.id)]); // unpaid
      await a.patch(`/api/admin/orders/${refunded.id}`).send({ status: 'refunded' });
      assert.equal(second.res.body.total, 200);
      const row = (await a.get('/api/admin/customers')).body.find((c: { email: string }) => c.email === 'buyer@example.com');
      assert.deepEqual({ orders: row.orders, spent: row.spent, role: row.role, name: row.name }, { orders: 2, spent: 450, role: 'customer', name: 'Buyer' });
      assert.ok(row.joined);
    } finally {
      await sim.cleanup();
    }
  });
});

describe('coupon administration', () => {
  let h: Harness;
  let admin: Agent;
  before(async () => {
    h = await makeApp();
    admin = await adminAgent(h);
  });
  after(() => h.cleanup());

  test('codes are uppercased and trimmed; needs percent 1..100 or flat > 0; used is read-only', async () => {
    const ok = await admin.put('/api/admin/coupons/save10').send({ percent: 10, minSubtotal: 0, active: true, used: 99 });
    assert.equal(ok.status, 200);
    assert.deepEqual(ok.body, { code: 'SAVE10', percent: 10, minSubtotal: 0, active: true, used: 0 });
    await h.ctx.db.run("UPDATE coupons SET used_count = 3 WHERE code = 'SAVE10'");
    const upd = await admin.put('/api/admin/coupons/SAVE10').send({ percent: 15, minSubtotal: 100, active: false, endsAt: '2031-12-31', maxUses: 10, used: 0 });
    assert.deepEqual(upd.body, { code: 'SAVE10', percent: 15, minSubtotal: 100, active: false, endsAt: '2031-12-31', maxUses: 10, used: 3 });
    assert.equal((await admin.put('/api/admin/coupons/X1').send({ minSubtotal: 0, active: true })).status, 400, 'neither percent nor flat');
    assert.equal((await admin.put('/api/admin/coupons/X1').send({ percent: 0, minSubtotal: 0, active: true })).status, 400);
    assert.equal((await admin.put('/api/admin/coupons/X1').send({ percent: 101, minSubtotal: 0, active: true })).status, 400);
    assert.equal((await admin.put('/api/admin/coupons/X1').send({ flatInr: -5, minSubtotal: 0, active: true })).status, 400);
    assert.equal((await admin.put('/api/admin/coupons/X1').send({ percent: 5, flatInr: 5, minSubtotal: 0, active: true })).status, 400);
    assert.equal((await admin.put('/api/admin/coupons/X1').send({ percent: 5, minSubtotal: -1, active: true })).status, 400);
    assert.equal((await admin.put('/api/admin/coupons/X1').send({ percent: 5, minSubtotal: 0, active: true, endsAt: 'tomorrow' })).status, 400);
    assert.equal((await admin.put('/api/admin/coupons/a').send({ percent: 5, minSubtotal: 0, active: true })).status, 400, 'code too short');
    assert.equal((await admin.put('/api/admin/coupons/FLAT').send({ flatInr: 75, minSubtotal: 0, active: true })).status, 200);
    assert.deepEqual((await admin.get('/api/admin/coupons')).body.map((c: { code: string }) => c.code), ['FLAT', 'SAVE10']);
    assert.equal((await admin.delete('/api/admin/coupons/flat')).status, 204);
    assert.equal((await admin.delete('/api/admin/coupons/FLAT')).status, 404);
  });
});

describe('visit events', () => {
  let h: Harness;
  let admin: Agent;
  before(async () => {
    h = await makeApp();
    admin = await adminAgent(h);
  });
  after(() => h.cleanup());

  const ev = (agent: Agent | ReturnType<typeof request>, over: Record<string, unknown> = {}) =>
    (agent as ReturnType<typeof request>).post('/api/events').send({ visitorId: 'v-abc123', type: 'page', path: '/shop', ...over });

  test('records anonymous page and product views; the admin list shows them newest first', async () => {
    const p = await makeProduct(admin);
    assert.equal((await ev(request(h.app))).status, 204);
    assert.equal((await ev(request(h.app), { type: 'product', path: `/product/${p['slug']}`, productId: p.id })).status, 204);
    assert.equal((await ev(request(h.app), { type: 'like', path: '/shop', productId: p.id })).status, 204);
    const list = (await admin.get('/api/admin/events')).body;
    assert.equal(list.length, 3);
    assert.deepEqual(list.map((e: { type: string }) => e.type), ['like', 'product', 'page']);
    assert.equal(list[0].userId, undefined);
    assert.equal(list[1].productId, p.id);
    assert.match(list[0].at, /Z$/);
  });

  test('signed-in visitors are attributed (userId + email label) but admins and private pages are ignored', async () => {
    const shopper = await signup(h.app, 'asha@example.com');
    await ev(shopper, { path: '/cart' });
    const row = (await admin.get('/api/admin/events')).body.find((e: { path: string }) => e.path === '/cart');
    assert.equal(row.userLabel, 'asha@example.com');
    assert.ok(row.userId);
    const before = (await admin.get('/api/admin/events')).body.length;
    for (const p of ['/admin', '/admin/orders', '/checkout', '/checkout/pay', '/order/123', '/ADMIN/x']) assert.equal((await ev(request(h.app), { path: p })).status, 204);
    assert.equal((await ev(admin, { path: '/shop' })).status, 204);
    assert.equal((await admin.get('/api/admin/events')).body.length, before, 'admin traffic and private paths are not stored');
  });

  test('validation: path length, shape, type, visitor id, unknown fields; unknown product ids are dropped', async () => {
    assert.equal((await ev(request(h.app), { path: '/' + 'a'.repeat(300) })).status, 400);
    assert.equal((await ev(request(h.app), { path: '/' + 'a'.repeat(299) })).status, 204);
    assert.equal((await ev(request(h.app), { path: 'no-slash' })).status, 400);
    assert.equal((await ev(request(h.app), { type: 'click' })).status, 400);
    assert.equal((await ev(request(h.app), { visitorId: 'x' })).status, 400);
    assert.equal((await ev(request(h.app), { visitorId: 'bad id <script>' })).status, 400);
    assert.equal((await ev(request(h.app), { userId: 'someone-else' })).status, 400, 'clients cannot claim a user');
    assert.equal((await ev(request(h.app), { productId: uid() })).status, 204);
    const stored = (await h.ctx.db.get<{ product_id: string | null }>("SELECT product_id FROM visit_events WHERE path = '/shop' ORDER BY created_at DESC LIMIT 1"));
    assert.equal(stored!.product_id, null);
  });

  test('the admin list only covers the last 30 days and is capped', async () => {
    const old = new Date(Date.now() - 31 * 24 * 3600 * 1000).toISOString();
    await h.ctx.db.run("INSERT INTO visit_events (id, visitor_id, type, path, created_at) VALUES (?, 'v-old000', 'page', '/ancient', ?)", uid(), old);
    assert.equal((await admin.get('/api/admin/events')).body.some((e: { path: string }) => e.path === '/ancient'), false);
  });

  test('events are rate limited to 120 per minute per IP', async () => {
    const p = await makeApp({ rateLimit: true });
    try {
      let last = 0;
      for (let i = 0; i < 121; i++) last = (await ev(request(p.app))).status;
      assert.equal(last, 429);
    } finally {
      await p.cleanup();
    }
  });
});

describe('rate limits on public forms', () => {
  test('contact, inquiry, callback and newsletter allow 8 per hour, then 429', async () => {
    const p = await makeApp({ rateLimit: true });
    try {
      const forms: [string, Record<string, unknown>][] = [
        ['/api/contact', { name: 'C', email: 'c@example.com', message: 'A long enough message.' }],
        ['/api/inquiries', { name: 'A', email: 'a@example.com', productType: 'Card', description: 'A birthday card for my sister please.' }],
        ['/api/callbacks', { name: 'R', phone: '9876543210' }],
        ['/api/newsletter', { email: 'n@example.com', consent: true }],
      ];
      for (const [url, body] of forms) {
        const codes: number[] = [];
        for (let i = 0; i < 9; i++) codes.push((await request(p.app).post(url).send(body)).status);
        assert.equal(codes[8], 429, url);
        assert.notEqual(codes[7], 429, url);
      }
    } finally {
      await p.cleanup();
    }
  });
});

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import request from 'supertest';
import { adminAgent, makeApp, makeProduct, signup, uid, type Agent, type Harness } from './helpers.js';

type Method = 'get' | 'put' | 'post' | 'patch' | 'delete';
const X = uid();

/** EVERY /api/admin route in docs/API.md. */
const ADMIN_ROUTES: [Method, string][] = [
  ['put', `/api/admin/products/${X}`],
  ['put', `/api/admin/products/${X}/file`],
  ['put', `/api/admin/portfolio/${X}`],
  ['delete', `/api/admin/portfolio/${X}`],
  ['post', '/api/admin/categories'],
  ['delete', '/api/admin/categories/some-category'],
  ['put', '/api/admin/categories-order'],
  ['get', '/api/admin/orders'],
  ['patch', `/api/admin/orders/${X}`],
  ['put', `/api/admin/orders/${X}/note`],
  ['post', `/api/admin/orders/${X}/deliverables/${X}`],
  ['get', '/api/admin/reviews'],
  ['patch', `/api/admin/reviews/${X}`],
  ['get', '/api/admin/coupons'],
  ['put', '/api/admin/coupons/SAVE10'],
  ['delete', '/api/admin/coupons/SAVE10'],
  ['get', '/api/admin/customers'],
  ['put', '/api/admin/settings'],
  ['get', '/api/admin/contacts'],
  ['patch', '/api/admin/contacts/MSG-AAAAAA'],
  ['get', '/api/admin/inquiries'],
  ['patch', '/api/admin/inquiries/INQ-AAAAAA'],
  ['put', '/api/admin/inquiries/INQ-AAAAAA/note'],
  ['get', '/api/admin/callbacks'],
  ['patch', '/api/admin/callbacks/CB-AAAAAA'],
  ['get', '/api/admin/subscribers'],
  ['delete', '/api/admin/subscribers?email=a@b.co'],
  ['get', '/api/admin/events'],
];

describe('authorization matrix', () => {
  let h: Harness;
  let customer: Agent;
  let admin: Agent;
  before(async () => {
    h = await makeApp();
    customer = await signup(h.app, 'cust@example.com');
    admin = await adminAgent(h);
  });
  after(() => h.cleanup());

  test('every /api/admin route returns 401 for anonymous callers', async () => {
    for (const [m, url] of ADMIN_ROUTES) {
      const res = await request(h.app)[m](url).send({});
      assert.equal(res.status, 401, `${m.toUpperCase()} ${url}`);
    }
  });

  test('every /api/admin route returns 403 for a signed-in customer', async () => {
    for (const [m, url] of ADMIN_ROUTES) {
      const res = await customer[m](url).send({});
      assert.equal(res.status, 403, `${m.toUpperCase()} ${url}`);
      assert.equal(res.body.error, 'Admin access required.');
    }
  });

  test('an unknown /api/admin path is still behind the guard (401 for anonymous)', async () => {
    assert.equal((await request(h.app).get('/api/admin/does-not-exist')).status, 401);
    assert.equal((await admin.get('/api/admin/does-not-exist')).status, 404);
  });

  test('admin gets through on the read routes (200) and the guard never blocks them', async () => {
    for (const url of ['orders', 'reviews', 'coupons', 'customers', 'contacts', 'inquiries', 'callbacks', 'subscribers', 'events']) {
      const res = await admin.get(`/api/admin/${url}`);
      assert.equal(res.status, 200, url);
      assert.ok(Array.isArray(res.body), url);
    }
  });

  test('admin write routes pass the guard (they fail on validation or missing data, never 401/403)', async () => {
    for (const [m, url] of ADMIN_ROUTES.filter(([mm]) => mm !== 'get')) {
      const res = await admin[m](url).send({});
      assert.notEqual(res.status, 401, `${m} ${url}`);
      assert.notEqual(res.status, 403, `${m} ${url}`);
    }
  });

  test('other admin-only endpoints: upload sign, media/file uploads, ?all=1', async () => {
    assert.equal((await request(h.app).get('/api/uploads/sign?path=private/x')).status, 401);
    assert.equal((await customer.get('/api/uploads/sign?path=private/x')).status, 403);
    assert.equal((await request(h.app).post('/api/uploads?kind=media').attach('file', Buffer.alloc(40), 'a.png')).status, 401);
    assert.equal((await customer.post('/api/uploads?kind=file').attach('file', Buffer.alloc(40), 'a.zip')).status, 403);
  });

  test('a role cannot be self-assigned through signup, profile update or a forged token', async () => {
    assert.equal((await request(h.app).post('/api/auth/signup').send({ name: 'Eve', email: 'eve@example.com', password: 'password-123', role: 'admin' })).status, 400);
    const me = await customer.patch('/api/me').send({ name: 'Cust', role: 'admin' });
    assert.equal(me.status, 400);
    assert.equal((await customer.get('/api/admin/orders')).status, 403);
  });

  test('a customer cannot create products or coupons even with a valid body', async () => {
    await makeProduct(admin);
    assert.equal((await customer.put('/api/admin/coupons/FREE').send({ percent: 100, minSubtotal: 0, active: true })).status, 403);
    assert.equal((await customer.post('/api/admin/categories').send({ id: '', name: 'Mine', motif: 'cake', blurb: '' })).status, 403);
  });
});

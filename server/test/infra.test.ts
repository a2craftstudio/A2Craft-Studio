import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, afterEach, before, describe, test } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { bootstrapAdmin, upsertAdmin } from '../src/auth.js';
import { createLogger } from '../src/log.js';
import { createMailer, notifyOrderPaid, sendPasswordReset } from '../src/services/mail.js';
import { runRetention } from '../src/services/retention.js';
import { PASSWORD, makeApp, mockFetch, openTestDb, signup, testConfig, uid, makeProduct, cartOf, type Harness } from './helpers.js';

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 3600 * 1000).toISOString();

describe('retention job', () => {
  test('deletes events and call-backs older than 90 days and expired/used reset tokens, keeps the rest', async () => {
    const h = await makeApp();
    try {
      const db = h.ctx.db;
      const user = await signup(h.app, 'asha@example.com');
      void user;
      const userId = (await db.get<{ id: string }>('SELECT id FROM users'))!.id;
      for (const [id, age] of [['old', 91], ['edge', 89], ['new', 1]] as const) {
        await db.run("INSERT INTO visit_events (id, visitor_id, type, path, created_at) VALUES (?, 'v-aaaa', 'page', '/', ?)", id, daysAgo(age));
        await db.run("INSERT INTO callback_requests (id, name, phone, created_at) VALUES (?, 'N', '9876543210', ?)", `CB-${id}`, daysAgo(age));
      }
      const insertReset = (hash: string, expires: string, used: string | null) =>
        db.run('INSERT INTO password_resets (token_hash, user_id, expires_at, used_at, created_at) VALUES (?, ?, ?, ?, ?)', hash, userId, expires, used, daysAgo(0));
      await insertReset('expired', new Date(Date.now() - 1000).toISOString(), null);
      await insertReset('used', new Date(Date.now() + 3600_000).toISOString(), new Date().toISOString());
      await insertReset('live', new Date(Date.now() + 3600_000).toISOString(), null);

      const out = await runRetention(db);
      assert.deepEqual(out, { events: 1, callbacks: 1, resetTokens: 2 });
      assert.deepEqual((await db.all<{ id: string }>('SELECT id FROM visit_events ORDER BY id')).map((r) => r.id), ['edge', 'new']);
      assert.deepEqual((await db.all<{ id: string }>('SELECT id FROM callback_requests ORDER BY id')).map((r) => r.id), ['CB-edge', 'CB-new']);
      assert.deepEqual((await db.all<{ token_hash: string }>('SELECT token_hash FROM password_resets')).map((r) => r.token_hash), ['live']);
    } finally {
      await h.cleanup();
    }
  });
});

describe('email through Resend', () => {
  let m: ReturnType<typeof mockFetch>;
  afterEach(() => m?.restore());

  test('posts to the Resend REST API with a bearer key, reply-to and a single-line subject', async () => {
    m = mockFetch(() => ({ json: { id: 'e1' } }));
    const cfg = testConfig({ mail: { resendApiKey: 're_secret_key', from: 'A2 <hi@a2.test>', ownerEmail: 'o@a2.test' } });
    const mail = createMailer(cfg, createLogger('silent'));
    await mail.send({ to: 'x@y.co', subject: 'Hi\r\nBcc: evil@x.co', html: '<p>hello</p>', replyTo: 'cust@y.co' });
    assert.equal(m.calls.length, 1);
    const c = m.calls[0]!;
    assert.equal(c.url, 'https://api.resend.com/emails');
    assert.equal(c.method, 'POST');
    assert.equal(c.headers['authorization'], 'Bearer re_secret_key');
    const body = c.body as Record<string, unknown>;
    assert.deepEqual(body['to'], ['x@y.co']);
    assert.equal(body['from'], 'A2 <hi@a2.test>');
    assert.equal(body['reply_to'], 'cust@y.co');
    assert.equal((body['subject'] as string).includes('\n'), false);
  });

  test('without an API key nothing is sent and the log line has no body or secrets', async () => {
    m = mockFetch(() => ({}));
    const lines: string[] = [];
    const orig = console.log;
    console.log = (s: string) => void lines.push(String(s));
    try {
      const mail = createMailer(testConfig(), createLogger('info'));
      await mail.send({ to: 'x@y.co', subject: 'Reset', html: '<a href="https://shop/account?reset=SECRETTOKEN">x</a>' });
    } finally {
      console.log = orig;
    }
    assert.equal(m.calls.length, 0);
    assert.equal(lines.length, 1);
    assert.match(lines[0]!, /not sent/);
    assert.equal(lines[0]!.includes('SECRETTOKEN'), false);
  });

  test('a Resend failure never throws into the request', async () => {
    m = mockFetch(() => ({ status: 500, json: { message: 'boom' } }));
    const mail = createMailer(testConfig({ mail: { resendApiKey: 'k', from: 'f', ownerEmail: '' } }), createLogger('silent'));
    await assert.doesNotReject(mail.send({ to: 'x@y.co', subject: 's', html: 'h' }));
    m.restore();
    m = mockFetch(() => {
      throw new Error('network down');
    });
    await assert.doesNotReject(mail.send({ to: 'x@y.co', subject: 's', html: 'h' }));
  });

  test('a paid order sends a customer and an owner email through the real mailer; names are escaped', async () => {
    m = mockFetch(() => ({ json: { id: 'e' } }));
    const cfg = testConfig({ paymentSimulator: true, mail: { resendApiKey: 'k', from: 'A2 <a@a2.test>', ownerEmail: 'owner@a2.test' } });
    const app = createApp(cfg, { db: await openTestDb() });
    try {
      const admin = await (async () => {
        const { createUser } = await import('../src/auth.js');
        await createUser(app.ctx, { email: 'boss@a2.test', name: 'Boss', password: PASSWORD, role: 'admin' });
        const a = request.agent(app);
        await a.post('/api/auth/login').send({ email: 'boss@a2.test', password: PASSWORD });
        return a;
      })();
      const shopper = request.agent(app);
      await shopper.post('/api/auth/signup').send({ name: '<i>Asha</i>', email: 'a@a2.test', password: PASSWORD });
      const p = await makeProduct(admin as never, { title: 'Card <b>1</b>' });
      const o = await shopper.post('/api/orders').send({ items: [cartOf(p.id)], customer: { name: '<i>Asha</i>', email: 'a@a2.test', phone: '9876543210' }, acceptedTerms: true });
      await shopper.post(`/api/orders/${o.body.orderId}/verify`).send({ outcome: 'success' });
      const mails = m.calls.filter((c) => c.url.includes('resend')).map((c) => c.body as { to: string[]; html: string; subject: string });
      assert.deepEqual(mails.map((x) => x.to[0]).sort(), ['a@a2.test', 'owner@a2.test']);
      for (const x of mails) {
        assert.equal(x.html.includes('<i>'), false);
        assert.equal(x.html.includes('<b>1'), false);
        assert.match(x.html, /&lt;i&gt;Asha&lt;\/i&gt;/);
      }
      assert.match(mails.find((x) => x.to[0] === 'a@a2.test')!.html, /https:\/\/shop\.test\/order\/|\/order\//);
    } finally {
      await app.ctx.db.close();
    }
  });

  test('password reset mail links to SITE_ORIGIN/account?reset=<token>', async () => {
    const sent: { html: string }[] = [];
    sendPasswordReset(testConfig(), { send: async () => {}, idle: async () => {}, queue: (x) => void sent.push(x) }, 'a@b.co', 'Asha', 'abc123');
    assert.match(sent[0]!.html, /href="https:\/\/shop\.test\/account\?reset=abc123"/);
  });

  test('notifyOrderPaid ignores unknown orders', async () => {
    const h = await makeApp();
    try {
      await notifyOrderPaid(h.ctx.config, h.ctx.db, h.ctx.mail, uid());
      assert.equal(h.outbox.length, 0);
    } finally {
      await h.cleanup();
    }
  });
});

describe('admin bootstrap and CLI helper', () => {
  test('bootstrapAdmin creates the admin from env only when none exists', async () => {
    const h = await makeApp({ admin: { email: 'owner@a2.test', password: 'owner-password-1', name: 'Owner' } });
    try {
      assert.equal(await bootstrapAdmin(h.ctx), 'created');
      assert.equal(await bootstrapAdmin(h.ctx), 'skipped', 'an admin now exists');
      const login = await request(h.app).post('/api/auth/login').send({ email: 'owner@a2.test', password: 'owner-password-1' });
      assert.equal(login.status, 200);
      assert.equal(login.body.user.role, 'admin');
      assert.equal(login.body.user.name, 'Owner');
    } finally {
      await h.cleanup();
    }
  });

  test('bootstrapAdmin does nothing without env, or with a short password', async () => {
    const a = await makeApp();
    const b = await makeApp({ admin: { email: 'x@a2.test', password: 'short', name: 'X' } });
    try {
      assert.equal(await bootstrapAdmin(a.ctx), 'skipped');
      assert.equal(await bootstrapAdmin(b.ctx), 'skipped');
      assert.equal((await b.ctx.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM users'))!.n, 0);
    } finally {
      await a.cleanup();
      await b.cleanup();
    }
  });

  test('upsertAdmin creates, then promotes and resets the password of an existing account', async () => {
    const h = await makeApp();
    try {
      assert.equal(await upsertAdmin(h.ctx, 'New@A2.test', 'first-password-1', 'New Admin'), 'created');
      await signup(h.app, 'cust@a2.test', 'Cust');
      assert.equal(await upsertAdmin(h.ctx, 'cust@a2.test', 'second-password-2'), 'updated');
      const res = await request(h.app).post('/api/auth/login').send({ email: 'cust@a2.test', password: 'second-password-2' });
      assert.equal(res.body.user.role, 'admin');
      assert.equal(res.body.user.name, 'Cust', 'name kept when none is given');
      assert.equal((await request(h.app).post('/api/auth/login').send({ email: 'cust@a2.test', password: PASSWORD })).status, 401);
    } finally {
      await h.cleanup();
    }
  });
});

describe('http hardening', () => {
  let h: Harness;
  before(async () => void (h = await makeApp()));
  after(() => h.cleanup());

  test('security headers and no X-Powered-By; API responses are not cacheable', async () => {
    const res = await request(h.app).get('/api/products');
    assert.equal(res.headers['x-powered-by'], undefined);
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.match(res.headers['content-security-policy']!, /default-src 'self'/);
    assert.match(res.headers['content-security-policy']!, /checkout\.razorpay\.com/);
    assert.equal(res.headers['cache-control'], 'no-store');
    assert.ok(res.headers['x-request-id']);
  });

  test('unknown API routes give JSON 404, not HTML', async () => {
    const res = await request(h.app).get('/api/nope');
    assert.equal(res.status, 404);
    assert.deepEqual(res.body, { error: 'Not found.' });
  });

  test('oversized JSON bodies get 413', async () => {
    const res = await request(h.app).post('/api/contact').send({ name: 'x', email: 'a@b.co', message: 'y'.repeat(1_100_000) });
    assert.equal(res.status, 413);
  });

  test('unexpected errors return a generic 500 with a request id and no stack or SQL', async () => {
    const db = h.ctx.db;
    await db.exec('ALTER TABLE site_settings RENAME TO site_settings_x');
    try {
      const res = await request(h.app).get('/api/settings');
      assert.equal(res.status, 500);
      assert.deepEqual(Object.keys(res.body).sort(), ['error', 'requestId']);
      assert.equal(res.body.error, 'Something went wrong. Please try again.');
      assert.equal(JSON.stringify(res.body).includes('site_settings'), false);
    } finally {
      await db.exec('ALTER TABLE site_settings_x RENAME TO site_settings');
    }
  });
});

describe('serving the Angular build', () => {
  const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'a2-dist-'));
  fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>A2</title><app-root></app-root>');
  fs.writeFileSync(path.join(dist, 'main-ABCDEFGH.js'), 'console.log(1)');
  fs.writeFileSync(path.join(dist, 'favicon.ico'), 'ico');
  let h: Harness;
  before(async () => void (h = await makeApp({ clientDist: dist })));
  after(async () => {
    await h.cleanup();
    fs.rmSync(dist, { recursive: true, force: true });
  });

  test('index.html is no-cache; hashed assets are cached for a year', async () => {
    const idx = await request(h.app).get('/');
    assert.equal(idx.status, 200);
    assert.match(idx.text, /app-root/);
    assert.equal(idx.headers['cache-control'], 'no-cache');
    const js = await request(h.app).get('/main-ABCDEFGH.js');
    assert.equal(js.headers['cache-control'], 'public, max-age=31536000, immutable');
    assert.match((await request(h.app).get('/favicon.ico')).headers['cache-control']!, /max-age=3600/);
  });

  test('SPA fallback for client routes, but not for /api, /media, /files or missing files', async () => {
    for (const p of ['/shop', '/product/blush-invite', '/account', '/admin/orders']) {
      const res = await request(h.app).get(p);
      assert.equal(res.status, 200, p);
      assert.match(res.text, /app-root/);
    }
    assert.equal((await request(h.app).get('/api/unknown')).headers['content-type']!.includes('json'), true);
    assert.equal((await request(h.app).get('/media/missing.png')).status, 404);
    assert.equal((await request(h.app).get('/files/missing.pdf')).status, 403);
    assert.equal((await request(h.app).get('/missing.js')).status, 404);
    assert.equal((await request(h.app).post('/shop').send({})).status, 404, 'only GET falls back');
  });
});


import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import request from 'supertest';
import { loadConfig } from '../src/config.js';
import { PASSWORD, makeApp, signup, type Harness } from './helpers.js';

describe('auth', () => {
  let h: Harness;
  before(async () => void (h = await makeApp()));
  after(() => h.cleanup());

  test('signup sets an httpOnly, SameSite=Lax session cookie and returns the user (no hash)', async () => {
    const res = await request(h.app).post('/api/auth/signup').send({ name: '  Asha Rao ', email: 'Asha@Example.com ', password: PASSWORD });
    assert.equal(res.status, 200);
    assert.equal(res.body.user.email, 'asha@example.com');
    assert.equal(res.body.user.name, 'Asha Rao');
    assert.equal(res.body.user.role, 'customer');
    assert.equal(JSON.stringify(res.body).includes('hash'), false);
    const cookie = (res.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('a2_session='))!;
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Lax/i);
    assert.doesNotMatch(cookie, /Secure/i); // test config is not production
    assert.match(cookie, /Max-Age=604800/);
  });

  test('cookie is Secure when COOKIE_SECURE is on (production default)', async () => {
    const p = await makeApp({ cookieSecure: true });
    try {
      const res = await request(p.app).post('/api/auth/signup').send({ name: 'Sec', email: 'sec@example.com', password: PASSWORD });
      const cookie = (res.headers['set-cookie'] as unknown as string[])[0]!;
      assert.match(cookie, /Secure/i);
      assert.match(cookie, /HttpOnly/i);
    } finally {
      await p.cleanup();
    }
  });

  test('production config requires a strong JWT_SECRET and SITE_ORIGIN, and defaults cookies to Secure', () => {
    assert.throws(() => loadConfig({ NODE_ENV: 'production' }, () => undefined), /JWT_SECRET/);
    assert.throws(() => loadConfig({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(40) }, () => undefined), /SITE_ORIGIN/);
    const c = loadConfig({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(40), SITE_ORIGIN: 'https://a2.example', DATABASE_URL: 'postgresql://user:pw@db.example.test:5432/postgres' }, () => undefined);
    assert.equal(c.cookieSecure, true);
    assert.equal(c.bcryptCost, 12);
  });

  test('duplicate email returns 409, case-insensitively', async () => {
    const res = await request(h.app).post('/api/auth/signup').send({ name: 'Other', email: 'ASHA@example.com', password: PASSWORD });
    assert.equal(res.status, 409);
    assert.match(res.body.error, /already exists/);
  });

  test('weak or malformed signup is rejected with 400 and a message', async () => {
    const weak = await request(h.app).post('/api/auth/signup').send({ name: 'W', email: 'w@example.com', password: 'short' });
    assert.equal(weak.status, 400);
    assert.match(weak.body.error, /at least 8/);
    const bad = await request(h.app).post('/api/auth/signup').send({ name: 'W', email: 'not-an-email', password: PASSWORD });
    assert.equal(bad.status, 400);
    const extra = await request(h.app).post('/api/auth/signup').send({ name: 'W', email: 'w@example.com', password: PASSWORD, role: 'admin' });
    assert.equal(extra.status, 400, 'unknown fields (like role) are rejected');
  });

  test('login works, wrong password and unknown email give the same 401 message', async () => {
    const ok = await request(h.app).post('/api/auth/login').send({ email: 'asha@example.com', password: PASSWORD });
    assert.equal(ok.status, 200);
    const wrong = await request(h.app).post('/api/auth/login').send({ email: 'asha@example.com', password: 'wrong-password' });
    const unknown = await request(h.app).post('/api/auth/login').send({ email: 'nobody@example.com', password: 'wrong-password' });
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.equal(wrong.body.error, 'Incorrect email or password.');
    assert.deepEqual(unknown.body, wrong.body);
  });

  test('me, logout and the session cookie', async () => {
    const agent = await signup(h.app, 'me@example.com', 'Mina Das');
    const me = await agent.get('/api/auth/me');
    assert.equal(me.body.user.email, 'me@example.com');
    const out = await agent.post('/api/auth/logout');
    assert.equal(out.status, 204);
    assert.match((out.headers['set-cookie'] as unknown as string[])[0]!, /a2_session=;/);
    assert.equal((await agent.get('/api/auth/me')).body.user, null);
    assert.equal((await request(h.app).get('/api/auth/me')).body.user, null);
  });

  test('a forged or tampered cookie is ignored', async () => {
    const res = await request(h.app).get('/api/auth/me').set('Cookie', 'a2_session=eyJhbGciOiJub25lIn0.eyJzdWIiOiJ4In0.');
    assert.equal(res.body.user, null);
  });

  test('profile update and password change; the old password stops working', async () => {
    const agent = await signup(h.app, 'pw@example.com', 'Pia');
    assert.equal((await agent.patch('/api/me').send({ name: 'Pia K' })).body.user.name, 'Pia K');
    assert.equal((await agent.post('/api/me/password').send({ password: 'short' })).status, 400);
    assert.equal((await agent.post('/api/me/password').send({ password: 'brand-new-pass-1' })).status, 204);
    assert.equal((await agent.get('/api/auth/me')).body.user.name, 'Pia K', 'current session stays valid');
    assert.equal((await request(h.app).post('/api/auth/login').send({ email: 'pw@example.com', password: PASSWORD })).status, 401);
    assert.equal((await request(h.app).post('/api/auth/login').send({ email: 'pw@example.com', password: 'brand-new-pass-1' })).status, 200);
    assert.equal((await request(h.app).patch('/api/me').send({ name: 'x' })).status, 401);
  });

  test('forgot answers 204 for known and unknown emails; reset token works exactly once', async () => {
    await signup(h.app, 'reset@example.com', 'Rita');
    h.outbox.length = 0;
    assert.equal((await request(h.app).post('/api/auth/forgot').send({ email: 'nobody-here@example.com' })).status, 204);
    assert.equal(h.outbox.length, 0, 'no email for unknown address');
    assert.equal((await request(h.app).post('/api/auth/forgot').send({ email: 'RESET@example.com' })).status, 204);
    assert.equal(h.outbox.length, 1);
    const mail = h.outbox[0]!;
    assert.equal(mail.to, 'reset@example.com');
    const token = /reset=([0-9a-f]{64})/.exec(mail.html)![1]!;
    assert.match(mail.html, /^<p>Hi Rita/);

    // only a hash is stored
    const stored = (await h.ctx.db.all<{ token_hash: string }>('SELECT token_hash FROM password_resets'));
    assert.equal(stored.some((r) => r.token_hash === token), false);
    assert.equal(stored.length, 1);

    const bad = await request(h.app).post('/api/auth/reset').send({ token: 'f'.repeat(64), password: 'whatever-123' });
    assert.equal(bad.status, 400);
    const weak = await request(h.app).post('/api/auth/reset').send({ token, password: 'short' });
    assert.equal(weak.status, 400);

    const ok = await request(h.app).post('/api/auth/reset').send({ token, password: 'fresh-password-7' });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.user.email, 'reset@example.com');
    assert.ok(ok.headers['set-cookie']);
    const again = await request(h.app).post('/api/auth/reset').send({ token, password: 'another-pass-8' });
    assert.equal(again.status, 400, 'single use');
    assert.equal((await request(h.app).post('/api/auth/login').send({ email: 'reset@example.com', password: 'fresh-password-7' })).status, 200);
  });

  test('an expired reset token is rejected', async () => {
    await signup(h.app, 'late@example.com', 'Late');
    h.outbox.length = 0;
    await request(h.app).post('/api/auth/forgot').send({ email: 'late@example.com' });
    const token = /reset=([0-9a-f]{64})/.exec(h.outbox[0]!.html)![1]!;
    await h.ctx.db.run('UPDATE password_resets SET expires_at = ?', new Date(Date.now() - 1000).toISOString());
    const res = await request(h.app).post('/api/auth/reset').send({ token, password: 'fresh-password-7' });
    assert.equal(res.status, 400);
  });

  test('password reset signs out sessions that existed before', async () => {
    const agent = await signup(h.app, 'old@example.com', 'Old');
    h.outbox.length = 0;
    await request(h.app).post('/api/auth/forgot').send({ email: 'old@example.com' });
    const token = /reset=([0-9a-f]{64})/.exec(h.outbox[0]!.html)![1]!;
    await request(h.app).post('/api/auth/reset').send({ token, password: 'fresh-password-7' });
    assert.equal((await agent.get('/api/auth/me')).body.user, null);
  });

  test('form-encoded and text/plain bodies are rejected (CSRF), JSON is required', async () => {
    const form = await request(h.app).post('/api/auth/login').type('form').send({ email: 'asha@example.com', password: PASSWORD });
    assert.equal(form.status, 400);
    assert.match(form.body.error, /JSON/);
    const plain = await request(h.app).post('/api/auth/login').set('Content-Type', 'text/plain').send(JSON.stringify({ email: 'asha@example.com', password: PASSWORD }));
    assert.equal(plain.status, 400);
  });

  test('a state-changing request from a foreign Origin is refused', async () => {
    const res = await request(h.app).post('/api/auth/login').set('Origin', 'https://evil.example').send({ email: 'asha@example.com', password: PASSWORD });
    assert.equal(res.status, 403);
    const same = await request(h.app).post('/api/auth/login').set('Origin', 'https://shop.test').send({ email: 'asha@example.com', password: PASSWORD });
    assert.equal(same.status, 200);
  });

  test('malformed JSON gives a clean 400 and never a stack trace', async () => {
    const res = await request(h.app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email": ');
    assert.equal(res.status, 400);
    assert.deepEqual(Object.keys(res.body), ['error']);
    assert.equal(JSON.stringify(res.body).includes('at '), false);
  });

  test('rate limit: the 11th auth attempt within a minute gets 429', async () => {
    const p = await makeApp({ rateLimit: true });
    try {
      let last = 0;
      for (let i = 0; i < 11; i++) last = (await request(p.app).post('/api/auth/login').send({ email: 'x@example.com', password: 'nope-nope-1' })).status;
      assert.equal(last, 429);
      const res = await request(p.app).post('/api/auth/login').send({ email: 'x@example.com', password: 'nope-nope-1' });
      assert.equal(res.body.error, 'Too many requests. Please wait a moment and try again.');
    } finally {
      await p.cleanup();
    }
  });
});

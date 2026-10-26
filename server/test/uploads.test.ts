import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import request from 'supertest';
import { JPEG, MP4, PNG, adminAgent, makeApp, signup, type Agent, type Harness } from './helpers.js';

const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
const html = Buffer.from('<html><script>alert(1)</script></html>');

describe('uploads', () => {
  let h: Harness;
  let admin: Agent;
  let customer: Agent;
  before(async () => {
    h = await makeApp();
    admin = await adminAgent(h);
    customer = await signup(h.app, 'cust@example.com');
  });
  after(() => h.cleanup());

  const files = (dir: 'public' | 'private' | 'tmp') => fs.readdirSync(path.join(h.uploadDir, dir));

  test('kind is required and must be one of media, file, reference', async () => {
    assert.equal((await admin.post('/api/uploads').attach('file', PNG, 'a.png')).status, 400);
    assert.equal((await admin.post('/api/uploads?kind=avatar').attach('file', PNG, 'a.png')).status, 400);
  });

  test('media: admin only; stored under a random name with the sniffed extension and served from /media', async () => {
    assert.equal((await request(h.app).post('/api/uploads?kind=media').attach('file', PNG, 'a.png')).status, 401);
    assert.equal((await customer.post('/api/uploads?kind=media').attach('file', PNG, 'a.png')).status, 403);
    const res = await admin.post('/api/uploads?kind=media').attach('file', PNG, 'My Cover Photo.PNG');
    assert.equal(res.status, 200);
    assert.match(res.body.url, /^\/media\/[0-9a-f]{32}\.png$/);
    assert.equal(res.body.url.includes('Cover'), false, 'the client file name is never used');
    const served = await request(h.app).get(res.body.url);
    assert.equal(served.status, 200);
    assert.equal(served.headers['content-type'], 'image/png');
    assert.equal(served.headers['x-content-type-options'], 'nosniff');
    assert.match(served.headers['cache-control']!, /max-age=\d+/);
    const mp4 = await admin.post('/api/uploads?kind=media').attach('file', MP4, 'clip.mp4');
    assert.match(mp4.body.url, /\.mp4$/);
    assert.equal((await request(h.app).get(mp4.body.url)).headers['content-type'], 'video/mp4');
  });

  test('media: SVG, HTML, executables and disguised files are rejected', async () => {
    for (const [name, buf] of [['x.svg', svg], ['x.html', html], ['x.exe', Buffer.alloc(100, 0x4d)], ['x.png', html], ['x.jpg', svg], ['x.mp4', html]] as const) {
      const res = await admin.post('/api/uploads?kind=media').attach('file', buf, name);
      assert.equal(res.status, 400, name);
    }
    assert.equal(files('public').filter((f) => /svg|html|exe/.test(f)).length, 0);
  });

  test('media: images over 10 MB are refused with 413; nothing is left in the temp folder', async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(10 * 1024 * 1024)]);
    const res = await admin.post('/api/uploads?kind=media').attach('file', big, 'big.png');
    assert.equal(res.status, 413);
    assert.equal(files('tmp').length, 0);
  });

  test('reference: anyone can upload a JPG/PNG/WebP, stored privately with a random name', async () => {
    const anon = await request(h.app).post('/api/uploads?kind=reference').attach('file', JPEG, 'me.jpeg');
    assert.equal(anon.status, 200);
    assert.match(anon.body.path, /^private\/[0-9a-f]{32}\.jpg$/);
    assert.equal(anon.body.url, undefined, 'private files get no public URL');
    assert.ok(files('private').includes(anon.body.path.replace('private/', '')));
    const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.from([1, 2, 3, 4]), Buffer.from('WEBP'), Buffer.alloc(32)]);
    const w = await customer.post('/api/uploads?kind=reference').attach('file', webp, 'p.webp');
    assert.match(w.body.path, /\.webp$/);
    assert.equal((await request(h.app).get(`/${anon.body.path}`)).status, 404, 'not reachable as a static file');
    assert.equal((await request(h.app).get(`/media/${anon.body.path.replace('private/', '')}`)).status, 404);
  });

  test('reference: wrong type, wrong content, GIF/SVG, and files over 5 MB are rejected', async () => {
    const post = (buf: Buffer, name: string) => request(h.app).post('/api/uploads?kind=reference').attach('file', buf, name);
    assert.equal((await post(svg, 'x.svg')).status, 400);
    assert.equal((await post(html, 'x.png')).status, 400, 'extension says png, bytes say html');
    assert.equal((await post(Buffer.from('GIF89a' + 'x'.repeat(40)), 'x.gif')).status, 400);
    assert.equal((await post(MP4, 'x.mp4')).status, 400);
    assert.equal((await post(PNG, 'x.exe')).status, 400, 'extension allow-list applies too');
    assert.equal((await post(Buffer.alloc(0), 'empty.png')).status, 400);
    const big = await post(Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]), 'big.png');
    assert.equal(big.status, 413);
    assert.equal(files('tmp').length, 0);
  });

  test('file: admin only, keeps a sanitised name, never traverses', async () => {
    assert.equal((await customer.post('/api/uploads?kind=file').attach('file', Buffer.from('z'), 'a.zip')).status, 403);
    const res = await admin.post('/api/uploads?kind=file').attach('file', Buffer.from('data'), '../../../etc/pass wd<script>.zip');
    assert.equal(res.status, 200);
    assert.match(res.body.path, /^private\/[0-9a-f]{32}-[A-Za-z0-9._-]+\.zip$/);
    assert.equal(res.body.path.includes('..'), false);
    assert.equal(res.body.path.split('/').length, 2);
    assert.equal(fs.existsSync(path.join(h.uploadDir, 'private', res.body.path.slice(8))), true);
    const none = await admin.post('/api/uploads?kind=file').field('x', 'y');
    assert.equal(none.status, 400);
  });

  test('path traversal attempts cannot read or sign anything outside private/', async () => {
    fs.writeFileSync(path.join(h.uploadDir, 'secret.txt'), 'TOP SECRET');
    for (const p of ['private/../secret.txt', '../secret.txt', 'private/..%2Fsecret.txt', 'private/a/b', '/etc/passwd', 'public/x.png', 'private/.hidden']) {
      const res = await admin.get(`/api/uploads/sign?path=${encodeURIComponent(p)}`);
      assert.equal(res.status, 400, p);
    }
    assert.equal((await admin.get('/api/uploads/sign?path=private/nothere.png')).status, 404);
    assert.equal((await request(h.app).get('/files/..%2Fsecret.txt?e=9999999999&s=' + '0'.repeat(64))).status, 403);
    assert.equal((await request(h.app).get('/media/..%2Fsecret.txt')).status, 404);
    assert.equal((await request(h.app).get('/media/%2e%2e/secret.txt')).status, 404);
  });

  test('a signed private URL serves a reference photo to the admin; scripts are never served inline', async () => {
    const up = await request(h.app).post('/api/uploads?kind=reference').attach('file', PNG, 'ref.png');
    const signed = await admin.get(`/api/uploads/sign?path=${encodeURIComponent(up.body.path)}`);
    assert.equal(signed.status, 200);
    const res = await request(h.app).get(signed.body.url);
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-type'], 'image/png');
    assert.equal(res.headers['cache-control'], 'private, no-store');

    // an HTML "deliverable" is forced to download as an opaque binary, with a sandbox CSP
    const evil = await admin.post('/api/uploads?kind=file').attach('file', html, 'page.html');
    const evilUrl = (await admin.get(`/api/uploads/sign?path=${encodeURIComponent(evil.body.path)}`)).body.url;
    const evilRes = await request(h.app).get(evilUrl);
    assert.equal(evilRes.status, 200);
    assert.equal(evilRes.headers['content-type'], 'application/octet-stream');
    assert.match(evilRes.headers['content-disposition']!, /^attachment/);
    assert.match(evilRes.headers['content-security-policy']!, /sandbox/);
  });

  test('reference uploads are rate limited to 20 per hour per IP (429)', async () => {
    const p = await makeApp({ rateLimit: true });
    try {
      let last = 0;
      for (let i = 0; i < 21; i++) last = (await request(p.app).post('/api/uploads?kind=reference').attach('file', PNG, 'a.png')).status;
      assert.equal(last, 429);
    } finally {
      await p.cleanup();
    }
  });
});

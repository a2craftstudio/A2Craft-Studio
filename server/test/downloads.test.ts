import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import request from 'supertest';
import { signPath } from '../src/services/files.js';
import { adminAgent, cartOf, makeApp, makeProduct, placeOrder, signup, uid, type Agent, type Harness } from './helpers.js';

const custom = { fields: { name: 'Asha' }, paletteId: 'blush', fontId: 'serif', photos: [], notes: '' };

describe('downloads, deliverables and signed files', () => {
  let h: Harness;
  let admin: Agent;
  let shopper: Agent;
  let readyMade: { id: string }; // downloadable template with a private file
  let handMade: { id: string }; // customizable, prepared by hand
  let handMade2: { id: string };
  let noFile: { id: string };
  let orderId: string;
  let unpaidId: string;

  const pay = async (agent: Agent, id: string) => (await agent.post(`/api/orders/${id}/verify`).send({ outcome: 'success' })).body;

  before(async () => {
    h = await makeApp({ paymentSimulator: true });
    admin = await adminAgent(h);
    shopper = await signup(h.app, 'asha@example.com');
    readyMade = await makeProduct(admin, { title: 'Ready template', priceInr: 100 });
    handMade = await makeProduct(admin, { title: 'Custom video', priceInr: 900, customizable: true, customizationKind: 'text' });
    handMade2 = await makeProduct(admin, { title: 'Custom book', priceInr: 700, customizable: true, customizationKind: 'text' });
    noFile = await makeProduct(admin, { title: 'No file yet', priceInr: 50 });

    const up = await admin.post('/api/uploads?kind=file').attach('file', Buffer.from('TEMPLATE-BYTES'), 'ready.pdf');
    await admin.put(`/api/admin/products/${readyMade.id}/file`).send({ path: up.body.path });

    const o = await placeOrder(shopper, [cartOf(readyMade.id), cartOf(handMade.id, 1, { customization: custom }), cartOf(handMade2.id, 1, { customization: custom }), cartOf(noFile.id)]);
    assert.equal(o.status, 200, JSON.stringify(o.body));
    orderId = o.body.orderId;
    const u = await placeOrder(shopper, [cartOf(readyMade.id)]);
    unpaidId = u.body.orderId;
  });
  after(() => h.cleanup());

  test('unpaid orders cannot download (403), even for a ready-made file', async () => {
    const res = await shopper.get(`/api/orders/${unpaidId}/download/${readyMade.id}`);
    assert.equal(res.status, 403);
    assert.match(res.body.error, /verified payment/);
  });

  test('deliverables are admin only and never for unpaid orders', async () => {
    const file = Buffer.from('FINAL-VIDEO');
    const anon = await request(h.app).post(`/api/admin/orders/${orderId}/deliverables/${handMade.id}`).attach('file', file, 'final.mp4');
    assert.equal(anon.status, 401);
    const asCustomer = await shopper.post(`/api/admin/orders/${orderId}/deliverables/${handMade.id}`).attach('file', file, 'final.mp4');
    assert.equal(asCustomer.status, 403);
    const unpaid = await admin.post(`/api/admin/orders/${unpaidId}/deliverables/${readyMade.id}`).attach('file', file, 'final.mp4');
    assert.equal(unpaid.status, 409);
    assert.equal((await h.ctx.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM deliverables'))!.n, 0);
  });

  test('after payment: ready-made returns a signed URL; hand-made without deliverable is a 409; no file is a 404', async () => {
    const paid = await pay(shopper, orderId);
    assert.equal(paid.status, 'paid');

    const ready = await shopper.get(`/api/orders/${orderId}/download/${readyMade.id}`);
    assert.equal(ready.status, 200);
    assert.match(ready.body.url, /^\/files\/[0-9a-f]{32}-ready\.pdf\?e=\d+&s=[0-9a-f]{64}&dl=1$/);

    const hand = await shopper.get(`/api/orders/${orderId}/download/${handMade.id}`);
    assert.equal(hand.status, 409);
    assert.equal(hand.body.error, 'This item is prepared by hand. We will email you as soon as your files are ready.');

    const none = await shopper.get(`/api/orders/${orderId}/download/${noFile.id}`);
    assert.equal(none.status, 404);
    assert.equal(none.body.error, 'No file is attached to this product yet.');

    assert.equal((await shopper.get(`/api/orders/${orderId}/download/${uid()}`)).status, 404, 'product not in this order');
  });

  test('another user gets 404 and anonymous gets 401 (no hint that the order exists)', async () => {
    const other = await signup(h.app, 'other@example.com', 'Other');
    assert.equal((await other.get(`/api/orders/${orderId}/download/${readyMade.id}`)).status, 404);
    assert.equal((await request(h.app).get(`/api/orders/${orderId}/download/${readyMade.id}`)).status, 401);
    assert.equal((await admin.get(`/api/orders/${orderId}/download/${readyMade.id}`)).status, 404, 'download is for the owner only');
  });

  test('the signed URL serves the file as an attachment with private, no-store headers', async () => {
    const { url } = (await shopper.get(`/api/orders/${orderId}/download/${readyMade.id}`)).body;
    const res = await request(h.app).get(url);
    assert.equal(res.status, 200);
    assert.equal(res.body.toString(), 'TEMPLATE-BYTES');
    assert.equal(res.headers['cache-control'], 'private, no-store');
    assert.match(res.headers['content-disposition']!, /^attachment; filename="ready\.pdf"$/);
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.equal(res.headers['content-type'], 'application/pdf');
  });

  test('signed URLs fail when tampered, expired, re-pointed or unsigned', async () => {
    const { url } = (await shopper.get(`/api/orders/${orderId}/download/${readyMade.id}`)).body as { url: string };
    const u = new URL(url, 'http://x');
    const name = u.pathname.replace('/files/', '');
    const e = u.searchParams.get('e')!;
    const s = u.searchParams.get('s')!;
    const get = (p: string) => request(h.app).get(p);

    assert.equal((await get(`/files/${name}?e=${e}&s=${'0'.repeat(64)}`)).status, 403, 'wrong signature');
    assert.equal((await get(`/files/${name}?e=${Number(e) + 3600}&s=${s}`)).status, 403, 'extended expiry');
    assert.equal((await get(`/files/${name}`)).status, 403, 'no signature');
    assert.equal((await get(`/files/${name}?e=${e}&s=${s.slice(0, 63)}`)).status, 403, 'short signature');
    assert.equal((await get(`/files/${name}?e=${e}&s=${s.toUpperCase()}`)).status, 403, 'wrong case');

    const past = Math.floor(Date.now() / 1000) - 10;
    const expired = signPath(h.ctx.config, `private/${name}`, past);
    assert.equal((await get(`/files/${name}?e=${past}&s=${expired}`)).status, 403, 'expired');

    const otherName = `${'a'.repeat(32)}-other.pdf`;
    fs.writeFileSync(path.join(h.uploadDir, 'private', otherName), 'SECRET-OTHER');
    assert.equal((await get(`/files/${otherName}?e=${e}&s=${s}`)).status, 403, 'a signature for one file does not unlock another');
    assert.equal((await get(`/files/..%2F..%2Fpackage.json?e=${e}&s=${s}`)).status, 403);
    assert.equal((await get(`/files/${name}?e=${e}&s=${s}`)).status, 200, 'the untouched URL still works');
  });

  test('the download URL is valid for about 60 seconds, the admin sign URL for 5 minutes', async () => {
    const { url } = (await shopper.get(`/api/orders/${orderId}/download/${readyMade.id}`)).body as { url: string };
    const ttl = Number(new URL(url, 'http://x').searchParams.get('e')) - Math.floor(Date.now() / 1000);
    assert.ok(ttl > 55 && ttl <= 60, `ttl ${ttl}`);
    const up = await admin.post('/api/uploads?kind=file').attach('file', Buffer.from('x'), 'p.txt');
    const signed = (await admin.get(`/api/uploads/sign?path=${encodeURIComponent(up.body.path)}`)).body.url as string;
    const ttl2 = Number(new URL(signed, 'http://x').searchParams.get('e')) - Math.floor(Date.now() / 1000);
    assert.ok(ttl2 > 295 && ttl2 <= 300, `ttl ${ttl2}`);
    assert.equal((await request(h.app).get(signed)).status, 200);
  });

  test('status becomes delivered only when EVERY personalized item has its deliverable; customer is emailed', async () => {
    h.outbox.length = 0;
    const first = await admin.post(`/api/admin/orders/${orderId}/deliverables/${handMade.id}`).attach('file', Buffer.from('FINAL-VIDEO-V1'), 'final video.mp4');
    assert.equal(first.status, 204);
    let order = (await shopper.get(`/api/orders/${orderId}`)).body;
    assert.equal(order.status, 'paid', 'one of two personalized items is not enough');
    assert.equal(order.items.find((i: { productId: string }) => i.productId === handMade.id).deliverable, 'final-video.mp4');
    assert.equal(order.items.find((i: { productId: string }) => i.productId === handMade2.id).deliverable, undefined);
    assert.equal(h.outbox.length, 1);
    assert.equal(h.outbox[0]!.to, 'asha@example.com');
    assert.equal(h.outbox[0]!.subject, 'Your files are ready');

    // replacing a deliverable keeps one row and removes the old file
    const before = fs.readdirSync(path.join(h.uploadDir, 'private')).length;
    await admin.post(`/api/admin/orders/${orderId}/deliverables/${handMade.id}`).attach('file', Buffer.from('FINAL-VIDEO-V2'), 'final video.mp4');
    assert.equal(fs.readdirSync(path.join(h.uploadDir, 'private')).length, before);
    assert.equal((await h.ctx.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM deliverables WHERE order_id = ?', orderId))!.n, 1);

    await admin.post(`/api/admin/orders/${orderId}/deliverables/${handMade2.id}`).attach('file', Buffer.from('BOOK'), 'book.pdf');
    order = (await shopper.get(`/api/orders/${orderId}`)).body;
    assert.equal(order.status, 'delivered');
  });

  test('a deliverable is preferred over the product file and downloads the final bytes', async () => {
    const res = await shopper.get(`/api/orders/${orderId}/download/${handMade.id}`);
    assert.equal(res.status, 200);
    const file = await request(h.app).get(res.body.url);
    assert.equal(file.body.toString(), 'FINAL-VIDEO-V2');

    // even a non-customizable product with a product file returns the deliverable when one exists
    await admin.post(`/api/admin/orders/${orderId}/deliverables/${readyMade.id}`).attach('file', Buffer.from('PERSONAL-COPY'), 'mine.pdf');
    const pref = await shopper.get(`/api/orders/${orderId}/download/${readyMade.id}`);
    assert.equal((await request(h.app).get(pref.body.url)).body.toString(), 'PERSONAL-COPY');
  });

  test('deliverable file paths never appear in order JSON, and customers cannot sign private paths', async () => {
    const json = JSON.stringify((await shopper.get(`/api/orders/${orderId}`)).body);
    assert.equal(json.includes('private/'), false);
    const row = (await h.ctx.db.get<{ file_path: string }>('SELECT file_path FROM deliverables LIMIT 1'))!;
    assert.equal((await shopper.get(`/api/uploads/sign?path=${encodeURIComponent(row.file_path)}`)).status, 403);
  });

  test('deliverable upload validates the order and product, and a missing file is a 400', async () => {
    assert.equal((await admin.post(`/api/admin/orders/${uid()}/deliverables/${handMade.id}`).attach('file', Buffer.from('x'), 'a.pdf')).status, 404);
    assert.equal((await admin.post(`/api/admin/orders/${orderId}/deliverables/${uid()}`).attach('file', Buffer.from('x'), 'a.pdf')).status, 404);
    assert.equal((await admin.post(`/api/admin/orders/${orderId}/deliverables/${handMade.id}`).field('note', 'no file here')).status, 400);
  });

  test('an order with only ready-made items is never flipped to delivered by a deliverable', async () => {
    const o = await placeOrder(shopper, [cartOf(noFile.id)]);
    await pay(shopper, o.body.orderId);
    await admin.post(`/api/admin/orders/${o.body.orderId}/deliverables/${noFile.id}`).attach('file', Buffer.from('x'), 'x.pdf');
    assert.equal((await shopper.get(`/api/orders/${o.body.orderId}`)).body.status, 'paid');
  });

  test('admin status changes: payment-requiring statuses need verification (409)', async () => {
    const pending = (await placeOrder(shopper, [cartOf(noFile.id)])).body.orderId as string;
    for (const status of ['paid', 'in_progress', 'delivered', 'refunded']) {
      assert.equal((await admin.patch(`/api/admin/orders/${pending}`).send({ status })).status, 409, status);
    }
    assert.equal((await admin.patch(`/api/admin/orders/${pending}`).send({ status: 'cancelled' })).status, 204);
    assert.equal((await admin.patch(`/api/admin/orders/${pending}`).send({ status: 'weird' })).status, 400);
    assert.equal((await admin.patch(`/api/admin/orders/${uid()}`).send({ status: 'cancelled' })).status, 404);
    assert.equal((await admin.patch(`/api/admin/orders/${orderId}`).send({ status: 'in_progress' })).status, 204);
    assert.equal((await admin.patch(`/api/admin/orders/${orderId}`).send({ status: 'pending' })).status, 409, 'a paid order cannot go back to pending');
    // the database itself also refuses an unverified paid order
    await assert.rejects(h.ctx.db.run("UPDATE orders SET status = 'paid' WHERE id = ?", pending), /constraint/i);
  });
});

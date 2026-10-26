import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import request from 'supertest';
import { makeApp, makeProduct, productPayload, signup, uid, adminAgent, type Agent, type Harness } from './helpers.js';

describe('catalog', () => {
  let h: Harness;
  let admin: Agent;
  before(async () => {
    h = await makeApp();
    admin = await adminAgent(h);
  });
  after(() => h.cleanup());

  test('a fresh database is empty (no seeded business data)', async () => {
    assert.deepEqual((await request(h.app).get('/api/products')).body, []);
    assert.deepEqual((await request(h.app).get('/api/categories')).body, []);
    assert.deepEqual((await request(h.app).get('/api/portfolio')).body, []);
    assert.deepEqual((await request(h.app).get('/api/settings')).body, { announcement: '', whatsapp: '', supportEmail: '' });
  });

  test('categories: create with slug id, conflict, update, order, delete guard', async () => {
    const a = await admin.post('/api/admin/categories').send({ id: '', name: 'Wedding Invitations', motif: 'rings', blurb: 'For the big day' });
    assert.equal(a.status, 200);
    assert.deepEqual(a.body, { id: 'wedding-invitations', name: 'Wedding Invitations', motif: 'rings', blurb: 'For the big day' });
    assert.equal((await admin.post('/api/admin/categories').send({ id: '', name: 'Wedding invitations', motif: 'rings', blurb: '' })).status, 409);
    await admin.post('/api/admin/categories').send({ id: '', name: 'Birthday Gifts', motif: 'cake', blurb: '' });
    await admin.post('/api/admin/categories').send({ id: '', name: 'Seasonal', motif: 'floral', blurb: '' });
    assert.deepEqual((await request(h.app).get('/api/categories')).body.map((c: { id: string }) => c.id), ['wedding-invitations', 'birthday-gifts', 'seasonal']);

    const upd = await admin.post('/api/admin/categories').send({ id: 'seasonal', name: 'Seasonal picks', motif: 'lamp', blurb: 'Festive' });
    assert.equal(upd.body.name, 'Seasonal picks');
    assert.equal((await admin.post('/api/admin/categories').send({ id: 'ghost', name: 'Ghost', motif: 'lamp', blurb: '' })).status, 404);
    assert.equal((await admin.post('/api/admin/categories').send({ id: '', name: '   ', motif: 'lamp', blurb: '' })).status, 400);
    assert.equal((await admin.post('/api/admin/categories').send({ id: '', name: 'Bad', motif: 'dragon', blurb: '' })).status, 400);

    const reorder = await admin.put('/api/admin/categories-order').send({ ids: ['seasonal', 'wedding-invitations'] });
    assert.equal(reorder.status, 204);
    assert.deepEqual((await request(h.app).get('/api/categories')).body.map((c: { id: string }) => c.id), ['seasonal', 'wedding-invitations', 'birthday-gifts']);
    assert.equal((await admin.put('/api/admin/categories-order').send({ ids: ['seasonal', 'nope'] })).status, 400);
    assert.equal((await admin.put('/api/admin/categories-order').send({ ids: ['seasonal', 'seasonal'] })).status, 400);

    await makeProduct(admin, { category: 'birthday-gifts' });
    const del = await admin.delete('/api/admin/categories/birthday-gifts');
    assert.equal(del.status, 409);
    assert.equal(del.body.error, '1 product(s) still use this category. Move them first.');
    assert.equal((await admin.delete('/api/admin/categories/seasonal')).status, 204);
    assert.equal((await admin.delete('/api/admin/categories/seasonal')).status, 404);
  });

  test('product upsert returns the full Product shape, create then update keeps createdAt', async () => {
    const created = await makeProduct(admin, { slug: 'blush-invite', originalPriceInr: 799, tags: ['a', 'b'], videoUrl: 'https://cdn.example/v.mp4' });
    assert.equal(created['slug'], 'blush-invite');
    assert.equal(created['priceInr'], 499);
    assert.equal(created['originalPriceInr'], 799);
    assert.deepEqual(created['tags'], ['a', 'b']);
    assert.deepEqual(created['palette'], ['#F2DDE1', '#C78391']);
    assert.deepEqual(created['gallery'], [{ url: '/media/abc.png', alt: 'cover', kind: 'image' }]);
    assert.deepEqual(created['faq'], [{ q: 'Can I edit it?', a: 'Yes.' }]);
    assert.equal(created['videoUrl'], 'https://cdn.example/v.mp4');
    assert.equal(created['category'], 'invitations');
    assert.match(String(created['createdAt']), /^\d{4}-\d\d-\d\dT.*Z$/);
    assert.equal(created['customizable'], false);

    const id = created['id'] as string;
    const upd = await admin.put(`/api/admin/products/${id}`).send(productPayload({ slug: 'blush-invite', title: 'Renamed', priceInr: 399, tags: ['c'], gallery: [] }));
    assert.equal(upd.status, 200);
    assert.equal(upd.body.title, 'Renamed');
    assert.equal(upd.body.originalPriceInr, undefined, 'cleared when not sent');
    assert.deepEqual(upd.body.tags, ['c']);
    assert.deepEqual(upd.body.gallery, []);
    assert.equal(upd.body.createdAt, created['createdAt']);
    assert.equal((await request(h.app).get('/api/products')).body.filter((p: { id: string }) => p.id === id).length, 1);
  });

  test('product validation: price, original price rule, slug conflict, category, urls, id', async () => {
    const id = uid();
    const put = (body: Record<string, unknown>, pid: string = id) => admin.put(`/api/admin/products/${pid}`).send(body);
    assert.equal((await put(productPayload({ slug: 'v1', priceInr: 0 }))).status, 400);
    assert.equal((await put(productPayload({ slug: 'v1', priceInr: 10.5 }))).status, 400);
    assert.equal((await put(productPayload({ slug: 'v1', title: '   ' }))).status, 400);
    const orig = await put(productPayload({ slug: 'v1', priceInr: 500, originalPriceInr: 500 }));
    assert.equal(orig.status, 400);
    assert.match(orig.body.error, /original price/i);
    assert.equal((await put(productPayload({ slug: 'v1', priceInr: 500, originalPriceInr: 400 }))).status, 400);
    assert.equal((await put(productPayload({ slug: 'v1', category: 'no-such-category' }))).status, 400);
    assert.equal((await put(productPayload({ slug: 'Bad Slug!' }))).status, 400);
    assert.equal((await put(productPayload({ slug: 'v1', gallery: [{ url: 'javascript:alert(1)', alt: '', kind: 'image' }] }))).status, 400);
    assert.equal((await put(productPayload({ slug: 'v1', isHacked: true }))).status, 400, 'unknown fields rejected');
    assert.equal((await put(productPayload({ slug: 'v1' }), 'not-a-uuid')).status, 400);
    assert.equal((await put(productPayload({ slug: 'v1', id: uid() }))).status, 400, 'body id must match URL');

    await put(productPayload({ slug: 'taken-slug' }));
    const clash = await put(productPayload({ slug: 'taken-slug' }), uid());
    assert.equal(clash.status, 409);
    assert.match(clash.body.error, /slug/);
  });

  test('empty slug is generated from the title; drafts and archived are hidden from the public list', async () => {
    const draft = await makeProduct(admin, { slug: '', title: 'Secret Draft Design', status: 'draft' });
    assert.equal(draft['slug'], 'secret-draft-design');
    const archived = await makeProduct(admin, { status: 'archived' });
    const publicIds = (await request(h.app).get('/api/products')).body.map((p: { id: string }) => p.id);
    assert.equal(publicIds.includes(draft['id'] as string), false);
    assert.equal(publicIds.includes(archived['id'] as string), false);
    const customerAgent = await signup(h.app, 'shopper@example.com');
    const asCustomer = (await customerAgent.get('/api/products?all=1')).body.map((p: { id: string }) => p.id);
    assert.equal(asCustomer.includes(draft['id'] as string), false, '?all=1 only works for admins');
    const asAdmin = (await admin.get('/api/products?all=1')).body.map((p: { id: string }) => p.id);
    assert.ok(asAdmin.includes(draft['id'] as string) && asAdmin.includes(archived['id'] as string));
  });

  test('product file: must be an uploaded private file; never exposed in the product JSON', async () => {
    const p = await makeProduct(admin);
    const up = await admin.post('/api/uploads?kind=file').attach('file', Buffer.from('zipdata'), 'My Template.zip');
    assert.equal(up.status, 200);
    assert.match(up.body.path, /^private\/[0-9a-f]{32}-My-Template\.zip$/);
    assert.equal((await admin.put(`/api/admin/products/${p['id']}/file`).send({ path: up.body.path })).status, 204);
    assert.equal((await admin.put(`/api/admin/products/${p['id']}/file`).send({ path: 'private/doesnotexist.zip' })).status, 400);
    assert.equal((await admin.put(`/api/admin/products/${p['id']}/file`).send({ path: '../../etc/passwd' })).status, 400);
    assert.equal((await admin.put(`/api/admin/products/${uid()}/file`).send({ path: up.body.path })).status, 404);
    const pub = JSON.stringify((await request(h.app).get('/api/products')).body);
    assert.equal(pub.includes(up.body.path), false);
  });

  test('portfolio CRUD, ordering and visibility', async () => {
    const a = uid();
    const b = uid();
    const body = (o: Record<string, unknown>) => ({ title: 'Project', category: 'Memory books', story: 'A story', palette: ['#111111', '#222222'], motif: 'book', aspect: 1.4, beforeAfter: false, published: true, sortOrder: 5, isDemo: false, ...o });
    assert.equal((await admin.put(`/api/admin/portfolio/${a}`).send(body({ title: 'Second', sortOrder: 2 }))).status, 200);
    assert.equal((await admin.put(`/api/admin/portfolio/${b}`).send(body({ title: 'First', sortOrder: 1, image: '/media/x.png' }))).status, 200);
    const hidden = uid();
    await admin.put(`/api/admin/portfolio/${hidden}`).send(body({ title: 'Hidden', published: false, sortOrder: 0 }));
    const pub = (await request(h.app).get('/api/portfolio')).body;
    assert.deepEqual(pub.map((p: { title: string }) => p.title), ['First', 'Second']);
    assert.equal(pub[0].image, '/media/x.png');
    assert.deepEqual(pub[0].palette, ['#111111', '#222222']);
    assert.equal((await admin.get('/api/portfolio?all=1')).body.length, 3);
    assert.equal((await request(h.app).get('/api/portfolio?all=1')).body.length, 2);
    assert.equal((await admin.put(`/api/admin/portfolio/${a}`).send(body({ title: '', sortOrder: 2 }))).status, 400);
    assert.equal((await admin.put(`/api/admin/portfolio/${a}`).send(body({ image: 'data:text/html,x' }))).status, 400);
    assert.equal((await admin.delete(`/api/admin/portfolio/${a}`)).status, 204);
    assert.equal((await admin.delete(`/api/admin/portfolio/${a}`)).status, 404);
  });

  test('settings: public read, admin write with validation, and no secrets leak', async () => {
    const hours = { mon: { open: '10:00', close: '18:00' }, tue: null, wed: null, thu: null, fri: null, sat: null, sun: { open: '10:00', close: '12:00' } };
    const ok = await admin.put('/api/admin/settings').send({ announcement: 'Sale!', whatsapp: '+91 98765 43210', supportEmail: 'help@shop.test', hours, business: { legalName: 'A2 Craft Studio', supportEmail: 'help@shop.test' }, faq: [{ label: 'Orders', items: [{ q: 'Q?', a: 'A.' }] }] });
    assert.equal(ok.status, 200);
    const pub = (await request(h.app).get('/api/settings')).body;
    assert.equal(pub.announcement, 'Sale!');
    assert.deepEqual(pub.hours, hours);
    assert.equal(pub.business.legalName, 'A2 Craft Studio');
    const badHours = await admin.put('/api/admin/settings').send({ announcement: '', whatsapp: '', supportEmail: '', hours: { ...hours, mon: { open: '18:00', close: '10:00' } } });
    assert.equal(badHours.status, 400);
    assert.match(badHours.body.error, /after/);
    assert.equal((await admin.put('/api/admin/settings').send({ announcement: '', whatsapp: '', supportEmail: 'nope' })).status, 400);
    assert.equal((await admin.put('/api/admin/settings').send({ announcement: '', whatsapp: '', supportEmail: '', hours: { ...hours, mon: { open: '25:00', close: '26:00' } } })).status, 400);
  });
});

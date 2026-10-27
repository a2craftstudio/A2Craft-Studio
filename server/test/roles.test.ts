import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { adminAgent, makeApp, signup, uid, type Agent, type Harness } from './helpers.js';

describe('role management (super admin only)', () => {
  let h: Harness;
  let boss: Agent;
  let staff: Agent;
  let shopper: Agent;
  let shopperId: string;
  let staffId: string;
  let bossId: string;

  const idOf = async (a: Agent, email: string) => ((await a.get('/api/admin/customers')).body as { id: string; email: string }[]).find((c) => c.email === email)!.id;

  before(async () => {
    h = await makeApp({ admin: { email: 'boss@shop.test', password: '', name: 'Boss' } });
    boss = await adminAgent(h, 'boss@shop.test');
    staff = await adminAgent(h, 'staff@shop.test');
    shopper = await signup(h.app, 'shopper@example.com', 'Shopper');
    shopperId = await idOf(boss, 'shopper@example.com');
    staffId = await idOf(boss, 'staff@shop.test');
    bossId = await idOf(boss, 'boss@shop.test');
  });
  after(() => h.cleanup());

  test('the session says who the super admin is', async () => {
    assert.equal((await boss.get('/api/auth/me')).body.user.superAdmin, true);
    assert.equal((await staff.get('/api/auth/me')).body.user.superAdmin, false);
  });

  test('the super admin can promote and demote', async () => {
    assert.equal((await boss.put(`/api/admin/users/${shopperId}/role`).send({ role: 'admin' })).status, 200);
    assert.equal((await shopper.get('/api/admin/customers')).status, 200, 'promotion takes effect immediately');
    assert.equal((await boss.put(`/api/admin/users/${shopperId}/role`).send({ role: 'customer' })).status, 200);
    assert.equal((await shopper.get('/api/admin/customers')).status, 403);
  });

  test('other admins and customers cannot change roles', async () => {
    assert.equal((await staff.put(`/api/admin/users/${shopperId}/role`).send({ role: 'admin' })).status, 403);
    assert.equal((await shopper.put(`/api/admin/users/${staffId}/role`).send({ role: 'customer' })).status, 403);
  });

  test('the super admin role itself is protected and bad input is rejected', async () => {
    assert.equal((await boss.put(`/api/admin/users/${bossId}/role`).send({ role: 'customer' })).status, 409);
    assert.equal((await boss.put(`/api/admin/users/${uid()}/role`).send({ role: 'admin' })).status, 404);
    assert.equal((await boss.put(`/api/admin/users/${shopperId}/role`).send({ role: 'owner' })).status, 400);
  });
});

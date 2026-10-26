import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { createUser } from '../src/auth.js';
import { loadConfig, type Config } from '../src/config.js';
import { migrate, openPglite, type Db } from '../src/db.js';
import type { Mailer, MailMessage } from '../src/services/mail.js';

export type Agent = ReturnType<typeof request.agent>;

export interface Harness {
  app: Express;
  ctx: Express['ctx'];
  outbox: MailMessage[];
  uploadDir: string;
  cleanup(): Promise<void>;
}

export const SECRETS = { keyId: 'rzp_test_KEY', keySecret: 'rzp_secret_for_tests', webhook: 'whsec_for_tests' };

export function testConfig(over: Partial<Config> = {}): Config {
  const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a2-test-'));
  const base = loadConfig(
    { NODE_ENV: 'test', JWT_SECRET: 'test-secret-test-secret-test-secret-1234', PGLITE_DIR: 'memory://', UPLOAD_DIR: uploadDir, SITE_ORIGIN: 'https://shop.test', OWNER_EMAIL: 'owner@shop.test' },
    () => undefined,
  );
  return { ...base, bcryptCost: 4, rateLimit: false, clientDist: null, ...over };
}

export const withRazorpay = (): Partial<Config> => ({ razorpay: { keyId: SECRETS.keyId, keySecret: SECRETS.keySecret, webhookSecret: SECRETS.webhook } });

let template: Promise<Blob> | undefined;
/** Migrates one PGlite instance per process and serializes it; every test database is a cheap clone of that. */
async function migratedTemplate(): Promise<Blob> {
  template ??= (async () => {
    const db = await openPglite('memory://');
    await migrate(db);
    const blob = await db.snapshot();
    await db.close();
    return blob;
  })();
  return template;
}
/** A fresh, migrated, empty in-memory PostgreSQL (PGlite). */
export async function openTestDb(): Promise<Db> {
  return openPglite('memory://', { loadDataDir: await migratedTemplate() });
}

/** Builds the app on a fresh PGlite clone, or on `opts.db` (an already migrated database, e.g. the pg driver). */
export async function makeApp(over: Partial<Config> = {}, opts: { db?: Db } = {}): Promise<Harness> {
  const config = testConfig(over);
  const db = opts.db ?? (await openTestDb());
  const outbox: MailMessage[] = [];
  const mail: Mailer = {
    async send(m) {
      outbox.push(m);
    },
    queue(m) {
      outbox.push(m);
    },
    async idle() {},
  };
  const app = createApp(config, { mail, db });
  return {
    app,
    ctx: app.ctx,
    outbox,
    uploadDir: config.uploadDir,
    async cleanup() {
      try {
        await app.ctx.db.close();
      } catch {
        /* closed */
      }
      fs.rmSync(config.uploadDir, { recursive: true, force: true });
    },
  };
}

export const PASSWORD = 'correct-horse-9';

/** Signs a new customer up and returns an agent that keeps the session cookie. */
export async function signup(app: Express, emailAddr = 'asha@example.com', name = 'Asha Rao'): Promise<Agent> {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/signup').send({ name, email: emailAddr, password: PASSWORD });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return agent;
}

export async function adminAgent(h: Harness, emailAddr = 'boss@shop.test'): Promise<Agent> {
  await createUser(h.ctx, { email: emailAddr, name: 'Studio Boss', password: PASSWORD, role: 'admin' });
  const agent = request.agent(h.app);
  const res = await agent.post('/api/auth/login').send({ email: emailAddr, password: PASSWORD });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return agent;
}

export const uid = () => crypto.randomUUID();

export function productPayload(over: Record<string, unknown> = {}) {
  return {
    slug: '',
    title: 'Blush wedding invitation',
    tagline: 'Soft florals',
    description: 'A printable invitation.',
    priceInr: 499,
    category: 'invitations',
    tags: ['wedding', 'floral'],
    occasion: 'Wedding',
    style: 'Floral',
    formats: ['PDF', 'PNG'],
    delivery: 'Instant',
    customizable: false,
    customizationKind: 'none',
    aspect: 1.4,
    palette: ['#F2DDE1', '#C78391'],
    motif: 'floral',
    gallery: [{ url: '/media/abc.png', alt: 'cover', kind: 'image' }],
    license: 'Personal use',
    faq: [{ q: 'Can I edit it?', a: 'Yes.' }],
    status: 'published',
    featured: false,
    trending: false,
    bestseller: false,
    isDemo: false,
    ...over,
  };
}

/** Creates the default category (once) and a product through the admin API. */
export async function makeProduct(admin: Agent, over: Record<string, unknown> = {}): Promise<{ id: string; [k: string]: unknown }> {
  await admin.post('/api/admin/categories').send({ id: '', name: 'Invitations', motif: 'card', blurb: 'Cards' });
  const id = uid();
  const res = await admin.put(`/api/admin/products/${id}`).send(productPayload({ slug: `p-${id.slice(0, 8)}`, ...over }));
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body;
}

export async function addCoupon(admin: Agent, code: string, body: Record<string, unknown>) {
  const res = await admin.put(`/api/admin/coupons/${code}`).send({ minSubtotal: 0, active: true, ...body });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body;
}

export const customer = { name: 'Asha Rao', email: 'asha@example.com', phone: '+91 98765 43210' };
export const cartOf = (productId: string, qty = 1, extra: Record<string, unknown> = {}) => ({ key: `k-${productId.slice(0, 4)}`, productId, qty, ...extra });

export async function placeOrder(agent: Agent, items: unknown[], coupon?: string) {
  return agent.post('/api/orders').send({ items, ...(coupon ? { coupon } : {}), customer, acceptedTerms: true });
}

// ---------------------------------------------------------------- fetch mocking
export interface FetchCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}
export type FetchHandler = (call: FetchCall) => { status?: number; json?: unknown } | undefined;

/** Replaces global fetch (used for Razorpay and Resend). Returns the recorded calls and a restore function. */
export function mockFetch(handler: FetchHandler) {
  const real = globalThis.fetch;
  const calls: FetchCall[] = [];
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
    const headers = Object.fromEntries(Object.entries((init?.headers as Record<string, string>) ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
    let body: unknown = init?.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        /* keep string */
      }
    }
    const call: FetchCall = { url, method: init?.method ?? 'GET', headers, body };
    calls.push(call);
    const out = handler(call) ?? { status: 404, json: { error: 'unmocked' } };
    return new Response(JSON.stringify(out.json ?? {}), { status: out.status ?? 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return { calls, restore: () => void (globalThis.fetch = real) };
}

/** A fake Razorpay: creates orders, and returns whatever payment you registered. */
export function fakeRazorpay() {
  const payments = new Map<string, Record<string, unknown>>();
  let n = 0;
  const m = mockFetch((c) => {
    if (c.url === 'https://api.razorpay.com/v1/orders' && c.method === 'POST') {
      n += 1;
      return { json: { id: `order_TEST${n}`, amount: (c.body as { amount: number }).amount } };
    }
    const pm = /^https:\/\/api\.razorpay\.com\/v1\/payments\/([A-Za-z0-9_]+)$/.exec(c.url);
    if (pm) {
      const p = payments.get(pm[1]!);
      return p ? { json: p } : { status: 404, json: { error: { description: 'not found' } } };
    }
    if (c.url === 'https://api.resend.com/emails') return { json: { id: 'email_1' } };
    return undefined;
  });
  return { ...m, payments };
}

export const rzSignature = (orderId: string, paymentId: string, secret = SECRETS.keySecret) => crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
export const webhookSig = (raw: string, secret = SECRETS.webhook) => crypto.createHmac('sha256', secret).update(raw).digest('hex');

/** 12+ byte PNG header followed by filler, enough for magic-byte sniffing. */
export const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);
export const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 2)]);
export const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypisom'), Buffer.alloc(64, 3)]);

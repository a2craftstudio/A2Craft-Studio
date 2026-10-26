import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { parseDatabaseConfig, type PostgresConfig } from '../src/config.js';
import { isUniqueError, migrate, openPglite, openPostgres, toPgPlaceholders, type Db } from '../src/db.js';
import { HttpError } from '../src/errors.js';
import { markOrderPaid } from '../src/services/orders.js';
import request from 'supertest';
import { newestFirstOrder, listTables, showTable } from '../src/cli/db-info.js';
import { adminAgent, addCoupon, cartOf, makeApp, makeProduct, placeOrder, signup, uid } from './helpers.js';

// ---------------------------------------------------------------- ? -> $n
describe('placeholder conversion (? to $n)', () => {
  const conv = (sql: string) => toPgPlaceholders(sql);

  test('numbers placeholders in order and counts them', () => {
    assert.deepEqual(conv('SELECT * FROM t WHERE a = ? AND b IN (?, ?)'), { text: 'SELECT * FROM t WHERE a = $1 AND b IN ($2, $3)', count: 3 });
    assert.deepEqual(conv('SELECT 1'), { text: 'SELECT 1', count: 0 });
  });

  test('leaves ? inside single-quoted strings alone (also with doubled quotes)', () => {
    assert.deepEqual(conv("SELECT '?' AS q, ? AS p, 'it''s ?' AS r, ?"), { text: "SELECT '?' AS q, $1 AS p, 'it''s ?' AS r, $2", count: 2 });
  });

  test('leaves ? inside double-quoted identifiers, comments and dollar-quoted bodies alone', () => {
    assert.equal(conv('SELECT "wh?y" FROM t WHERE a = ?').text, 'SELECT "wh?y" FROM t WHERE a = $1');
    assert.equal(conv('SELECT ? -- really?\n, ?').text, 'SELECT $1 -- really?\n, $2');
    assert.equal(conv('SELECT ? /* a ? /* nested ? */ still ? */ , ?').text, 'SELECT $1 /* a ? /* nested ? */ still ? */ , $2');
    assert.equal(conv("DO $$ BEGIN RAISE NOTICE 'a?'; END $$; SELECT ?").text, "DO $$ BEGIN RAISE NOTICE 'a?'; END $$; SELECT $1");
    assert.equal(conv('SELECT $tag$ ? $tag$, ?').text, 'SELECT $tag$ ? $tag$, $1');
  });

  test('E-strings honour backslash escapes; plain strings do not', () => {
    assert.equal(conv("SELECT E'it\\'s ?', ?").text, "SELECT E'it\\'s ?', $1");
    assert.equal(conv("SELECT 'a\\', ?").text, "SELECT 'a\\', $1");
  });

  test('a parameter count mismatch is rejected before anything is sent', async () => {
    const db = await openPglite('memory://');
    try {
      await assert.rejects(db.get('SELECT ?::int AS a', 1, 2), /expects 1 parameter/);
      await assert.rejects(db.get('SELECT ?::int AS a'), /expects 1 parameter/);
      assert.equal((await db.get<{ q: string; a: number }>("SELECT '?' AS q, ?::int AS a", 7))!.a, 7);
    } finally {
      await db.close();
    }
  });
});

// ---------------------------------------------------------------- engines
interface Engine {
  name: string;
  /** A database with nothing in it (no tables). */
  open(): Promise<Db>;
  /** True when roles like anon/authenticated may be created freely (never on someone's real database). */
  disposable: boolean;
  stop(): Promise<void>;
}

/**
 * The real `pg` driver talking to PGlite over its PostgreSQL wire-protocol socket: exercises Pool, BEGIN/COMMIT, type
 * parsers and error codes. PGlite is ONE session, so its socket multiplexer cannot give real concurrent connections
 * (interleaved statements from several connections get mixed up): the pool is limited to 1 here. Genuine row-lock races
 * are only exercised by the optional TEST_DATABASE_URL engine below.
 */
async function socketEngine(): Promise<Engine> {
  const lite = await PGlite.create('memory://');
  const server = new PGLiteSocketServer({ db: lite, port: 0, host: '127.0.0.1', maxConnections: 20 });
  await server.start();
  const [host, port] = server.getServerConn().split(':');
  const cfg = parseDatabaseConfig({ DATABASE_URL: `postgresql://postgres:postgres@${host}:${port}/postgres`, DATABASE_POOL_MAX: '1' }, 'test') as PostgresConfig;
  const open: Db[] = [];
  return {
    name: 'postgres driver (pg Pool over the wire protocol)',
    disposable: true,
    async open() {
      for (const prev of open) await prev.close().catch(() => undefined); // keep the number of connections small
      const db = await openPostgres(cfg);
      await db.exec('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
      open.push(db);
      return db;
    },
    async stop() {
      for (const db of open) await db.close().catch(() => undefined);
      await server.stop();
      await lite.close();
    },
  };
}

/** Optional: a REAL PostgreSQL, e.g. TEST_DATABASE_URL=postgresql://postgres:pw@localhost:5432/a2_test. The `public` schema is wiped, so the database name must contain "test". */
async function realEngine(url: string): Promise<Engine | null> {
  const cfg = parseDatabaseConfig({ DATABASE_URL: url }, 'test') as PostgresConfig;
  if (!/test/i.test(cfg.database)) {
    console.warn('TEST_DATABASE_URL ignored: the database name must contain "test" because the public schema is dropped.');
    return null;
  }
  const open: Db[] = [];
  return {
    name: `real PostgreSQL (${cfg.label})`,
    disposable: false,
    async open() {
      for (const prev of open) await prev.close().catch(() => undefined); // keep the number of connections small
      const db = await openPostgres(cfg);
      await db.exec('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
      open.push(db);
      return db;
    },
    async stop() {
      for (const db of open) await db.close().catch(() => undefined);
    },
  };
}

const pgliteEngine = (): Engine => {
  const open: Db[] = [];
  return {
    name: 'pglite (embedded)',
    disposable: true,
    async open() {
      const db = await openPglite('memory://');
      open.push(db);
      return db;
    },
    async stop() {
      for (const db of open) await db.close().catch(() => undefined);
    },
  };
};

const engines: { name: string; make: () => Promise<Engine | null> }[] = [
  { name: 'pglite (embedded)', make: async () => pgliteEngine() },
  { name: 'postgres driver (pg Pool over the wire protocol)', make: socketEngine },
  ...(process.env['TEST_DATABASE_URL'] ? [{ name: 'real PostgreSQL', make: () => realEngine(process.env['TEST_DATABASE_URL']!) }] : []),
];

for (const e of engines) {
  describe(`database on ${e.name}`, () => {
    let engine: Engine | null;
    before(async () => void (engine = await e.make()));
    after(async () => engine?.stop());
    const open = async (): Promise<Db> => engine!.open();
    const skip = () => engine === null;

    test('migrations are tracked and idempotent; foreign keys, checks and lowercase-unique emails are enforced', async (t) => {
      if (skip()) return t.skip();
      const db = await open();
      assert.deepEqual(await migrate(db), ['001_init']);
      assert.deepEqual(await migrate(db), [], 'running again applies nothing');
      assert.equal((await db.get<{ version: string }>('SELECT version FROM schema_migrations'))!.version, '001_init');
      await assert.rejects(db.run("INSERT INTO products (id, slug, title, price_inr, category_id, created_at) VALUES ('p','s','t',1,'missing','now')"), /foreign key/i);
      await assert.rejects(db.run("INSERT INTO users (id, email, name, role, password_hash, created_at) VALUES ('u','X@Y.co','n','customer','h','now')"), /constraint/i, 'emails must be lowercase');
      await db.run("INSERT INTO users (id, email, name, role, password_hash, created_at) VALUES ('u1','x@y.co','n','customer','h','now')");
      await assert.rejects(db.run("INSERT INTO users (id, email, name, role, password_hash, created_at) VALUES ('u2','x@y.co','n','customer','h','now')"), (err: unknown) => isUniqueError(err));
      assert.equal(db.driver, e.name.startsWith('pglite') ? 'pglite' : 'postgres');
      assert.ok(db.label.length > 0);
    });

    test('the unique lower(email) index exists (case-insensitive uniqueness even without the CHECK)', async (t) => {
      if (skip()) return t.skip();
      const db = await open();
      await migrate(db);
      const idx = await db.get<{ indexdef: string }>("SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'users_email_lower_idx'");
      assert.match(idx!.indexdef, /UNIQUE.*lower\(email\)/i);
    });

    test('a failing migration rolls back completely; earlier ones stay applied', async (t) => {
      if (skip()) return t.skip();
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'a2-mig-'));
      try {
        fs.writeFileSync(path.join(dir, '001_a.sql'), 'CREATE TABLE a (x INTEGER);');
        fs.writeFileSync(path.join(dir, '002_bad.sql'), 'CREATE TABLE b (x INTEGER); INSERT INTO nope VALUES (1);');
        const db = await open();
        await assert.rejects(migrate(db, dir));
        assert.equal(await db.get("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = ?", 'b'), undefined, 'table b must not exist');
        assert.equal((await db.get("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = ?", 'a'))?.['tablename'], 'a', 'the earlier migration stays applied');
        assert.deepEqual((await db.all('SELECT version FROM schema_migrations')).map((r) => r['version']), ['001_a']);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });

    test('two instances migrating at the same time apply each migration exactly once (advisory lock)', async (t) => {
      if (skip()) return t.skip();
      const db = await open();
      const results = await Promise.all([migrate(db), migrate(db), migrate(db)]);
      assert.deepEqual(results.flat(), ['001_init'], 'exactly one runner applied it');
      assert.equal((await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM schema_migrations'))!.n, 1);
    });

    test('a new database is empty: no seeded business data', async (t) => {
      if (skip()) return t.skip();
      const db = await open();
      await migrate(db);
      for (const tbl of ['users', 'products', 'categories', 'orders', 'coupons', 'reviews', 'inquiries', 'portfolio_projects']) {
        assert.equal((await db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${tbl}`))!.n, 0, tbl);
      }
    });

    test('SECURITY: Row Level Security is enabled on EVERY table in public (incl. schema_migrations)', async (t) => {
      if (skip()) return t.skip();
      const db = await open();
      await migrate(db);
      const tables = await db.all<{ relname: string; relrowsecurity: boolean }>(
        "SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') ORDER BY c.relname",
      );
      assert.ok(tables.length >= 20, `found ${tables.length} tables`);
      assert.ok(tables.some((x) => x.relname === 'schema_migrations'));
      assert.deepEqual(tables.filter((x) => !x.relrowsecurity).map((x) => x.relname), [], 'tables without RLS');
      const policies = await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM pg_policies WHERE schemaname = 'public'");
      assert.equal(policies!.n, 0, 'no policies: anon/authenticated get nothing');
    });

    test('SECURITY: anon/authenticated lose all privileges now and for future tables, and RLS hides rows even if granted', async (t) => {
      if (skip() || !engine!.disposable) return t.skip();
      const db = await open();
      // What Supabase does by default: API roles may use public and automatically get access to every new object.
      await db.exec(`
        CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
        GRANT USAGE ON SCHEMA public TO anon, authenticated;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;
      `);
      await migrate(db);
      const tables = (await db.all<{ tablename: string }>("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")).map((x) => x.tablename);
      for (const role of ['anon', 'authenticated']) {
        for (const tbl of tables) {
          for (const priv of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
            assert.equal((await db.get<{ ok: boolean }>(`SELECT has_table_privilege('${role}', 'public.${tbl}', '${priv}') AS ok`))!.ok, false, `${role} ${priv} ${tbl}`);
          }
        }
        assert.equal((await db.get<{ ok: boolean }>(`SELECT has_sequence_privilege('${role}', 'public.order_items_id_seq', 'USAGE') AS ok`))!.ok, false);
      }
      await db.exec('CREATE TABLE public.future_table (x int)'); // created AFTER the migration, as a later migration would
      assert.equal((await db.get<{ ok: boolean }>("SELECT has_table_privilege('anon', 'public.future_table', 'SELECT') AS ok"))!.ok, false, 'default privileges were revoked');

      // Real access attempt as the API role.
      await assert.rejects(
        db.tx(async () => {
          await db.exec('SET LOCAL ROLE anon');
          await db.get('SELECT * FROM users');
        }),
        /permission denied/,
      );
      // Defence in depth: even with a grant, RLS without policies returns no rows.
      await db.run("INSERT INTO users (id, email, name, role, password_hash, created_at) VALUES ('u1','a@b.co','A','customer','h','now')");
      await db.exec('GRANT SELECT ON users TO anon');
      const visible = await db.tx(async () => {
        await db.exec('SET LOCAL ROLE anon');
        return (await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM users'))!.n;
      });
      assert.equal(visible, 0);
      assert.equal((await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM users'))!.n, 1, 'the privileged server role still sees everything');
    });

    test('bigint, count and sum come back as JS numbers; ids and money are numbers', async (t) => {
      if (skip()) return t.skip();
      const db = await open();
      await migrate(db);
      await db.run("INSERT INTO categories (id, name) VALUES ('c', 'C')");
      const row = await db.get<{ n: unknown; s: unknown; one: unknown }>('SELECT COUNT(*) AS n, COALESCE(SUM(sort), 0) AS s, 1::bigint AS one FROM categories');
      assert.deepEqual(row, { n: 1, s: 0, one: 1 });
      assert.equal(typeof row!.n, 'number');
    });

    test('tx commits on success and rolls everything back when fn throws', async (t) => {
      if (skip()) return t.skip();
      const db = await open();
      await migrate(db);
      await db.tx(async () => {
        await db.run("INSERT INTO categories (id, name) VALUES ('kept', 'Kept')");
      });
      await assert.rejects(
        db.tx(async () => {
          await db.run("INSERT INTO categories (id, name) VALUES ('gone', 'Gone')");
          assert.equal((await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM categories'))!.n, 2, 'visible inside the transaction');
          throw new Error('boom');
        }),
        /boom/,
      );
      assert.deepEqual((await db.all('SELECT id FROM categories ORDER BY id')).map((r) => r['id']), ['kept']);
      // a database error (not just a thrown Error) also rolls back
      await assert.rejects(
        db.tx(async () => {
          await db.run("INSERT INTO categories (id, name) VALUES ('gone2', 'Gone')");
          await db.run("INSERT INTO categories (id, name) VALUES ('kept', 'Duplicate')");
        }),
        (err: unknown) => isUniqueError(err),
      );
      assert.deepEqual((await db.all('SELECT id FROM categories ORDER BY id')).map((r) => r['id']), ['kept']);
      // and the connection is healthy afterwards
      await db.run("INSERT INTO categories (id, name) VALUES ('after', 'After')");
    });

    test('nested tx joins the outer transaction: an outer failure undoes the inner work too', async (t) => {
      if (skip()) return t.skip();
      const db = await open();
      await migrate(db);
      await assert.rejects(
        db.tx(async () => {
          await db.tx(async () => {
            await db.run("INSERT INTO categories (id, name) VALUES ('inner', 'Inner')");
          });
          assert.equal((await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM categories'))!.n, 1);
          throw new Error('outer fails');
        }),
        /outer fails/,
      );
      assert.equal((await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM categories'))!.n, 0);
      const out = await db.tx(() => db.tx(() => db.tx(async () => 42)));
      assert.equal(out, 42);
    });

    test('every query inside tx runs on ONE connection, different transactions use their own', async (t) => {
      if (skip()) return t.skip();
      const db = await open();
      const pid = async () => (await db.get<{ p: number }>('SELECT pg_backend_pid() AS p'))!.p;
      const seen = await db.tx(async () => [await pid(), await pid(), await db.tx(pid), (await db.get<{ p: number }>('SELECT pg_backend_pid() AS p'))!.p]);
      assert.equal(new Set(seen).size, 1, 'same backend for the whole transaction');
      // a transaction left open by a failed query does not poison the next one
      await assert.rejects(db.tx(async () => void (await db.get('SELECT * FROM does_not_exist'))));
      assert.equal((await db.get<{ ok: number }>('SELECT 1 AS ok'))!.ok, 1);
    });

    test('concurrent transactions with SELECT ... FOR UPDATE never lose an update', async (t) => {
      if (skip()) return t.skip();
      const db = await open();
      await migrate(db);
      await db.run("INSERT INTO coupons (code, percent, used_count) VALUES ('C1', 10, 0)");
      await Promise.all(
        Array.from({ length: 12 }, () =>
          db.tx(async () => {
            const c = (await db.get<{ used_count: number }>('SELECT used_count FROM coupons WHERE code = ? FOR UPDATE', 'C1'))!;
            await new Promise((r) => setTimeout(r, 5));
            await db.run('UPDATE coupons SET used_count = ? WHERE code = ?', c.used_count + 1, 'C1');
          }),
        ),
      );
      assert.equal((await db.get<{ used_count: number }>("SELECT used_count FROM coupons WHERE code = 'C1'"))!.used_count, 12);
    });

    test('the atomic coupon guard never exceeds max_uses, however many run at once', async (t) => {
      if (skip()) return t.skip();
      const db = await open();
      await migrate(db);
      await db.run("INSERT INTO coupons (code, percent, max_uses, used_count) VALUES ('ONE', 10, 3, 0)");
      const results = await Promise.all(
        Array.from({ length: 10 }, () => db.run('UPDATE coupons SET used_count = used_count + 1 WHERE code = ? AND (max_uses IS NULL OR used_count < max_uses)', 'ONE')),
      );
      assert.equal(results.filter((r) => r.changes === 1).length, 3);
      assert.equal((await db.get<{ used_count: number }>("SELECT used_count FROM coupons WHERE code = 'ONE'"))!.used_count, 3);
    });

    test('payments.provider_payment_id is unique: a second insert is a unique violation, NULLs are allowed many times', async (t) => {
      if (skip()) return t.skip();
      const db = await open();
      await migrate(db);
      await db.run("INSERT INTO users (id, email, name, role, password_hash, created_at) VALUES ('u','a@b.co','A','customer','h','now')");
      await db.run("INSERT INTO orders (id, user_id, email, subtotal, total, created_at) VALUES ('o1','u','a@b.co',100,100,'now')");
      const ins = (pid: string | null) =>
        db.run("INSERT INTO payments (order_id, provider, provider_payment_id, status, amount_paise, created_at) VALUES ('o1', 'simulator', ?, 'captured', 10000, 'now')", pid);
      await ins(null);
      await ins(null);
      await ins('pay_1');
      await assert.rejects(ins('pay_1'), (err: unknown) => isUniqueError(err));
      assert.equal((await db.run("INSERT INTO payments (order_id, provider, provider_payment_id, status, amount_paise, created_at) VALUES ('o1', 'simulator', 'pay_1', 'captured', 1, 'now') ON CONFLICT (provider_payment_id) DO NOTHING")).changes, 0);
    });

    test('markOrderPaid is idempotent under concurrency; a payment id cannot pay a second order', async (t) => {
      if (skip()) return t.skip();
      const db = await open();
      await migrate(db);
      const h = await makeApp({ paymentSimulator: true }, { db });
      try {
        const admin = await adminAgent(h);
        const shopper = await signup(h.app);
        const card = await makeProduct(admin, { priceInr: 500 });
        await addCoupon(admin, 'TEN', { percent: 10 });
        const o1 = (await placeOrder(shopper, [cartOf(card.id)], 'TEN')).body as { orderId: string; amountPaise: number };
        const o2 = (await placeOrder(shopper, [cartOf(card.id)], 'TEN')).body as { orderId: string; amountPaise: number };
        const paid = (orderId: string, paymentId: string, amountPaise: number) =>
          markOrderPaid(h.ctx.db, { orderId, provider: 'razorpay', providerPaymentId: paymentId, providerOrderId: 'order_X', amountPaise, raw: { n: 1 } });

        const first = await Promise.all(Array.from({ length: 8 }, () => paid(o1.orderId, 'pay_ONE', o1.amountPaise)));
        assert.equal(first.filter(Boolean).length, 1, 'exactly one call flips the order');
        assert.equal((await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM payments WHERE provider_payment_id = 'pay_ONE'"))!.n, 1);
        assert.equal((await db.get<{ used_count: number }>("SELECT used_count FROM coupons WHERE code = 'TEN'"))!.used_count, 1, 'coupon counted once');

        await assert.rejects(paid(o2.orderId, 'pay_ONE', o2.amountPaise), (err: unknown) => err instanceof HttpError && err.status === 409);
        assert.deepEqual(await db.get("SELECT status, payment_verified FROM orders WHERE id = ?", o2.orderId), { status: 'pending', payment_verified: 0 });
        await assert.rejects(paid(o2.orderId, 'pay_TWO', 1), (err: unknown) => err instanceof HttpError && err.status === 409, 'amount mismatch');
        assert.equal(await paid(o2.orderId, 'pay_TWO', o2.amountPaise), true);
        assert.equal(await paid(o2.orderId, 'pay_TWO', o2.amountPaise), false);
        assert.equal((await db.get<{ used_count: number }>("SELECT used_count FROM coupons WHERE code = 'TEN'"))!.used_count, 2);
      } finally {
        await h.cleanup();
      }
    });

    test('concurrent simulator verifications over HTTP: one paid-marking, one coupon use, one confirmation email', async (t) => {
      if (skip()) return t.skip();
      const db = await open();
      await migrate(db);
      const h = await makeApp({ paymentSimulator: true }, { db });
      try {
        const admin = await adminAgent(h);
        const shopper = await signup(h.app);
        const card = await makeProduct(admin, { priceInr: 500 });
        await addCoupon(admin, 'TEN', { percent: 10 });
        const order = (await placeOrder(shopper, [cartOf(card.id)], 'TEN')).body as { orderId: string };
        const results = await Promise.all(Array.from({ length: 6 }, () => shopper.post(`/api/orders/${order.orderId}/verify`).send({ outcome: 'success' })));
        assert.deepEqual(results.map((r) => r.status), [200, 200, 200, 200, 200, 200], JSON.stringify(results.map((r) => r.body)));
        assert.ok(results.every((r) => r.body.paymentVerified === true && r.body.status === 'paid'));
        assert.equal((await db.get<{ used_count: number }>("SELECT used_count FROM coupons WHERE code = 'TEN'"))!.used_count, 1);
        assert.equal((await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM payments WHERE status = 'captured'"))!.n, 1);
        assert.equal(h.outbox.filter((m) => m.to === 'asha@example.com').length, 1);
      } finally {
        await h.cleanup();
      }
    });

    test('a fully used coupon never blocks an already captured payment and never exceeds max_uses', async (t) => {
      if (skip()) return t.skip();
      const db = await open();
      await migrate(db);
      const h = await makeApp({ paymentSimulator: true }, { db });
      try {
        const admin = await adminAgent(h);
        const shopper = await signup(h.app);
        const card = await makeProduct(admin, { priceInr: 500 });
        await addCoupon(admin, 'LAST', { percent: 10, maxUses: 1 });
        const a = (await placeOrder(shopper, [cartOf(card.id)], 'LAST')).body as { orderId: string };
        const b = (await placeOrder(shopper, [cartOf(card.id)], 'LAST')).body as { orderId: string };
        const [ra, rb] = await Promise.all([a, b].map((o) => shopper.post(`/api/orders/${o.orderId}/verify`).send({ outcome: 'success' })));
        assert.equal(ra!.status, 200);
        assert.equal(rb!.status, 200);
        assert.equal((await db.get<{ used_count: number }>("SELECT used_count FROM coupons WHERE code = 'LAST'"))!.used_count, 1, 'capped at max_uses');
        assert.equal((await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM orders WHERE payment_verified = 1'))!.n, 2);
      } finally {
        await h.cleanup();
      }
    });

    test('db-info helpers: real table list, newest-first order for every table, secrets hidden', async (t) => {
      if (skip()) return t.skip();
      const db = await open();
      await migrate(db);
      const tables = await listTables(db);
      assert.ok(tables.includes('users') && tables.includes('schema_migrations') && tables.includes('orders'));
      await db.run("INSERT INTO users (id, email, name, role, password_hash, created_at) VALUES ('u1','a@b.co','A','customer','$2a$12$hashhashhash','2024-01-01T00:00:00.000Z')");
      await db.run("INSERT INTO users (id, email, name, role, password_hash, created_at) VALUES ('u2','b@b.co','B','customer','$2a$12$otherotherother','2025-01-01T00:00:00.000Z')");
      const rows = await showTable(db, 'users', 10);
      assert.deepEqual(rows.map((r) => r['id']), ['u2', 'u1'], 'newest first');
      assert.ok(rows.every((r) => r['password_hash'] === '(hidden)'));
      assert.match(await newestFirstOrder(db, 'orders'), /created_at.*seq/);
      for (const name of tables) await showTable(db, name, 5); // every table works, with or without created_at
    });
  });
}

// ---------------------------------------------------------------- PGlite specifics
describe('embedded PGlite (development) persistence and locking', () => {
  test('data persists in the directory across restarts and the lock file is removed on close', async () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'a2-pglite-'));
    const dir = path.join(base, 'pglite');
    try {
      let db = await openPglite(dir);
      await migrate(db);
      await db.run("INSERT INTO categories (id, name) VALUES ('c1', 'Cards')");
      assert.equal(fs.existsSync(`${dir}.lock`), true);
      await db.close();
      assert.equal(fs.existsSync(`${dir}.lock`), false);
      db = await openPglite(dir);
      assert.deepEqual(await migrate(db), [], 'already migrated');
      assert.equal((await db.get<{ name: string }>("SELECT name FROM categories WHERE id = 'c1'"))!.name, 'Cards');
      await db.close();
    } finally {
      fs.rmSync(base, { recursive: true, force: true });
    }
  });

  test('a directory in use by another live process is refused; a stale lock is taken over', async () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'a2-pglite-'));
    const dir = path.join(base, 'pglite');
    try {
      fs.writeFileSync(`${dir}.lock`, String(process.ppid)); // the parent process is certainly alive
      await assert.rejects(openPglite(dir), /in use by another process/);
      fs.writeFileSync(`${dir}.lock`, '999999999'); // no such process
      const db = await openPglite(dir);
      await db.close();
    } finally {
      fs.rmSync(base, { recursive: true, force: true });
    }
  });

  test('the migrated template used by the other tests is a faithful clone', async () => {
    const h = await makeApp();
    try {
      assert.deepEqual((await h.ctx.db.all('SELECT version FROM schema_migrations')).map((r) => r['version']), ['001_init']);
      assert.equal(h.ctx.db.driver, 'pglite');
      const id = uid();
      assert.equal((await h.ctx.db.run("INSERT INTO categories (id, name) VALUES (?, 'X')", id)).changes, 1);
    } finally {
      await h.cleanup();
    }
  });
});

describe('input PostgreSQL cannot store', () => {
  test('a NUL character in text is a 400, not a 500', async () => {
    const h = await makeApp();
    try {
      const res = await request(h.app).post('/api/contact').send({ name: 'A\u0000B', email: 'a@b.co', message: 'hello there, friend' });
      assert.equal(res.status, 400);
      assert.equal(res.body.error, 'The request contains characters that are not allowed.');
      assert.equal((await h.ctx.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM contact_messages'))!.n, 0);
    } finally {
      await h.cleanup();
    }
  });
});

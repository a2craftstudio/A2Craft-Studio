import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { inspect } from 'node:util';
import { describe, test } from 'node:test';
import { ROOT, loadConfig, parseDatabaseConfig, type PostgresConfig } from '../src/config.js';
import { openPostgres } from '../src/db.js';

const PW = 'S3cr3t!pw';
const BASE = { JWT_SECRET: 'x'.repeat(40), SITE_ORIGIN: 'https://a2.example' };
const SUPABASE = `postgresql://postgres.abcdefgh:${PW}@aws-0-ap-south-1.pooler.supabase.com:6543/postgres`;

const pg = (env: Record<string, string>, nodeEnv: 'development' | 'test' | 'production' = 'production') => parseDatabaseConfig(env, nodeEnv) as PostgresConfig;

describe('config: database selection', () => {
  test('without DATABASE_URL, development uses embedded PGlite under server/data/pglite', () => {
    const c = parseDatabaseConfig({}, 'development');
    assert.equal(c.engine, 'pglite');
    assert.equal(c.engine === 'pglite' && c.dataDir, path.join(ROOT, 'data', 'pglite'));
    assert.equal(c.label, 'pglite (embedded, dev only)');
  });

  test('tests default to an in-memory PGlite; PGLITE_DIR overrides', () => {
    const t = parseDatabaseConfig({}, 'test');
    assert.equal(t.engine === 'pglite' && t.dataDir, 'memory://');
    const d = parseDatabaseConfig({ PGLITE_DIR: 'some/dir' }, 'development');
    assert.equal(d.engine === 'pglite' && d.dataDir, path.resolve('some/dir'));
    const m = parseDatabaseConfig({ PGLITE_DIR: 'memory://' }, 'development');
    assert.equal(m.engine === 'pglite' && m.dataDir, 'memory://');
  });

  test('production requires DATABASE_URL (clear message), and a blank value counts as missing', () => {
    assert.throws(() => loadConfig({ NODE_ENV: 'production', ...BASE }, () => undefined), /DATABASE_URL is required in production/);
    assert.throws(() => loadConfig({ NODE_ENV: 'production', ...BASE, DATABASE_URL: '   ' }, () => undefined), /DATABASE_URL is required in production/);
    const c = loadConfig({ NODE_ENV: 'production', ...BASE, DATABASE_URL: SUPABASE }, () => undefined);
    assert.equal(c.database.engine, 'postgres');
  });

  test('a set DATABASE_URL wins in development too; DATABASE_FILE is ignored with a warning', () => {
    const warnings: string[] = [];
    const c = loadConfig({ NODE_ENV: 'development', DATABASE_URL: SUPABASE, DATABASE_FILE: 'old.db' }, (m) => void warnings.push(m));
    assert.equal(c.database.engine, 'postgres');
    assert.ok(warnings.some((w) => /DATABASE_FILE is ignored/.test(w)));
  });
});

describe('config: DATABASE_URL parsing', () => {
  test('splits a Supabase transaction-pooler URL into parts', () => {
    const c = pg({ DATABASE_URL: SUPABASE });
    assert.equal(c.host, 'aws-0-ap-south-1.pooler.supabase.com');
    assert.equal(c.port, 6543);
    assert.equal(c.user, 'postgres.abcdefgh');
    assert.equal(c.database, 'postgres');
    assert.equal(c.password, PW);
    assert.equal(c.label, 'postgres (aws-0-ap-south-1.pooler.supabase.com/postgres)');
  });

  test('accepts postgres:// too, defaults port 5432 and database postgres, decodes percent-escapes', () => {
    const c = pg({ DATABASE_URL: 'postgres://us%40er:p%40ss%23w%2Ford@db.abc.supabase.co/' });
    assert.equal(c.user, 'us@er');
    assert.equal(c.password, 'p@ss#w/ord');
    assert.equal(c.port, 5432);
    assert.equal(c.database, 'postgres');
  });

  test('the password is not enumerable: it cannot leak through JSON, inspect or a spread copy', () => {
    const c = pg({ DATABASE_URL: SUPABASE });
    assert.equal(c.password, PW);
    assert.equal(JSON.stringify(c).includes(PW), false);
    assert.equal(inspect(c, { depth: 5 }).includes(PW), false);
    assert.equal(JSON.stringify(loadConfig({ NODE_ENV: 'production', ...BASE, DATABASE_URL: SUPABASE }, () => undefined)).includes(PW), false);
    assert.equal(JSON.stringify({ ...c }).includes(PW), false);
  });

  test('invalid URLs fail with a helpful message that contains neither the URL nor the password', () => {
    const bad = [
      `mysql://u:${PW}@host/db`,
      `postgresql://u:${PW}#x@host/db`, // unencoded # in the password
      `postgresql://u:${PW}@/db`,
      `postgresql://u:${PW}@host:99999/db`,
      `postgresql://:${PW}@host/db`,
      `not a url ${PW}`,
      `postgresql://u:${PW}%ZZ@host/db`,
      'postgresql://postgres:[YOUR-PASSWORD]@db.abc.supabase.co:5432/postgres',
    ];
    for (const url of bad) {
      let message = '';
      try {
        parseDatabaseConfig({ DATABASE_URL: url }, 'production');
      } catch (e) {
        message = (e as Error).message;
      }
      assert.match(message, /DATABASE_URL is not valid/, url);
      assert.equal(message.includes(PW), false, `password leaked for ${url}`);
      assert.equal(message.includes(url), false, `URL echoed for ${url}`);
    }
    assert.throws(() => parseDatabaseConfig({ DATABASE_URL: 'postgresql://postgres:[YOUR-PASSWORD]@h/db' }, 'production'), /placeholder/);
  });
});

describe('config: DATABASE_SSL and pool', () => {
  test('remote hosts default to TLS with certificate verification', () => {
    assert.deepEqual(pg({ DATABASE_URL: SUPABASE }).ssl, { rejectUnauthorized: true });
  });

  test('localhost defaults to no TLS (localhost, 127.0.0.1 and ::1)', () => {
    for (const host of ['localhost', '127.0.0.1', '[::1]']) {
      assert.equal(pg({ DATABASE_URL: `postgresql://u:p@${host}:5432/db` }).ssl, false, host);
    }
    // ...but an explicit setting still wins on localhost
    assert.deepEqual(pg({ DATABASE_URL: 'postgresql://u:p@localhost/db', DATABASE_SSL: 'require' }).ssl, { rejectUnauthorized: true });
  });

  test('DATABASE_SSL: require, no-verify and disable', () => {
    assert.deepEqual(pg({ DATABASE_URL: SUPABASE, DATABASE_SSL: 'require' }).ssl, { rejectUnauthorized: true });
    assert.deepEqual(pg({ DATABASE_URL: SUPABASE, DATABASE_SSL: 'NO-VERIFY' }).ssl, { rejectUnauthorized: false });
    assert.equal(pg({ DATABASE_URL: SUPABASE, DATABASE_SSL: 'disable' }).ssl, false);
    assert.throws(() => pg({ DATABASE_URL: SUPABASE, DATABASE_SSL: 'maybe' }), /DATABASE_SSL must be one of/);
  });

  test('weaker TLS settings on a remote host log a warning', () => {
    const warnings: string[] = [];
    parseDatabaseConfig({ DATABASE_URL: SUPABASE, DATABASE_SSL: 'no-verify' }, 'production', (m) => void warnings.push(m));
    parseDatabaseConfig({ DATABASE_URL: SUPABASE, DATABASE_SSL: 'disable' }, 'production', (m) => void warnings.push(m));
    assert.equal(warnings.length, 2);
    assert.ok(warnings.every((w) => !w.includes(PW)));
  });

  test('DATABASE_SSL_CA accepts a PEM file path or the PEM text and keeps verification on', () => {
    const pem = '-----BEGIN CERTIFICATE-----\nMIIBfake\n-----END CERTIFICATE-----\n';
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'a2-ca-'));
    try {
      const file = path.join(dir, 'ca.crt');
      fs.writeFileSync(file, pem);
      assert.deepEqual(pg({ DATABASE_URL: SUPABASE, DATABASE_SSL_CA: file }).ssl, { rejectUnauthorized: true, ca: pem });
      const inline = pg({ DATABASE_URL: SUPABASE, DATABASE_SSL_CA: pem.trim().replace(/\n/g, '\\n') }).ssl;
      assert.deepEqual(inline, { rejectUnauthorized: true, ca: pem.trim() });
      assert.throws(() => pg({ DATABASE_URL: SUPABASE, DATABASE_SSL_CA: path.join(dir, 'missing.crt') }), /DATABASE_SSL_CA/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('DATABASE_POOL_MAX defaults to 10 and must be a sensible integer', () => {
    assert.equal(pg({ DATABASE_URL: SUPABASE }).poolMax, 10);
    assert.equal(pg({ DATABASE_URL: SUPABASE, DATABASE_POOL_MAX: '4' }).poolMax, 4);
    for (const v of ['0', '-1', '2.5', 'many', '1000']) assert.throws(() => pg({ DATABASE_URL: SUPABASE, DATABASE_POOL_MAX: v }), /DATABASE_POOL_MAX/, v);
  });
});

describe('connection failures never leak the URL or password', () => {
  test('an unreachable server gives a clear error with host and database only', async () => {
    const cfg = pg({ DATABASE_URL: `postgresql://appuser:${PW}@127.0.0.1:1/shopdb` }, 'development');
    const logged: string[] = [];
    let message = '';
    try {
      await openPostgres(cfg, { warn: (m) => void logged.push(m) });
    } catch (e) {
      message = (e as Error).message;
    }
    assert.match(message, /Could not connect to postgres \(127\.0\.0\.1\/shopdb\)/);
    assert.equal(message.includes(PW), false);
    assert.equal(message.includes('appuser'), false);
    assert.equal(logged.join('\n').includes(PW), false);
  });
});

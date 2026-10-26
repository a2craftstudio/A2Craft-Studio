import { AsyncLocalStorage } from 'node:async_hooks';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { ROOT, type DatabaseConfig, type PostgresConfig } from './config.js';

export type Param = string | number | bigint | boolean | Buffer | null;

/**
 * The only way the rest of the server talks to the database. Two engines implement it: a `pg` Pool (PostgreSQL, i.e.
 * Supabase) and PGlite (embedded Postgres for development and tests). SQL is written with `?` placeholders; they are
 * converted to `$1..$n` here and every value travels as a bound parameter (never concatenated into the SQL text).
 * Statements are never named/prepared, so the Supabase transaction pooler (pgbouncer transaction mode) works.
 */
export interface Db {
  readonly driver: 'postgres' | 'pglite';
  /** Safe-to-log description, e.g. `postgres (host/db)` or `pglite (embedded, dev only)`. */
  readonly label: string;
  run(sql: string, ...params: Param[]): Promise<{ changes: number }>;
  get<T = Record<string, unknown>>(sql: string, ...params: Param[]): Promise<T | undefined>;
  all<T = Record<string, unknown>>(sql: string, ...params: Param[]): Promise<T[]>;
  /** Runs one or more statements without parameters (DDL, migrations). `?` is NOT converted here. */
  exec(sql: string): Promise<void>;
  /**
   * Runs fn in one transaction on ONE connection (BEGIN/COMMIT, ROLLBACK if it throws). Every db call made inside fn
   * (also from nested helpers) uses that same connection; a nested tx() simply joins the outer one.
   */
  tx<T>(fn: () => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

// ---------------------------------------------------------------- ? -> $n
/**
 * Rewrites `?` placeholders to `$1..$n`, leaving anything inside single-quoted strings (also E'..'), double-quoted
 * identifiers, dollar-quoted bodies, `--` comments and nested block comments untouched.
 */
export function toPgPlaceholders(sql: string): { text: string; count: number } {
  let out = '';
  let n = 0;
  let i = 0;
  const len = sql.length;
  while (i < len) {
    const c = sql[i]!;
    const next = sql[i + 1];
    if (c === "'") {
      const escapes = /[eE]/.test(sql[i - 1] ?? '') && !/[A-Za-z0-9_$]/.test(sql[i - 2] ?? ' ');
      let j = i + 1;
      while (j < len) {
        if (escapes && sql[j] === '\\') j += 2;
        else if (sql[j] === "'") {
          if (sql[j + 1] === "'") j += 2;
          else break;
        } else j++;
      }
      out += sql.slice(i, j + 1);
      i = j + 1;
    } else if (c === '"') {
      let j = i + 1;
      while (j < len) {
        if (sql[j] === '"') {
          if (sql[j + 1] === '"') j += 2;
          else break;
        } else j++;
      }
      out += sql.slice(i, j + 1);
      i = j + 1;
    } else if (c === '-' && next === '-') {
      let j = i;
      while (j < len && sql[j] !== '\n') j++;
      out += sql.slice(i, j);
      i = j;
    } else if (c === '/' && next === '*') {
      let depth = 1;
      let j = i + 2;
      while (j < len && depth > 0) {
        if (sql[j] === '/' && sql[j + 1] === '*') (depth++, (j += 2));
        else if (sql[j] === '*' && sql[j + 1] === '/') (depth--, (j += 2));
        else j++;
      }
      out += sql.slice(i, j);
      i = j;
    } else if (c === '$') {
      const m = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i, i + 80));
      if (m && !/[A-Za-z0-9_$]/.test(sql[i - 1] ?? ' ')) {
        const end = sql.indexOf(m[0], i + m[0].length);
        const stop = end < 0 ? len : end + m[0].length;
        out += sql.slice(i, stop);
        i = stop;
      } else {
        out += c;
        i++;
      }
    } else if (c === '?') {
      out += `$${++n}`;
      i++;
    } else {
      out += c;
      i++;
    }
  }
  return { text: out, count: n };
}

// ---------------------------------------------------------------- shared implementation
interface Conn {
  query(text: string, values: Param[]): Promise<{ rows: unknown[]; affected: number }>;
  exec(sql: string): Promise<void>;
}

function makeDb(driver: Db['driver'], label: string, base: Conn, runTx: <T>(fn: (c: Conn) => Promise<T>) => Promise<T>, end: () => Promise<void>): Db {
  const als = new AsyncLocalStorage<Conn>();
  const cur = () => als.getStore() ?? base;
  const q = (sql: string, params: Param[]) => {
    const { text, count } = toPgPlaceholders(sql);
    if (count !== params.length) throw new Error(`SQL expects ${count} parameter(s) but ${params.length} were given.`);
    return cur().query(text, params);
  };
  let closed: Promise<void> | null = null;
  return {
    driver,
    label,
    run: async (sql, ...p) => ({ changes: (await q(sql, p)).affected }),
    get: async <T>(sql: string, ...p: Param[]) => (await q(sql, p)).rows[0] as T | undefined,
    all: async <T>(sql: string, ...p: Param[]) => (await q(sql, p)).rows as T[],
    exec: (sql) => cur().exec(sql),
    tx: <T>(fn: () => Promise<T>): Promise<T> => (als.getStore() ? fn() : runTx((c) => als.run(c, fn))),
    close: () => (closed ??= end()),
  };
}

// ---------------------------------------------------------------- PostgreSQL (pg Pool)
const INT8 = 20;
const NUMERIC = 1700;
/** Money is whole INR and counts are far below 2^53, so int8 and numeric come back as JS numbers (not strings). */
const typeParsers = {
  getTypeParser: ((oid: number, format?: 'text' | 'binary') => (oid === INT8 || oid === NUMERIC ? (v: string) => Number(v) : pg.types.getTypeParser(oid, format as 'text'))) as never,
};

export interface OpenOptions {
  /** Called for non-fatal pool problems (idle client errors). Messages never contain credentials. */
  warn?: (msg: string) => void;
}

const redact = (msg: string, secret: string) => (secret ? msg.split(secret).join('***') : msg);

export async function openPostgres(cfg: PostgresConfig, opts: OpenOptions = {}): Promise<Db> {
  const warn = opts.warn ?? ((m) => console.warn(m));
  const pool = new pg.Pool({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    ssl: cfg.ssl === false ? false : { ...cfg.ssl },
    max: cfg.poolMax,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    query_timeout: 30_000,
    keepAlive: true,
    application_name: 'a2-craft-studio',
    types: typeParsers,
  });
  // An error on an idle client (server restart, network drop, pooler timeout) must never crash the process:
  // pg removes that client from the pool and the next query opens a new one.
  pool.on('error', (e) => warn(`[db] idle connection error (${cfg.label}): ${redact(e.message, cfg.password)}`));

  const conn = (c: { query: pg.Pool['query'] }): Conn => ({
    query: async (text, values) => {
      const r = await c.query({ text, values: values as unknown[] });
      return { rows: r.rows as unknown[], affected: r.rowCount ?? 0 };
    },
    exec: async (sql) => void (await c.query(sql)),
  });

  const db = makeDb(
    'postgres',
    cfg.label,
    conn(pool),
    async (fn) => {
      const client = await pool.connect();
      let broken: Error | undefined;
      const onError = (e: Error) => void (broken = e);
      client.on('error', onError);
      try {
        await client.query('BEGIN');
        const out = await fn(conn(client as unknown as { query: pg.Pool['query'] }));
        await client.query('COMMIT');
        return out;
      } catch (e) {
        try {
          await client.query('ROLLBACK');
        } catch (re) {
          broken ??= re as Error; // the connection is unusable: destroy it instead of returning it to the pool
        }
        throw e;
      } finally {
        client.removeListener('error', onError);
        client.release(broken);
      }
    },
    () => pool.end(),
  );

  try {
    await db.get('SELECT 1 AS ok');
  } catch (e) {
    await db.close().catch(() => undefined);
    throw connectError(cfg, e);
  }
  return db;
}

const TLS_CODES = new Set(['SELF_SIGNED_CERT_IN_CHAIN', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'CERT_HAS_EXPIRED', 'ERR_TLS_CERT_ALTNAME_INVALID']);

/** A connection failure with a hint and no secrets (pg messages never include the password, but we redact anyway). */
function connectError(cfg: PostgresConfig, e: unknown): Error {
  const err = e as { code?: string; message?: string };
  const code = err.code ? ` [${err.code}]` : '';
  let msg = `Could not connect to ${cfg.label}${code}: ${redact(err.message ?? 'unknown error', cfg.password)}`;
  if (err.code && TLS_CODES.has(err.code)) {
    msg += '\nThe server certificate could not be verified. Download your provider\'s CA certificate (Supabase: Project Settings > Database > SSL Configuration) and set DATABASE_SSL_CA to its file path, or set DATABASE_SSL=no-verify to encrypt without verifying.';
  } else if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT') {
    msg += '\nCheck the host and port in DATABASE_URL (Supabase: use the Transaction pooler string from Project > Connect).';
  }
  return new Error(msg);
}

// ---------------------------------------------------------------- PGlite (embedded Postgres, development and tests)
export interface PgliteDb extends Db {
  /** Serializes the whole database (used by tests to clone a migrated database cheaply). */
  snapshot(): Promise<Blob>;
}

function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === 'EPERM';
  }
}

/** PGlite supports a single process per data directory; a pid lock file turns accidental double use into a clear error. */
function lockDir(dataDir: string): () => void {
  fs.mkdirSync(path.dirname(dataDir), { recursive: true });
  const lock = `${dataDir}.lock`;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      fs.writeFileSync(lock, String(process.pid), { flag: 'wx' });
      return () => fs.rmSync(lock, { force: true });
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
      const pid = Number(fs.readFileSync(lock, 'utf8').trim());
      if (pid && pid !== process.pid && pidAlive(pid)) {
        throw new Error(`The embedded dev database (${path.basename(dataDir)}) is in use by another process (pid ${pid}). Stop it first (for example the dev server), or set DATABASE_URL to use a real PostgreSQL.`);
      }
      fs.rmSync(lock, { force: true }); // stale lock from a crashed process
    }
  }
  throw new Error('Could not lock the embedded dev database.');
}

export async function openPglite(dataDir: string, opts: { loadDataDir?: Blob } = {}): Promise<PgliteDb> {
  const { PGlite, types } = await import('@electric-sql/pglite'); // only loaded when the embedded engine is used
  const memory = dataDir.startsWith('memory://');
  const unlock = memory ? () => undefined : lockDir(dataDir);
  let lite: InstanceType<typeof PGlite>;
  try {
    lite = await PGlite.create({
      dataDir,
      ...(opts.loadDataDir ? { loadDataDir: opts.loadDataDir } : {}),
      parsers: { [types.INT8]: (v: string) => Number(v), [types.NUMERIC]: (v: string) => Number(v) },
    });
  } catch (e) {
    unlock();
    throw e;
  }
  type Q = Pick<typeof lite, 'query' | 'exec'>;
  const conn = (c: Q): Conn => ({
    query: async (text, values) => {
      const r = await c.query(text, values as unknown[]);
      return { rows: r.rows as unknown[], affected: r.affectedRows ?? r.rows.length };
    },
    exec: async (sql) => void (await c.exec(sql)),
  });
  const db = makeDb(
    'pglite',
    'pglite (embedded, dev only)',
    conn(lite),
    // PGlite is one connection: its own transaction() holds the connection until commit, so other callers queue.
    (fn) => lite.transaction((t) => fn(conn(t as unknown as Q))),
    async () => {
      try {
        await lite.close();
      } finally {
        unlock();
      }
    },
  );
  return Object.assign(db, { snapshot: async () => (await lite.dumpDataDir('gzip')) as Blob });
}

export function openDb(cfg: DatabaseConfig, opts: OpenOptions = {}): Promise<Db> {
  return cfg.engine === 'postgres' ? openPostgres(cfg, opts) : openPglite(cfg.dataDir);
}

// ---------------------------------------------------------------- migrations
/** Arbitrary constant naming this app's migration lock (pg_advisory_xact_lock key). */
const MIGRATION_LOCK = 727_274_001;

const BOOKKEEPING = `
  CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL);
  DO $$ BEGIN
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'schema_migrations'::regclass) THEN
      ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY;
    END IF;
  END $$;`;

/**
 * Applies src/migrations/*.sql in filename order, each in its own transaction, tracked in schema_migrations.
 * Every migration transaction first takes a transaction-scoped advisory lock (released automatically at COMMIT or
 * ROLLBACK, so it is safe with pgbouncer transaction mode) and only then checks what is applied, so two instances
 * starting at once cannot both run the same migration.
 */
export async function migrate(db: Db, dir = path.join(ROOT, 'src', 'migrations')): Promise<string[]> {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const done: string[] = [];
  for (const f of files) {
    const version = f.replace(/\.sql$/, '');
    const sql = fs.readFileSync(path.join(dir, f), 'utf8');
    const ran = await db.tx(async () => {
      await db.get(`SELECT pg_advisory_xact_lock(${MIGRATION_LOCK})`); // a constant, not user input
      await db.exec(BOOKKEEPING);
      if (await db.get('SELECT 1 AS x FROM schema_migrations WHERE version = ?', version)) return false;
      await db.exec(sql);
      await db.run('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)', version, new Date().toISOString());
      return true;
    });
    if (ran) done.push(version);
  }
  return done;
}

export const nowIso = () => new Date().toISOString();
/** True for a PostgreSQL unique_violation (SQLSTATE 23505), from either engine. */
export const isUniqueError = (e: unknown) => typeof e === 'object' && e !== null && (e as { code?: unknown }).code === '23505';

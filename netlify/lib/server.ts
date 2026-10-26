import { getStore } from '@netlify/blobs';
import type { Express } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../../server/src/app.js';
import { bootstrapAdmin } from '../../server/src/auth.js';
import { loadConfig, type Config } from '../../server/src/config.js';
import { migrate, openDb, type Db } from '../../server/src/db.js';
import { createLogger } from '../../server/src/log.js';
import { STORE_KEY_RE, type FileStore } from '../../server/src/services/files.js';

/** Netlify Blobs store holding every accepted upload, keyed `public/<name>` or `private/<name>`. */
export const uploadsStore = () => getStore({ name: 'uploads', consistency: 'strong' });

/**
 * Production settings come from the site's environment variables. A function's disk is temporary, so multer's temp
 * files go to /tmp and finished uploads go to Netlify Blobs. SITE_ORIGIN falls back to the site's primary URL.
 */
export function functionConfig(): Config {
  const env = process.env;
  env['NODE_ENV'] = 'production';
  env['UPLOAD_DIR'] ||= '/tmp/a2-uploads';
  env['SITE_ORIGIN'] ||= env['URL'];
  env['TRUST_PROXY'] ||= '1';
  env['DATABASE_POOL_MAX'] ||= '3';
  return loadConfig(env);
}

export function blobFileStore(): FileStore {
  const check = (key: string) => {
    if (!STORE_KEY_RE.test(key)) throw new Error('Not a valid file key.');
    return key;
  };
  return {
    async save(key, tmpFile) {
      await uploadsStore().set(check(key), fs.readFileSync(tmpFile));
      fs.rmSync(tmpFile, { force: true });
    },
    async exists(key) {
      return STORE_KEY_RE.test(key) && (await uploadsStore().getMetadata(key)) !== null;
    },
    async remove(key) {
      if (STORE_KEY_RE.test(key)) await uploadsStore().delete(key);
    },
  };
}

/** The SQL migrations ship with the function as included files; their location depends on how the bundle is laid out. */
function migrationsDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve('server/src/migrations'),
    path.join(process.env['LAMBDA_TASK_ROOT'] ?? '/var/task', 'server/src/migrations'),
    path.resolve(here, '../../server/src/migrations'),
    path.resolve(here, 'server/src/migrations'),
  ];
  const dir = candidates.find((d) => fs.existsSync(d));
  if (!dir) throw new Error('The database migrations were not found in the function bundle.');
  return dir;
}

export async function openFunctionDb(config: Config): Promise<Db> {
  const log = createLogger(config.logLevel);
  const db = await openDb(config.database, { warn: (m) => log.warn(m) });
  const applied = await migrate(db, migrationsDir());
  if (applied.length) log.info(`[db] applied migrations: ${applied.join(', ')}`);
  return db;
}

let app: Promise<Express> | undefined;
/** One Express app (and one connection pool) per function instance, created on the first request. */
export function getApp(): Promise<Express> {
  app ??= (async () => {
    const config = functionConfig();
    const db = await openFunctionDb(config);
    const created = createApp(config, { db, files: blobFileStore() });
    await bootstrapAdmin(created.ctx);
    return created;
  })().catch((e) => {
    app = undefined; // retry on the next request instead of caching the failure
    throw e;
  });
  return app;
}

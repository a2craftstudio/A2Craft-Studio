import type { Db } from '../db.js';
import type { Logger } from '../log.js';

export const RETENTION_DAYS = 90;

/** Deletes visit events and call-back requests older than 90 days, and expired or used password-reset tokens. */
export function runRetention(db: Db, now = Date.now()) {
  const cutoff = new Date(now - RETENTION_DAYS * 24 * 3600 * 1000).toISOString();
  const nowIso = new Date(now).toISOString();
  return db.tx(async () => ({
    events: (await db.run('DELETE FROM visit_events WHERE created_at < ?', cutoff)).changes,
    callbacks: (await db.run('DELETE FROM callback_requests WHERE created_at < ?', cutoff)).changes,
    resetTokens: (await db.run('DELETE FROM password_resets WHERE expires_at < ? OR used_at IS NOT NULL', nowIso)).changes,
  }));
}

/** Runs once now and then every 24 hours. Returns a stop function. */
export function startRetentionJob(db: Db, log: Logger): () => void {
  const tick = () =>
    runRetention(db).then(
      (r) => log.info(`[retention] removed ${r.events} visit events, ${r.callbacks} call-back requests, ${r.resetTokens} reset tokens`),
      (e) => log.error('[retention] failed', e),
    );
  void tick();
  const timer = setInterval(() => void tick(), 24 * 3600 * 1000);
  timer.unref();
  return () => clearInterval(timer);
}

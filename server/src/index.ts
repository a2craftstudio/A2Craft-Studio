import 'dotenv/config';
import { createApp } from './app.js';
import { bootstrapAdmin } from './auth.js';
import { loadConfig, razorpayConfigured, simulatorAllowed } from './config.js';
import { migrate, openDb, type Db } from './db.js';
import { createLogger } from './log.js';
import { startRetentionJob } from './services/retention.js';

const config = loadConfig();
const log = createLogger(config.logLevel);

let db: Db;
try {
  db = await openDb(config.database, { warn: (m) => log.warn(m) });
  const applied = await migrate(db);
  if (applied.length) log.info(`[db] applied migrations: ${applied.join(', ')}`);
} catch (e) {
  // The message is built by the db layer and never contains the connection string or password.
  log.error(`[db] startup failed: ${e instanceof Error ? e.message : 'unknown error'}`);
  process.exit(1);
}
log.info(`[db] using ${db.label}`);

const app = createApp(config, { db });
await bootstrapAdmin(app.ctx);
const stopRetention = startRetentionJob(db, log);

if (!razorpayConfigured(config)) {
  log.warn(
    simulatorAllowed(config)
      ? '[payments] Razorpay keys not set: using the PAYMENT SIMULATOR (development only).'
      : '[payments] Razorpay keys not set and no simulator: creating orders will answer 503.',
  );
}
if (razorpayConfigured(config) && !config.razorpay.webhookSecret) log.warn('[payments] RAZORPAY_WEBHOOK_SECRET is not set: the webhook endpoint is disabled (503).');
if (!config.mail.resendApiKey) log.warn('[mail] RESEND_API_KEY not set: emails are only logged (one line each).');
if (config.clientDist) log.info(`[web] serving the Angular build from ${config.clientDist}`);

const server = app.listen(config.port, () => {
  log.info(`[server] A2 Craft Studio API listening on http://localhost:${config.port} (${config.nodeEnv}, ${db.label})`);
});

function shutdown(signal: string) {
  log.info(`[server] ${signal} received, shutting down`);
  stopRetention();
  server.close(() => {
    db.close().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

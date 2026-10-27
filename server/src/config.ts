import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** The server package root (the folder holding package.json). Works from src/ (tsx) and dist/ (node). */
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Where and how the server stores data. Contains no secrets except the (non-enumerable) password. */
export type DatabaseConfig = PostgresConfig | PgliteConfig;
export interface PostgresConfig {
  engine: 'postgres';
  host: string;
  port: number;
  user: string;
  database: string;
  /** Non-enumerable, so it cannot leak through JSON.stringify / console.log / util.inspect of a config object. */
  readonly password: string;
  ssl: false | { rejectUnauthorized: boolean; ca?: string };
  poolMax: number;
  /** Safe to log: `host/database`, never the URL or credentials. */
  label: string;
}
export interface PgliteConfig {
  engine: 'pglite';
  /** Absolute directory, or `memory://` for an in-memory instance (the default under NODE_ENV=test). */
  dataDir: string;
  label: string;
}

export interface Config {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  database: DatabaseConfig;
  jwtSecret: string;
  siteOrigin: string;
  /** Extra origins (besides siteOrigin) allowed to send state-changing browser requests. */
  allowedOrigins: string[];
  cookieSecure: boolean;
  uploadDir: string;
  clientDist: string | null;
  trustProxy: number;
  razorpay: { keyId: string; keySecret: string; webhookSecret: string };
  /** What the operator asked for. Use `simulatorAllowed(config)`; it is never honoured in production. */
  paymentSimulator: boolean;
  mail: { resendApiKey: string; from: string; ownerEmail: string };
  admin: { email: string; password: string; name: string };
  /** The owner account (SUPERADMIN_EMAIL, falling back to ADMIN_EMAIL): always an admin, and the only one who can change roles. */
  superAdminEmail: string;
  /** SUPERADMIN_PASSWORD: when set, start-up creates the owner account or resets its password to this value. */
  superAdminPassword: string;
  bcryptCost: number;
  rateLimit: boolean;
  logLevel: 'silent' | 'error' | 'info';
}

export const isProduction = (c: Pick<Config, 'nodeEnv'>) => c.nodeEnv === 'production';
export const razorpayConfigured = (c: Config) => !!(c.razorpay.keyId && c.razorpay.keySecret);
/** The simulator can only ever run outside production, and only when explicitly enabled. */
export const simulatorAllowed = (c: Pick<Config, 'nodeEnv' | 'paymentSimulator'>) => c.paymentSimulator && c.nodeEnv !== 'production';

const str = (v: string | undefined, d = '') => (v ?? d).trim();

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const SSL_MODES = ['require', 'no-verify', 'disable'] as const;
type SslMode = (typeof SSL_MODES)[number];

/**
 * DATABASE_URL (postgres:// or postgresql://) selects PostgreSQL (Supabase in production). Without it, development and
 * tests use PGlite (embedded Postgres). Production REQUIRES DATABASE_URL. Error messages never contain the URL.
 */
export function parseDatabaseConfig(env: NodeJS.ProcessEnv, nodeEnv: Config['nodeEnv'], warn: (m: string) => void = () => {}): DatabaseConfig {
  if (str(env['DATABASE_FILE'])) warn('[config] DATABASE_FILE is ignored: the file database was replaced by PostgreSQL. Use DATABASE_URL (or leave it unset for the embedded dev database).');
  const raw = str(env['DATABASE_URL']);

  if (!raw) {
    if (nodeEnv === 'production') {
      throw new Error('DATABASE_URL is required in production. On Supabase: Project > Connect > Transaction pooler, then URL-encode the password.');
    }
    const dir = str(env['PGLITE_DIR']);
    const dataDir = dir ? (dir.startsWith('memory://') ? 'memory://' : path.resolve(dir)) : nodeEnv === 'test' ? 'memory://' : path.join(ROOT, 'data', 'pglite');
    return { engine: 'pglite', dataDir, label: 'pglite (embedded, dev only)' };
  }

  const invalid = (why: string) =>
    new Error(`DATABASE_URL is not valid: ${why} Expected postgresql://USER:PASSWORD@HOST:PORT/DATABASE with special characters in the password URL-encoded (@ is %40, # is %23, / is %2F).`);
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw invalid('it could not be parsed.');
  }
  if (u.protocol !== 'postgres:' && u.protocol !== 'postgresql:') throw invalid('it must start with postgres:// or postgresql://.');
  if (u.hash) throw invalid('it contains an unencoded "#" (probably in the password).');
  if (!u.hostname) throw invalid('the host is missing.');
  let user: string;
  let password: string;
  let database: string;
  try {
    user = decodeURIComponent(u.username);
    password = decodeURIComponent(u.password);
    database = decodeURIComponent(u.pathname.replace(/^\//, '')) || 'postgres';
  } catch {
    throw invalid('it contains a bad % escape.');
  }
  if (!user) throw invalid('the user is missing.');
  if (password === '[YOUR-PASSWORD]') throw invalid('replace the [YOUR-PASSWORD] placeholder with your real database password.');
  const port = u.port ? Number(u.port) : 5432;
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw invalid('the port is not valid.');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  const local = LOCAL_HOSTS.has(host.toLowerCase());

  const sslRaw = str(env['DATABASE_SSL']).toLowerCase();
  if (sslRaw && !(SSL_MODES as readonly string[]).includes(sslRaw)) throw new Error('DATABASE_SSL must be one of: require, no-verify, disable.');
  const mode: SslMode = (sslRaw as SslMode) || (local ? 'disable' : 'require');
  let ssl: PostgresConfig['ssl'] = false;
  if (mode !== 'disable') {
    ssl = { rejectUnauthorized: mode === 'require' };
    const ca = str(env['DATABASE_SSL_CA']);
    if (ca) {
      // A PEM pasted into a one-line .env value may use literal "\n" escapes.
      if (ca.includes('BEGIN CERTIFICATE')) ssl.ca = ca.split('\\n').join('\n');
      else if (fs.existsSync(path.resolve(ca))) ssl.ca = fs.readFileSync(path.resolve(ca), 'utf8');
      else throw new Error('DATABASE_SSL_CA must be the path of a PEM certificate file (or the PEM text itself).');
    }
  }
  if (!local && mode === 'disable') warn('[config] DATABASE_SSL=disable with a remote database: the connection is NOT encrypted.');
  if (mode === 'no-verify') warn('[config] DATABASE_SSL=no-verify: the connection is encrypted but the server certificate is not verified.');

  const poolRaw = str(env['DATABASE_POOL_MAX'], '10');
  const poolMax = Number(poolRaw);
  if (!Number.isInteger(poolMax) || poolMax < 1 || poolMax > 100) throw new Error('DATABASE_POOL_MAX must be a whole number from 1 to 100.');

  const cfg = { engine: 'postgres' as const, host, port, user, database, ssl, poolMax, label: `postgres (${host}/${database})` };
  Object.defineProperty(cfg, 'password', { value: password, enumerable: false });
  return cfg as PostgresConfig;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env, warn: (m: string) => void = (m) => console.warn(m)): Config {
  const rawEnv = str(env['NODE_ENV'], 'development');
  const nodeEnv = (['development', 'test', 'production'].includes(rawEnv) ? rawEnv : 'development') as Config['nodeEnv'];
  const prod = nodeEnv === 'production';
  const port = Number(str(env['PORT'], '3100'));
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT must be a valid port number.');

  let jwtSecret = str(env['JWT_SECRET']);
  if (prod) {
    if (jwtSecret.length < 32) throw new Error('JWT_SECRET is required in production and must be at least 32 characters.');
  } else if (!jwtSecret) {
    jwtSecret = crypto.randomBytes(48).toString('hex');
    warn('[config] JWT_SECRET is not set: generated a random one. Sessions will be invalidated on every restart.');
  }

  const siteOrigin = str(env['SITE_ORIGIN'], prod ? '' : `http://localhost:${port}`).replace(/\/+$/, '');
  if (prod && !/^https?:\/\/[^/]+$/.test(siteOrigin)) throw new Error('SITE_ORIGIN (e.g. https://a2craft.example) is required in production.');

  const paymentSimulator = str(env['PAYMENT_SIMULATOR']).toLowerCase() === 'true';
  if (prod && paymentSimulator) warn('[config] PAYMENT_SIMULATOR is ignored in production.');

  const clientDistEnv = str(env['CLIENT_DIST']);
  const clientDist = clientDistEnv
    ? path.resolve(clientDistEnv)
    : fs.existsSync(path.resolve(ROOT, '../dist/a2-craft-studio/browser/index.html'))
      ? path.resolve(ROOT, '../dist/a2-craft-studio/browser')
      : null;

  const cookieSecureEnv = str(env['COOKIE_SECURE']).toLowerCase();
  const cookieSecure = cookieSecureEnv ? cookieSecureEnv === 'true' : prod;

  const database = parseDatabaseConfig(env, nodeEnv, warn);
  return {
    nodeEnv,
    port,
    database,
    jwtSecret,
    siteOrigin,
    allowedOrigins: str(env['ALLOWED_ORIGINS']).split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean),
    cookieSecure,
    uploadDir: path.resolve(str(env['UPLOAD_DIR'], path.join(ROOT, 'storage'))),
    clientDist,
    trustProxy: Math.max(0, Number(str(env['TRUST_PROXY'], '0')) || 0),
    razorpay: { keyId: str(env['RAZORPAY_KEY_ID']), keySecret: str(env['RAZORPAY_KEY_SECRET']), webhookSecret: str(env['RAZORPAY_WEBHOOK_SECRET']) },
    paymentSimulator,
    mail: { resendApiKey: str(env['RESEND_API_KEY']), from: str(env['MAIL_FROM'], 'A2 Craft Studio <onboarding@resend.dev>'), ownerEmail: str(env['OWNER_EMAIL']) },
    superAdminPassword: env['SUPERADMIN_PASSWORD'] ?? '',
    superAdminEmail: (str(env['SUPERADMIN_EMAIL']) || str(env['ADMIN_EMAIL'])).toLowerCase(),
    admin: { email: str(env['ADMIN_EMAIL']).toLowerCase(), password: env['ADMIN_PASSWORD'] ?? '', name: str(env['ADMIN_NAME'], 'Studio Admin') },
    bcryptCost: 12,
    rateLimit: true,
    logLevel: nodeEnv === 'test' ? 'silent' : 'info',
  };
}

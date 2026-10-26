# A2 Craft Studio: API server

Node.js 22 + TypeScript (ESM, strict) + Express 4 + PostgreSQL (`pg`; Supabase in production, embedded PGlite in development). It implements every route of
[`docs/API.md`](../docs/API.md), serves the Angular build, and talks to Razorpay and Resend over plain `fetch`.
A fresh database is **empty**: no products, orders, reviews or demo accounts are seeded.

## Quick start (development)

```bash
cd server
npm install
cp .env.example .env            # then edit; see the table below
npm run create-admin -- you@example.com 'a-long-password' 'Your Name'
npm run dev                     # tsx watch, http://localhost:$PORT
```

With `DATABASE_URL` empty (the default) development runs on **PGlite**, a real PostgreSQL compiled to WebAssembly that runs inside the Node process: no
database server to install. Its files live in `server/data/pglite` (git-ignored). PGlite allows **one process per data directory**: stop `npm run dev` before running
`npm run db` or `npm run create-admin`, otherwise they refuse to start with a message naming the other process. Production never uses PGlite (it needs `DATABASE_URL`).
To develop against a real Postgres (for example your Supabase project, or a local one) just set `DATABASE_URL`.

For local payments without Razorpay keys set `PAYMENT_SIMULATOR=true` (ignored in production). Without keys and
without the simulator, `GET /api/config` still says `razorpay` and `POST /api/orders` answers `503 Payments are not configured yet.`

Angular's dev server should proxy `/api`, `/media` and `/files` to this server. To serve the built Angular app from
Node instead, run `ng build` in the repo root; the API picks up `../dist/a2-craft-studio/browser` automatically
(or set `CLIENT_DIST`).

## Connecting Supabase

The production database is Supabase Postgres. The server connects with a normal PostgreSQL connection string; nothing else from Supabase is used
(no Supabase JS client, no Auth, no Storage, no anon key).

1. In Supabase open your project and press **Connect** (top bar), choose **Transaction pooler** and copy the connection string. It looks like
   `postgresql://postgres.<project-ref>:[YOUR-PASSWORD]@aws-0-<region>.pooler.supabase.com:6543/postgres`.
2. Put it in `server/.env` as `DATABASE_URL`, with `[YOUR-PASSWORD]` replaced by your database password (Project Settings > Database > reset it if you
   forgot it). **URL-encode special characters in the password** (`@` becomes `%40`, `#` `%23`, `/` `%2F`, `:` `%3A`, `?` `%3F`, `%` `%25`).
   In a `.env` file a `#` also starts a comment, so wrap the whole value in double quotes if it contains one.
3. TLS is on by default for every non-localhost host and the server certificate is **verified**. Supabase signs its certificates with its own CA, which
   Node does not know, so the first start usually fails with `self-signed certificate in certificate chain`. Pick one:
   - download the CA certificate (Project Settings > Database > SSL Configuration) and set `DATABASE_SSL_CA=/path/to/prod-ca-2021.crt` (verified, recommended), or
   - set `DATABASE_SSL=no-verify` (still encrypted, but the server's identity is not checked).
4. Start the server (`npm start`, or `npm run dev`). The first start **creates every table** (`001_init.sql`) and, when `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set,
   **creates the admin** from them. The log says `using postgres (<host>/<database>)` (never the password).

Notes:

- **Row Level Security.** Supabase publishes every table in the `public` schema through its REST Data API with the public anon key. The migration therefore enables
  RLS on **every** table with **no policies** and revokes all privileges of the `anon` and `authenticated` roles (also for future tables). The server connects as the
  privileged `postgres` role, which bypasses RLS. A test fails if any table is created without RLS: new migrations must do the same. Do not add policies unless you
  intend to expose that table to browsers.
- **Transaction pooler.** The server uses no named prepared statements, no session state, no `LISTEN`, and takes advisory locks only inside the migration transaction
  (`pg_advisory_xact_lock`), so it works through port 6543. The direct connection (5432) and the session pooler also work. `DATABASE_POOL_MAX` (default 10) caps the connections.
- If you use IPv4-only hosting, use the pooler string (the direct `db.<ref>.supabase.co` host is IPv6-only unless you buy the IPv4 add-on).

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | `tsx watch src/index.ts` |
| `npm run build` | `tsc` into `dist/` |
| `npm start` | `node dist/index.js` (run `npm run build` first) |
| `npm test` | `node --test` with `tsx`: integration tests (supertest, in-memory PGlite, mocked `fetch`; no database server needed) |
| `npm run typecheck` | `tsc --noEmit` for `src/` and `test/` |
| `npm run create-admin -- <email> <password> [name]` | creates an admin, or promotes an existing account and resets its password |
| `npm run db` | lists every table with its row count; `npm run db -- <table> [limit]` shows the newest rows (columns named like hash/secret/token/password are hidden) |

Tests need no database server: every test file builds its app on an in-memory PGlite clone of the migrated schema, and `test/database.test.ts` also runs the real `pg`
driver (Pool, transactions, type parsers) against PGlite over its PostgreSQL wire-protocol socket. PGlite serializes transactions, so genuine concurrent row-lock races are
only exercised against a real PostgreSQL: set `TEST_DATABASE_URL=postgresql://postgres:<pw>@localhost:5432/a2_test` (the database name must contain `test`; its `public`
schema is **dropped and recreated** by the tests) and `npm test` runs the same database tests there too. Never point it at Supabase production.

## Environment

| Variable | Default | Notes |
| --- | --- | --- |
| `NODE_ENV` | `development` | `production` turns on strict checks (below) and disables the simulator |
| `PORT` | `3100` | |
| `DATABASE_URL` | empty | `postgresql://user:password@host:port/database`. **Required in production** (the server refuses to start without it). Empty in development/test means embedded PGlite. Special characters in the password must be URL-encoded. Never logged: only `host/database` is |
| `DATABASE_SSL` | `require` for remote hosts, `disable` for localhost | `require` = TLS with certificate verification, `no-verify` = TLS without verification (escape hatch), `disable` = no TLS |
| `DATABASE_SSL_CA` | empty | Path to (or the text of) a PEM CA certificate to trust, e.g. Supabase's. Keeps verification on |
| `DATABASE_POOL_MAX` | `10` | Maximum pooled connections (1 to 100) |
| `PGLITE_DIR` | `./data/pglite` (dev), in memory (tests) | Embedded dev database directory; `memory://` for a throwaway one. Ignored when `DATABASE_URL` is set |
| `JWT_SECRET` | random per start in dev | **Required in production, 32+ chars.** Also derives the file-signing key |
| `SITE_ORIGIN` | `http://localhost:<PORT>` | **Required in production** (`https://your.domain`, no trailing slash). Used in email links and the Origin check |
| `ALLOWED_ORIGINS` | empty | Extra origins allowed to send state-changing requests (comma separated). Outside production every `localhost` origin is allowed |
| `COOKIE_SECURE` | `true` in production | Secure flag of the `a2_session` cookie |
| `TRUST_PROXY` | `0` | Number of reverse proxies in front of Node (1 for Nginx, Render, Fly, Railway). Needed so rate limits see the real client IP |
| `UPLOAD_DIR` | `./storage` | `public/` is served at `/media`, `private/` only through signed `/files` links, `tmp/` is scratch |
| `CLIENT_DIST` | `../dist/a2-craft-studio/browser` if it exists | Angular build to serve, with SPA fallback |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | empty | Both set means Razorpay is used |
| `RAZORPAY_WEBHOOK_SECRET` | empty | Without it the webhook answers 503 (never open) |
| `PAYMENT_SIMULATOR` | `false` | `true` is honoured only when `NODE_ENV` is not `production` |
| `RESEND_API_KEY`, `MAIL_FROM`, `OWNER_EMAIL` | empty | Without a key, emails are logged as one line (no body, no links). `OWNER_EMAIL` receives order, inquiry, contact and call-back alerts |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | empty | Admin is created at start only if no admin exists yet |

Production start-up refuses to run without a strong `JWT_SECRET`, a valid `SITE_ORIGIN` and a `DATABASE_URL`.

## Folder map

```
server/
  src/index.ts          bootstrap: env, db, migrations, admin, retention job, listen
  src/app.ts            createApp(config, { db }): Express (tests build it against an in-memory PGlite)
  src/config.ts         env parsing (incl. DATABASE_URL / SSL / pool), simulatorAllowed(), razorpayConfigured()
  src/db.ts             the async Db interface with two engines (pg Pool, PGlite): ? to $n, tx() on one connection, migrate()
  src/migrations/*.sql  versioned PostgreSQL schema (incl. RLS), applied in a transaction under an advisory lock, tracked in schema_migrations
  src/auth.ts           bcrypt, JWT cookie, admin bootstrap
  src/middleware/       auth guards, zod validation, rate limits, Origin/JSON checks, error handler, async wrapper
  src/routes/           auth, catalog, uploads, orders, payments (webhook), engagement, admin, events
  src/services/         pricing, mail, razorpay, files (signing, sniffing), orders (mark-paid), retention
  src/cli/create-admin.ts, db-info.ts
  test/*.test.ts        integration tests
```

## Security notes

- **Prices are server-side only.** `computeQuote` reads published products and coupons from the DB; client prices are ignored.
- **Payment finality has one function**, `markOrderPaid`: one transaction that locks the order row (`SELECT ... FOR UPDATE`), a unique
  `provider_payment_id` (`INSERT ... ON CONFLICT DO NOTHING`), amount check, and a `used_count` incremented (with an atomic `max_uses` guard) only by the call
  that flips the order to paid. Browser verify and webhook both use it, so concurrent replays stay idempotent.
  Razorpay verify checks the HMAC (`timingSafeEqual`), the stored provider order id, then fetches the payment from Razorpay
  and requires `captured`, matching order id and `amount == total * 100`.
- **The simulator is impossible in production**: `simulatorAllowed()` is `false` whenever `NODE_ENV=production`; orders then 503 and verify 403.
- **Auth**: bcrypt cost 12, dummy compare for unknown emails, JWT in an `httpOnly; SameSite=Lax` cookie (`Secure` in production),
  the role is read from the DB on every request, passwords changes and resets invalidate older sessions. Reset tokens are 32 random bytes,
  only their SHA-256 is stored, single use, 1 hour.
- **Authorization**: everything under `/api/admin` sits behind one guard (401 anonymous, 403 customer). Other people's orders are 404.
  `adminNote` lives in `admin_notes` and is only joined on admin routes; call-back numbers are only returned by the admin route.
- **CSRF**: state-changing requests that carry a body must be `application/json` (multipart only on the two upload routes), and a request
  with a foreign `Origin` header is refused, on top of `SameSite=Lax`.
- **Files**: uploads get random names, extension allow-lists, magic-byte sniffing (no SVG), strict size limits and are streamed to disk.
  Private files are served only via `/files/<name>?e=<expiry>&s=<hmac>` (HMAC-SHA256 over `path|expiry`, 60 s for customer downloads,
  5 min for admins) with `private, no-store`, `nosniff` and a sandbox CSP; unknown types are forced to download as `application/octet-stream`.
- **Database exposure.** Every table has Row Level Security enabled with no policies, and `anon`/`authenticated` have no privileges (see Connecting Supabase), so the
  Supabase REST API cannot read or write anything. All SQL uses bound parameters (`?` becomes `$1..$n` in `db.ts`).
- Zod validates every body and query (unknown body fields are rejected, strings trimmed and capped), SQL is always parameterised,
  errors are `{ "error": "..." }` and 500s carry only a request id (details go to the server log, never secrets or bodies).
- `helmet` with a CSP that allows Razorpay Checkout and Google Fonts; JSON body limit 1 MB; per-IP / per-user rate limits as in API.md.
- Known dependency note: `npm audit` reports a zod advisory (memory use when validating huge constrained collections). Here every
  body is capped at 1 MB and every array has a small `max`, so it is not reachable; upgrade to zod 4.6.7+ when convenient.

## Deploy

1. Build the Angular app in the repo root (`ng build`) and `npm ci && npm run build` here.
2. Set the environment (at least `NODE_ENV=production`, `DATABASE_URL`, `JWT_SECRET`, `SITE_ORIGIN`, `TRUST_PROXY=1` behind a proxy, Razorpay keys, `RESEND_API_KEY`, `OWNER_EMAIL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`).
3. Put `UPLOAD_DIR` on a **persistent disk/volume**, then `npm start`. Terminate TLS at a reverse proxy (Nginx, Caddy, a PaaS) and forward to Node.
   Deploy the whole `server/` folder (the migrations are read from `src/migrations`). The first start creates the tables and the admin.
4. The database is shared (Supabase), but the in-memory rate limiter is per process, so rate limits are per instance. Run one instance, or accept per-instance limits.
5. **Uploads are still files on disk** (`UPLOAD_DIR`), not in Supabase Storage. On hosts with an ephemeral disk (most free tiers and containers) uploaded photos and
   deliverables vanish on every deploy or restart: mount a persistent volume, or move uploads to object storage (Supabase Storage, S3) in a later change.

### Razorpay webhook

In the Razorpay dashboard: Settings > Webhooks > Add new webhook.
URL `https://<your domain>/api/payments/razorpay/webhook`, a secret of your choice (put the same value in `RAZORPAY_WEBHOOK_SECRET`),
events `payment.captured`, `order.paid` and `payment.failed`. The endpoint verifies `x-razorpay-signature` over the raw body and always answers 200 for
valid signatures (including duplicates), so it also rescues customers who close the tab before the browser calls verify.

## Backups

The data is the PostgreSQL database plus the upload folder.

- Database: use Supabase backups (Project Settings > Database > Backups: daily backups on paid plans, point-in-time recovery as an add-on), and/or take your own
  logical dump with `pg_dump`, using the **direct or session** connection string (port 5432, not the transaction pooler):
  `pg_dump "postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres" --no-owner -Fc -f backup/a2-$(date +%F).dump`
  Restore with `pg_restore --no-owner -d <target-url> backup/a2-YYYY-MM-DD.dump`. Dumps contain password hashes and customer data: store them encrypted.
- The embedded dev database (`server/data/pglite`) is disposable; copy the folder (with the server stopped) if you want a snapshot.
- Back up `UPLOAD_DIR` (`public/` and `private/`) with the same schedule (`rsync` or volume snapshots). `private/` holds customer photos and deliverables.
- Keep several days of backups off the machine, and test a restore once.
- Retention: visit events and call-back requests older than 90 days and expired/used reset tokens are deleted at start and every 24 hours.

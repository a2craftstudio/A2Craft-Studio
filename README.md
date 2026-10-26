# A2 Craft Studio

A Pinterest-inspired storefront for digital templates, animated videos, personalized gifts, invitations and memory books.

- **Frontend:** Angular 19 (standalone components, signals, lazy routes), in `src/`.
- **Backend:** Node.js + Express + TypeScript with a PostgreSQL database (Supabase in production, an embedded Postgres for local development), in `server/`. It owns authentication, the catalog, orders,
  Razorpay payments, file uploads/downloads, email and every admin action.
- **No static data.** The app ships with no products, categories, orders, reviews, demo accounts or sample photos. Everything on screen
  comes from the API and the database. A fresh install is an empty shop that you fill from the admin.

The API contract is in [`docs/API.md`](docs/API.md). Server details are in [`server/README.md`](server/README.md).

## Quick start

```bash
npm install                      # frontend
npm --prefix server install      # API
cp server/.env.example server/.env
```

Edit `server/.env` (at least `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`; see the table below), then:

```bash
npm run dev                      # API on :3100 + Angular on :4200 (proxied to the API)
```

Open http://localhost:4200 and sign in with the admin email and password from `server/.env`. The admin account is created on the API's first start
(or run `npm --prefix server run create-admin -- you@example.com 'a-strong-password' 'Your Name'`).

With `DATABASE_URL` empty, local development uses an embedded PostgreSQL (PGlite) stored in `server/data/pglite`: nothing to install. Set `DATABASE_URL` to use
a real Postgres such as Supabase (see **Connecting Supabase** below).

Tips for local development: set `PAYMENT_SIMULATOR=true` to test checkout without Razorpay, and set a fixed `JWT_SECRET` (otherwise a random one is
generated on every API restart and you are signed out each time). In `.env`, a `#` starts a comment, so avoid it in `ADMIN_PASSWORD` (or wrap the value in quotes).
The API uses port 3100 by default (change `PORT` and `proxy.conf.json` together).

To look inside the database (the one `server/.env` points to; the embedded one when `DATABASE_URL` is empty):

```bash
npm --prefix server run db                  # every table with its row count
npm --prefix server run db -- orders        # the newest rows of one table (password hashes are hidden)
```

With the embedded database, stop the API (`npm run dev`) first: it allows only one process at a time. With Supabase you can also use its Table Editor / SQL editor.

### Connecting Supabase

1. Supabase project > **Connect** > **Transaction pooler**: copy the connection string (`postgresql://postgres.<ref>:[YOUR-PASSWORD]@aws-0-<region>.pooler.supabase.com:6543/postgres`).
2. Put it in `server/.env` as `DATABASE_URL`, replacing `[YOUR-PASSWORD]` with your database password. **URL-encode special characters** in the password (`@` is `%40`, `#` is `%23`,
   `/` is `%2F`). A `#` also starts a comment in `.env`, so wrap the value in double quotes if it contains one.
3. Start the API. The **first start creates all tables and the admin account** from `ADMIN_EMAIL` / `ADMIN_PASSWORD`. If it stops with `self-signed certificate in certificate chain`,
   download Supabase's CA certificate (Project Settings > Database > SSL Configuration) and set `DATABASE_SSL_CA` to its path, or set `DATABASE_SSL=no-verify`.
4. **Security:** Supabase exposes `public` tables through its REST API using the public anon key. The schema enables Row Level Security with no policies on every table and revokes
   the `anon`/`authenticated` roles' privileges, so the API can read nothing; only this server (the `postgres` role) can. Keep it that way: never add policies casually, and never put the
   database password or the `service_role` key in the Angular app.

More in [`server/README.md`](server/README.md).

### First-run checklist (all in Admin)

1. **Settings:** business name, address, GSTIN, support email, opening hours, WhatsApp number (feeds the footer and every policy page).
2. **Categories:** press **Add suggested categories** for a ready-made set (you can rename, reorder and delete them) or add your own.
3. **Products:** add designs with photos, price, formats and the downloadable file; set status to Published.
4. **FAQ & About:** edit the built-in text to match how you really work.
5. Make a test purchase (see Payments).

## Configuration (`server/.env`)

| Variable | Purpose |
| --- | --- |
| `JWT_SECRET` | Signs login cookies. **Required in production**; use 32+ random characters. |
| `SITE_ORIGIN` | Public URL of the site (used in emails and CORS). |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | Creates the first admin when none exists. Remove the password afterwards. |
| `DATABASE_URL` | PostgreSQL connection string (Supabase: Transaction pooler). **Required in production.** Empty in development uses an embedded Postgres in `server/data/pglite`. URL-encode the password. |
| `DATABASE_SSL`, `DATABASE_SSL_CA`, `DATABASE_POOL_MAX` | TLS mode (`require` default for remote hosts, `no-verify`, `disable`), optional CA certificate file, pool size (default 10). |
| `UPLOAD_DIR` | Where uploads live (default `./storage`): `public/` for product photos, `private/` for files only served through signed links. |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Real payments. |
| `PAYMENT_SIMULATOR` | `true` enables a **test-only** payment simulator. Ignored (forced off) when `NODE_ENV=production`. |
| `RESEND_API_KEY`, `MAIL_FROM`, `OWNER_EMAIL` | Email (order receipts, delivery, inquiries, password reset). Without a key, emails are logged to the console. |
| `CLIENT_DIST` | Optional path to the Angular build for the server to serve (production). |

## Payments

- **Production / real testing:** create a Razorpay account (use *test mode* first), put the three values in `server/.env`, and in the Razorpay
  dashboard add a webhook to `https://YOUR-SITE/api/payments/razorpay/webhook` for `payment.captured`, `order.paid` and `payment.failed`
  (use the same secret as `RAZORPAY_WEBHOOK_SECRET`). Enable auto-capture. Every payment is verified on the server (signature, Razorpay lookup, amount),
  idempotently, and downloads unlock only after that.
- **Local development without Razorpay:** set `PAYMENT_SIMULATOR=true` (and not production). Checkout then shows a clearly labelled simulator with
  success / pending / failed / cancelled buttons. It cannot be enabled in production.
- Card details never touch this app.

## Deploy

```bash
npm run build:all                # Angular build + API build
NODE_ENV=production npm run start:prod
```

Put the Node server behind HTTPS (Caddy, nginx, a platform like Render/Railway/Fly). It serves the Angular app, the API, `/media` and signed `/files`
from one origin. Set `DATABASE_URL` to your Supabase string; the database is backed up by Supabase (Project Settings > Database > Backups) and/or `pg_dump`
(use the direct connection, port 5432). **Uploads are still files on disk** (`server/storage`, or `UPLOAD_DIR`): on hosts with an ephemeral disk mount a persistent volume
(or switch to object storage such as Supabase Storage later), and back that folder up too. Run `ng build` before starting so `CLIENT_DIST` exists.
Generate `sitemap.xml` with `node scripts/generate-sitemap.mjs` (set `SITE_URL`, and `API_URL` if the API is elsewhere).

## Tests

```bash
npm run test:all                 # Angular (Karma/Jasmine) + API (integration tests)
npm test                         # frontend only
npm run test:server              # API only
```

The API tests cover authentication, the authorization matrix for every admin route, server-side pricing and coupons, payment verification
(including replays and tampering), downloads, uploads, privacy of notes and phone numbers, and rate limits. Frontend tests cover the services,
the HTTP client (against a mocked `fetch`), components and the pure logic (search, opening hours, popularity, policy text).

## Project map

```
src/app/core        models, Backend contract, ApiBackend (HTTP client), services, search, opening hours, policy text, FAQ text
src/app/shared      product card, masonry, hero, quick view, search box, newsletter, reviews, toasts, welcome tour, cookie notice
src/app/layout      header (account menu), footer
src/app/pages       home, shop, product, studio, our work, custom order, cart, checkout, order, account, admin, contact, faq, legal
src/app/pages/admin dashboard, products, categories, orders, coupons, custom requests, call-backs, messages, reviews, customers, subscribers,
                    visitors, portfolio, FAQ & About, settings
src/testing         Backend test double and fixtures (tests only)
server/             the Node API (see server/README.md)
docs/API.md         the HTTP contract
```

## Running the business (admin guide)

The admin (`/admin`) has a menu on the left (a dropdown on phones). Numbers in red are things waiting for you.

| Task | Where | Flow |
| --- | --- | --- |
| See what needs doing | Dashboard | attention list, launch checklist, sales, top sellers, what people like most |
| Add a product | Products â†’ Add product | basics, price, organise, what the customer gets, photos/video, FAQ, visibility â†’ Save / Save and publish |
| Change many products | Products â†’ tick rows | Publish, Unpublish, Archive; Duplicate to start from an existing one |
| Fulfil a personalized/video order | Orders â†’ To make and deliver â†’ Details | read the brief and photos â†’ make it â†’ **Upload final file** â†’ the customer is emailed |
| Ready-made orders | automatic | files unlock the moment payment is verified |
| Quote a custom request | Custom requests | filter by status, spot overdue deadlines, reply by email, private note |
| Phone people back | Call-backs | visitors leave a number (none is published); Call now / WhatsApp, mark the result |
| Run a sale | Coupons + Settings | code with percent or flat amount, end date, maximum uses; mention it in the announcement bar |
| Publish testimonials | Reviews | verified buyers submit; approve to publish |
| Organise the shop | Categories | add, rename, reorder; a category in use can't be deleted |
| Edit FAQ and About | FAQ & About | edit in place; live immediately |
| Legal details once | Settings â†’ Business details | footer and every policy page |
| Opening hours | Settings â†’ Opening hours | live "online now" badge across the site |
| Newsletter | Subscribers | search, copy, export, remove |
| Numbers | Dashboard, Visitors | verified revenue, trends, likes, opt-in visitor journeys |

## Security model

- Prices, discounts and totals are computed **only on the server**. Payments are verified server-side and are idempotent.
- Sessions are `httpOnly` cookies; passwords are bcrypt-hashed; password reset links are single-use and expire in an hour.
- Every admin route is enforced on the server. Private notes and call-back phone numbers never leave admin routes.
- Private files (downloads, customer photos) are only reachable through short-lived signed links.
- No card data touches this app. No payment secrets exist in the Angular code.

## Decisions and limits

- **Prerendering/SSR:** the site is a client-rendered app that sets titles, meta, Open Graph and Product structured data per route. Add `@angular/ssr`
  if you need server-rendered previews for social crawlers.
- **Customization studio** shows a live SVG layout preview for text/photo products. It is a guide, not print-ready output: finals and all videos are made by hand.
- **Checkout requires an account** so downloads attach to it. Browsing, favourites (on the device until sign-in) and the bag work without one.
- **Policies** in `src/app/core/pages-content.ts` are templates. Have them reviewed for your business and Indian law before launch.
- **Not built:** GST tax invoices (a printable receipt exists), refunds from inside the app (refund in Razorpay, then mark the order refunded),
  and a customer email when a custom request is received (only you are emailed).

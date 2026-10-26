# A2 Craft Studio: HTTP API contract

The Angular app talks to a Node.js (Express + TypeScript + PostgreSQL) server through the JSON API below.
Types are the ones in `src/app/core/models.ts` (the server returns exactly those shapes, camelCase).
Nothing is static: no seeded products, orders, reviews or demo accounts. A fresh database is empty.

## Conventions

- Base path `/api`. Bodies and responses are JSON (`Content-Type: application/json`) except uploads (multipart) and the
  Razorpay webhook (raw body).
- **Errors**: HTTP status plus `{ "error": "Human readable message" }`. Use 400 validation, 401 not signed in, 403 forbidden,
  404 not found, 409 conflict, 413 too large, 429 rate limited, 500 unexpected (never leak stack traces or SQL).
- **Auth**: email + password. Session is a signed JWT in an `httpOnly`, `SameSite=Lax`, `Secure` (production) cookie named
  `a2_session` (7 days). Passwords are hashed with bcrypt (cost 12). Roles: `customer`, `admin`.
- **Same origin**: in production the Node server also serves the Angular build, `/media/*` (public uploads) and `/files/*`
  (signed private downloads). In development Angular's dev server proxies `/api`, `/media` and `/files` to the API.
- `/api/admin/**` requires an admin (403 for customers, 401 for anonymous). Authorization is enforced on the server only.
- All money is whole INR. Prices are **always** recomputed on the server from the database; client numbers are ignored.
- IDs: products, orders, reviews, events, portfolio projects are UUIDs. Categories use a slug (`wedding-invitations`).
  Inquiries `INQ-XXXXXX`, call-backs `CB-XXXXXX`, messages `MSG-XXXXXX` (6 random uppercase hex chars).
- Timestamps are ISO 8601 UTC strings.

## Config and auth

| Method & path | Auth | Body → Response |
| --- | --- | --- |
| `GET /api/config` | none | → `{ paymentProvider: 'razorpay' \| 'simulator', razorpayKeyId?: string }` |
| `GET /api/auth/me` | none | → `{ user: UserSession \| null }` |
| `POST /api/auth/signup` | none | `{ name, email, password }` → `{ user }` + sets cookie. 409 if the email exists. Password ≥ 8 chars. |
| `POST /api/auth/login` | none | `{ email, password }` → `{ user }` + cookie. 401 `Incorrect email or password.` (same message for unknown email) |
| `POST /api/auth/logout` | any | → 204, clears cookie |
| `POST /api/auth/forgot` | none | `{ email }` → 204 always (no account enumeration). Emails a single-use link `${SITE_ORIGIN}/account?reset=<token>` valid 1 hour. Store only a hash of the token. |
| `POST /api/auth/reset` | none | `{ token, password }` → `{ user }` + cookie. 400 if invalid/expired/used. |
| `PATCH /api/me` | user | `{ name }` → `{ user }` |
| `POST /api/me/password` | user | `{ password }` → 204 |

## Catalog

| Method & path | Auth | Notes |
| --- | --- | --- |
| `GET /api/products` | none | Published products only. Admin may pass `?all=1` for drafts and archived. → `Product[]` (with `gallery`, `tags`, `faq`). |
| `PUT /api/admin/products/:id` | admin | Body `Product` (id from URL). Upsert incl. gallery, tags, faq. Validates title, price ≥ 1, `originalPriceInr` only if > price, slug unique (409). → `Product` |
| `PUT /api/admin/products/:id/file` | admin | `{ path }` sets the private downloadable file (a path returned by `kind=file` upload). 204 |
| `GET /api/portfolio` | none | Published, ordered by `sortOrder`. Admin `?all=1` includes hidden. |
| `PUT /api/admin/portfolio/:id` | admin | Body `PortfolioProject`. Upsert. |
| `DELETE /api/admin/portfolio/:id` | admin | 204 |
| `GET /api/categories` | none | Ordered. → `Category[]` |
| `POST /api/admin/categories` | admin | Body `Category`. Empty `id` creates (id = slug of name, 409 if exists); non-empty updates. |
| `DELETE /api/admin/categories/:id` | admin | 409 `N product(s) still use this category. Move them first.` |
| `PUT /api/admin/categories-order` | admin | `{ ids: string[] }` sets order. 204 |

## Uploads and private files

- `POST /api/uploads?kind=media|file|reference` (multipart field `file`) → `{ path: string, url?: string }`
  - `media`: **admin**. image/* or video/*, ≤ 10 MB image / ≤ 100 MB video. Stored publicly; response `url` is `/media/<random-name>.<ext>`.
  - `file`: **admin**. Any type ≤ 200 MB. Private. Response `path` like `private/<random>-<safe-name>`.
  - `reference`: anyone (signed in or not), rate limited. JPG/PNG/WebP ≤ 5 MB, content sniffed (magic bytes), not just the extension. Private.
  - Reject others with 400/413. Never trust the client filename or MIME type; generate random names; no path traversal.
- `GET /api/uploads/sign?path=<private path>` → `{ url }` (**admin**), URL valid for 5 minutes.
- `GET /files/*?e=<expiry>&s=<hmac>` serves a private file when the HMAC over `path + expiry` is valid and unexpired; otherwise 403.
  Support `&dl=1` for `Content-Disposition: attachment`. `Cache-Control: private, no-store`.
- `GET /media/*` serves public uploads (long cache, `X-Content-Type-Options: nosniff`).

## Quote, orders and payments

`PaymentSession = { provider: 'razorpay' | 'simulator', orderId, providerOrderId?, amountPaise?, keyId? }`

| Method & path | Auth | Notes |
| --- | --- | --- |
| `POST /api/quote` | none | `{ items: CartItem[], coupon? }` → `Quote`. Published products only; `qty` clamped 1..10. |
| `POST /api/orders` | user | `{ items, coupon?, customer: { name, email, phone }, acceptedTerms }` → `PaymentSession`. Requires `acceptedTerms`; non-empty priced lines; valid email and phone (`^\+?[0-9\s-]{10,16}$`); invalid coupon → 400 with the quote's `couponMessage`. Creates order `pending` + items (title/unit price copied from the DB, `customization` JSON stored, string fields length-capped) and a payment row. Razorpay: create the order through Razorpay's REST API (amount total × 100 paise, `receipt` = order id) and return `providerOrderId`, `amountPaise`, `keyId`. |
| `POST /api/orders/:id/verify` | owner | Body: Razorpay `{ razorpay_order_id, razorpay_payment_id, razorpay_signature }` or simulator `{ outcome: 'success'\|'failed'\|'cancelled'\|'pending' }`. → `Order`. See rules below. |
| `GET /api/orders` | user | My orders (newest first). Never include `adminNote`. |
| `GET /api/orders/:id` | owner or admin | 404 for anyone else. `adminNote` only for admins. |
| `GET /api/orders/:id/download/:productId` | owner | → `{ url }` signed for 60 s. Rules below. |
| `GET /api/admin/orders` | admin | All orders, incl. `adminNote`. |
| `PATCH /api/admin/orders/:id` | admin | `{ status }`. A status of paid/in_progress/delivered/refunded requires `paymentVerified` (409). 204 |
| `PUT /api/admin/orders/:id/note` | admin | `{ note }` (≤ 2000 chars). 204 |
| `POST /api/admin/orders/:id/deliverables/:productId` | admin | multipart `file` (≤ 200 MB). Order must be payment-verified. Stores privately, upserts the deliverable, then sets the order `delivered` **only when every personalized item** (`customization` present) has a deliverable, and emails the customer. 204 |
| `POST /api/payments/razorpay/webhook` | HMAC | Raw body, header `x-razorpay-signature` = HMAC-SHA256(body, `RAZORPAY_WEBHOOK_SECRET`), compared in constant time. `payment.captured` / `order.paid` → mark paid (same idempotent function). `payment.failed` → status `failed` only if not verified and still pending. Always 200 for valid signatures, including duplicates. |

**Verify rules (Razorpay).** Order must belong to the caller. If already verified return the order unchanged (idempotent).
Check `HMAC_SHA256(secret, order_id + '|' + payment_id)` equals the signature (constant time) and that `razorpay_order_id`
matches the stored provider order id. Fetch the payment from Razorpay (`GET /v1/payments/:id`, basic auth) and require
`status === 'captured'`, `order_id` match and `amount === total × 100`. Then, in **one DB transaction**: insert the payment
(unique `provider_payment_id`), set `payment_verified = 1`, `status = 'paid'`, grant downloads, and increment the coupon's
`used_count` once. Replays never double-count. On signature failure return 400 and change nothing.

**Verify rules (simulator).** Only when `PAYMENT_SIMULATOR=true` **and** `NODE_ENV !== 'production'`; otherwise 403. `success` runs the same
mark-paid transaction; `failed`/`cancelled` set that status only if not already verified; `pending` changes nothing. A verified order is never changed.

**Download rules.** Order must be owned by the caller and `payment_verified`. If a deliverable exists for (order, product), return it.
Else if the product is customizable → 409 `This item is prepared by hand. We will email you as soon as your files are ready.`
Else if the product has a private file → return it; else 404 `No file is attached to this product yet.`

## Engagement, content and admin lists

| Method & path | Auth | Notes |
| --- | --- | --- |
| `GET /api/reviews?productId=` | none | Approved **and** consent-to-publish only. `authorName` is the author's first name (or `Customer`). |
| `GET /api/reviews/eligibility?productId=` | user | → `{ canReview }`: has a payment-verified order containing the product and no earlier review of it. |
| `POST /api/reviews` | user | `{ productId, rating 1..5, body 5..600 chars, consentToPublish }`. 403 if not eligible. Starts `approved = false`. 204 |
| `GET /api/admin/reviews` · `PATCH /api/admin/reviews/:id` `{ approved }` | admin | A review without consent cannot be approved (409). |
| `GET /api/admin/coupons` · `PUT /api/admin/coupons/:code` · `DELETE …/:code` | admin | Body `Coupon`. Code uppercased/trimmed; needs `percent` 1..100 **or** `flatInr` > 0; `minSubtotal` ≥ 0. `used` is read-only (kept on update). |
| `GET /api/admin/customers` | admin | `Customer[]` with paid-order count and spend (excluding refunded). |
| `GET /api/settings` | none | `SiteSettings` (public, so never store secrets). Defaults to empty strings when unset. |
| `PUT /api/admin/settings` | admin | Whole `SiteSettings`; validate hours (close after open) and email formats. |
| `POST /api/contact` | none | `{ name, email, message }` (message ≥ 10). → 204. Emails the owner. |
| `GET /api/admin/contacts` · `PATCH /api/admin/contacts/:id` `{ status }` | admin | |
| `POST /api/inquiries` | none (user attached if signed in) | `InquiryInput` (name, email, productType, occasion, deadline `YYYY-MM-DD` or '', budget, style, description ≥ 20, referenceImages: private paths from `kind=reference`, max 5). → `{ id }`. Emails the owner. |
| `GET /api/inquiries` | user | Mine, without `adminNote`. |
| `GET /api/admin/inquiries` · `PATCH /api/admin/inquiries/:id` `{ status }` · `PUT /api/admin/inquiries/:id/note` `{ note }` | admin | |
| `POST /api/callbacks` | none | `{ name, phone, topic, preferred, note }`. Phone digits 10..13. → 204. Emails the owner. Numbers are never returned by any public endpoint. |
| `GET /api/admin/callbacks` · `PATCH /api/admin/callbacks/:id` `{ status?, adminNote? }` | admin | |
| `POST /api/newsletter` | none | `{ email, consent: true }`; duplicates ignored (still 204). |
| `GET /api/admin/subscribers` · `DELETE /api/admin/subscribers?email=` | admin | |
| `GET /api/favorites` → `string[]` · `PUT/DELETE /api/favorites/:productId` | user | |
| `POST /api/events` | none | `{ visitorId, type: 'page'\|'product'\|'like', path, productId? }` → 204. Caller must have opted in (client rule). Attach `userId` if signed in. Ignore admin users, `/admin`, `/checkout`, `/order` paths. Max 300-char path. |
| `GET /api/admin/events` | admin | Last 30 days, newest first, max 5000, `userLabel` = the user's email when `userId` is set. |

Retention job (run at start and daily): delete events and call-back requests older than 90 days, expired password-reset tokens.

## Cross-cutting requirements

- `helmet`, JSON body limit 1 MB, `express-rate-limit` per IP on sensitive routes (auth 10/min, contact/inquiry/callback/newsletter 8/hour,
  reference uploads 20/hour, events 120/min, order create 10/min/user, verify 20/min/user). 429 `Too many requests. Please wait a moment and try again.`
- Validate **every** body/query with zod; trim and length-cap strings; reject unknown shapes with 400.
- SQL only through prepared statements (no string concatenation).
- Emails (Resend REST API via `fetch` when `RESEND_API_KEY` is set, otherwise logged to the console so development works): order paid
  (customer + owner), delivery ready, inquiry/contact/callback to owner, password reset. Escape all user text in HTML.
- A private studio note (`adminNote`) must never appear in any non-admin response.
- A visitor who is not signed in must never be able to read another person's order, inquiry, download or upload.
- Admin bootstrap: on start, if there is no admin and `ADMIN_EMAIL` + `ADMIN_PASSWORD` are set, create it. Also `npm run create-admin`.
- Never log passwords, tokens, signatures or full request bodies.

-- A2 Craft Studio: initial schema. Money is whole INR (integers). Timestamps are ISO-8601 UTC strings stored as TEXT
-- (the API returns them unchanged). Flags are 0/1 integers. PostgreSQL dialect (Supabase / PGlite).
--
-- SECURITY: Supabase exposes every table in the public schema through its REST Data API (anon key). Every table
-- below has ROW LEVEL SECURITY enabled with NO policies, so anon/authenticated can read nothing; the server connects
-- as the privileged postgres role (bypasses RLS). EVERY NEW TABLE IN A FUTURE MIGRATION MUST DO THE SAME (a test
-- fails otherwise).
-- No business data is seeded: a fresh database is empty.

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE CHECK (email = lower(email)),
  name          TEXT NOT NULL DEFAULT '',
  role          TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  password_hash TEXT NOT NULL,
  token_version INTEGER NOT NULL DEFAULT 0,       -- bumped on password change/reset; invalidates older sessions
  created_at    TEXT NOT NULL
);

-- Emails are stored lowercase (CHECK above); the lower() index keeps that true even if the CHECK is ever relaxed.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (lower(email));

CREATE TABLE IF NOT EXISTS password_resets (
  token_hash TEXT PRIMARY KEY,                    -- SHA-256 of the emailed token; the token itself is never stored
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  used_at    TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS password_resets_user_idx ON password_resets (user_id, created_at);

CREATE TABLE IF NOT EXISTS categories (
  id    TEXT PRIMARY KEY,                         -- slug
  name  TEXT NOT NULL,
  blurb TEXT NOT NULL DEFAULT '',
  motif TEXT NOT NULL DEFAULT 'floral',
  sort  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  seq BIGINT GENERATED ALWAYS AS IDENTITY,        -- insertion order: tie-breaker for equal created_at (replaces rowid)
  id                  TEXT PRIMARY KEY,
  slug                TEXT NOT NULL UNIQUE,
  title               TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 160),
  tagline             TEXT NOT NULL DEFAULT '',
  description         TEXT NOT NULL DEFAULT '',
  price_inr           INTEGER NOT NULL CHECK (price_inr > 0),
  original_price_inr  INTEGER CHECK (original_price_inr IS NULL OR original_price_inr > price_inr),
  category_id         TEXT NOT NULL REFERENCES categories(id),
  occasion            TEXT NOT NULL DEFAULT '',
  style               TEXT NOT NULL DEFAULT '',
  formats             TEXT NOT NULL DEFAULT '[]',  -- JSON string[]
  delivery            TEXT NOT NULL DEFAULT '',
  customizable        INTEGER NOT NULL DEFAULT 0,
  customization_kind  TEXT NOT NULL DEFAULT 'none' CHECK (customization_kind IN ('none', 'text', 'photo-text', 'video-request')),
  aspect              DOUBLE PRECISION NOT NULL DEFAULT 1.3,
  palette             TEXT NOT NULL DEFAULT '["#F2DDE1","#C78391"]', -- JSON [string,string]
  motif               TEXT NOT NULL DEFAULT 'floral',
  video_url           TEXT,
  license             TEXT NOT NULL DEFAULT '',
  faq                 TEXT NOT NULL DEFAULT '[]',  -- JSON {q,a}[]
  status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  featured            INTEGER NOT NULL DEFAULT 0,
  trending            INTEGER NOT NULL DEFAULT 0,
  bestseller          INTEGER NOT NULL DEFAULT 0,
  is_demo             INTEGER NOT NULL DEFAULT 0,
  created_at          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS products_status_idx ON products (status, created_at DESC);
CREATE INDEX IF NOT EXISTS products_category_idx ON products (category_id);

CREATE TABLE IF NOT EXISTS product_tags (
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  tag        TEXT NOT NULL,
  position   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, tag)
);

CREATE TABLE IF NOT EXISTS product_media (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url        TEXT NOT NULL,
  alt        TEXT NOT NULL DEFAULT '',
  kind       TEXT NOT NULL DEFAULT 'image' CHECK (kind IN ('image', 'video')),
  poster     TEXT,
  position   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS product_media_product_idx ON product_media (product_id, position);

-- Private downloadable file per product (a path like private/<random>-<name>). Never returned by public routes.
CREATE TABLE IF NOT EXISTS product_files (
  product_id TEXT PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  file_path  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS portfolio_projects (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  category     TEXT NOT NULL DEFAULT '',
  story        TEXT NOT NULL DEFAULT '',
  palette      TEXT NOT NULL DEFAULT '["#F2DDE1","#C78391"]',
  motif        TEXT NOT NULL DEFAULT 'frame',
  aspect       DOUBLE PRECISION NOT NULL DEFAULT 1.4,
  video_url    TEXT,
  before_after INTEGER NOT NULL DEFAULT 0,
  published    INTEGER NOT NULL DEFAULT 0,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  is_demo      INTEGER NOT NULL DEFAULT 0,
  image        TEXT
);
CREATE INDEX IF NOT EXISTS portfolio_sort_idx ON portfolio_projects (published, sort_order);

CREATE TABLE IF NOT EXISTS favorites (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS coupons (
  code         TEXT PRIMARY KEY CHECK (code = upper(code)),
  percent      INTEGER CHECK (percent IS NULL OR percent BETWEEN 1 AND 100),
  flat_inr     INTEGER CHECK (flat_inr IS NULL OR flat_inr > 0),
  min_subtotal INTEGER NOT NULL DEFAULT 0 CHECK (min_subtotal >= 0),
  active       INTEGER NOT NULL DEFAULT 1,
  ends_at      TEXT,                              -- YYYY-MM-DD, last valid day in India time
  max_uses     INTEGER CHECK (max_uses IS NULL OR max_uses >= 1),
  used_count   INTEGER NOT NULL DEFAULT 0,
  CHECK (percent IS NOT NULL OR flat_inr IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS orders (
  seq BIGINT GENERATED ALWAYS AS IDENTITY,        -- insertion order: tie-breaker for equal created_at (replaces rowid)
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id),
  email            TEXT NOT NULL,
  customer_name    TEXT NOT NULL DEFAULT '',
  phone            TEXT NOT NULL DEFAULT '',
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'paid', 'failed', 'cancelled', 'refunded', 'in_progress', 'delivered')),
  payment_verified INTEGER NOT NULL DEFAULT 0,
  subtotal         INTEGER NOT NULL,
  discount         INTEGER NOT NULL DEFAULT 0,
  total            INTEGER NOT NULL,
  coupon_code      TEXT REFERENCES coupons(code) ON DELETE SET NULL ON UPDATE CASCADE,
  created_at       TEXT NOT NULL,
  -- An order can never look paid/delivered unless a payment was verified server-side.
  CONSTRAINT paid_requires_verification
    CHECK (status NOT IN ('paid', 'in_progress', 'delivered', 'refunded') OR payment_verified = 1)
);
CREATE INDEX IF NOT EXISTS orders_user_idx ON orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status);
CREATE INDEX IF NOT EXISTS orders_created_idx ON orders (created_at DESC);

CREATE TABLE IF NOT EXISTS order_items (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id      TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id    TEXT NOT NULL REFERENCES products(id),
  title         TEXT NOT NULL,
  qty           INTEGER NOT NULL CHECK (qty BETWEEN 1 AND 10),
  unit_price    INTEGER NOT NULL,
  customization TEXT                               -- JSON, NULL when the item is not personalized
);
CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items (order_id);

CREATE TABLE IF NOT EXISTS payments (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id            TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider            TEXT NOT NULL CHECK (provider IN ('razorpay', 'simulator')),
  provider_order_id   TEXT,
  provider_payment_id TEXT UNIQUE,                 -- uniqueness makes verification + webhook idempotent
  status              TEXT NOT NULL,               -- created | captured
  amount_paise        INTEGER NOT NULL,
  raw                 TEXT,
  created_at          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS payments_order_idx ON payments (order_id);
CREATE INDEX IF NOT EXISTS payments_provider_order_idx ON payments (provider_order_id);

CREATE TABLE IF NOT EXISTS deliverables (
  order_id   TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id),
  file_path  TEXT NOT NULL,
  file_name  TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  PRIMARY KEY (order_id, product_id)
);

CREATE TABLE IF NOT EXISTS reviews (
  seq BIGINT GENERATED ALWAYS AS IDENTITY,        -- insertion order: tie-breaker for equal created_at (replaces rowid)
  id                 TEXT PRIMARY KEY,
  product_id         TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating             INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body               TEXT NOT NULL,
  consent_to_publish INTEGER NOT NULL DEFAULT 0,
  approved           INTEGER NOT NULL DEFAULT 0,
  created_at         TEXT NOT NULL,
  UNIQUE (product_id, user_id),
  CHECK (approved = 0 OR consent_to_publish = 1)
);
CREATE INDEX IF NOT EXISTS reviews_product_idx ON reviews (product_id, approved);

CREATE TABLE IF NOT EXISTS inquiries (
  seq BIGINT GENERATED ALWAYS AS IDENTITY,        -- insertion order: tie-breaker for equal created_at (replaces rowid)
  id               TEXT PRIMARY KEY,               -- INQ-XXXXXX
  user_id          TEXT REFERENCES users(id) ON DELETE SET NULL,
  name             TEXT NOT NULL,
  email            TEXT NOT NULL,
  product_type     TEXT NOT NULL,
  occasion         TEXT NOT NULL DEFAULT '',
  deadline         TEXT NOT NULL DEFAULT '',
  budget           TEXT NOT NULL DEFAULT '',
  style            TEXT NOT NULL DEFAULT '',
  description      TEXT NOT NULL,
  reference_images TEXT NOT NULL DEFAULT '[]',     -- JSON private paths
  status           TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'quoted', 'completed', 'declined')),
  created_at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS inquiries_user_idx ON inquiries (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS inquiries_created_idx ON inquiries (created_at DESC);

CREATE TABLE IF NOT EXISTS callback_requests (
  seq BIGINT GENERATED ALWAYS AS IDENTITY,        -- insertion order: tie-breaker for equal created_at (replaces rowid)
  id         TEXT PRIMARY KEY,                     -- CB-XXXXXX
  name       TEXT NOT NULL,
  phone      TEXT NOT NULL,
  topic      TEXT NOT NULL DEFAULT '',
  preferred  TEXT NOT NULL DEFAULT '',
  note       TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'called', 'no_answer')),
  admin_note TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS callback_requests_created_idx ON callback_requests (created_at);

CREATE TABLE IF NOT EXISTS contact_messages (
  seq BIGINT GENERATED ALWAYS AS IDENTITY,        -- insertion order: tie-breaker for equal created_at (replaces rowid)
  id         TEXT PRIMARY KEY,                     -- MSG-XXXXXX
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  message    TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'replied')),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS contact_messages_created_idx ON contact_messages (created_at DESC);

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  email      TEXT PRIMARY KEY CHECK (email = lower(email)),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS visit_events (
  seq BIGINT GENERATED ALWAYS AS IDENTITY,        -- insertion order: tie-breaker for equal created_at (replaces rowid)
  id         TEXT PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  user_id    TEXT REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('page', 'product', 'like')),
  path       TEXT NOT NULL CHECK (length(path) <= 300),
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS visit_events_time_idx ON visit_events (created_at DESC);

-- Single row of owner-edited, publicly readable settings (never store secrets here).
CREATE TABLE IF NOT EXISTS site_settings (
  id   INTEGER PRIMARY KEY CHECK (id = 1),
  data TEXT NOT NULL DEFAULT '{}'
);
INSERT INTO site_settings (id, data) VALUES (1, '{}') ON CONFLICT (id) DO NOTHING;

-- Private studio notes live here, NOT as columns on orders/inquiries, so no customer query can ever select them.
CREATE TABLE IF NOT EXISTS admin_notes (
  kind       TEXT NOT NULL CHECK (kind IN ('order', 'inquiry')),
  target_id  TEXT NOT NULL,
  note       TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (kind, target_id)
);

-- ---------------------------------------------------------------- Row Level Security (no policies = no access)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE callback_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_notes ENABLE ROW LEVEL SECURITY;

-- Supabase's API roles get no privileges on anything in public, now or in the future. Guarded so this also runs on
-- plain PostgreSQL / PGlite, where these roles do not exist.
DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I', r);
    END IF;
  END LOOP;
END $$;

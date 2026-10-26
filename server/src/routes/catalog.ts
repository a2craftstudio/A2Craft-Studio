import { Router } from 'express';
import { z } from 'zod';
import type { Ctx } from '../context.js';
import { isUniqueError, nowIso, type Db } from '../db.js';
import { badRequest, conflict, notFound } from '../errors.js';
import { ah } from '../middleware/async.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { flag, mediaUrl, motif, palette, privatePath, text, textOpt, uuidStr } from '../schemas.js';
import { privateFile } from '../services/files.js';
import { bool, slugify } from '../util.js';
import fs from 'node:fs';

// ---------------------------------------------------------------- shapes
interface ProductRow {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  description: string;
  price_inr: number;
  original_price_inr: number | null;
  category_id: string;
  occasion: string;
  style: string;
  formats: string;
  delivery: string;
  customizable: number;
  customization_kind: string;
  aspect: number;
  palette: string;
  motif: string;
  video_url: string | null;
  license: string;
  faq: string;
  status: string;
  featured: number;
  trending: number;
  bestseller: number;
  is_demo: number;
  created_at: string;
}

export async function loadProducts(db: Db, opts: { publishedOnly: boolean; id?: string }) {
  const where = opts.id ? 'WHERE id = ?' : opts.publishedOnly ? "WHERE status = 'published'" : '';
  const params = opts.id ? [opts.id] : [];
  const rows = await db.all<ProductRow>(`SELECT * FROM products ${where} ORDER BY created_at DESC, seq DESC`, ...params);
  const scope = opts.id ? 'product_id = ?' : opts.publishedOnly ? "product_id IN (SELECT id FROM products WHERE status = 'published')" : '1 = 1';
  const tags = await db.all<{ product_id: string; tag: string }>(`SELECT product_id, tag FROM product_tags WHERE ${scope} ORDER BY position`, ...params);
  const media = await db.all<{ product_id: string; url: string; alt: string; kind: 'image' | 'video'; poster: string | null }>(
    `SELECT product_id, url, alt, kind, poster FROM product_media WHERE ${scope} ORDER BY position, id`,
    ...params,
  );
  const tagMap = new Map<string, string[]>();
  for (const t of tags) (tagMap.get(t.product_id) ?? tagMap.set(t.product_id, []).get(t.product_id)!).push(t.tag);
  const mediaMap = new Map<string, { url: string; alt: string; kind: 'image' | 'video'; poster?: string }[]>();
  for (const m of media) {
    const list = mediaMap.get(m.product_id) ?? mediaMap.set(m.product_id, []).get(m.product_id)!;
    list.push({ url: m.url, alt: m.alt, kind: m.kind, ...(m.poster ? { poster: m.poster } : {}) });
  }
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    tagline: r.tagline,
    description: r.description,
    priceInr: r.price_inr,
    ...(r.original_price_inr != null ? { originalPriceInr: r.original_price_inr } : {}),
    category: r.category_id,
    tags: tagMap.get(r.id) ?? [],
    occasion: r.occasion,
    style: r.style,
    formats: JSON.parse(r.formats) as string[],
    delivery: r.delivery,
    customizable: bool(r.customizable),
    customizationKind: r.customization_kind,
    aspect: r.aspect,
    palette: JSON.parse(r.palette) as [string, string],
    motif: r.motif,
    gallery: mediaMap.get(r.id) ?? [],
    ...(r.video_url ? { videoUrl: r.video_url } : {}),
    license: r.license,
    faq: JSON.parse(r.faq) as { q: string; a: string }[],
    status: r.status,
    featured: bool(r.featured),
    trending: bool(r.trending),
    bestseller: bool(r.bestseller),
    isDemo: bool(r.is_demo),
    createdAt: r.created_at,
  }));
}

const productBody = z
  .object({
    id: z.string().optional(),
    slug: text(120).regex(/^([a-z0-9]+(-[a-z0-9]+)*)?$/, 'The slug can only use lowercase letters, numbers and dashes.').optional().default(''),
    title: text(160, 1, 'Please enter a title.'),
    tagline: textOpt(300),
    description: textOpt(5000),
    priceInr: z.number({ invalid_type_error: 'Price must be a number.' }).int('Price must be a whole number of rupees.').min(1, 'Price must be at least ₹1.').max(10_000_000),
    originalPriceInr: z.number().int().min(0).max(10_000_000).nullish(),
    category: text(80, 1, 'Please choose a category.'),
    tags: z.array(text(40, 1)).max(20).default([]),
    occasion: textOpt(120),
    style: textOpt(120),
    formats: z.array(text(40, 1)).max(20).default([]),
    delivery: textOpt(300),
    customizable: z.boolean().default(false),
    customizationKind: z.enum(['none', 'text', 'photo-text', 'video-request']).default('none'),
    aspect: z.number().min(0.3).max(4).default(1.3),
    palette: palette.default(['#F2DDE1', '#C78391']),
    motif: motif.default('floral'),
    gallery: z
      .array(z.object({ url: mediaUrl, alt: textOpt(200), kind: z.enum(['image', 'video']), poster: mediaUrl.nullish() }).strict())
      .max(20)
      .default([]),
    videoUrl: mediaUrl.nullish().or(z.literal('')),
    license: textOpt(500),
    faq: z.array(z.object({ q: text(300, 1), a: text(2000) }).strict()).max(30).default([]),
    status: z.enum(['draft', 'published', 'archived']).default('draft'),
    featured: z.boolean().default(false),
    trending: z.boolean().default(false),
    bestseller: z.boolean().default(false),
    isDemo: z.boolean().default(false),
    createdAt: z.string().optional(),
  })
  .strict();

const portfolioBody = z
  .object({
    id: z.string().optional(),
    title: text(160, 1, 'Please enter a title.'),
    category: textOpt(120),
    story: textOpt(3000),
    palette: palette.default(['#F2DDE1', '#C78391']),
    motif: motif.default('frame'),
    aspect: z.number().min(0.3).max(4).default(1.4),
    videoUrl: mediaUrl.nullish().or(z.literal('')),
    beforeAfter: z.boolean().default(false),
    published: z.boolean().default(false),
    sortOrder: z.number().int().min(-100000).max(100000).default(0),
    isDemo: z.boolean().default(false),
    image: mediaUrl.nullish().or(z.literal('')),
  })
  .strict();

const categoryBody = z
  .object({
    id: z.string().trim().max(80).optional().default(''),
    name: text(80, 1, 'A category needs a name.'),
    motif: motif.default('floral'),
    blurb: textOpt(300),
  })
  .strict();

const allQuery = z.object({ all: flag });
const uuidParam = z.object({ id: uuidStr });

function categoryRow(db: Db, id: string) {
  return db.get<{ id: string; name: string; motif: string; blurb: string }>('SELECT id, name, motif, blurb FROM categories WHERE id = ?', id);
}

/** Public catalog reads: products, portfolio, categories. */
export function catalogRoutes(ctx: Ctx): Router {
  const { db } = ctx;
  const r = Router();

  r.get('/products', validateQuery(allQuery), ah(async (req, res) => {
    const all = (req.query as { all?: string }).all && req.user?.role === 'admin';
    res.json(await loadProducts(db, { publishedOnly: !all }));
  }));

  r.get('/portfolio', validateQuery(allQuery), ah(async (req, res) => {
    const all = (req.query as { all?: string }).all && req.user?.role === 'admin';
    res.json(await listPortfolio(db, !!all));
  }));

  r.get('/categories', ah(async (_req, res) => {
    res.json(await db.all('SELECT id, name, motif, blurb FROM categories ORDER BY sort, name'));
  }));

  return r;
}

interface PortfolioRow {
  id: string;
  title: string;
  category: string;
  story: string;
  palette: string;
  motif: string;
  aspect: number;
  video_url: string | null;
  before_after: number;
  published: number;
  sort_order: number;
  is_demo: number;
  image: string | null;
}
const portfolioOut = (p: PortfolioRow) => ({
  id: p.id,
  title: p.title,
  category: p.category,
  story: p.story,
  palette: JSON.parse(p.palette) as [string, string],
  motif: p.motif,
  aspect: p.aspect,
  ...(p.video_url ? { videoUrl: p.video_url } : {}),
  beforeAfter: bool(p.before_after),
  published: bool(p.published),
  sortOrder: p.sort_order,
  isDemo: bool(p.is_demo),
  ...(p.image ? { image: p.image } : {}),
});
async function listPortfolio(db: Db, all: boolean) {
  return (await db.all<PortfolioRow>(`SELECT * FROM portfolio_projects ${all ? '' : 'WHERE published = 1'} ORDER BY sort_order, title, id`)).map(portfolioOut);
}

/** Admin catalog writes (mounted under /api/admin, behind the admin guard). */
export function adminCatalogRoutes(ctx: Ctx): Router {
  const { db, config } = ctx;
  const r = Router();

  // ---- products
  r.put('/products/:id', validateBody(productBody), ah(async (req, res) => {
    const id = uuidParam.safeParse(req.params);
    if (!id.success) throw badRequest('Product ids must be UUIDs.');
    const pid = id.data.id;
    const b = req.body as z.infer<typeof productBody>;
    if (b.id && b.id.toLowerCase() !== pid) throw badRequest('The id in the body does not match the URL.');
    if (b.originalPriceInr != null && b.originalPriceInr > 0 && b.originalPriceInr <= b.priceInr) {
      throw badRequest('The original price must be higher than the price, or left empty.');
    }
    const original = b.originalPriceInr && b.originalPriceInr > 0 ? b.originalPriceInr : null;
    if (!(await categoryRow(db, b.category))) throw badRequest('Please choose an existing category.');
    const slug = b.slug || slugify(b.title);
    if (!slug) throw badRequest('Please give the product a slug.');
    if (await db.get('SELECT 1 AS x FROM products WHERE slug = ? AND id <> ?', slug, pid)) throw conflict('Another product already uses that slug.');

    try {
      await db.tx(async () => {
        const exists = await db.get('SELECT 1 AS x FROM products WHERE id = ?', pid);
        const cols = [slug, b.title, b.tagline, b.description, b.priceInr, original, b.category, b.occasion, b.style, JSON.stringify(b.formats), b.delivery, b.customizable ? 1 : 0, b.customizationKind, b.aspect, JSON.stringify(b.palette), b.motif, b.videoUrl || null, b.license, JSON.stringify(b.faq), b.status, b.featured ? 1 : 0, b.trending ? 1 : 0, b.bestseller ? 1 : 0, b.isDemo ? 1 : 0] as const;
        if (exists) {
          await db.run(
            `UPDATE products SET slug=?, title=?, tagline=?, description=?, price_inr=?, original_price_inr=?, category_id=?, occasion=?, style=?, formats=?, delivery=?, customizable=?, customization_kind=?, aspect=?, palette=?, motif=?, video_url=?, license=?, faq=?, status=?, featured=?, trending=?, bestseller=?, is_demo=? WHERE id=?`,
            ...cols,
            pid,
          );
        } else {
          await db.run(
            `INSERT INTO products (slug, title, tagline, description, price_inr, original_price_inr, category_id, occasion, style, formats, delivery, customizable, customization_kind, aspect, palette, motif, video_url, license, faq, status, featured, trending, bestseller, is_demo, id, created_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            ...cols,
            pid,
            nowIso(),
          );
        }
        await db.run('DELETE FROM product_tags WHERE product_id = ?', pid);
        for (const [i, t] of [...new Set(b.tags)].entries()) await db.run('INSERT INTO product_tags (product_id, tag, position) VALUES (?, ?, ?)', pid, t, i);
        await db.run('DELETE FROM product_media WHERE product_id = ?', pid);
        for (const [i, m] of b.gallery.entries()) await db.run('INSERT INTO product_media (product_id, url, alt, kind, poster, position) VALUES (?, ?, ?, ?, ?, ?)', pid, m.url, m.alt, m.kind, m.poster ?? null, i);
      });
    } catch (e) {
      if (isUniqueError(e)) throw conflict('Another product already uses that slug.');
      throw e;
    }
    res.json((await loadProducts(db, { publishedOnly: false, id: pid }))[0]);
  }));

  const fileBody = z.object({ path: privatePath }).strict();
  r.put('/products/:id/file', validateBody(fileBody), ah(async (req, res) => {
    const id = uuidParam.safeParse(req.params);
    if (!id.success || !(await db.get('SELECT 1 AS x FROM products WHERE id = ?', id.data.id))) throw notFound('Product not found.');
    const { path: p } = req.body as z.infer<typeof fileBody>;
    const abs = privateFile(config, p);
    if (!abs || !fs.existsSync(abs)) throw badRequest('That file has not been uploaded.');
    await db.run('INSERT INTO product_files (product_id, file_path) VALUES (?, ?) ON CONFLICT(product_id) DO UPDATE SET file_path = excluded.file_path', id.data.id, p);
    res.status(204).end();
  }));

  // ---- portfolio
  r.put('/portfolio/:id', validateBody(portfolioBody), ah(async (req, res) => {
    const id = uuidParam.safeParse(req.params);
    if (!id.success) throw badRequest('Portfolio ids must be UUIDs.');
    const b = req.body as z.infer<typeof portfolioBody>;
    if (b.id && b.id.toLowerCase() !== id.data.id) throw badRequest('The id in the body does not match the URL.');
    await db.run(
      `INSERT INTO portfolio_projects (id, title, category, story, palette, motif, aspect, video_url, before_after, published, sort_order, is_demo, image)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET title=excluded.title, category=excluded.category, story=excluded.story, palette=excluded.palette, motif=excluded.motif,
         aspect=excluded.aspect, video_url=excluded.video_url, before_after=excluded.before_after, published=excluded.published,
         sort_order=excluded.sort_order, is_demo=excluded.is_demo, image=excluded.image`,
      id.data.id, b.title, b.category, b.story, JSON.stringify(b.palette), b.motif, b.aspect, b.videoUrl || null, b.beforeAfter ? 1 : 0, b.published ? 1 : 0, b.sortOrder, b.isDemo ? 1 : 0, b.image || null,
    );
    res.json(portfolioOut((await db.get<PortfolioRow>('SELECT * FROM portfolio_projects WHERE id = ?', id.data.id))!));
  }));

  r.delete('/portfolio/:id', ah(async (req, res) => {
    const id = uuidParam.safeParse(req.params);
    if (!id.success || (await db.run('DELETE FROM portfolio_projects WHERE id = ?', id.data.id)).changes === 0) throw notFound('Project not found.');
    res.status(204).end();
  }));

  // ---- categories
  r.post('/categories', validateBody(categoryBody), ah(async (req, res) => {
    const b = req.body as z.infer<typeof categoryBody>;
    if (!b.id) {
      const id = slugify(b.name);
      if (!id) throw badRequest('Please use letters or numbers in the category name.');
      if (await categoryRow(db, id)) throw conflict('A category with that name already exists.');
      const next = ((await db.get<{ m: number | null }>('SELECT MAX(sort) AS m FROM categories'))?.m ?? 0) + 1;
      try {
        await db.run('INSERT INTO categories (id, name, blurb, motif, sort) VALUES (?, ?, ?, ?, ?)', id, b.name, b.blurb, b.motif, next);
      } catch (e) {
        if (isUniqueError(e)) throw conflict('A category with that name already exists.');
        throw e;
      }
      res.json(await categoryRow(db, id));
      return;
    }
    if (!(await categoryRow(db, b.id))) throw notFound('Category not found.');
    await db.run('UPDATE categories SET name = ?, blurb = ?, motif = ? WHERE id = ?', b.name, b.blurb, b.motif, b.id);
    res.json(await categoryRow(db, b.id));
  }));

  r.delete('/categories/:id', ah(async (req, res) => {
    const id = String(req.params['id']);
    if (!(await categoryRow(db, id))) throw notFound('Category not found.');
    const used = (await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM products WHERE category_id = ?', id))!.n;
    if (used) throw conflict(`${used} product(s) still use this category. Move them first.`);
    await db.run('DELETE FROM categories WHERE id = ?', id);
    res.status(204).end();
  }));

  const orderBody = z.object({ ids: z.array(z.string().trim().min(1).max(80)).max(200) }).strict();
  r.put('/categories-order', validateBody(orderBody), ah(async (req, res) => {
    const { ids } = req.body as z.infer<typeof orderBody>;
    const known = new Set((await db.all<{ id: string }>('SELECT id FROM categories')).map((c) => c.id));
    if (new Set(ids).size !== ids.length || ids.some((i) => !known.has(i))) throw badRequest('The order must list each existing category once.');
    await db.tx(async () => {
      for (const [i, id] of ids.entries()) await db.run('UPDATE categories SET sort = ? WHERE id = ?', i + 1, id);
      // Categories not mentioned keep their relative order after the listed ones.
      const rest = (await db.all<{ id: string }>('SELECT id FROM categories ORDER BY sort, name')).filter((c) => !ids.includes(c.id));
      for (const [i, c] of rest.entries()) await db.run('UPDATE categories SET sort = ? WHERE id = ?', ids.length + i + 1, c.id);
    });
    res.status(204).end();
  }));

  return r;
}

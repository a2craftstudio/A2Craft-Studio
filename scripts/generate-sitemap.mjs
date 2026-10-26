// Generates public/sitemap.xml from the live API. Usage:
//   SITE_URL=https://your-domain.com API_URL=https://your-domain.com node scripts/generate-sitemap.mjs
// API_URL defaults to SITE_URL. If the API is unreachable only the static pages are listed.
import { writeFileSync } from 'node:fs';

const site = (process.env.SITE_URL ?? 'https://example.com').replace(/\/$/, '');
const api = (process.env.API_URL ?? site).replace(/\/$/, '');
const pages = ['', '/shop', '/our-work', '/custom-order', '/about', '/faq', '/contact', '/privacy', '/terms', '/delivery', '/refunds', '/licensing', '/custom-terms', '/cookies', '/grievance', '/takedown', '/accessibility'];
let slugs = [];

try {
  const res = await fetch(`${api}/api/products`);
  if (!res.ok) throw new Error(`API responded ${res.status}`);
  slugs = (await res.json()).map((p) => p.slug);
} catch (e) {
  console.warn(`Could not read products from ${api}: ${e.message}. Listing static pages only.`);
}

const urls = [...pages, ...slugs.map((s) => `/product/${s}`)];
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
  .map((u) => `  <url><loc>${site}${u}</loc></url>`)
  .join('\n')}\n</urlset>\n`;
writeFileSync(new URL('../public/sitemap.xml', import.meta.url), xml);
console.log(`Wrote ${urls.length} URLs to public/sitemap.xml`);

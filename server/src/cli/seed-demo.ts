import 'dotenv/config';
import crypto from 'node:crypto';

// Usage:  npm run seed:demo                                  fills the local API (http://localhost:3100)
//         SEED_URL=https://your-site.onrender.com SEED_EMAIL=you@example.com SEED_PASSWORD='...' npm run seed:demo
// Adds demo categories, products, portfolio projects and coupons through the admin API, marked "demo" so they are easy to spot.
// Safe to run again: every item has a fixed id, so a second run updates the same rows instead of duplicating them.
// Covers are drawn from each item's palette and motif; replace them with real photos in the admin area whenever you like.

const BASE = (process.env['SEED_URL'] ?? `http://localhost:${process.env['PORT'] ?? 3100}`).replace(/\/+$/, '');
const EMAIL = process.env['SEED_EMAIL'] ?? process.env['SUPERADMIN_EMAIL'] ?? process.env['ADMIN_EMAIL'] ?? '';
const PASSWORD = process.env['SEED_PASSWORD'] ?? process.env['SUPERADMIN_PASSWORD'] ?? process.env['ADMIN_PASSWORD'] ?? '';

type Motif = 'cake' | 'lamp' | 'floral' | 'hearts' | 'book' | 'frame' | 'story' | 'letter' | 'video' | 'card' | 'rings';
type Kind = 'none' | 'text' | 'photo-text' | 'video-request';
type Pal = [string, string];

const BLUSH: Pal = ['#F2DDE1', '#C78391'];
const BERRY: Pal = ['#71394E', '#F2DDE1'];
const IVORY: Pal = ['#FFF9F5', '#C78391'];
const COCOA: Pal = ['#473633', '#F2DDE1'];
const SAGE: Pal = ['#E3EBDD', '#6F8F72'];
const GOLD: Pal = ['#FBF1D9', '#B8860B'];
const SKY: Pal = ['#E1EEF7', '#4A7FA7'];
const PEACH: Pal = ['#FDE5D8', '#E0805A'];

const CATEGORIES: { id: string; name: string; blurb: string; motif: Motif }[] = [
  { id: 'wedding-invitations', name: 'Wedding invitations', blurb: 'Elegant suites for your big day', motif: 'frame' },
  { id: 'birthday-invitations', name: 'Birthday invitations', blurb: 'Party-ready invites', motif: 'cake' },
  { id: 'animated-video-invitations', name: 'Animated video invitations', blurb: 'Invites that move', motif: 'video' },
  { id: 'memory-books', name: 'Memory books', blurb: 'Stories worth keeping', motif: 'book' },
  { id: 'digital-scrapbooks', name: 'Digital scrapbooks', blurb: 'Layered memories, beautifully arranged', motif: 'frame' },
  { id: 'couple-gifts', name: 'Couple gifts', blurb: 'Little things that say “us”', motif: 'hearts' },
  { id: 'anniversary', name: 'Anniversary', blurb: 'Celebrate every year together', motif: 'rings' },
  { id: 'instagram-story-templates', name: 'Instagram story templates', blurb: 'Scroll-stopping story layouts', motif: 'story' },
];

interface Prod {
  title: string; tagline: string; description: string; price: number; was?: number; category: string; tags: string[];
  occasion: string; style: string; formats: string[]; delivery: string; kind: Kind; motif: Motif; palette: Pal; aspect: number;
  flags?: { featured?: boolean; trending?: boolean; bestseller?: boolean };
}

const READY = 'Instant download after payment';
const MADE = 'Made by hand and delivered within 2 to 3 days';
const FAQ = (extra?: { q: string; a: string }) => [
  { q: 'Can I edit the details?', a: 'Yes. Ready-made designs open in common free editors. For personalized items, tell us what to change and we update it for you.' },
  { q: 'How will I receive it?', a: 'A download link appears in your account and arrives by email as soon as the order is complete.' },
  ...(extra ? [extra] : []),
];

const PRODUCTS: Prod[] = [
  { title: 'Blush Floral Wedding Invitation', tagline: 'Soft watercolor florals on warm ivory', description: 'A romantic one-page invitation with hand-painted blooms. Includes matching RSVP and details cards.', price: 499, was: 699, category: 'wedding-invitations', tags: ['wedding', 'floral', 'printable'], occasion: 'Wedding', style: 'Floral', formats: ['PDF', 'PNG'], delivery: READY, kind: 'none', motif: 'floral', palette: BLUSH, aspect: 1.4, flags: { featured: true, bestseller: true } },
  { title: 'Golden Rings Save the Date', tagline: 'Minimal gold linework', description: 'A clean save-the-date for modern couples, sized for print and phone screens.', price: 349, category: 'wedding-invitations', tags: ['wedding', 'minimal', 'gold'], occasion: 'Wedding', style: 'Minimal', formats: ['PDF', 'PNG'], delivery: READY, kind: 'none', motif: 'rings', palette: GOLD, aspect: 1.3 },
  { title: 'Custom Wedding Invitation Suite', tagline: 'Designed around your names and colors', description: 'We design your invitation, RSVP and details card from your brief, with two rounds of changes.', price: 1499, category: 'wedding-invitations', tags: ['wedding', 'custom', 'suite'], occasion: 'Wedding', style: 'Custom', formats: ['PDF', 'PNG'], delivery: MADE, kind: 'text', motif: 'frame', palette: IVORY, aspect: 1.4, flags: { trending: true } },
  { title: 'Sweet Cake Birthday Invite', tagline: 'Playful pastel party card', description: 'A cheerful invite you can edit and share in minutes. Works for kids and adults.', price: 249, category: 'birthday-invitations', tags: ['birthday', 'party', 'pastel'], occasion: 'Birthday', style: 'Playful', formats: ['PDF', 'PNG', 'JPG'], delivery: READY, kind: 'none', motif: 'cake', palette: PEACH, aspect: 1.2, flags: { bestseller: true } },
  { title: 'Baby Shower Invite', tagline: 'Gentle sage and cream', description: 'A calm, modern invitation for baby showers and welcome parties.', price: 299, category: 'birthday-invitations', tags: ['baby shower', 'sage', 'printable'], occasion: 'Baby shower', style: 'Minimal', formats: ['PDF', 'PNG'], delivery: READY, kind: 'none', motif: 'floral', palette: SAGE, aspect: 1.3 },
  { title: 'Animated Birthday Video Invitation', tagline: 'A 20-second invite that moves', description: 'Send us the name, date and a few photos. We animate a vertical video invitation, ready for WhatsApp and Instagram.', price: 999, was: 1299, category: 'animated-video-invitations', tags: ['video', 'birthday', 'whatsapp'], occasion: 'Birthday', style: 'Animated', formats: ['MP4'], delivery: MADE, kind: 'video-request', motif: 'video', palette: BERRY, aspect: 0.56, flags: { featured: true, trending: true } },
  { title: 'Animated Wedding Video Invite', tagline: 'Floral reveal with music', description: 'A cinematic wedding invitation with your names, date and venue animated over soft florals.', price: 1799, category: 'animated-video-invitations', tags: ['video', 'wedding', 'music'], occasion: 'Wedding', style: 'Animated', formats: ['MP4'], delivery: MADE, kind: 'video-request', motif: 'video', palette: BLUSH, aspect: 0.56, flags: { trending: true } },
  { title: 'Our Story Memory Book', tagline: 'Pages of your favorite moments', description: 'A personalized digital book that tells your story in photos and words. Share your photos and messages, we lay it all out.', price: 1299, category: 'memory-books', tags: ['memory book', 'photos', 'gift'], occasion: 'Anniversary', style: 'Story', formats: ['PDF'], delivery: MADE, kind: 'photo-text', motif: 'book', palette: COCOA, aspect: 1.1, flags: { bestseller: true, featured: true } },
  { title: 'Birthday Memory Book', tagline: 'A year of reasons we love you', description: 'A heartfelt book of messages and photos, a gift that is easy to send from anywhere.', price: 899, category: 'memory-books', tags: ['birthday', 'photos', 'messages'], occasion: 'Birthday', style: 'Story', formats: ['PDF'], delivery: MADE, kind: 'photo-text', motif: 'book', palette: BLUSH, aspect: 1.1 },
  { title: 'Travel Scrapbook', tagline: 'Trips in layers and textures', description: 'A layered digital scrapbook for a trip, made from your photos with maps, tickets and handwritten notes.', price: 799, category: 'digital-scrapbooks', tags: ['scrapbook', 'travel', 'photos'], occasion: 'Any', style: 'Collage', formats: ['PDF', 'PNG'], delivery: MADE, kind: 'photo-text', motif: 'frame', palette: SKY, aspect: 1.2 },
  { title: 'Wedding Day Scrapbook', tagline: 'The whole day on a few pages', description: 'Your wedding moments arranged into a beautiful scrapbook you can print or share.', price: 1199, category: 'digital-scrapbooks', tags: ['scrapbook', 'wedding', 'keepsake'], occasion: 'Wedding', style: 'Collage', formats: ['PDF'], delivery: MADE, kind: 'photo-text', motif: 'frame', palette: IVORY, aspect: 1.2 },
  { title: 'Love Letter Poster', tagline: 'Your words, beautifully set', description: 'A printable poster with your message in elegant lettering. Type your text and we prepare the final file.', price: 449, category: 'couple-gifts', tags: ['love letter', 'poster', 'printable'], occasion: 'Valentine', style: 'Typographic', formats: ['PDF', 'PNG'], delivery: MADE, kind: 'text', motif: 'letter', palette: BERRY, aspect: 0.75, flags: { trending: true } },
  { title: 'Couple Timeline Poster', tagline: 'How it all began', description: 'A timeline of your milestones, from the first hello to today.', price: 549, category: 'couple-gifts', tags: ['couple', 'timeline', 'gift'], occasion: 'Anniversary', style: 'Timeline', formats: ['PDF', 'PNG'], delivery: MADE, kind: 'text', motif: 'hearts', palette: BLUSH, aspect: 0.75 },
  { title: 'Anniversary Countdown Card', tagline: 'A little surprise, every year', description: 'A shareable card that counts the days you have been together.', price: 299, category: 'anniversary', tags: ['anniversary', 'card', 'countdown'], occasion: 'Anniversary', style: 'Minimal', formats: ['PNG', 'PDF'], delivery: READY, kind: 'none', motif: 'rings', palette: GOLD, aspect: 1.3 },
  { title: 'Festive Lantern Story Pack', tagline: '10 festival story templates', description: 'A pack of vertical templates for festive greetings and offers. Editable in free apps.', price: 349, was: 499, category: 'instagram-story-templates', tags: ['festival', 'story', 'social media'], occasion: 'Festival', style: 'Festive', formats: ['PNG', 'ZIP'], delivery: READY, kind: 'none', motif: 'lamp', palette: GOLD, aspect: 0.56 },
  { title: 'Soft Brand Story Pack', tagline: '12 calm story layouts', description: 'Brand-friendly story templates in a soft palette for small shops and creators.', price: 399, category: 'instagram-story-templates', tags: ['story', 'branding', 'templates'], occasion: 'Any', style: 'Minimal', formats: ['PNG', 'ZIP'], delivery: READY, kind: 'none', motif: 'story', palette: SAGE, aspect: 0.56, flags: { bestseller: true } },
];

const PORTFOLIO: { title: string; category: string; story: string; palette: Pal; motif: Motif; aspect: number; sortOrder: number }[] = [
  { title: 'Aanya and Rohan, wedding suite', category: 'Wedding invitations', story: 'A floral invitation, RSVP and details card for a three-day wedding. They sent us their colors and a pressed-flower photo.', palette: BLUSH, motif: 'floral', aspect: 1.4, sortOrder: 1 },
  { title: 'Meera’s 30th, animated invite', category: 'Animated video invitations', story: 'A 20-second vertical video with a pastel balloon theme, shared in a family group chat within hours.', palette: PEACH, motif: 'video', aspect: 0.56, sortOrder: 2 },
  { title: 'Ten Years Together, memory book', category: 'Memory books', story: 'Forty pages of photos and letters, gathered by friends for a tenth anniversary surprise.', palette: COCOA, motif: 'book', aspect: 1.1, sortOrder: 3 },
  { title: 'Goa Trip Scrapbook', category: 'Digital scrapbooks', story: 'Sand, tickets and sunsets: a layered scrapbook from one week away.', palette: SKY, motif: 'frame', aspect: 1.2, sortOrder: 4 },
  { title: 'Diwali Story Pack for a Bakery', category: 'Instagram story templates', story: 'A set of ten story templates for offers and greetings, in the shop’s own colors.', palette: GOLD, motif: 'lamp', aspect: 0.56, sortOrder: 5 },
  { title: 'Our First Year, love letter poster', category: 'Couple gifts', story: 'A handwritten-style letter turned into a framed print for a first anniversary.', palette: BERRY, motif: 'letter', aspect: 0.75, sortOrder: 6 },
];

const COUPONS = [
  { code: 'WELCOME10', percent: 10, minSubtotal: 0 },
  { code: 'FESTIVE15', percent: 15, minSubtotal: 799 },
  { code: 'FLAT50', flatInr: 50, minSubtotal: 299 },
];

/** A stable UUID from a name, so running the seed twice updates the same row. */
const stableId = (name: string) => {
  const h = crypto.createHash('sha1').update(`a2craft-demo:${name}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const slugOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

let cookie = '';
async function call(method: string, url: string, body?: unknown): Promise<{ status: number; json: unknown }> {
  const headers: Record<string, string> = { origin: BASE };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (cookie) headers['cookie'] = cookie;
  const r = await fetch(BASE + url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const set = r.headers.getSetCookie?.() ?? [];
  if (set.length) cookie = set.map((c) => c.split(';')[0]).join('; ');
  const json: unknown = await r.json().catch(() => null);
  return { status: r.status, json };
}

async function must(label: string, method: string, url: string, body?: unknown) {
  const r = await call(method, url, body);
  if (r.status >= 300) throw new Error(`${label}: ${method} ${url} returned ${r.status} ${JSON.stringify(r.json)}`);
  return r;
}

async function main() {
  if (!EMAIL || !PASSWORD) {
    console.error('Set SEED_EMAIL and SEED_PASSWORD (an admin account), or SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD in server/.env.');
    process.exit(1);
  }
  console.log(`Seeding ${BASE} as ${EMAIL} ...`);
  await must('sign in', 'POST', '/api/auth/login', { email: EMAIL, password: PASSWORD });
  const me = (await call('GET', '/api/auth/me')).json as { user?: { role?: string } };
  if (me.user?.role !== 'admin') throw new Error('That account is not an admin.');

  // The API creates a category when the id is empty and updates it when the id exists, so try the update first.
  for (const c of CATEGORIES) {
    const updated = await call('POST', '/api/admin/categories', c);
    if (updated.status === 404) await must(`category ${c.name}`, 'POST', '/api/admin/categories', { ...c, id: '' });
    else if (updated.status >= 300) throw new Error(`category ${c.name}: returned ${updated.status} ${JSON.stringify(updated.json)}`);
  }
  console.log(`  ${CATEGORIES.length} categories`);

  for (const p of PRODUCTS) {
    const id = stableId(`product:${p.title}`);
    await must(`product ${p.title}`, 'PUT', `/api/admin/products/${id}`, {
      slug: slugOf(p.title), title: p.title, tagline: p.tagline, description: p.description, priceInr: p.price,
      ...(p.was ? { originalPriceInr: p.was } : {}), category: p.category, tags: p.tags, occasion: p.occasion, style: p.style,
      formats: p.formats, delivery: p.delivery, customizable: p.kind !== 'none', customizationKind: p.kind, aspect: p.aspect,
      palette: p.palette, motif: p.motif, gallery: [], license: 'Personal use. Not for resale.', faq: FAQ(),
      status: 'published', featured: !!p.flags?.featured, trending: !!p.flags?.trending, bestseller: !!p.flags?.bestseller, isDemo: true,
    });
  }
  console.log(`  ${PRODUCTS.length} products`);

  for (const w of PORTFOLIO) {
    const id = stableId(`portfolio:${w.title}`);
    await must(`portfolio ${w.title}`, 'PUT', `/api/admin/portfolio/${id}`, { ...w, beforeAfter: false, published: true, isDemo: true });
  }
  console.log(`  ${PORTFOLIO.length} portfolio projects`);

  for (const c of COUPONS) await must(`coupon ${c.code}`, 'PUT', `/api/admin/coupons/${c.code}`, { active: true, ...c });
  console.log(`  ${COUPONS.length} coupons (${COUPONS.map((c) => c.code).join(', ')})`);
  console.log('Done. Demo items are marked "demo" in the admin; unpublish or delete them when you add real ones.');
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

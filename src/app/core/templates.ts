/**
 * The website templates the studio sells: previewed in an iframe at /preview/:slug
 * and edited live at /customize/:slug.
 *
 * Every entry below is a repo under github.com/a2craftstudio. Titles and descriptions
 * were read from each template's own index.html rather than guessed.
 *
 * Three kinds of template, which differ in how they can be hosted:
 *  - 'html'  a self-contained page with relative paths; drops straight into public/<slug>/.
 *  - 'nuxt'  a server-rendered Nuxt bundle, also relative; likewise served from public/.
 *  - 'spa'   a client-rendered bundle whose asset paths are absolute (`/assets/...`) and
 *            whose router matches on the full path, so it has to own a web root (or be
 *            rewritten for a sub-path). Those are hosted per template and reached through
 *            `url`; see scripts/prepare-template.mjs and docs/TEMPLATE-HOSTING.md.
 *
 * Editing works the same way for all three: public/template-bridge.js runs inside the page
 * and rewrites text and images on request. A same-origin template gets the bridge injected
 * by the editor; a hosted one has to carry it in its own index.html.
 */
import { Motif } from './models';

export type TemplateKind = 'html' | 'nuxt' | 'spa';

export const CATEGORIES = ['Wedding', 'Romance', 'Anniversary', 'Birthday', 'Other'] as const;
export type Category = (typeof CATEGORIES)[number];

/** One line per category, for the home page and the category pages. */
export const CATEGORY_BLURBS: Record<Category, string> = {
  Wedding: 'Invitation sites for the big day',
  Romance: 'Save the date, and the story behind it',
  Anniversary: 'Greetings for the years together',
  Birthday: 'Surprise pages to send on the day',
  Other: 'Shop fronts and one-page sites',
};

/** The drawing to fall back on for a category whose templates ship no still of their own. */
export const CATEGORY_MOTIFS: Record<Category, Motif> = {
  Wedding: 'rings',
  Romance: 'hearts',
  Anniversary: 'floral',
  Birthday: 'cake',
  Other: 'frame',
};

export interface WebTemplate {
  /** The route segment, and by default the folder under public/ for a template this app serves. */
  slug: string;
  /**
   * The folder under public/ when it is not the slug — for a repo that holds more than one
   * template, where each lives in its own sub-folder beside shared assets.
   */
  dir?: string;
  title: string;
  /** The couple, occasion or business the demo is dressed for. */
  subtitle: string;
  category: Category;
  kind: TemplateKind;
  /** One line for the gallery card and the detail page. */
  blurb: string;
  /**
   * 'pending' keeps a template in the catalogue but out of every frame: the gallery shows
   * "coming soon" and the detail page offers a custom order. It is the right state for a
   * template whose files this app does not serve and which is not hosted anywhere yet.
   */
  status?: 'live' | 'pending';
  /**
   * A still image for the template, relative to its own folder — usually the og:image it
   * already ships. Used where a live frame would be too heavy, such as the home page.
   */
  thumb?: string;
  /**
   * For a 'spa' template: the route its router was built for, which is also the folder in
   * its repo. The invitation lives at <host>/<demoPath>/, not at the host root.
   */
  demoPath?: string;
  /** Absolute URL of the template's index.html, for templates not served from this app. */
  url?: string;
}

/**
 * Where the templates served from this app live. Empty means this app's own `public/<slug>/`,
 * resolved against <base href> so it works locally (/) and under a sub-path. Point it at
 * another host — e.g. 'https://a2craftstudio.github.io/templates/' — to load them from there
 * instead. The trailing slash matters.
 */
export const TEMPLATE_ORIGIN = '';

/** The GitHub account the template repos live under, used to suggest their Pages URLs. */
export const PAGES_OWNER = 'a2craftstudio';

/**
 * Hosts for the 'spa' templates, which cannot be served from a sub-path of this app.
 * Deploy the repo (see docs/TEMPLATE-HOSTING.md), then put the deployed URL of its demo
 * route here — `pagesUrl` below spells out what GitHub Pages will serve it at. A template
 * with no entry shows as "coming soon" rather than an empty frame.
 */
export const SPA_TEMPLATE_URLS: Record<string, string> = {
  // 'web-wedding-template-13': 'https://a2craftstudio.github.io/web-wedding-template-13/demo12/',
};

export const WEB_TEMPLATES: WebTemplate[] = [
  // --- Wedding, self-contained --------------------------------------------------------
  {
    slug: 'web-wedding-template-4',
    thumb: 'assets/og-image.png',
    title: 'Harman & Jasleen',
    subtitle: 'Arfa Moments',
    category: 'Wedding',
    kind: 'html',
    blurb: 'A calm one-page invitation in cream and gold, with music and a scrolling story.',
  },
  {
    slug: 'web-wedding-template-5',
    thumb: 'assets/og-image.png',
    title: 'Daniyal & Mahnoor',
    subtitle: 'Arfa Moments — Nikah',
    category: 'Wedding',
    kind: 'html',
    blurb: 'The same calm layout dressed for a nikah, with its own palette and opening line.',
  },
  {
    slug: 'web-wedding-template-3',
    title: 'Phulkari',
    subtitle: 'Punjabi wedding',
    category: 'Wedding',
    kind: 'html',
    blurb: 'Phulkari embroidery motifs drawn entirely in SVG — one file, no photographs.',
  },
  {
    slug: 'web-wedding-template-6',
    thumb: 'assets/og-image.png',
    title: 'Taimur & Noorjahan',
    subtitle: 'Arfa Moments',
    category: 'Wedding',
    kind: 'html',
    blurb: 'A calm one-page invitation that opens on a tap, with music and a scrolling story, and a video.',
  },
  {
    slug: 'web-wedding-template-7',
    thumb: 'assets/og-image.png',
    title: 'Arjun & Meera',
    subtitle: 'Arfa Moments',
    category: 'Wedding',
    kind: 'html',
    blurb: 'A calm one-page invitation that opens on a tap, with music and a scrolling story.',
  },
  {
    slug: 'web-wedding-template-8',
    thumb: 'assets/og-image.png',
    title: 'Daniel & Sarah',
    subtitle: 'Arfa Moments',
    category: 'Wedding',
    kind: 'html',
    blurb: 'A calm one-page invitation that opens on a tap, with music and a scrolling story.',
  },
  {
    slug: 'web-wedding-template-9',
    thumb: 'assets/og-image.png',
    title: 'Karthik & Priya',
    subtitle: 'Arfa Moments',
    category: 'Wedding',
    kind: 'html',
    blurb: 'A calm one-page invitation that opens on a tap, with music and a scrolling story.',
  },
  {
    slug: 'web-wedding-template-10',
    thumb: 'assets/og-image.png',
    title: 'Bilal & Hira',
    subtitle: 'Arfa Moments',
    category: 'Wedding',
    kind: 'html',
    blurb: 'A calm one-page invitation that opens on a tap, with music and a scrolling story.',
  },
  {
    slug: 'web-wedding-template-11',
    thumb: 'assets/og-image.png',
    title: 'Mirza & Husna',
    subtitle: 'Arfa Moments',
    category: 'Wedding',
    kind: 'html',
    blurb: 'A calm one-page invitation that opens on a tap, with music and a scrolling story, and a video.',
  },
  {
    slug: 'web-wedding-template-12',
    thumb: 'assets/og-image.png',
    title: 'Saif & Mahtab',
    subtitle: 'Arfa Moments',
    category: 'Wedding',
    kind: 'html',
    blurb: 'A calm one-page invitation that opens on a tap, with music and a scrolling story, and a video.',
  },

  // --- Wedding, client-rendered -------------------------------------------------------
  {
    slug: 'web-wedding-template-1',
    title: 'Divine Ram Vivah',
    subtitle: 'Demo couple',
    category: 'Wedding',
    kind: 'spa',
    demoPath: 'demo10',
    blurb: 'A floating temple, a Hanuman blessing and a golden-arrow date reveal.',
    status: 'pending',
  },
  {
    slug: 'web-wedding-template-2',
    title: 'Shri Ram Vivah',
    subtitle: 'Demo couple',
    category: 'Wedding',
    kind: 'spa',
    demoPath: 'demo8',
    blurb: 'An illustrated Ayodhya invitation with sacred vows and a wedding-date reveal.',
    status: 'pending',
  },
  {
    slug: 'web-wedding-template-13',
    title: 'Kailash — The Divine Union',
    subtitle: 'Aarav & Parvati',
    category: 'Wedding',
    kind: 'spa',
    demoPath: 'demo12',
    blurb: 'Opens on a Shiva mantra video, then unfolds into a Jaipur palace invitation.',
    status: 'pending',
  },
  {
    slug: 'web-wedding-template-14',
    title: 'Rajwada',
    subtitle: 'Demo couple',
    category: 'Wedding',
    kind: 'spa',
    demoPath: 'demo1',
    blurb: 'An interactive invitation that reveals each event as you scroll.',
    status: 'pending',
  },
  {
    slug: 'web-wedding-template-16',
    title: 'Golden Bansuri',
    subtitle: 'Demo couple',
    category: 'Wedding',
    kind: 'spa',
    demoPath: 'demo11',
    blurb: 'Radha Krishna motifs, opening palace gates and a golden bansuri date reveal.',
    status: 'pending',
  },
  {
    slug: 'web-wedding-template-17',
    title: 'Royal Burgundy',
    subtitle: 'Demo couple',
    category: 'Wedding',
    kind: 'spa',
    demoPath: 'demo3',
    blurb: 'A pared-back interactive invitation built around one long cinematic scroll.',
    status: 'pending',
  },
  {
    slug: 'web-wedding-template-18',
    title: 'Divine Jain Temple',
    subtitle: 'Demo couple',
    category: 'Wedding',
    kind: 'spa',
    demoPath: 'demo7',
    blurb: 'A cinematic 3D invitation — lotus bloom, temple doors, mandala and diya.',
    status: 'pending',
  },
  {
    slug: 'web-wedding-template-20',
    title: 'Living Vedic Garden',
    subtitle: 'Demo couple',
    category: 'Wedding',
    kind: 'spa',
    demoPath: 'demo5',
    blurb: 'A hand-painted invitation that shifts and parallaxes as the phone moves.',
    status: 'pending',
  },

  // --- Romance ------------------------------------------------------------------------
  // Empty for now. The one Romance design we had was a scrape of einvite.website whose
  // bundle carried that site's own live payment keys, so it is not kept in this repo at
  // all; see docs/TEMPLATE-HOSTING.md.

  // --- Anniversary --------------------------------------------------------------------
  {
    slug: 'Digital-Anniversary-Tempale-1',
    thumb: 'src/layers/slide01-flower-pink.png',
    title: "Valentine's Day",
    subtitle: 'For the two of you',
    category: 'Anniversary',
    kind: 'html',
    blurb: 'A short, warm Valentine’s page to send on the day.',
  },
  {
    slug: 'Digital-Anniversary-Tempale-2',
    thumb: 'src/layers/compass.png',
    title: 'Happy Anniversary',
    subtitle: 'Year after year',
    category: 'Anniversary',
    kind: 'html',
    blurb: 'An anniversary greeting built around your own photographs.',
  },
  {
    slug: 'Digital-Anniversary-Tempale-3',
    thumb: 'src/layers/slide01-layer-1.png',
    title: 'Our Love Story',
    subtitle: 'How it happened',
    category: 'Anniversary',
    kind: 'html',
    blurb: 'A scrolling timeline of the story so far, told in moments.',
  },

  // --- Birthday -----------------------------------------------------------------------
  {
    slug: 'Digital-BirthDay-Tempale-1',
    thumb: 'src/preview.jpg',
    title: 'Happy Birthday',
    subtitle: 'A little surprise',
    category: 'Birthday',
    kind: 'html',
    blurb: 'A birthday surprise page that opens with a message and a photograph.',
  },
  {
    // One repo, two finished templates sharing an assets folder, so each is listed on its own
    // and served from its sub-folder rather than from a folder named after its slug.
    slug: 'Digital-BirthDay-Tempale-2-rose-pink',
    thumb: 'src/photos/photo-01.jpg',
    dir: 'Digital-BirthDay-Tempale-2/rose-pink',
    title: 'A Little Book of You — Rose',
    subtitle: 'Birthday, rose pink',
    category: 'Birthday',
    kind: 'html',
    blurb: 'A soft 3D birthday book that turns page by page, in rose pink.',
  },
  {
    slug: 'Digital-BirthDay-Tempale-2-soft-blue',
    thumb: 'src/photos/photo-01.jpg',
    dir: 'Digital-BirthDay-Tempale-2/soft-blue',
    title: 'A Little Book of You — Blue',
    subtitle: 'Birthday, soft blue',
    category: 'Birthday',
    kind: 'html',
    blurb: 'The same 3D birthday book in a cooler, soft-blue palette.',
  },

  // --- Other --------------------------------------------------------------------------
  {
    slug: 'Web-IceCream-1',
    thumb: 'img/gola-base.jpg',
    title: 'Sweet Drip',
    subtitle: 'Dessert parlour',
    category: 'Other',
    kind: 'html',
    blurb: 'A shop site for ice cream, falooda, gola, kulfi, chocolates, shakes and sundaes.',
  },
  {
    slug: 'Web-IceCream-2',
    thumb: 'assets/strawberry-cone.png',
    title: 'Drop Cream',
    subtitle: 'Ice-cream shop',
    category: 'Other',
    kind: 'html',
    blurb: 'A red-flower ice-cream shop front, lighter and more photographic than Sweet Drip.',
  },
  {
    slug: 'Web-TeaCoffee-1',
    title: 'Ember & Oak',
    subtitle: 'Coffee house & bakery',
    category: 'Other',
    kind: 'html',
    blurb: 'Single-origin espresso, morning croissants and a rooftop — a one-page cafe site.',
  },
];

export const templateBySlug = (slug: string) => WEB_TEMPLATES.find((t) => t.slug === slug);

/**
 * Resolves a template's index.html: an explicit `url` wins, then the host configured for a
 * 'spa' template, then this app. Empty means the template is not reachable yet, either
 * because it is marked pending or because no host has been configured for it.
 */
export function templateUrl(t: WebTemplate, baseUri: string): string {
  if (t.status === 'pending') return '';
  if (t.url) return t.url;
  if (t.kind === 'spa') return SPA_TEMPLATE_URLS[t.slug] ?? '';
  // The directory, not index.html: a client-side router needs the URL its base was built for.
  return new URL(`${t.dir ?? t.slug}/`, TEMPLATE_ORIGIN || baseUri).toString();
}

/**
 * What GitHub Pages will serve a template at once its repo has Pages switched on — the value
 * to paste into SPA_TEMPLATE_URLS. A project repo is served from a sub-path, and a 'spa'
 * template answers on its own demo route rather than at the root.
 */
export function pagesUrl(t: WebTemplate): string {
  const base = `https://${PAGES_OWNER}.github.io/${t.slug}/`;
  return t.demoPath ? `${base}${t.demoPath}/` : base;
}

/**
 * A still image for the template, or null when it ships none. Only resolved for templates
 * this app serves: the hosted ones carry no artwork we can point at.
 */
export function templateThumb(t: WebTemplate, baseUri: string): string | null {
  if (!t.thumb || t.kind === 'spa') return null;
  return new URL(`${t.dir ?? t.slug}/${t.thumb}`, TEMPLATE_ORIGIN || baseUri).toString();
}

/** True when the template is served from this app, so the editor can inject the bridge itself. */
export function isSameOrigin(t: WebTemplate, baseUri: string): boolean {
  const url = templateUrl(t, baseUri);
  if (!url) return false;
  try {
    return new URL(url, baseUri).origin === new URL(baseUri).origin;
  } catch {
    return false;
  }
}

/** The categories with at least one template, in CATEGORIES order. A category with nothing in
 *  it has no page worth linking to, so the chips and any other category list are built from
 *  this rather than from CATEGORIES, which also carries the ones we have no designs for yet. */
export function stockedCategories(): Category[] {
  return templatesByCategory().map((g) => g.category);
}

/** Templates grouped by category, in CATEGORIES order, skipping categories with nothing in them. */
export function templatesByCategory(): { category: Category; items: WebTemplate[] }[] {
  return CATEGORIES.map((category) => ({
    category,
    items: WEB_TEMPLATES.filter((t) => t.category === category),
  })).filter((g) => g.items.length > 0);
}

/** Matches a category route segment ('wedding') back to a category ('Wedding'). */
export function categoryFromSlug(slug: string): Category | undefined {
  return CATEGORIES.find((c) => c.toLowerCase() === slug.toLowerCase());
}

export const categorySlug = (c: Category) => c.toLowerCase();

import {
  categoryFromSlug, categorySlug, isSameOrigin, SPA_TEMPLATE_URLS, stockedCategories, templateBySlug,
  pagesUrl, templatesByCategory, templateUrl, WEB_TEMPLATES, WebTemplate,
} from './templates';
import { emptyOverlay, highlightSlots, overlayIsEmpty, TextSlot } from './template-overlay';

const BASE = 'https://a2craft.example/';

const t = (over: Partial<WebTemplate> = {}): WebTemplate => ({
  slug: 'web-demo', title: 'Demo', subtitle: 'A & B', category: 'Wedding', kind: 'html', blurb: '', ...over,
});

const slot = (over: Partial<TextSlot> = {}): TextSlot =>
  ({ id: 't0', text: 'something', tag: 'p', size: 16, role: 'text', ...over });

describe('website templates', () => {
  it('serves its own templates from the app, as a directory the template’s router can match', () => {
    expect(templateUrl(t(), BASE)).toBe('https://a2craft.example/web-demo/');
    expect(isSameOrigin(t(), BASE)).toBeTrue();
  });

  it('sends a template with its own url there instead', () => {
    const hosted = t({ url: 'https://pages.example/demo/' });
    expect(templateUrl(hosted, BASE)).toBe('https://pages.example/demo/');
    expect(isSameOrigin(hosted, BASE)).toBeFalse();
  });

  it('looks a client-rendered template up by host, since it cannot live under a sub-path', () => {
    const spa = t({ slug: 'web-spa', kind: 'spa' });
    expect(templateUrl(spa, BASE)).toBe('');

    SPA_TEMPLATE_URLS['web-spa'] = 'https://spa.example/demo1/';
    try {
      expect(templateUrl(spa, BASE)).toBe('https://spa.example/demo1/');
    } finally {
      delete SPA_TEMPLATE_URLS['web-spa'];
    }
  });

  it('gives no url for a pending template, so nothing renders an empty frame', () => {
    expect(templateUrl(t({ status: 'pending' }), BASE)).toBe('');
    expect(templateUrl(t({ status: 'pending', url: 'https://pages.example/demo/' }), BASE)).toBe('');
  });

  it('groups by category and leaves empty categories out', () => {
    const groups = templatesByCategory();
    expect(groups.length).toBeGreaterThan(0);
    expect(groups.every((g) => g.items.length > 0)).toBeTrue();
    expect(groups.map((g) => g.items.length).reduce((a, b) => a + b)).toBe(WEB_TEMPLATES.length);
  });

  it('offers no category chip that opens onto an empty page', () => {
    // CATEGORIES carries every category we have artwork or a blurb for, including ones with no
    // designs yet; the chips are built from the stocked ones so none of them is a dead end.
    const stocked = stockedCategories();
    expect(stocked.length).toBeGreaterThan(0);
    for (const c of stocked) {
      expect(WEB_TEMPLATES.some((t) => t.category === c)).withContext(c).toBeTrue();
      expect(categoryFromSlug(categorySlug(c))).withContext(c).toBe(c);
    }
    expect(stocked).toEqual(templatesByCategory().map((g) => g.category));
  });

  it('round-trips a category through its route segment', () => {
    expect(categorySlug('Wedding')).toBe('wedding');
    expect(categoryFromSlug('wedding')).toBe('Wedding');
    expect(categoryFromSlug('WEDDING')).toBe('Wedding');
    expect(categoryFromSlug('nonsense')).toBeUndefined();
  });

  it('has a unique slug for every template, since the routes are keyed on it', () => {
    const slugs = WEB_TEMPLATES.map((x) => x.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(templateBySlug(slugs[0])?.slug).toBe(slugs[0]);
    expect(templateBySlug('no-such-template')).toBeUndefined();
  });

  it('spells out the Pages URL a template will answer on, demo route included', () => {
    expect(pagesUrl(t({ slug: 'web-demo', kind: 'spa', demoPath: 'demo12' })))
      .toBe('https://a2craftstudio.github.io/web-demo/demo12/');
    expect(pagesUrl(t({ slug: 'web-demo' }))).toBe('https://a2craftstudio.github.io/web-demo/');
  });

  it('gives every client-rendered template the demo route its router was built for', () => {
    const spas = WEB_TEMPLATES.filter((x) => x.kind === 'spa');
    expect(spas.length).toBeGreaterThan(0);
    for (const s of spas) expect(s.demoPath).withContext(s.slug).toMatch(/^demo\d+$/);
  });

  it('never marks a template live without somewhere to load it from', () => {
    // A client-rendered template cannot be served from a sub-path of this app, so going live
    // needs a URL of its own; the self-contained ones resolve against public/. Either way a
    // live template must produce a URL, or its card and preview open onto nothing.
    const live = WEB_TEMPLATES.filter((x) => x.status !== 'pending');
    expect(live.length).toBeGreaterThan(0);
    for (const s of live) {
      expect(templateUrl(s, BASE)).withContext(s.slug).toBeTruthy();
      if (s.kind === 'spa') expect(SPA_TEMPLATE_URLS[s.slug] ?? s.url).withContext(s.slug).toBeTruthy();
    }
  });

  it('serves a template from its own folder when the repo holds more than one', () => {
    const shared = t({ slug: 'repo-rose', dir: 'repo/rose' });
    expect(templateUrl(shared, BASE)).toBe('https://a2craft.example/repo/rose/');
    for (const s of WEB_TEMPLATES.filter((x) => x.dir)) {
      expect(s.dir).withContext(s.slug).toContain('/');
    }
  });
});

describe('template overlay', () => {
  it('starts empty', () => {
    expect(overlayIsEmpty(emptyOverlay())).toBeTrue();
    expect(overlayIsEmpty({ text: { t0: 'hi' }, images: {} })).toBeFalse();
    expect(overlayIsEmpty({ text: {}, images: { i0: 'data:,' } })).toBeFalse();
  });

  it('puts the names, date and venue at the top of the editor', () => {
    const slots = [
      slot({ id: 't0', role: 'heading', size: 60 }),
      slot({ id: 't1', role: 'names', text: 'Harman & Jasleen', size: 48 }),
      slot({ id: 't2', role: 'date', text: '26 January 2027', size: 20 }),
      slot({ id: 't3', role: 'venue', text: 'The Royal Palace', size: 18 }),
    ];
    expect(highlightSlots(slots).map((h) => [h.label, h.slot.id])).toEqual([
      ['Names', 't1'], ['Date', 't2'], ['Venue', 't3'], ['Heading', 't0'],
    ]);
  });

  it('skips a role the page does not have, and never repeats a slot', () => {
    const picks = highlightSlots([slot({ id: 't0', role: 'names' }), slot({ id: 't1', role: 'heading' })]);
    expect(picks.map((h) => h.label)).toEqual(['Names', 'Heading']);
    expect(new Set(picks.map((h) => h.slot.id)).size).toBe(picks.length);
  });
});

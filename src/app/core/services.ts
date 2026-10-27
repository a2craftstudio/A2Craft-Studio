import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { DOCUMENT } from '@angular/common';
import { BRAND } from './config';
import { Backend } from './backend';
import { BusinessInfo, CartItem, Category, ContentSection, Customization, FaqGroup, PortfolioProject, Product, Quote, SiteSettings } from './models';
import { BUSINESS } from './config';
import { DEFAULT_HOURS, statusNow, summarize } from './hours';

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly messages = signal<{ id: number; text: string; tone: 'ok' | 'error' }[]>([]);
  private n = 0;
  show(text: string, tone: 'ok' | 'error' = 'ok') {
    const id = ++this.n;
    this.messages.update((m) => [...m, { id, text, tone }]);
    setTimeout(() => this.messages.update((m) => m.filter((x) => x.id !== id)), 4200);
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private backend = inject(Backend);
  readonly session = this.backend.session;
  readonly isAdmin = computed(() => this.session()?.role === 'admin');
  readonly roleLabel = computed(() => (this.session()?.superAdmin ? 'Super admin' : this.session()?.role === 'admin' ? 'Admin' : 'Customer'));
  readonly loggedIn = computed(() => !!this.session());
  signIn = (e: string, p: string) => this.backend.signIn(e, p);
  signUp = (n: string, e: string, p: string) => this.backend.signUp(n, e, p);
  signOut = () => this.backend.signOut();
  resetPassword = (e: string) => this.backend.resetPassword(e);
  updateProfile = (n: string) => this.backend.updateProfile(n);
}

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private backend = inject(Backend);
  readonly products = signal<Product[]>([]);
  readonly portfolio = signal<PortfolioProject[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly categories = signal<Category[]>([]);
  private loaded: Promise<void> | null = null;

  load(force = false): Promise<void> {
    if (!this.loaded || force) {
      this.loading.set(true);
      this.loaded = Promise.all([this.backend.listProducts(), this.backend.listPortfolio(), this.backend.listCategories()])
        .then(([p, pf, cats]) => {
          this.categories.set(cats);
          this.products.set(p);
          this.portfolio.set(pf);
          this.error.set(null);
        })
        .catch((e) => {
          this.error.set(e?.message ?? 'Could not load the catalog.');
          this.loaded = null;
        })
        .finally(() => this.loading.set(false));
    }
    return this.loaded;
  }
  bySlug = (slug: string) => this.products().find((p) => p.slug === slug);
  byId = (id: string) => this.products().find((p) => p.id === id);
  categoryName = (id: string) => this.categories().find((c) => c.id === id)?.name ?? id;
  related(p: Product, n = 6) {
    return this.products()
      .filter((x) => x.id !== p.id)
      .map((x) => ({ x, s: (x.category === p.category ? 3 : 0) + x.tags.filter((t) => p.tags.includes(t)).length + (x.occasion === p.occasion ? 1 : 0) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, n)
      .map((r) => r.x);
  }
}

@Injectable({ providedIn: 'root' })
export class FavoritesService {
  private backend = inject(Backend);
  private auth = inject(AuthService);
  private analytics = inject(AnalyticsService);
  readonly ids = signal<string[]>([]);
  readonly count = computed(() => this.ids().length);

  constructor() {
    effect(() => {
      const loggedIn = !!this.auth.session();
      void this.sync(loggedIn);
    });
  }

  private readLocal(): string[] {
    try { const v = JSON.parse(localStorage.getItem('a2.favs') ?? '[]'); return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []; } catch { return []; }
  }
  private saveLocal(l: string[]) {
    try { localStorage.setItem('a2.favs', JSON.stringify(l)); } catch { /* storage unavailable */ }
  }

  /** Visitors keep favourites on this device; once signed in they are saved to the account (and merged in). */
  private async sync(loggedIn: boolean) {
    if (!loggedIn) { this.ids.set(this.readLocal()); return; }
    const local = this.readLocal();
    try {
      const server = await this.backend.listFavorites();
      for (const id of local) if (!server.includes(id)) await this.backend.setFavorite(id, true).catch(() => undefined);
      this.ids.set([...new Set([...server, ...local])]);
      if (local.length) this.saveLocal([]);
    } catch { /* keep what we have */ }
  }

  has = (id: string) => this.ids().includes(id);

  async toggle(id: string) {
    const on = !this.has(id);
    this.ids.update((l) => (on ? [...l, id] : l.filter((x) => x !== id)));
    if (on) this.analytics.track('like', location.pathname, id); // counted only with consent
    if (!this.auth.session()) { this.saveLocal(this.ids()); return on; }
    try {
      await this.backend.setFavorite(id, on);
    } catch {
      this.ids.update((l) => (on ? l.filter((x) => x !== id) : [...l, id]));
    }
    return on;
  }
}

const CART_KEY = 'a2.cart';

@Injectable({ providedIn: 'root' })
export class CartService {
  private backend = inject(Backend);
  readonly items = signal<CartItem[]>(this.restore());
  readonly coupon = signal<string>(localStorage.getItem(CART_KEY + '.coupon') ?? '');
  readonly quote = signal<Quote | null>(null);
  readonly quoting = signal(false);
  readonly pulse = signal(0);
  readonly count = computed(() => this.items().reduce((s, i) => s + i.qty, 0));
  readonly drawerOpen = signal(false);
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      const items = this.items();
      const coupon = this.coupon();
      try {
        localStorage.setItem(CART_KEY, JSON.stringify(items));
        localStorage.setItem(CART_KEY + '.coupon', coupon);
      } catch { /* storage unavailable */ }
      if (this.timer) clearTimeout(this.timer);
      if (!items.length) return this.quote.set(null);
      this.quoting.set(true);
      this.timer = setTimeout(() => {
        this.backend.quote(items, coupon).then((q) => this.quote.set(q)).catch(() => this.quote.set(null)).finally(() => this.quoting.set(false));
      }, 150);
    });
  }

  private restore(): CartItem[] {
    try { return JSON.parse(localStorage.getItem(CART_KEY) ?? '[]'); } catch { return []; }
  }

  add(productId: string, customization?: Customization) {
    const key = customization ? `${productId}:${Date.now()}` : productId;
    this.items.update((l) => {
      const existing = !customization && l.find((i) => i.key === key);
      return existing ? l.map((i) => (i.key === key ? { ...i, qty: Math.min(10, i.qty + 1) } : i)) : [...l, { key, productId, qty: 1, customization }];
    });
    this.pulse.update((n) => n + 1);
  }
  setQty(key: string, qty: number) {
    this.items.update((l) => l.map((i) => (i.key === key ? { ...i, qty: Math.max(1, Math.min(10, qty)) } : i)));
  }
  remove(key: string) {
    this.items.update((l) => l.filter((i) => i.key !== key));
  }
  clear() {
    this.items.set([]);
    this.coupon.set('');
  }
}

@Injectable({ providedIn: 'root' })
export class SeoService {
  private title = inject(Title);
  private meta = inject(Meta);
  private doc = inject(DOCUMENT);

  set(opts: { title: string; description?: string; image?: string; path?: string; jsonLd?: object | null }) {
    const full = opts.title === BRAND.name ? `${BRAND.name} | ${BRAND.tagline}` : `${opts.title} | ${BRAND.name}`;
    const desc = opts.description ?? BRAND.description;
    this.title.setTitle(full);
    this.meta.updateTag({ name: 'description', content: desc });
    this.meta.updateTag({ property: 'og:title', content: full });
    this.meta.updateTag({ property: 'og:description', content: desc });
    this.meta.updateTag({ property: 'og:type', content: opts.jsonLd ? 'product' : 'website' });
    this.meta.updateTag({ property: 'og:site_name', content: BRAND.name });
    if (opts.image && !opts.image.startsWith('data:')) this.meta.updateTag({ property: 'og:image', content: opts.image });
    const url = BRAND.siteUrl + (opts.path ?? '');
    this.meta.updateTag({ property: 'og:url', content: url });
    let link = this.doc.querySelector<HTMLLinkElement>('link[rel=canonical]');
    if (!link) {
      link = this.doc.createElement('link');
      link.rel = 'canonical';
      this.doc.head.appendChild(link);
    }
    link.href = url;
    this.doc.getElementById('ld-json')?.remove();
    if (opts.jsonLd) {
      const s = this.doc.createElement('script');
      s.id = 'ld-json';
      s.type = 'application/ld+json';
      s.text = JSON.stringify(opts.jsonLd);
      this.doc.head.appendChild(s);
    }
  }
}

export const formatInr = (n: number) => new Intl.NumberFormat(BRAND.locale, { style: 'currency', currency: BRAND.currency, maximumFractionDigits: 0 }).format(n);

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private backend = inject(Backend);
  readonly settings = signal<SiteSettings>({ announcement: '', whatsapp: '', supportEmail: '' });

  /** Owner-entered business details win over the placeholders in config.ts. Empty fields fall back to the placeholder. */
  readonly business = computed<BusinessInfo & { responseHours: number; resolveDays: number }>(() => {
    const saved = this.settings().business ?? {};
    const pick = (k: keyof BusinessInfo) => (saved[k] ?? '').trim() || (k === 'supportEmail' ? this.settings().supportEmail?.trim() : '') || String(BUSINESS[k]);
    return {
      legalName: pick('legalName'), address: pick('address'), gstin: pick('gstin'), supportEmail: pick('supportEmail'),
      grievanceOfficer: pick('grievanceOfficer'), grievanceEmail: pick('grievanceEmail'), jurisdiction: pick('jurisdiction'),
      responseHours: BUSINESS.responseHours, resolveDays: BUSINESS.resolveDays,
    };
  });
  /** True while any business detail is still a [placeholder]. */
  readonly businessIncomplete = computed(() => Object.values(this.business()).some((v) => typeof v === 'string' && v.startsWith('[')));
  /** Studio hours (owner-edited, or the defaults) and a live open/closed status that refreshes every minute. */
  readonly hours = computed(() => this.settings().hours ?? DEFAULT_HOURS);
  readonly hoursSummary = computed(() => summarize(this.hours()));
  private tick = signal(Date.now());
  readonly status = computed(() => { this.tick(); return statusNow(this.hours()); });
  private timer = setInterval(() => this.tick.set(Date.now()), 30000);

  readonly faq = computed<FaqGroup[] | undefined>(() => this.settings().faq?.length ? this.settings().faq : undefined);
  readonly about = computed<ContentSection[] | undefined>(() => this.settings().about?.length ? this.settings().about : undefined);

  load() {
    return this.backend.getSettings().then((s) => this.settings.set(s)).catch(() => undefined);
  }
}

const RECENT_KEY = 'a2.recent';
const RECENT_MAX = 12;

/** Designs the visitor opened, newest first. Stored only on this device. */
@Injectable({ providedIn: 'root' })
export class RecentlyViewedService {
  readonly ids = signal<string[]>(this.load());

  private load(): string[] {
    try {
      const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
      return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, RECENT_MAX) : [];
    } catch {
      return [];
    }
  }

  private save(list: string[]) {
    this.ids.set(list);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch { /* storage unavailable */ }
  }

  add(id: string) {
    if (this.ids()[0] === id) return;
    this.save([id, ...this.ids().filter((x) => x !== id)].slice(0, RECENT_MAX));
  }

  remove(id: string) { this.save(this.ids().filter((x) => x !== id)); }
  clear() { this.save([]); }
}

const CONSENT_KEY = 'a2.consent';
const VISITOR_KEY = 'a2.vid';

/** The visitor's choice about visit analytics. Nothing is recorded until they say yes. */
@Injectable({ providedIn: 'root' })
export class ConsentService {
  readonly choice = signal<'granted' | 'denied' | null>(this.load());
  /** True while the notice should be visible (first visit, or reopened from "Privacy choices"). */
  readonly asking = signal(this.choice() === null);

  private load(): 'granted' | 'denied' | null {
    try {
      const v = localStorage.getItem(CONSENT_KEY);
      return v === 'granted' || v === 'denied' ? v : null;
    } catch {
      return 'denied'; // storage blocked: never track
    }
  }

  set(c: 'granted' | 'denied') {
    this.choice.set(c);
    this.asking.set(false);
    try {
      localStorage.setItem(CONSENT_KEY, c);
      if (c === 'denied') localStorage.removeItem(VISITOR_KEY); // forget the anonymous id
    } catch { /* ignore */ }
  }

  reopen() { this.asking.set(true); }
}

/** First-party visit analytics: page and product views, recorded only with consent and never for admins. */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private backend = inject(Backend);
  private consent = inject(ConsentService);
  private last = { key: '', at: 0 };

  private visitorId(): string {
    try {
      let id = localStorage.getItem(VISITOR_KEY);
      if (!id) {
        id = 'v-' + (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)).replace(/-/g, '').slice(0, 12);
        localStorage.setItem(VISITOR_KEY, id);
      }
      return id;
    } catch {
      return 'v-anon';
    }
  }

  track(type: 'page' | 'product' | 'like', path: string, productId?: string) {
    if (this.consent.choice() !== 'granted') return;
    if (this.backend.session()?.role === 'admin') return;
    if (/^\/(admin|checkout|order)/.test(path)) return; // sensitive or internal pages are never recorded
    const now = Date.now();
    const key = type + ':' + path;
    if (this.last.key === key && now - this.last.at < 2000) return; // collapse double-fires of the same view
    this.last = { key, at: now };
    void this.backend.trackEvent({ visitorId: this.visitorId(), type, path, productId }).catch(() => undefined);
  }
}

/** Log-out actions shared by the header menu, the mobile drawer and the account page. */
@Injectable({ providedIn: 'root' })
export class SessionActions {
  private auth = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastService);
  private cart = inject(CartService);
  private recent = inject(RecentlyViewedService);

  /** Signs out and returns to the home page, so no account screen is left open. */
  async logout(message = 'You’ve been logged out') {
    await this.auth.signOut();
    await this.router.navigateByUrl('/');
    this.toast.show(message);
  }

  /**
   * For shared computers: signs out and also forgets what this browser remembers about the visit
   * (bag, coupon, recently viewed, saved drafts, checkout details, anonymous visitor ID).
   * The cookie choice and welcome-tour flag are kept so the visitor isn't asked again.
   */
  async logoutAndClear() {
    this.clearDevice();
    await this.logout('Logged out. This device has been cleared.');
  }

  clearDevice() {
    this.cart.clear();
    this.recent.clear();
    try {
      for (const k of Object.keys(localStorage)) if (k.startsWith('a2.draft.') || k === 'a2.vid' || k === 'a2.favs') localStorage.removeItem(k);
      sessionStorage.removeItem('a2.checkout');
    } catch { /* storage unavailable */ }
  }
}

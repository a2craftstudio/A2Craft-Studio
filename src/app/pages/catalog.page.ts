import { AfterViewInit, Component, computed, DestroyRef, ElementRef, inject, OnInit, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { applyFilters, EMPTY_FILTERS, Filters, KindFilter, SortKey } from '../core/search';
import { FORMAT_OPTIONS } from '../core/options';
import { CatalogService, SeoService } from '../core/services';
import { IconComponent } from '../shared/icon.component';
import { MasonryComponent } from '../shared/masonry.component';
import { CategoryMenuComponent } from '../shared/category-menu.component';

const PAGE = 12;

@Component({
  selector: 'app-catalog',
  standalone: true,
  imports: [FormsModule, MasonryComponent, IconComponent, CategoryMenuComponent],
  template: `
    <div class="container top">
      <p class="eyebrow">Shop</p>
      <h1>Find your next <span class="hl">favourite</span></h1>
      <div class="bar">
        <div class="search">
          <app-icon name="search" />
          <label class="sr-only" for="cat-q">Search designs</label>
          <input id="cat-q" type="search" placeholder="Search by name, theme, occasion or style" [ngModel]="term()" (ngModelChange)="onTerm($event)" autocomplete="off" />
        </div>
        <label class="sr-only" for="sort">Sort by</label>
        <select id="sort" class="sel" [ngModel]="f().sort" (ngModelChange)="patch({ sort: $event })">
          <option value="relevance">Most relevant</option><option value="newest">Newest</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option>
        </select>
        <button class="btn ghost" type="button" (click)="panel.set(!panel())" [attr.aria-expanded]="panel()" aria-controls="filters"><app-icon name="filter" [size]="18" /> Filters @if (activeCount()) { ({{ activeCount() }}) }</button>
      </div>

      <div class="kind" role="group" aria-label="Show">
        @for (k of kinds; track k.id) { <button type="button" [class.on]="f().kind === k.id" [attr.aria-pressed]="f().kind === k.id" (click)="patch({ kind: k.id })">{{ k.label }}</button> }
      </div>
      <div class="cats"><app-category-menu [value]="f().category" (changed)="patch({ category: $event })" /></div>

      @if (panel()) {
        <form id="filters" class="filters card reveal" (submit)="$event.preventDefault()">
          <div class="field"><label for="f-occ">Occasion</label>
            <select id="f-occ" [ngModel]="f().occasion" name="occ" (ngModelChange)="patch({ occasion: $event })"><option value="">Any occasion</option>@for (o of occasions(); track o) { <option [value]="o">{{ o }}</option> }</select></div>
          <div class="field"><label for="f-fmt">Format</label>
            <select id="f-fmt" [ngModel]="f().format" name="fmt" (ngModelChange)="patch({ format: $event })"><option value="">Any format</option>@for (o of formats; track o) { <option [value]="o">{{ o }}</option> }</select></div>
          <div class="field"><label for="f-min">Min price (₹)</label><input id="f-min" type="number" min="0" name="min" [ngModel]="f().minPrice" (ngModelChange)="patch({ minPrice: num($event) })" /></div>
          <div class="field"><label for="f-max">Max price (₹)</label><input id="f-max" type="number" min="0" name="max" [ngModel]="f().maxPrice" (ngModelChange)="patch({ maxPrice: num($event) })" /></div>
          <label class="check"><input type="checkbox" name="cust" [ngModel]="f().customizable" (ngModelChange)="patch({ customizable: $event })" /> Customizable only</label>
          <button class="btn soft small" type="button" (click)="clear()">Clear all</button>
        </form>
      }

      <p class="count muted" aria-live="polite">{{ catalog.loading() ? 'Loading…' : results().length + (results().length === 1 ? ' design' : ' designs') }}</p>
      <app-masonry [products]="visible()" [loading]="catalog.loading()" [error]="catalog.error()" (retry)="catalog.load(true)" (clear)="clear()" />

      @if (!catalog.loading() && visible().length < results().length) {
        <div #sentinel class="sentinel" aria-hidden="true"></div>
        <div class="more"><button class="btn ghost" type="button" (click)="more()">Show more designs</button></div>
      }
    </div>
  `,
  styles: [`
    .top { padding-block: 32px 24px; }
    .bar { display: flex; flex-wrap: wrap; gap: .7rem; margin-bottom: 1rem; }
    .search { flex: 1 1 280px; display: flex; gap: .6rem; align-items: center; background: #efefef; border: 0; border-radius: 999px; padding: 0 1rem; height: 48px; color: #767676; }
    .search:focus-within { outline: 3px solid rgba(199,131,145,.45); }
    .search input { flex: 1; border: 0; outline: none; background: transparent; font: inherit; color: var(--brown); height: 100%; }
    .sel { height: 48px; border-radius: 999px; border: 0; background: #efefef; font-weight: 600; padding: 0 1rem; font: inherit; color: var(--brown); }
    .cats { margin-bottom: 1rem; }
    .kind { display: inline-flex; background: #efefef; border-radius: 999px; padding: 4px; margin-bottom: 12px; button { border: 0; background: transparent; font-weight: 700; padding: .5rem 1.1rem; border-radius: 999px; transition: background .2s, color .2s; &.on { background: #111; color: #fff; } } }
    .filters { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: .8rem 1rem; padding: 1.2rem; margin-bottom: 1rem; align-items: end; .field, .check { margin-bottom: 0; } }
    .count { font-size: .88rem; }
    .more { text-align: center; padding: 24px; }
    .sentinel { height: 1px; }
  `],
})
export class CatalogPage implements OnInit, AfterViewInit {
  catalog = inject(CatalogService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private seo = inject(SeoService);
  private destroyRef = inject(DestroyRef);
  kinds: { id: KindFilter; label: string }[] = [{ id: '', label: 'Everything' }, { id: 'design', label: 'Cards & designs' }, { id: 'video', label: 'Videos' }];
  formats = FORMAT_OPTIONS;
  /** Occasions come from the products that actually exist, so the filter never offers an empty choice. */
  occasions = computed(() => [...new Set(this.catalog.products().map((p) => p.occasion).filter((o) => o && o !== 'Any'))].sort());

  mode = signal<'explore' | 'shop'>('explore');
  f = signal<Filters>({ ...EMPTY_FILTERS });
  term = signal('');
  panel = signal(false);
  shown = signal(PAGE);
  private t: ReturnType<typeof setTimeout> | null = null;
  sentinel = viewChild<ElementRef<HTMLElement>>('sentinel');

  results = computed(() => applyFilters(this.catalog.products(), this.f()));
  visible = computed(() => this.results().slice(0, this.shown()));
  activeCount = computed(() => {
    const f = this.f();
    return [f.occasion, f.format, f.minPrice != null, f.maxPrice != null, f.customizable].filter(Boolean).length;
  });

  constructor() {
    this.route.data.pipe(takeUntilDestroyed()).subscribe((d) => this.mode.set(d['mode'] ?? 'explore'));
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((q) => {
      const n = (k: string) => (q.get(k) !== null && q.get(k) !== '' && !isNaN(+q.get(k)!) ? +q.get(k)! : null);
      const f: Filters = {
        q: q.get('q') ?? '', category: q.get('category') ?? '', occasion: q.get('occasion') ?? '', format: q.get('format') ?? '',
        minPrice: n('min'), maxPrice: n('max'), customizable: q.get('custom') === '1', kind: (q.get('type') === 'video' || q.get('type') === 'design' ? q.get('type') : '') as KindFilter, sort: (q.get('sort') as SortKey) || 'relevance',
      };
      this.f.set(f);
      this.term.set(f.q);
      this.shown.set(PAGE);
      if (f.occasion || f.format || f.minPrice != null || f.maxPrice != null || f.customizable) this.panel.set(true);
      this.seo.set({
        title: f.category ? this.catalog.categoryName(f.category) : f.q ? `Search: ${f.q}` : 'Shop',
        description: 'Browse invitations, memory books, scrapbooks, videos and printable gifts.',
        path: this.router.url.split('?')[0],
      });
    });
  }

  ngOnInit() { void this.catalog.load(); }

  ngAfterViewInit() {
    if (typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && this.more(), { rootMargin: '400px' });
    const attach = () => { const el = this.sentinel()?.nativeElement; if (el) io.observe(el); };
    // The sentinel is rendered conditionally, so re-check after each result change.
    const iv = setInterval(attach, 800);
    this.destroyRef.onDestroy(() => { clearInterval(iv); io.disconnect(); });
  }

  more() { this.shown.update((n) => n + PAGE); }
  num(v: unknown) { return v === '' || v == null ? null : Number(v); }

  onTerm(v: string) {
    this.term.set(v);
    if (this.t) clearTimeout(this.t);
    this.t = setTimeout(() => this.patch({ q: v }), 300);
  }

  patch(p: Partial<Filters>) {
    const f = { ...this.f(), ...p };
    this.router.navigate([], {
      relativeTo: this.route, replaceUrl: true,
      queryParams: {
        q: f.q || null, category: f.category || null, occasion: f.occasion || null, format: f.format || null,
        min: f.minPrice, max: f.maxPrice, custom: f.customizable ? 1 : null, type: f.kind || null, sort: f.sort !== 'relevance' ? f.sort : null,
      },
    });
  }
  clear() { this.patch({ ...EMPTY_FILTERS }); }
}

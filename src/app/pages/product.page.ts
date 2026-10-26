import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { BRAND } from '../core/config';
import { discountPercent } from '../core/search';
import { AnalyticsService, CartService, CatalogService, FavoritesService, formatInr, RecentlyViewedService, SeoService, ToastService } from '../core/services';
import { IconComponent } from '../shared/icon.component';
import { MasonryComponent } from '../shared/masonry.component';
import { ReviewsSectionComponent } from '../shared/reviews-section.component';
import { Router } from '@angular/router';

@Component({
  selector: 'app-product',
  standalone: true,
  imports: [RouterLink, IconComponent, MasonryComponent, ReviewsSectionComponent],
  template: `
    @if (catalog.loading()) {
      <div class="container wrap"><div class="skeleton" style="aspect-ratio: 4/5"></div><div class="skeleton" style="height: 420px"></div></div>
    } @else if (item()) {
      @let p = item()!;
      <div class="container">
        <nav class="crumbs" aria-label="Breadcrumb"><a routerLink="/shop">Shop</a> / <a routerLink="/shop" [queryParams]="{ category: p.category }">{{ catalog.categoryName(p.category) }}</a> / <span>{{ p.title }}</span></nav>
        <div class="wrap">
          <div class="gal">
            <div class="main card">
              @if (media().kind === 'video' && media().url) { <video [src]="media().url" [poster]="media().poster" controls preload="none" playsinline></video> }
              @else { <img [src]="media().url" [alt]="media().alt" width="800" height="1000" /> }
            </div>
            <div class="thumbs" role="group" aria-label="Product images">
              @for (m of items(); track $index) {
                <button type="button" [class.on]="$index === idx()" (click)="idx.set($index)" [attr.aria-label]="'Show image ' + ($index + 1)" [attr.aria-current]="$index === idx()"><img [src]="m.kind === 'video' ? (m.poster ?? m.url) : m.url" alt="" width="80" height="80" /></button>
              }
            </div>
          </div>

          <div class="info">
            <p class="eyebrow">{{ catalog.categoryName(p.category) }}</p>
            <h1>{{ p.title }}</h1>
            <p class="lead">{{ p.tagline }}</p>
            <p class="price big">{{ money(p.priceInr) }} @if (p.originalPriceInr) { <s>{{ money(p.originalPriceInr) }}</s> <span class="off">{{ off(p) }}% off</span> }</p>
            <p>{{ p.description }}</p>

            <dl class="facts">
              <div><dt>Format</dt><dd>{{ p.formats.join(', ') }}</dd></div>
              <div><dt>Delivery</dt><dd>{{ p.delivery }}</dd></div>
              <div><dt>Customization</dt><dd>{{ p.customizable ? (p.customizationKind === 'video-request' ? 'Submit your details; we create it for you' : 'Personalize before you buy') : 'Not customizable' }}</dd></div>
              <div><dt>Occasion</dt><dd>{{ p.occasion }}</dd></div>
            </dl>

            <div class="cta">
              @if (p.customizable) {
                <a class="btn" [routerLink]="['/studio', p.slug]">{{ p.customizationKind === 'video-request' ? 'Share your details' : 'Customize & preview' }}</a>
              } @else {
                <button class="btn" type="button" (click)="add()">Add to bag</button>
                <button class="btn soft" type="button" (click)="buyNow()">Buy now</button>
              }
              <button class="btn ghost" type="button" (click)="fav.toggle(p.id)" [attr.aria-pressed]="fav.has(p.id)"><app-icon name="heart" [size]="18" /> {{ fav.has(p.id) ? 'Saved' : 'Save' }}</button>
              <button class="btn ghost" type="button" (click)="share()"><app-icon name="share" [size]="18" /> Share</button>
            </div>

            <div class="delivery card"><strong>Digital delivery.</strong> No physical item is shipped. Download links unlock in your account only after your payment is verified. <a routerLink="/delivery">Delivery details</a></div>

            <details><summary>License and usage</summary><p>{{ p.license }}</p></details>
            @for (f of p.faq; track f.q) { <details><summary>{{ f.q }}</summary><p>{{ f.a }}</p></details> }
            <p class="tags">@for (t of p.tags; track t) { <a class="chip" routerLink="/shop" [queryParams]="{ q: t }">{{ t }}</a> }</p>
          </div>
        </div>

        <app-reviews-section [productId]="p.id" />

        @if (related().length) {
          <section class="section" aria-labelledby="rel-h"><h2 id="rel-h">You may also love</h2><app-masonry [products]="related()" /></section>
        }
      </div>
    } @else {
      <div class="container empty"><h1>Design not found</h1><p>It may have been unpublished or moved.</p><a class="btn" routerLink="/shop">Back to the shop</a></div>
    }
  `,
  styles: [`
    .crumbs { padding-block: 20px 8px; font-size: .85rem; color: var(--muted); a { color: var(--muted); } }
    .wrap { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 0; align-items: start; margin: 8px auto 24px; max-width: 1016px; background: #fff; border-radius: 32px; box-shadow: 0 1px 20px rgba(0,0,0,.1); overflow: hidden; } .info { padding: clamp(20px, 4vw, 40px); }
    .gal { position: sticky; top: var(--header-h); }
    .main { overflow: hidden; background: var(--blush); border: 0; border-radius: 0; img, video { width: 100%; height: auto; max-height: 78vh; object-fit: cover; } }
    .thumbs { display: flex; gap: 10px; margin-top: 12px; button { border: 2px solid transparent; padding: 0; border-radius: 14px; overflow: hidden; width: 72px; height: 72px; background: none; img { width: 100%; height: 100%; object-fit: cover; } &.on { border-color: var(--berry); } } }
    .lead { font-size: 1.05rem; color: var(--muted); }
    .big { font-size: 1.8rem; } .off { font-size: .85rem; color: var(--rose); font-weight: 600; margin-left: .5rem; }
    .facts { display: grid; gap: .5rem; margin: 1.2rem 0; div { display: grid; grid-template-columns: 120px 1fr; gap: 1rem; padding: .6rem 0; border-bottom: 1px solid var(--line); } dt { color: var(--muted); font-size: .85rem; } dd { margin: 0; } }
    .cta { display: flex; flex-wrap: wrap; gap: .6rem; margin: 1.4rem 0; }
    .delivery { padding: 1rem 1.2rem; font-size: .92rem; margin-bottom: 1.2rem; background: var(--blush); border: 0; }
    details { border-bottom: 1px solid var(--line); padding: .8rem 0; summary { cursor: pointer; font-weight: 600; } p { margin: .6rem 0 0; color: var(--muted); } }
    .tags { display: flex; gap: .4rem; flex-wrap: wrap; margin-top: 1.2rem; }
    @media (max-width: 860px) { .wrap { grid-template-columns: 1fr; } .gal { position: static; } }
  `],
})
export class ProductPage {
  catalog = inject(CatalogService);
  fav = inject(FavoritesService);
  private cart = inject(CartService);
  private toast = inject(ToastService);
  private seo = inject(SeoService);
  private recent = inject(RecentlyViewedService);
  private analytics = inject(AnalyticsService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  money = formatInr;
  off = discountPercent;
  idx = signal(0);

  private slug = toSignal(this.route.paramMap.pipe(map((m) => m.get('slug') ?? '')), { initialValue: '' });
  item = computed(() => this.catalog.bySlug(this.slug()));
  items = computed(() => {
    const p = this.item()!;
    return p.videoUrl ? [{ kind: 'video' as const, url: p.videoUrl, alt: p.title + ' video', poster: p.gallery[0].url }, ...p.gallery] : p.gallery;
  });
  media = computed(() => this.items()[Math.min(this.idx(), this.items().length - 1)]);
  related = computed(() => (this.item() ? this.catalog.related(this.item()!, 6) : []));

  constructor() {
    void this.catalog.load();
    effect(() => {
      const p = this.item();
      this.slug();
      this.idx.set(0);
      if (!p) return;
      this.recent.add(p.id);
      this.analytics.track('product', '/product/' + p.slug, p.id);
      this.seo.set({
        title: p.title, description: p.tagline + '. ' + p.description.slice(0, 120), image: p.gallery[0].url, path: '/product/' + p.slug,
        jsonLd: {
          '@context': 'https://schema.org', '@type': 'Product', name: p.title, description: p.description, category: p.category,
          brand: { '@type': 'Brand', name: BRAND.name },
          offers: { '@type': 'Offer', priceCurrency: 'INR', price: p.priceInr, availability: 'https://schema.org/InStock', url: BRAND.siteUrl + '/product/' + p.slug },
        },
      });
    });
  }

  add() {
    this.cart.add(this.item()!.id);
    this.toast.show('Added to your bag');
  }
  buyNow() {
    this.cart.add(this.item()!.id);
    void this.router.navigate(['/checkout']);
  }
  async share() {
    const p = this.item()!;
    const url = location.href;
    try {
      if (navigator.share) await navigator.share({ title: p.title, url });
      else { await navigator.clipboard.writeText(url); this.toast.show('Link copied'); }
    } catch { /* user cancelled */ }
  }
}



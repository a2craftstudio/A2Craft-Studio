import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Backend } from '../core/backend';
import { BRAND } from '../core/config';
import { coverArt } from '../core/cover-art';
import { Review } from '../core/models';
import { CatalogService, RecentlyViewedService, SeoService } from '../core/services';
import { HeroComponent } from '../shared/hero.component';
import { IconComponent } from '../shared/icon.component';
import { MasonryComponent } from '../shared/masonry.component';
import { RevealDirective } from '../shared/reveal.directive';
import { StarsComponent } from '../shared/stars.component';

const PICKS = 8;

/** Home: rotating photo hero, today's picks feed, category boards, how it works, reviews, FAQ. */
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, HeroComponent, MasonryComponent, StarsComponent, IconComponent, RevealDirective],
  template: `
    <app-hero />

    @if (recent().length) {
      <section class="sec recent" aria-labelledby="recent-h">
        <div class="wide">
          <div class="head">
            <h2 id="recent-h" class="rtitle"><app-icon name="clock" [size]="22" /> Pick up where you left off</h2>
            <button type="button" class="btn ghost small" (click)="history.clear()">Clear history</button>
          </div>
          <ul class="rgrid">
            @for (p of recent(); track p.id) {
              <li><a [routerLink]="['/product', p.slug]"><img [src]="p.gallery[0].url" [alt]="p.title" loading="lazy" width="160" height="200" /><span>{{ p.title }}</span></a>
                <button type="button" class="x" (click)="history.remove(p.id)" [attr.aria-label]="'Remove ' + p.title + ' from history'">×</button></li>
            }
          </ul>
        </div>
      </section>
    }

    <section id="feed-sec" class="sec" aria-labelledby="feed-h">
      <div class="wide">
        <div class="head">
          <div>
            <span class="kicker" [appReveal]="0"><app-icon name="star" [size]="16" /> Today’s picks</span>
            <h2 id="feed-h" class="title" [appReveal]="80">Ideas you’ll <span class="hl">love</span></h2>
          </div>
          <a class="btn ghost small" routerLink="/shop">Shop all <app-icon name="arrow" [size]="16" /></a>
        </div>
        @if (!catalog.loading() && !catalog.error() && !picks().length) {
          <div class="adm-empty"><h3>The shop is being stocked</h3><p>New designs are on their way. In the meantime we can make something just for you.</p><a class="btn" routerLink="/custom-order">Request a custom design</a></div>
        } @else {
          <app-masonry [products]="picks()" [loading]="catalog.loading()" [error]="catalog.error()" (retry)="catalog.load(true)" />
          @if (picks().length) { <p class="more"><a class="btn primary" routerLink="/shop">Shop all designs <app-icon name="arrow" [size]="16" /></a></p> }
        }
      </div>
    </section>

    @if (boards().length) {
    <section class="sec" aria-labelledby="boards-h">
      <div class="wide">
        <span class="kicker" [appReveal]="0"><app-icon name="grid" [size]="16" /> Our categories</span>
        <h2 id="boards-h" class="title" [appReveal]="80">Browse by <span class="hl">category</span></h2>
        <div class="boards">
          @for (b of boards(); track b.id; let i = $index) {
            <a class="board" routerLink="/shop" [queryParams]="{ category: b.id }" [appReveal]="(i % 4) * 70">
              <div class="cover" [class.one]="b.imgs.length === 1" [class.two]="b.imgs.length === 2">@for (src of b.imgs; track $index) { <img [src]="src" alt="" loading="lazy" width="200" height="170" /> }</div>
              <h3>{{ b.name }}</h3>
              <p>{{ b.count }} {{ b.count === 1 ? 'design' : 'designs' }} · {{ b.blurb }}</p>
            </a>
          }
        </div>
      </div>
    </section>

    }

    <section class="sec how" aria-labelledby="how-h">
      <div class="wide">
        <span class="kicker" [appReveal]="0"><app-icon name="wand" [size]="16" /> Simple</span>
        <h2 id="how-h" class="title" [appReveal]="80">How it <span class="hl">works</span></h2>
        <ol>
          <li [appReveal]="0"><span>1</span><strong>Pick a design</strong>Browse, save favourites and open the one you love.</li>
          <li [appReveal]="80"><span>2</span><strong>Personalize it</strong>Add names, dates and photos and preview instantly.</li>
          <li [appReveal]="160"><span>3</span><strong>Pay securely</strong>Checkout with UPI, cards or netbanking.</li>
          <li [appReveal]="240"><span>4</span><strong>Download or receive</strong>Ready files unlock right away; custom ones arrive by email.</li>
        </ol>
      </div>
    </section>

    @if (reviews().length) {
      <section class="sec" aria-labelledby="loved-h">
        <div class="wide">
          <span class="kicker"><app-icon name="heart" [size]="16" /> Reviews</span>
          <h2 id="loved-h" class="title">Kind words from <span class="hl">customers</span></h2>
          <ul class="loved">@for (r of reviews(); track r.id) { <li [appReveal]="0"><app-stars [value]="r.rating" /><p>{{ r.body }}</p><span>{{ r.authorName }}</span></li> }</ul>
        </div>
      </section>
    }

  `,
  styles: [`
    .sec { padding: clamp(36px, 6vw, 72px) 0; }
    .wide { max-width: 1600px; margin: 0 auto; padding: 0 16px; }
    .head { display: flex; justify-content: space-between; align-items: flex-end; gap: 1rem; flex-wrap: wrap; margin-bottom: 22px; }
    .head + .adm-empty { margin-top: 0; }
    .recent { padding-bottom: 0; } .rtitle { display: flex; align-items: center; gap: .5rem; font-size: 1.3rem; margin: 0; }
    .rgrid { list-style: none; padding: 0; margin: 14px 0 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 14px; }
    .rgrid li { position: relative; } .rgrid a { display: block; text-decoration: none; color: inherit; font-size: .85rem; font-weight: 600; }
    .rgrid img { width: 100%; aspect-ratio: 4 / 5; object-fit: cover; border-radius: 16px; background: #efefef; margin-bottom: 6px; transition: transform .3s var(--ease); } .rgrid a:hover img { transform: translateY(-3px); }
    .rgrid .x { position: absolute; top: 6px; right: 6px; width: 28px; height: 28px; border-radius: 50%; border: 0; background: rgba(255,255,255,.95); color: #111; font-size: 1.1rem; line-height: 1; opacity: 0; transition: opacity .2s; } .rgrid li:hover .x, .rgrid .x:focus-visible { opacity: 1; }
    @media (hover: none) { .rgrid .x { opacity: 1; } }
    .tools { margin: 14px 0 18px; }
    .more { text-align: center; margin-top: 10px; }
    .boards { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 26px 20px; margin-top: 22px; }
    .board { display: block; text-decoration: none; color: inherit; }
    .cover { display: grid; grid-template-columns: 2fr 1fr; grid-template-rows: 1fr 1fr; gap: 2px; height: 170px; border-radius: 18px; overflow: hidden; background: #efefef; transition: transform .35s var(--ease), box-shadow .3s; }
    .board:hover .cover { transform: translateY(-4px); box-shadow: 0 18px 40px -20px rgba(0,0,0,.45); }
    .cover.one { grid-template-columns: 1fr; grid-template-rows: 1fr; } .cover.two { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr; } .cover.two img:first-child { grid-row: auto; }
    .cover img { width: 100%; height: 100%; object-fit: cover; } .cover img:first-child { grid-row: 1 / 3; }
    .board h3 { margin: 10px 0 0; font-size: 1.1rem; } .board p { margin: .1rem 0 0; color: var(--muted); font-size: .85rem; }
    .how ol { list-style: none; padding: 0; margin: 22px 0 0; display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
    .how li { background: #fff; border: 1px solid var(--line); border-radius: 24px; padding: 22px; font-size: .92rem; color: var(--muted); strong { display: block; color: #111; font-size: 1.08rem; margin-bottom: .2rem; }
      span { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 50%; background: #e60023; color: #fff; font-weight: 700; margin-bottom: 12px; } }
    .loved { list-style: none; padding: 0; margin: 22px 0 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; li { background: #efefef; border-radius: 24px; padding: 22px; p { margin: .4rem 0; } span { font-size: .85rem; color: var(--muted); } } }
    .btn.primary { background: #e60023; color: #fff; box-shadow: 0 12px 28px -8px rgba(230,0,35,.4); }
    @media (max-width: 860px) { .how ol { grid-template-columns: 1fr 1fr; } }
  `],
})
export class HomePage implements OnInit {
  brand = BRAND;
  catalog = inject(CatalogService);
  private seo = inject(SeoService);
  history = inject(RecentlyViewedService);
  private backend = inject(Backend);
  reviews = signal<Review[]>([]);
  /** Newest first, only designs that are still published. Up to six are shown. */
  recent = computed(() => this.history.ids().map((id) => this.catalog.byId(id)).filter((p): p is NonNullable<typeof p> => !!p).slice(0, 6));

  /** A short, curated row: trending first, then newest. The full catalog lives in the Shop. */
  picks = computed(() => [...this.catalog.products()].sort((a, b) => Number(b.trending) - Number(a.trending) || b.createdAt.localeCompare(a.createdAt)).slice(0, PICKS));

  /** One board per category: a collage of its own designs, or a drawing when it has none yet. */
  boards = computed(() => {
    const all = this.catalog.products();
    return this.catalog.categories().map((c) => {
      const own = [...new Set(all.filter((p) => p.category === c.id).map((p) => p.gallery[0]?.url).filter((u): u is string => !!u))].slice(0, 3);
      const imgs = own.length ? own : [coverArt({ seed: c.id, title: '', label: ' ', palette: ['#F2F2F2', '#9A9A9A'], motif: c.motif, aspect: 1 })];
      return { id: c.id, name: c.name, blurb: c.blurb, count: all.filter((p) => p.category === c.id).length, imgs };
    });
  });

  ngOnInit() {
    this.seo.set({ title: BRAND.name, path: '/' });
    void this.catalog.load();
    void this.backend.listReviews().then((r) => this.reviews.set(r.slice(0, 3))).catch(() => undefined);
  }
}

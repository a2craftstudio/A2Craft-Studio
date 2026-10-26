import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BRAND } from '../core/config';
import { coverArt } from '../core/cover-art';
import { PortfolioProject } from '../core/models';
import { CatalogService, SeoService } from '../core/services';
import { IconComponent } from '../shared/icon.component';

@Component({
  selector: 'app-portfolio',
  standalone: true,
  imports: [RouterLink, IconComponent],
  template: `
    <div class="container top">
      <p class="eyebrow">Our work</p>
      <h1>Stories we’ve crafted</h1>
      <p class="muted lead">A look at personal projects, from invitation suites to memory books and videos.</p>
      <div class="actions">
        <a class="btn" routerLink="/custom-order">Start a custom project</a>
        <a class="btn ghost" [href]="brand.instagramUrl" target="_blank" rel="noopener noreferrer"><app-icon name="insta" [size]="18" /> Follow on Instagram</a>
      </div>
      <div class="chips" role="group" aria-label="Project categories">
        <button class="chip" type="button" [class.active]="!cat()" (click)="cat.set('')">All</button>
        @for (c of cats(); track c) { <button class="chip" type="button" [class.active]="cat() === c" (click)="cat.set(c)">{{ c }}</button> }
      </div>

      @if (catalog.loading()) { <div class="skeleton" style="height: 320px"></div> }
      @else if (!shown().length) { <div class="empty"><h3>No projects published yet</h3><p>Add projects in the admin area.</p></div> }
      @else {
        <div class="masonry">
          @for (p of shown(); track p.id) {
            <button type="button" class="proj reveal" (click)="open.set(p)" [attr.aria-label]="'Open project: ' + p.title" [style.aspect-ratio]="'1 / ' + p.aspect">
              <img [src]="art(p)" [alt]="p.title" loading="lazy" width="400" [attr.height]="400 * p.aspect" />
              <span class="cap"><small>{{ p.category }}</small>{{ p.title }}</span>
            </button>
          }
        </div>
      }
    </div>

    @if (open(); as p) {
      <div class="scrim" (click)="open.set(null)"></div>
      <div class="modal" role="dialog" aria-modal="true" [attr.aria-label]="p.title" tabindex="-1" (keydown.escape)="open.set(null)">
        <button class="x" type="button" (click)="open.set(null)" aria-label="Close project"><app-icon name="close" /></button>
        @if (p.beforeAfter) {
          <div class="ba" [style.aspect-ratio]="'1 / ' + p.aspect">
            <img class="after" [src]="art(p)" alt="After: finished design" />
            <img class="before" [src]="art(p)" alt="Before: rough draft" [style.clip-path]="'inset(0 ' + (100 - pos()) + '% 0 0)'" />
            <span class="line" [style.left.%]="pos()"></span>
            <label class="sr-only" for="ba-r">Compare before and after</label>
            <input id="ba-r" type="range" min="0" max="100" [value]="pos()" (input)="pos.set(+$any($event.target).value)" />
            <span class="tag l">Before</span><span class="tag r">After</span>
          </div>
        } @else { <img class="one" [src]="art(p)" [alt]="p.title" /> }
        <div class="body">
          <p class="eyebrow">{{ p.category }}</p><h2>{{ p.title }}</h2><p>{{ p.story }}</p>
          <a class="btn" routerLink="/custom-order" [queryParams]="{ ref: p.title }" (click)="open.set(null)">Ask for something similar</a>
        </div>
      </div>
    }
  `,
  styles: [`
    .top { padding-block: 32px 56px; } .lead { max-width: 60ch; }
    .actions { display: flex; gap: .6rem; flex-wrap: wrap; margin-top: 1rem; }
    .chips { display: flex; gap: .5rem; flex-wrap: wrap; margin: 1.5rem 0; .chip { cursor: pointer; } }
    .masonry { columns: 3 280px; column-gap: 20px; }
    .proj { position: relative; display: block; width: 100%; padding: 0; border: 0; margin-bottom: 20px; break-inside: avoid; border-radius: var(--radius); overflow: hidden; box-shadow: var(--shadow-sm); transition: transform .35s var(--ease), box-shadow .35s; text-align: left; }
    .proj:hover { transform: translateY(-4px); box-shadow: var(--shadow-md); } .proj img { width: 100%; height: 100%; object-fit: cover; transition: transform .7s var(--ease); } .proj:hover img { transform: scale(1.05); }
    .cap { position: absolute; inset: auto 0 0; padding: 36px 16px 14px; color: #fff; font-family: var(--font-serif); font-size: 1.3rem; font-weight: 600; background: linear-gradient(transparent, rgba(71,54,51,.8)); small { display: block; font-family: var(--font-sans); font-size: .72rem; letter-spacing: .1em; text-transform: uppercase; opacity: .85; } .demo-tag { margin-left: .5rem; vertical-align: middle; } }
    .scrim { position: fixed; inset: 0; background: rgba(71,54,51,.55); z-index: 90; animation: fade .25s both; }
    .modal { position: fixed; z-index: 91; inset: 0; margin: auto; width: min(720px, calc(100% - 24px)); height: fit-content; max-height: calc(100dvh - 24px); overflow: auto; background: var(--ivory); border-radius: 26px; animation: pop .35s var(--ease) both; outline: none; }
    .one, .ba { width: 100%; max-height: 60vh; object-fit: cover; } .body { padding: 22px 26px 28px; }
    .ba { position: relative; overflow: hidden; img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; } .before { filter: grayscale(1) contrast(.85) brightness(1.1); }
      .line { position: absolute; top: 0; bottom: 0; width: 3px; background: #fff; box-shadow: 0 0 8px rgba(0,0,0,.3); } input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: ew-resize; }
      input:focus-visible ~ .line { outline: 3px solid var(--rose); } .tag { position: absolute; top: 12px; font-size: .72rem; background: rgba(255,255,255,.9); padding: .15rem .6rem; border-radius: 999px; font-weight: 600; &.l { left: 12px } &.r { right: 12px } } }
    .x { position: absolute; top: 14px; right: 14px; z-index: 3; width: 40px; height: 40px; border-radius: 50%; border: 0; background: var(--white); display: grid; place-items: center; box-shadow: var(--shadow-sm); }
    @keyframes fade { from { opacity: 0 } } @keyframes pop { from { opacity: 0; transform: translateY(16px) scale(.97) } }
  `],
})
export class PortfolioPage implements OnInit {
  brand = BRAND;
  catalog = inject(CatalogService);
  private seo = inject(SeoService);
  cat = signal('');
  open = signal<PortfolioProject | null>(null);
  pos = signal(50);
  cats = computed(() => [...new Set(this.catalog.portfolio().map((p) => p.category))]);
  shown = computed(() => this.catalog.portfolio().filter((p) => !this.cat() || p.category === this.cat()));
  art = (p: PortfolioProject) => p.image ?? coverArt({ seed: p.id, title: p.title, label: ' ', palette: p.palette, motif: p.motif, aspect: p.aspect });
  ngOnInit() {
    void this.catalog.load();
    this.seo.set({ title: 'Our work', description: 'A portfolio of invitations, memory books, scrapbooks and videos.', path: '/our-work' });
  }
}

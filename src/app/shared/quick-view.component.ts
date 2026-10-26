import { Component, effect, ElementRef, inject, Injectable, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Product } from '../core/models';
import { discountPercent } from '../core/search';
import { CartService, FavoritesService, formatInr, ToastService } from '../core/services';
import { IconComponent } from './icon.component';

@Injectable({ providedIn: 'root' })
export class QuickViewService {
  readonly product = signal<Product | null>(null);
  open = (p: Product) => this.product.set(p);
  close = () => this.product.set(null);
}

@Component({
  selector: 'app-quick-view',
  standalone: true,
  imports: [RouterLink, IconComponent],
  template: `
    @if (qv.product(); as p) {
      <div class="backdrop" (click)="qv.close()"></div>
      <div class="dialog" role="dialog" aria-modal="true" [attr.aria-label]="'Quick view: ' + p.title" tabindex="-1" #dlg (keydown.escape)="qv.close()">
        <button class="x" type="button" (click)="qv.close()" aria-label="Close quick view"><app-icon name="close" /></button>
        @if (p.videoUrl) { <video [src]="p.videoUrl" [poster]="p.gallery[0].url" controls preload="none" playsinline></video> } @else { <img [src]="p.gallery[0].url" [alt]="p.gallery[0].alt" /> }
        <div class="info">
          <p class="eyebrow">{{ p.occasion }} · {{ p.formats.join(' · ') }}</p>
          <h2>{{ p.title }}</h2>
          <p>{{ p.tagline }}</p>
          <p class="price big">{{ money(p.priceInr) }} @if (p.originalPriceInr) { <s>{{ money(p.originalPriceInr) }}</s> <span class="off">{{ off(p) }}% off</span> }</p>
          <div class="row">
            <a class="btn" [routerLink]="['/product', p.slug]" (click)="qv.close()">{{ p.customizable ? 'Customize' : 'View details' }}</a>
            @if (!p.customizable) { <button class="btn soft" type="button" (click)="add(p)">Add to bag</button> }
            <button class="btn ghost" type="button" (click)="fav.toggle(p.id)" [attr.aria-pressed]="fav.has(p.id)"><app-icon name="heart" [size]="18" /> {{ fav.has(p.id) ? 'Saved' : 'Save' }}</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .backdrop { position: fixed; inset: 0; background: rgba(71,54,51,.45); z-index: 90; animation: fade .25s both; backdrop-filter: blur(3px); }
    .dialog { position: fixed; z-index: 91; inset: 0; margin: auto; width: min(880px, calc(100% - 24px)); max-height: calc(100dvh - 32px); height: fit-content;
      background: var(--ivory); border-radius: 26px; display: grid; grid-template-columns: 1fr 1fr; overflow: auto; box-shadow: var(--shadow-md); animation: pop .35s var(--ease) both; outline: none; }
    img, video { width: 100%; height: 100%; object-fit: cover; min-height: 280px; }
    .info { padding: clamp(20px, 4vw, 40px); align-self: center; }
    .big { font-size: 1.5rem; } .off { font-size: .8rem; color: var(--rose); font-weight: 600; margin-left: .4rem; }
    .row { display: flex; flex-wrap: wrap; gap: .6rem; margin-top: 1.2rem; }
    .x { position: absolute; top: 12px; right: 12px; z-index: 2; border: 0; width: 40px; height: 40px; border-radius: 50%; background: var(--white); display: grid; place-items: center; box-shadow: var(--shadow-sm); }
    @keyframes fade { from { opacity: 0 } } @keyframes pop { from { opacity: 0; transform: translateY(18px) scale(.97) } }
    @media (max-width: 700px) { .dialog { grid-template-columns: 1fr; } img { max-height: 280px; } }
  `],
})
export class QuickViewComponent {
  qv = inject(QuickViewService);
  fav = inject(FavoritesService);
  private cart = inject(CartService);
  private toast = inject(ToastService);
  dlg = viewChild<ElementRef<HTMLElement>>('dlg');
  money = formatInr;
  off = discountPercent;
  constructor() {
    effect(() => {
      const el = this.dlg()?.nativeElement;
      if (el) queueMicrotask(() => el.focus());
    });
  }
  add(p: Product) {
    this.cart.add(p.id);
    this.toast.show(`${p.title} added to your bag`);
    this.qv.close();
  }
}

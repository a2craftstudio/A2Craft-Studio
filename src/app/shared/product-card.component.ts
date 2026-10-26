import { Component, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Product } from '../core/models';
import { discountPercent, isVideo } from '../core/search';
import { FavoritesService, formatInr } from '../core/services';
import { IconComponent } from './icon.component';
import { QuickViewService } from './quick-view.component';

/** Pinterest-style pin: rounded image, dark hover veil, red Save button, quiet caption. */
@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [RouterLink, IconComponent],
  template: `
    <article class="pin">
      <div class="media" [style.aspect-ratio]="'1 / ' + p().aspect" (mouseenter)="hover.set(true)" (mouseleave)="hover.set(false)">
        <a class="cover" [routerLink]="['/product', p().slug]" [attr.aria-label]="p().title">
          <img [src]="p().gallery[0].url" [alt]="p().gallery[0].alt" loading="lazy" width="400" [attr.height]="400 * p().aspect" />
        </a>
        @if (hover() && p().videoUrl) { <video class="pv" [src]="p().videoUrl" autoplay muted loop playsinline aria-hidden="true"></video> }
        @if (video()) { <span class="play" aria-hidden="true"><app-icon name="play" [size]="22" /></span><span class="vtag">Video</span> }
        <span class="veil" aria-hidden="true"></span>
        <button type="button" class="save fav" [class.on]="fav.has(p().id)" (click)="fav.toggle(p().id)" [attr.aria-pressed]="fav.has(p().id)"
          [attr.aria-label]="(fav.has(p().id) ? 'Remove from' : 'Save to') + ' favorites: ' + p().title">{{ fav.has(p().id) ? 'Saved' : 'Save' }}</button>
        <button type="button" class="round" (click)="qv.open(p())" [attr.aria-label]="'Quick view: ' + p().title"><app-icon name="eye" [size]="18" /></button>
        <span class="badges">
          @if (off() > 0) { <span class="badge sale">{{ off() }}% off</span> }
          
        </span>
      </div>
      <div class="meta">
        <a [routerLink]="['/product', p().slug]" class="title">{{ p().title }}</a>
        <span class="price">{{ money(p().priceInr) }} @if (p().originalPriceInr) { <s>{{ money(p().originalPriceInr!) }}</s> }
          @if (p().customizable) { <span class="cust">· Customizable</span> }</span>
      </div>
    </article>
  `,
  styles: [`
    .pin { position: relative; break-inside: avoid; margin-bottom: 16px; }
    .media { position: relative; overflow: hidden; border-radius: 16px; background: #efefef; }
    .cover, img { display: block; width: 100%; height: 100%; }
    img { object-fit: cover; }
    .pv { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; pointer-events: none; }
    .play { position: absolute; left: 12px; top: 12px; width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,.94); color: #111; display: grid; place-items: center; pointer-events: none; transition: transform .3s var(--ease); }
    .pin:hover .play { transform: scale(1.12); }
    .vtag { position: absolute; left: 60px; top: 20px; font-size: .7rem; font-weight: 700; background: #111; color: #fff; border-radius: 999px; padding: .15rem .6rem; pointer-events: none; }
    .veil { position: absolute; inset: 0; background: rgba(0,0,0,.38); opacity: 0; transition: opacity .2s; pointer-events: none; }
    .pin:hover .veil, .pin:focus-within .veil { opacity: 1; }
    .save { position: absolute; top: 12px; right: 12px; border: 0; background: #e60023; color: #fff; font-weight: 700; font-size: .95rem; padding: .7rem 1.1rem; border-radius: 999px; opacity: 0; transition: opacity .2s, background .2s; }
    .save:hover { background: #ad081b; }
    .save.on { background: #111111; opacity: 1; animation: pop .4s var(--ease); }
    .pin:hover .save, .pin:focus-within .save { opacity: 1; }
    .round { position: absolute; right: 12px; bottom: 12px; width: 40px; height: 40px; border-radius: 50%; border: 0; background: #fff; color: #111111; display: grid; place-items: center; opacity: 0; transition: opacity .2s, background .2s; }
    .round:hover { background: #efefef; }
    .pin:hover .round, .pin:focus-within .round { opacity: 1; }
    @media (hover: none) { .save, .round { opacity: 1; } .save { padding: .5rem .8rem; font-size: .85rem; } }
    @keyframes pop { 30% { transform: scale(1.18); } 60% { transform: scale(.95); } }
    .badges { position: absolute; left: 10px; bottom: 10px; display: flex; gap: 6px; pointer-events: none; }
    .badge { font-size: .7rem; font-weight: 700; padding: .2rem .6rem; border-radius: 999px; background: #fff; color: #111111; }
    .badge.sale { background: #e60023; color: #fff; }
    .meta { padding: 8px 4px 0; display: flex; flex-direction: column; gap: 2px; }
    .title { font-family: var(--font-serif); font-size: 1.1rem; font-weight: 700; color: #111111; text-decoration: none; line-height: 1.25; }
    .title:hover { text-decoration: underline; }
    .price { font-size: .85rem; color: #111111; font-weight: 400; }
    .price s { color: #767676; } .cust { color: #767676; }
  `],
})
export class ProductCardComponent {
  p = input.required<Product>();
  fav = inject(FavoritesService);
  qv = inject(QuickViewService);
  money = formatInr;
  off = () => discountPercent(this.p());
  video = () => isVideo(this.p());
  hover = signal(false);
}

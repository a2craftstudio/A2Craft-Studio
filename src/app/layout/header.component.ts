import { Component, effect, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { BRAND } from '../core/config';
import { AuthService, CartService, FavoritesService, SessionActions } from '../core/services';
import { AccountMenuComponent } from './account-menu.component';
import { IconComponent } from '../shared/icon.component';
import { SearchBoxComponent } from '../shared/search-box.component';
import { LogoMarkComponent } from '../shared/logo.component';

export const NAV = [
  { label: 'Home', path: '/' },
  { label: 'Shop', path: '/shop' },
  { label: 'Our Work', path: '/our-work' },
  { label: 'Custom Orders', path: '/custom-order' },
  { label: 'About', path: '/about' },
  { label: 'FAQ', path: '/faq' },
];

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, IconComponent, SearchBoxComponent, LogoMarkComponent, AccountMenuComponent],
  host: { "(window:scroll)": "scrolled.set(scrollY > 8)" },
  template: `
    <a class="skip" href="#main">Skip to content</a>
    <header class="hd" [class.scrolled]="scrolled()">
      <div class="container bar">
        <button class="icon burger" type="button" (click)="open.set(true)" aria-label="Open menu" [attr.aria-expanded]="open()"><app-icon name="menu" [size]="24" /></button>
        <a routerLink="/" class="logo" [attr.aria-label]="brand.name + ' home'"><app-logo-mark /><span class="name">{{ brand.name }}</span></a>
        <nav class="nav" aria-label="Primary">
          @for (n of nav; track n.path) { <a [routerLink]="n.path" [class.on]="isActive(n.path)" [attr.aria-current]="isActive(n.path) ? 'page' : null">{{ n.label }}</a> }
        </nav>
        <div class="search"><app-search-box [compact]="true" /></div>
        <div class="icons">
          <app-account-menu />
          <a class="icon" routerLink="/account" [queryParams]="{ tab: 'saved' }" aria-label="Saved designs">
            <app-icon name="heart" />@if (fav.count()) { <span class="dot">{{ fav.count() }}</span> }
          </a>
          <a class="icon bag" routerLink="/cart" [attr.aria-label]="'Shopping bag, ' + cart.count() + ' items'">
            <span class="bagi" [class.bump]="bump()"><app-icon name="bag" /></span>@if (cart.count()) { <span class="dot">{{ cart.count() }}</span> }
          </a>
        </div>
      </div>
    </header>

    @if (open()) {
      <div class="scrim" (click)="open.set(false)"></div>
      <aside class="drawer" role="dialog" aria-modal="true" aria-label="Menu" (keydown.escape)="open.set(false)">
        <div class="dh"><span class="logo"><app-logo-mark /><span class="name">{{ brand.name }}</span></span>
          <button class="icon" type="button" (click)="open.set(false)" aria-label="Close menu"><app-icon name="close" /></button></div>
        <app-search-box (committed)="open.set(false)" />
        <nav aria-label="Mobile">
          @for (n of nav; track n.path) { <a [routerLink]="n.path" [class.on]="isActive(n.path)" [attr.aria-current]="isActive(n.path) ? 'page' : null">{{ n.label }}</a> }
        </nav>
        <div class="acct">
          @if (auth.session(); as s) {
            <p class="who"><strong>{{ s.name || 'My account' }}</strong><span>{{ s.email }}</span></p>
            <a routerLink="/account" [queryParams]="{ tab: 'orders' }">My orders and downloads</a>
            <a routerLink="/account" [queryParams]="{ tab: 'profile' }">Profile and privacy</a>
            @if (auth.isAdmin()) { <a routerLink="/admin">{{ auth.dashboardLabel() }}</a> }
            <button type="button" class="btn" (click)="logout()">Log out</button>
            <button type="button" class="btn ghost" (click)="logoutAndClear()">Log out and clear this device</button>
          } @else {
            <a routerLink="/account" class="btn">Sign in or create an account</a>
          }
        </div>
      </aside>
    }
  `,
  styles: [`
    .skip { position: absolute; left: -999px; top: 8px; background: var(--berry); color: #fff; padding: .6rem 1rem; border-radius: 10px; z-index: 200; } .skip:focus { left: 8px; }
    .hd { position: sticky; top: 0; z-index: 50; background: rgba(255,255,255,.72); -webkit-backdrop-filter: saturate(180%) blur(16px); backdrop-filter: saturate(180%) blur(16px); transition: box-shadow .3s; } .hd.scrolled { box-shadow: 0 2px 14px rgba(0,0,0,.09); }
    .bar { display: flex; align-items: center; gap: .8rem; height: var(--header-h); }
    .logo { display: flex; align-items: center; gap: .5rem; text-decoration: none; color: #e60023; }
    .mark { width: 36px; height: 36px; border-radius: 12px; background: #e60023; color: #fff; display: grid; place-items: center; font-family: var(--font-serif); font-weight: 700; font-size: 1.1rem; }
    .name { font-size: 1.3rem; font-weight: 700; color: #e60023; letter-spacing: -.02em; white-space: nowrap; }
    .nav { display: flex; gap: .1rem; a { text-decoration: none; padding: .45rem .8rem; border-radius: 999px; font-size: .92rem; font-weight: 500; color: var(--brown); transition: background .2s; &:hover { background: var(--blush); } &.on { background: #111111; color: #fff; font-weight: 600; } } }
    .search { flex: 0 1 230px; margin-left: auto; transition: flex-basis .35s var(--ease); } .search:focus-within { flex-basis: 360px; }
    .icons { display: flex; gap: .2rem; }
    .icon { position: relative; width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; border: 0; background: transparent; color: var(--berry); text-decoration: none; transition: background .2s; &:hover { background: var(--blush); } }
    .dot { position: absolute; top: 3px; right: 1px; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px; background: #e60023; color: #fff; font-size: .68rem; font-weight: 700; display: grid; place-items: center; }
    .bagi.bump { animation: bump .5s var(--ease); } @keyframes bump { 30% { transform: scale(1.3) rotate(-8deg); } 65% { transform: scale(.94) rotate(4deg); } }
    .burger { display: none; }
    @media (max-width: 1100px) { .nav { display: none; } .burger { display: grid; } .search { display: none; } .logo { margin-right: auto; } .name { font-size: 1.3rem; } }
    @media (max-width: 480px) { .bar { gap: .3rem; } .icon { width: 40px; height: 40px; } .name { font-size: 1.12rem; } .icons a[aria-label="Saved designs"] { display: none; } }
    .scrim { position: fixed; inset: 0; background: rgba(71,54,51,.45); z-index: 80; animation: fade .25s both; }
    .drawer { position: fixed; z-index: 81; top: 0; bottom: 0; left: 0; width: min(340px, 88vw); background: var(--ivory); padding: 16px; display: flex; flex-direction: column; gap: 1rem; animation: slide .35s var(--ease) both; box-shadow: var(--shadow-md); }
    .dh { display: flex; justify-content: space-between; align-items: center; }
    .drawer nav { display: flex; flex-direction: column; a { padding: .85rem .6rem; text-decoration: none; font-size: 1.4rem; font-weight: 700; border-bottom: 1px solid var(--line); &.on { color: var(--rose); } } }
    .drawer .acct { margin-top: auto; display: grid; gap: .5rem; padding-top: 1rem; border-top: 1px solid var(--line); .who { margin: 0; display: grid; strong { font-size: 1.05rem; } span { font-size: .8rem; color: var(--muted); word-break: break-all; } } a:not(.btn) { padding: .5rem 0; text-decoration: none; font-weight: 600; } .btn { width: 100%; } }
    @keyframes fade { from { opacity: 0 } } @keyframes slide { from { transform: translateX(-100%) } }
  `],
})
export class HeaderComponent {
  brand = BRAND;
  nav = NAV;
  auth = inject(AuthService);
  cart = inject(CartService);
  fav = inject(FavoritesService);
  open = signal(false);
  bump = signal(false);
  scrolled = signal(false);
  private session = inject(SessionActions);
  private router = inject(Router);
  url = signal(this.router.url);

  /** Which tab is selected is derived from the current path, so product and studio pages keep the Shop tab lit. */
  isActive(path: string): boolean {
    const p = this.url().split('?')[0].split('#')[0];
    if (path === '/') return p === '/';
    if (path === '/shop') return /^\/(shop|product|studio)(\/|$)/.test(p);
    return p === path || p.startsWith(path + '/');
  }

  async logout() { this.open.set(false); await this.session.logout(); }
  async logoutAndClear() { this.open.set(false); await this.session.logoutAndClear(); }

  constructor() {
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe((e) => { this.url.set((e as NavigationEnd).urlAfterRedirects); this.open.set(false); });
    effect(() => {
      if (this.cart.pulse() > 0) {
        this.bump.set(true);
        setTimeout(() => this.bump.set(false), 520);
      }
    });
  }
}

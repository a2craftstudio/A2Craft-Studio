import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BRAND } from '../core/config';
import { POLICY_LINKS } from '../core/pages-content';
import { IconComponent } from '../shared/icon.component';
import { LogoMarkComponent } from '../shared/logo.component';
import { NewsletterComponent } from '../shared/newsletter.component';
import { WelcomeService } from '../shared/welcome.component';
import { ConsentService, SettingsService } from '../core/services';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink, IconComponent, LogoMarkComponent, NewsletterComponent],
  template: `
    <footer class="ft">
      <div class="container news">
        <div><h2 class="nh">Get new designs first</h2><p class="muted">A short note when new collections arrive. No spam, unsubscribe any time.</p></div>
        <app-newsletter />
      </div>
      <div class="container grid">
        <div>
          <p class="brand"><app-logo-mark [size]="32" /> {{ brand.name }}</p>
          <p class="muted">{{ brand.tagline }}.</p>
          <a class="btn ghost small" [href]="brand.instagramUrl" target="_blank" rel="noopener noreferrer"><app-icon name="insta" [size]="18" /> {{ brand.instagramHandle }}</a>
        </div>
        <nav aria-label="Shop"><h2>Shop</h2>
          <a routerLink="/shop">Shop all</a><a routerLink="/shop" [queryParams]="{ type: 'video' }">Videos</a><a routerLink="/custom-order">Custom orders</a></nav>
        <nav aria-label="Company"><h2>Studio</h2>
          <a routerLink="/our-work">Our work</a><a routerLink="/about">About</a><a routerLink="/faq">FAQ</a><a routerLink="/contact">Contact</a><a routerLink="/contact" [queryParams]="{ mode: 'callback' }">Request a call back</a><button type="button" class="tour" (click)="welcome.show()">Take the tour</button></nav>
        <nav aria-label="Policies"><h2>Policies</h2>
          @for (l of policies; track l.slug) { <a [routerLink]="['/' + l.slug]">{{ l.label }}</a> }<button type="button" class="tour" (click)="consent.reopen()">Privacy choices</button></nav>
      </div>
      <div class="container fine">
        <p class="biz hrs">Chat, calls and inquiries: <strong>{{ hours() }}</strong> (IST) · <a routerLink="/contact" [class.open]="status().open">{{ status().open ? 'Online now' : 'Offline, ' + status().short }}</a></p>
        <p class="biz"><strong>{{ biz().legalName }}</strong> · {{ biz().address }} · GSTIN: {{ biz().gstin }} · {{ biz().supportEmail }}</p>
        © {{ year }} {{ brand.name }}. All rights reserved. Prices in INR.
      </div>
    </footer>
  `,
  styles: [`
    .ft { background: #fff; border-top: 1px solid var(--line); margin-top: 40px; padding-top: 56px; }
    .grid { display: grid; grid-template-columns: 1.4fr 1fr 1fr 1fr; gap: 32px; }
    .brand { display: flex; align-items: center; gap: .6rem; font-size: 1.4rem; font-weight: 700; color: #e60023; margin-bottom: .3rem; }
    h2 { font-family: var(--font-sans); font-size: .78rem; text-transform: uppercase; letter-spacing: .14em; color: var(--berry); }
    nav { display: flex; flex-direction: column; gap: .4rem; a { color: var(--brown); text-decoration: none; font-size: .93rem; &:hover { text-decoration: underline; } } }
    .tour { background: none; border: 0; padding: 0; text-align: left; color: var(--brown); font-size: .93rem; cursor: pointer; &:hover { text-decoration: underline; } }
    .news { display: grid; grid-template-columns: 1fr 1.2fr; gap: 24px; align-items: center; padding-bottom: 36px; margin-bottom: 36px; border-bottom: 1px solid var(--line); } .nh { font-size: 1.5rem; margin: 0 0 .2rem; text-transform: none; letter-spacing: -.02em; color: #111; font-family: var(--font-serif); } @media (max-width: 760px) { .news { grid-template-columns: 1fr; } }
    .biz { margin: 0 0 .4rem; } .hrs a { color: #111; font-weight: 600; } .hrs a.open { color: #14632a; }
    .fine { padding-block: 32px 28px; color: var(--muted); font-size: .85rem; }
    @media (max-width: 760px) { .grid { grid-template-columns: 1fr 1fr; } .grid > :first-child { grid-column: 1 / -1; } }
  `],
})
export class FooterComponent {
  brand = BRAND;
  private settings = inject(SettingsService);
  biz = this.settings.business;
  hours = this.settings.hoursSummary;
  status = this.settings.status;
  policies = POLICY_LINKS;
  welcome = inject(WelcomeService);
  consent = inject(ConsentService);
  year = new Date().getFullYear();
}

import { Component, inject, OnInit, signal } from '@angular/core';
import { AnalyticsService, SettingsService } from './core/services';
import { NavigationEnd, Router } from '@angular/router';
import { RouterOutlet } from '@angular/router';
import { Backend } from './core/backend';
import { FooterComponent } from './layout/footer.component';
import { HeaderComponent } from './layout/header.component';
import { QuickViewComponent } from './shared/quick-view.component';
import { ToastsComponent } from './shared/toasts.component';
import { WelcomeComponent } from './shared/welcome.component';
import { CookieNoticeComponent } from './shared/cookie-notice.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, FooterComponent, QuickViewComponent, ToastsComponent, WelcomeComponent, CookieNoticeComponent],
  template: `
    @if (!adminRoute()) {
      @if (settings.settings().announcement) { <div class="announce" role="note">{{ settings.settings().announcement }}</div> }
      <app-header />
    }
    <main id="main" tabindex="-1"><router-outlet /></main>
    @if (!adminRoute()) { <app-footer /> }
    <app-quick-view />
    @if (!adminRoute() && wa(); as href) { <a class="wa" [href]="href" target="_blank" rel="noopener noreferrer" [attr.aria-label]="'Chat with us on WhatsApp. ' + settings.status().label">{{ settings.status().open ? 'Chat with us · online' : 'Message us · ' + settings.status().short }}</a> }
    @if (!adminRoute()) {
      <app-welcome />
      <app-cookie-notice />
    }
    <app-toasts />
  `,
  styles: [`main { min-height: 60vh; outline: none; } .announce { background: #e60023; color: #fff; text-align: center; font-size: .85rem; font-weight: 600; padding: .45rem 1rem; } .wa { position: fixed; z-index: 70; right: 16px; bottom: 16px; background: #111; color: #fff; text-decoration: none; font-weight: 700; font-size: .9rem; padding: .8rem 1.2rem; border-radius: 999px; box-shadow: 0 6px 20px rgba(0,0,0,.25); transition: transform .25s var(--ease); animation: waIn .6s var(--ease) .8s both; } .wa:hover { transform: translateY(-3px) scale(1.04); } @keyframes waIn { from { opacity: 0; transform: translateY(20px); } }`],
})
export class AppComponent implements OnInit {
  backend = inject(Backend);
  settings = inject(SettingsService);
  private analytics = inject(AnalyticsService);
  private router = inject(Router);
  /** The admin area has its own top bar, so the storefront header, footer and popups stay out of it. */
  adminRoute = signal(typeof location !== 'undefined' && /^\/admin(\/|$)/.test(location.pathname));
  wa = () => { const n = this.settings.settings().whatsapp.replace(/\D/g, ''); return n ? "https://wa.me/" + n : ""; };
  ngOnInit() {
    void this.settings.load();
    this.router.events.subscribe((e) => { if (e instanceof NavigationEnd) this.adminRoute.set(/^\/admin(?:[/?#]|$)/.test(e.urlAfterRedirects)); if (e instanceof NavigationEnd) this.analytics.track('page', e.urlAfterRedirects.split('?')[0].split('#')[0]); });
  }
}

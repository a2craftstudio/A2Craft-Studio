import { RoleBadgeComponent } from '../shared/role-badge.component';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Backend } from '../core/backend';
import { AuthService, SeoService } from '../core/services';
import { AdminStateService } from './admin/admin-state.service';
import { CallbacksTabComponent } from './admin/callbacks-tab.component';
import { CategoriesTabComponent } from './admin/categories-tab.component';
import { ContentTabComponent } from './admin/content-tab.component';
import { InquiriesTabComponent } from './admin/inquiries-tab.component';
import { OrdersTabComponent } from './admin/orders-tab.component';
import { OverviewTabComponent } from './admin/overview-tab.component';
import { PortfolioTabComponent } from './admin/portfolio-tab.component';
import { ProductsTabComponent } from './admin/products-tab.component';
import { CouponsTabComponent, CustomersTabComponent, MessagesTabComponent, ReviewsTabComponent, SettingsTabComponent, SubscribersTabComponent } from './admin/small-tabs.component';
import { VisitorsTabComponent } from './admin/visitors-tab.component';

type TabId = 'callbacks' | 'overview' | 'products' | 'categories' | 'orders' | 'coupons' | 'inquiries' | 'messages' | 'reviews' | 'customers' | 'subscribers' | 'visitors' | 'portfolio' | 'content' | 'settings';
interface Item { id: TabId; label: string; badge?: 'orders' | 'inquiries' | 'messages' | 'reviews' | 'drafts' | 'callbacks'; hint: string }

const NAV: { group: string; items: Item[] }[] = [
  { group: 'Overview', items: [{ id: 'overview', label: 'Dashboard', hint: 'What needs your attention today, sales and what people like.' }] },
  { group: 'Sell', items: [
    { id: 'products', label: 'Products', badge: 'drafts', hint: 'Add designs, set prices, publish or hide them.' },
    { id: 'categories', label: 'Categories', hint: 'The groups customers browse by.' },
    { id: 'orders', label: 'Orders', badge: 'orders', hint: 'Check payments, make personalized items and deliver files.' },
    { id: 'coupons', label: 'Coupons', hint: 'Discount codes for sales and promotions.' },
  ] },
  { group: 'Customers', items: [
    { id: 'inquiries', label: 'Custom requests', badge: 'inquiries', hint: 'Quote and track made-to-order projects.' },
    { id: 'callbacks', label: 'Call-backs', badge: 'callbacks', hint: 'People who left their number so you can call them.' },
    { id: 'messages', label: 'Messages', badge: 'messages', hint: 'Questions sent from the contact form.' },
    { id: 'reviews', label: 'Reviews', badge: 'reviews', hint: 'Approve what customers say before it goes live.' },
    { id: 'customers', label: 'Customers', hint: 'Everyone with an account and what they bought.' },
    { id: 'subscribers', label: 'Subscribers', hint: 'People who joined your newsletter.' },
  ] },
  { group: 'Insights', items: [{ id: 'visitors', label: 'Visitors', hint: 'Who browsed what, for visitors who allowed analytics.' }] },
  { group: 'Site', items: [
    { id: 'portfolio', label: 'Portfolio', hint: 'Showcase finished projects on “Our work”.' },
    { id: 'content', label: 'FAQ & About', hint: 'Edit the FAQ and About page without touching code.' },
    { id: 'settings', label: 'Settings', hint: 'Announcement bar, WhatsApp button and business details for the policies.' },
  ] },
];

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [RouterLink, RoleBadgeComponent, CallbacksTabComponent, OverviewTabComponent, ProductsTabComponent, CategoriesTabComponent, OrdersTabComponent, CouponsTabComponent, InquiriesTabComponent, MessagesTabComponent, ReviewsTabComponent,
    CustomersTabComponent, SubscribersTabComponent, VisitorsTabComponent, PortfolioTabComponent, ContentTabComponent, SettingsTabComponent],
  template: `
    <div class="shell">
      <aside class="side" [attr.aria-label]="auth.roleLabel() + ' menu'">
        <div class="who"><strong>Studio admin</strong><span>{{ auth.session()?.email }}</span></div>
        <nav>
          @for (g of nav; track g.group) {
            <p class="grp">{{ g.group }}</p>
            @for (i of g.items; track i.id) {
              <a [routerLink]="[]" [queryParams]="{ tab: i.id }" [class.on]="tab() === i.id" [attr.aria-current]="tab() === i.id ? 'page' : null">
                <span>{{ i.label }}</span>@if (badge(i); as n) { <b class="badge" [attr.aria-label]="n + ' need attention'">{{ n }}</b> }
              </a>
            }
          }
        </nav>
        <a class="site" routerLink="/" target="_blank">View the site ↗</a>
      </aside>

      <main class="main">
        <div class="mob"><label class="sr-only" for="adm-nav">{{ auth.roleLabel() }} section</label>
          <select id="adm-nav" [value]="tab()" (change)="open($any($event.target).value)">
            @for (g of nav; track g.group) { <optgroup [label]="g.group">@for (i of g.items; track i.id) { <option [value]="i.id" [selected]="tab() === i.id">{{ i.label }}{{ badge(i) ? ' (' + badge(i) + ')' : '' }}</option> }</optgroup> }
          </select></div>

        <header class="head"><h1>{{ current().label }} <app-role-badge [role]="auth.session()?.role" [superAdmin]="!!auth.session()?.superAdmin" /></h1><p class="adm-intro">{{ current().hint }}</p></header>

        @switch (tab()) {
          @case ('overview') { <app-overview-tab (go)="open($event)" /> }
          @case ('products') { <app-products-tab /> }
          @case ('categories') { <app-categories-tab /> }
          @case ('orders') { <app-orders-tab /> }
          @case ('coupons') { <app-coupons-tab /> }
          @case ('inquiries') { <app-inquiries-tab /> }
          @case ('callbacks') { <app-callbacks-tab /> }
          @case ('messages') { <app-messages-tab /> }
          @case ('reviews') { <app-reviews-tab /> }
          @case ('customers') { <app-customers-tab /> }
          @case ('subscribers') { <app-subscribers-tab /> }
          @case ('visitors') { <app-visitors-tab /> }
          @case ('portfolio') { <app-portfolio-tab /> }
          @case ('content') { <app-content-tab /> }
          @case ('settings') { <app-settings-tab /> }
        }
      </main>
    </div>
  `,
  styles: [`
    .shell { display: grid; grid-template-columns: 240px 1fr; gap: clamp(16px, 3vw, 36px); max-width: 1500px; margin: 0 auto; padding: 24px clamp(12px, 3vw, 32px) 72px; align-items: start; }
    .side { position: sticky; top: calc(var(--header-h) + 12px); background: #fff; border: 1px solid var(--line); border-radius: 24px; padding: 16px 12px; max-height: calc(100dvh - var(--header-h) - 24px); overflow: auto; }
    .who { padding: 4px 10px 12px; strong { display: block; font-size: 1.05rem; } span { font-size: .78rem; color: var(--muted); word-break: break-all; } }
    .grp { margin: 14px 10px 4px; font-size: .7rem; text-transform: uppercase; letter-spacing: .12em; font-weight: 700; color: var(--muted); }
    nav a { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: .55rem .8rem; border-radius: 14px; text-decoration: none; color: #111; font-weight: 500; font-size: .93rem; cursor: pointer; transition: background .2s;
      &:hover { background: #efefef; } &.on { background: #111; color: #fff; font-weight: 700; } }
    .badge { min-width: 22px; height: 22px; padding: 0 6px; border-radius: 999px; background: #e60023; color: #fff; font-size: .72rem; display: grid; place-items: center; }
    .site { display: block; margin: 14px 10px 4px; font-size: .85rem; color: var(--muted); }
    .main { min-width: 0; } .head { margin-bottom: 1rem; h1 { font-size: clamp(1.8rem, 3vw, 2.4rem); margin: 0 0 .2rem; } p { margin: 0; } }
    .mob { display: none; margin-bottom: 1rem; select { width: 100%; padding: .8rem 1rem; border-radius: 16px; border: 1px solid var(--line); font: inherit; background: #fff; } }
    .dev { font-size: .85rem; }
    @media (max-width: 960px) { .shell { grid-template-columns: 1fr; } .side { display: none; } .mob { display: block; } }
  `],
})
export class AdminPage implements OnInit {
  backend = inject(Backend);
  auth = inject(AuthService);
  private state = inject(AdminStateService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private seo = inject(SeoService);
  nav = NAV;
  private all = NAV.flatMap((g) => g.items);
  tab = signal<TabId>('overview');
  current = computed(() => this.all.find((i) => i.id === this.tab()) ?? this.all[0]);

  constructor() {
    // The ?tab= query param is the source of truth, so refresh, back and shared links all land on the same tab.
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((q) => {
      const t = q.get('tab') as TabId | null;
      this.tab.set(t && this.all.some((i) => i.id === t) ? t : 'overview');
      void this.state.refresh();
    });
  }

  badge(i: Item): number {
    return i.badge ? this.state.counts()[i.badge] : 0;
  }

  open(id: string) {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { tab: id } });
  }

  ngOnInit() {
    this.seo.set({ title: this.auth.session()?.superAdmin ? 'Super admin' : 'Admin' });
    void this.state.refresh();
  }
}


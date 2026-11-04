import { Component, computed, inject, OnInit, output, signal } from '@angular/core';
import { Backend } from '../../core/backend';
import { Order, Product } from '../../core/models';
import { formatInr, SettingsService } from '../../core/services';
import { AdminStateService } from './admin-state.service';
import { PopularityChartComponent } from './popularity-chart.component';

interface Todo { tab: string; label: string; count: number; hint: string }

@Component({
  selector: 'app-overview-tab',
  standalone: true,
  imports: [PopularityChartComponent],
  template: `
    <section class="adm-card" aria-labelledby="todo-h">
      <h2 id="todo-h" class="adm-h">Needs your attention</h2>
      @if (todos().length) {
        <ul class="todo">
          @for (t of todos(); track t.tab) {
            <li><button type="button" (click)="go.emit(t.tab)"><b>{{ t.count }}</b><span><strong>{{ t.label }}</strong><small>{{ t.hint }}</small></span><i aria-hidden="true">→</i></button></li>
          }
        </ul>
      } @else { <p class="ok">You’re all caught up. Nothing is waiting on you.</p> }
      <div class="adm-actions quick">
        <button class="btn small" type="button" (click)="go.emit('products')">Add a product</button>
        <button class="btn small ghost" type="button" (click)="go.emit('coupons')">Create a coupon</button>
        <button class="btn small ghost" type="button" (click)="go.emit('settings')">Edit announcement</button>
        <button class="btn small ghost" type="button" (click)="go.emit('portfolio')">Add a project</button>
      </div>
    </section>

    <div class="stats">
      <div class="card stat"><span>Revenue (verified, all time)</span><strong>{{ money(revenue()) }}</strong></div>
      <div class="card stat"><span>Last 7 days</span><strong>{{ money(last7()) }}</strong></div>
      <div class="card stat"><span>Paid orders</span><strong>{{ paid().length }}</strong></div>
      <div class="card stat"><span>Average order</span><strong>{{ money(avg()) }}</strong></div>
      <div class="card stat"><span>Published products</span><strong>{{ published() }}</strong></div>
      <div class="card stat"><span>Newsletter subscribers</span><strong>{{ subscribers() }}</strong></div>
    </div>

    <section class="adm-card" aria-labelledby="check-h">
      <h2 id="check-h" class="adm-h">Launch checklist</h2>
      <ul class="check">
        @for (c of checklist(); track c.label) { <li [class.done]="c.done"><span aria-hidden="true">{{ c.done ? '✓' : '○' }}</span><span>{{ c.label }}</span>@if (!c.done) { <button type="button" class="link" (click)="go.emit(c.tab)">Fix</button> }</li> }
      </ul>
    </section>

    <section class="adm-card" aria-labelledby="sales-h">
      <h2 id="sales-h" class="adm-h">Verified sales, last 14 days</h2>
      <div class="cols" role="img" aria-label="Daily verified sales for the last 14 days">
        @for (d of days(); track d.day) { <div class="col"><span class="bar" [style.height.%]="d.pct" [title]="d.day + ': ' + money(d.total)"></span><small>{{ d.day.slice(8) }}</small></div> }
      </div>
    </section>

    <app-popularity-chart />

    <section class="adm-card" aria-labelledby="top-h">
      <h2 id="top-h" class="adm-h">Top selling</h2>
      @for (p of top(); track p.title) { <div class="trow"><span>{{ p.title }}</span><strong>{{ p.qty }} sold · {{ money(p.total) }}</strong></div> } @empty { <p class="muted">Sales appear here after the first verified order.</p> }
      <p class="muted fine">Revenue counts only orders whose payment was verified on the server. Refunded orders are excluded.</p>
    </section>
  `,
  styles: [`
    .todo { list-style: none; padding: 0; margin: .6rem 0 1rem; display: grid; gap: 8px; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      button { width: 100%; display: flex; align-items: center; gap: 14px; text-align: left; border: 0; background: #fde8ec; border-radius: 18px; padding: .9rem 1.1rem; transition: transform .2s var(--ease), background .2s; &:hover { transform: translateY(-2px); background: #fbd5dd; }
        b { min-width: 38px; height: 38px; border-radius: 50%; background: #e60023; color: #fff; display: grid; place-items: center; font-size: 1rem; flex: none; } span { flex: 1; } strong { display: block; } small { color: #6b6b6b; } i { font-style: normal; font-weight: 700; } } }
    .ok { color: #14632a; font-weight: 600; } .quick { margin-top: .4rem; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 14px; margin-bottom: 14px; } .stat { padding: 1.1rem 1.2rem; border-top: 3px solid #6d28d9; span { display: block; font-size: .72rem; text-transform: uppercase; letter-spacing: .08em; font-weight: 600; color: var(--muted); margin-bottom: .35rem; } strong { font-size: 1.7rem; letter-spacing: -.02em; } }
    .check { list-style: none; padding: 0; margin: .4rem 0 0; display: grid; gap: 6px; li { display: flex; align-items: center; gap: 10px; font-size: .95rem; span:first-child { width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; background: #efefef; font-weight: 700; flex: none; } &.done { color: var(--muted); span:first-child { background: #dff5e3; color: #14632a; } } }
      .link { background: none; border: 0; padding: 0; text-decoration: underline; color: #e60023; font-weight: 600; } }
    .cols { display: flex; align-items: flex-end; gap: 6px; height: 150px; } .col { flex: 1; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; gap: 4px; small { font-size: .7rem; color: var(--muted); } }
    .bar { width: 100%; background: #e60023; border-radius: 6px 6px 0 0; transition: height .6s var(--ease); min-height: 2px; }
    .trow { display: flex; justify-content: space-between; gap: 1rem; padding: .5rem 0; border-bottom: 1px solid var(--line); font-size: .92rem; } .fine { font-size: .8rem; margin-bottom: 0; }
  `],
})
export class OverviewTabComponent implements OnInit {
  private backend = inject(Backend);
  private state = inject(AdminStateService);
  private settings = inject(SettingsService);
  go = output<string>();
  money = formatInr;
  orders = signal<Order[]>([]);
  products = signal<Product[]>([]);
  subscribers = signal(0);

  paid = computed(() => this.orders().filter((o) => o.paymentVerified && o.status !== 'refunded'));
  revenue = computed(() => this.paid().reduce((s, o) => s + o.total, 0));
  last7 = computed(() => this.paid().filter((o) => Date.now() - new Date(o.createdAt).getTime() < 7 * 86400000).reduce((s, o) => s + o.total, 0));
  avg = computed(() => (this.paid().length ? Math.round(this.revenue() / this.paid().length) : 0));
  published = computed(() => this.products().filter((p) => p.status === 'published').length);

  todos = computed<Todo[]>(() => {
    const c = this.state.counts();
    const awaiting = this.orders().filter((o) => o.status === 'pending').length;
    return [
      { tab: 'orders', label: 'Orders to make and deliver', count: c.orders, hint: 'Paid, personalized, no final file uploaded yet' },
      { tab: 'inquiries', label: 'New custom requests', count: c.inquiries, hint: 'Reply with a quote and timeline' },
      { tab: 'callbacks', label: 'People waiting for a call', count: c.callbacks, hint: 'They left their number, call them back' },
      { tab: 'messages', label: 'Unanswered messages', count: c.messages, hint: 'From the contact form' },
      { tab: 'reviews', label: 'Reviews waiting for approval', count: c.reviews, hint: 'Approve to show them on the site' },
      { tab: 'orders', label: 'Orders awaiting payment', count: awaiting, hint: 'Customers who started but did not pay' },
      { tab: 'products', label: 'Draft products', count: c.drafts, hint: 'Not visible to customers until published' },
    ].filter((t) => t.count > 0);
  });

  checklist = computed(() => [
    { label: 'Business name, address and GSTIN are filled in (used on every policy page)', done: !this.settings.businessIncomplete(), tab: 'settings' },
    { label: 'At least one product is published', done: this.products().some((p) => p.status === 'published'), tab: 'products' },
    { label: 'Support email is set', done: !!this.settings.settings().supportEmail?.trim() || !!this.settings.settings().business?.supportEmail?.trim(), tab: 'settings' },
    { label: 'WhatsApp number is set (optional chat button)', done: !!this.settings.settings().whatsapp?.trim(), tab: 'settings' },
    { label: 'FAQ answers match how you really work', done: !!this.settings.faq(), tab: 'content' },
  ]);

  days = computed(() => {
    const out: { day: string; total: number; pct: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const day = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      out.push({ day, total: this.paid().filter((o) => o.createdAt.startsWith(day)).reduce((s, o) => s + o.total, 0), pct: 0 });
    }
    const max = Math.max(1, ...out.map((d) => d.total));
    return out.map((d) => ({ ...d, pct: Math.max(d.total ? 6 : 1, (d.total / max) * 100) }));
  });

  top = computed(() => {
    const m = new Map<string, { title: string; qty: number; total: number }>();
    for (const o of this.paid()) for (const i of o.items) { const e = m.get(i.title) ?? { title: i.title, qty: 0, total: 0 }; e.qty += i.qty; e.total += i.unit * i.qty; m.set(i.title, e); }
    return [...m.values()].sort((a, b) => b.total - a.total).slice(0, 5);
  });

  async ngOnInit() {
    void this.settings.load();
    const [o, p, s] = await Promise.all([
      this.backend.listAllOrders().catch(() => []), this.backend.listProducts(true).catch(() => []), this.backend.listSubscribers().catch(() => []),
    ]);
    this.orders.set(o); this.products.set(p); this.subscribers.set(s.length);
  }
}

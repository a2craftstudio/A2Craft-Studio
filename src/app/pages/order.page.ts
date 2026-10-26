import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Backend } from '../core/backend';
import { Order } from '../core/models';
import { CatalogService, formatInr, SeoService, SettingsService, ToastService } from '../core/services';

@Component({
  selector: 'app-order',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="container narrow">
      @if (loading()) { <div class="skeleton" style="height: 260px"></div> }
      @else if (order()) {
        @let o = order()!;
        <div class="card box reveal">
          @switch (state()) {
            @case ('paid') { <p class="eyebrow">Order confirmed</p><h1>Thank you, {{ first(o.customerName) }}!</h1><p>Your payment was verified. Order <strong>{{ short(o.id) }}</strong>.</p> }
            @case ('pending') { <p class="eyebrow">Payment pending</p><h1>We’re waiting for confirmation</h1><p>Your payment hasn’t been confirmed yet. Downloads unlock automatically once it’s verified. Check back shortly; you won’t be charged twice.</p> }
            @case ('failed') { <p class="eyebrow">Payment failed</p><h1>That payment didn’t go through</h1><p>You haven’t been charged for this order. You can go back and try again.</p> }
            @default { <p class="eyebrow">Cancelled</p><h1>Payment cancelled</h1><p>Nothing was charged. Your bag is still saved.</p> }
          }
          @if (state() === 'failed' || state() === 'cancelled') { <a class="btn" routerLink="/checkout">Return to checkout</a> }
          @if (state() === 'pending') { <button class="btn soft" type="button" (click)="load()">Refresh status</button> }

          <ol class="tl" aria-label="Order progress">
            @for (s of steps(o); track s.label) { <li [class.done]="s.done"><span class="dot"></span>{{ s.label }}</li> }
          </ol>
          <h2>Items</h2>
          <ul class="list">
            @for (i of o.items; track $index) {
              <li><div><strong>{{ i.title }}</strong> × {{ i.qty }}
                  @if (i.customization) { <p class="muted s">Personalized for {{ i.customization.fields['name'] }} · {{ i.customization.fields['date'] }}</p> }</div>
                <span>{{ money(i.unit * i.qty) }}</span>
                @if (o.paymentVerified && i.customization && !i.deliverable) { <span class="muted s">Being prepared</span> }
                @else if (o.paymentVerified) { <button class="btn small" type="button" (click)="download(o.id, i.productId)">{{ i.deliverable ? 'Download final files' : 'Download' }}</button> }
                @if (o.paymentVerified && slug(i.productId); as sl) { <a class="rv" [routerLink]="['/product', sl]" fragment="rev-title">Review</a> }</li>
            }
          </ul>
          <p class="tot">{{ o.paymentVerified ? 'Total paid' : 'Order total' }}: {{ money(o.total) }}</p>
          <div class="acts">
            @if (o.paymentVerified) { <button class="btn small ghost" type="button" (click)="print()">Print receipt</button> }
            <a class="btn small ghost" routerLink="/contact" [queryParams]="{ order: short(o.id) }">Need help with this order?</a>
          </div>
          @if (o.paymentVerified) { <p class="muted">Personalized and video items are prepared by hand; we’ll email you when your final files are ready. Standard files download immediately. Find everything later under <a routerLink="/account" [queryParams]="{ tab: 'orders' }">My account</a>.</p> }
        </div>
        <section class="print-only receipt" aria-hidden="true">
          <h1>Payment receipt</h1>
          <p><strong>{{ biz().legalName }}</strong><br />{{ biz().address }}<br />GSTIN: {{ biz().gstin }} · {{ biz().supportEmail }}</p>
          <p>Order <strong>{{ short(o.id) }}</strong> · {{ o.createdAt.slice(0, 10) }}<br />Billed to: {{ o.customerName }} ({{ o.email }})</p>
          <table><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Amount</th></tr></thead><tbody>
            @for (i of o.items; track $index) { <tr><td>{{ i.title }}</td><td>{{ i.qty }}</td><td>{{ money(i.unit) }}</td><td>{{ money(i.unit * i.qty) }}</td></tr> }
          </tbody><tfoot><tr><td colspan="3"><strong>Total paid (INR)</strong></td><td><strong>{{ money(o.total) }}</strong></td></tr></tfoot></table>
          <p>Payment status: {{ o.paymentVerified ? 'Verified' : 'Not verified' }}. This is a payment receipt for your records. Digital products, delivered electronically.</p>
        </section>
      } @else {
        <div class="empty"><h1>Order not found</h1><p>Please sign in to view your orders.</p><a class="btn" routerLink="/account">My account</a></div>
      }
    </div>
  `,
  styles: [`.narrow { max-width: 720px; padding-block: 32px 64px; } .box { padding: clamp(20px, 4vw, 40px); } .list { list-style: none; padding: 0; li { display: grid; grid-template-columns: 1fr auto auto; gap: 1rem; align-items: center; padding: .8rem 0; border-bottom: 1px solid var(--line); } } .s { margin: 0; font-size: .85rem; } .tot { font-weight: 700; margin-top: 1rem; } .tl { list-style: none; padding: 0; margin: 1.2rem 0; display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; li { font-size: .78rem; color: var(--muted); border-top: 3px solid var(--line); padding-top: .5rem; &.done { color: #111; border-color: #e60023; font-weight: 600; } } } .rv { font-size: .8rem; } .acts { display: flex; gap: .6rem; flex-wrap: wrap; margin-top: .8rem; } .receipt table { width: 100%; border-collapse: collapse; margin: 1rem 0; th, td { text-align: left; padding: .4rem; border-bottom: 1px solid #ccc; } }`],
})
export class OrderPage implements OnInit {
  private backend = inject(Backend);
  private route = inject(ActivatedRoute);
  private seo = inject(SeoService);
  private toast = inject(ToastService);
  private catalog = inject(CatalogService);
  biz = inject(SettingsService).business;
  money = formatInr;
  loading = signal(true);
  order = signal<Order | null>(null);
  state = signal<'paid' | 'pending' | 'failed' | 'cancelled'>('pending');

  ngOnInit() {
    void this.catalog.load();
    this.seo.set({ title: 'Order confirmation' });
    void this.load();
  }

  async load() {
    this.loading.set(true);
    try {
      const o = await this.backend.getOrder(this.route.snapshot.paramMap.get('id')!);
      this.order.set(o);
      const q = this.route.snapshot.queryParamMap.get('state');
      if (o) this.state.set(o.paymentVerified ? 'paid' : o.status === 'failed' || q === 'failed' ? 'failed' : o.status === 'cancelled' || q === 'cancelled' ? 'cancelled' : 'pending');
    } catch {
      this.order.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  slug = (id: string) => this.catalog.byId(id)?.slug ?? '';
  steps(o: Order) {
    const custom = o.items.some((i) => i.customization);
    const ready = o.items.every((i) => !i.customization || i.deliverable);
    return [
      { label: 'Order placed', done: true },
      { label: 'Payment verified', done: o.paymentVerified },
      { label: custom ? 'Being prepared' : 'Files unlocked', done: o.paymentVerified && (!custom || o.status === 'in_progress' || o.status === 'delivered' || ready) },
      { label: 'Delivered', done: o.paymentVerified && ready && o.status !== 'in_progress' },
    ];
  }
  print() { window.print(); }
  first = (n: string) => n.split(' ')[0] || 'friend';
  short = (id: string) => (id.length > 12 ? id.slice(0, 8).toUpperCase() : id);

  async download(orderId: string, productId: string) {
    try {
      const url = await this.backend.getDownloadUrl(orderId, productId);
      const a = document.createElement('a');
      a.href = url;
      a.download = '';
      a.rel = 'noopener';
      a.click();
    } catch (e) {
      this.toast.show((e as Error).message, 'error');
    }
  }
}


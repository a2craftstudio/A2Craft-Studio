import { Component, computed, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CartService, CatalogService, formatInr, SeoService } from '../core/services';
import { CartItem } from '../core/models';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [RouterLink, FormsModule],
  template: `
    <div class="container top">
      <h1>Your bag</h1>
      @if (!cart.items().length) {
        <div class="empty"><h3>Your bag is empty</h3><p>Find something beautiful to fill it.</p><a class="btn" routerLink="/shop">Browse the shop</a></div>
      } @else {
        <div class="grid">
          <ul class="items">
            @for (it of cart.items(); track it.key) {
              @if (product(it); as p) {
                <li class="card item">
                  <a [routerLink]="['/product', p.slug]"><img [src]="p.gallery[0].url" [alt]="p.title" width="96" height="120" /></a>
                  <div class="mid">
                    <a class="t" [routerLink]="['/product', p.slug]">{{ p.title }}</a>
                    <p class="muted s">{{ p.formats.join(', ') }} · digital delivery</p>
                    @if (it.customization; as c) {
                      <details><summary>Customization summary</summary>
                        <dl class="cs"><dt>Name(s)</dt><dd>{{ c.fields['name'] }}</dd><dt>Date</dt><dd>{{ c.fields['date'] }}</dd>
                          @if (c.fields['message']) { <dt>Message</dt><dd>{{ c.fields['message'] }}</dd> }
                          <dt>Style</dt><dd>{{ c.paletteId }} · {{ c.fontId }}</dd><dt>Photos</dt><dd>{{ c.photos.length }}</dd></dl>
                        <a [routerLink]="['/studio', p.slug]" class="s">Create a new version</a></details>
                    }
                    <button class="link" type="button" (click)="cart.remove(it.key)">Remove</button>
                  </div>
                  <div class="qty">
                    <label class="sr-only" [for]="'q' + it.key">Quantity for {{ p.title }}</label>
                    <button type="button" class="step" (click)="cart.setQty(it.key, it.qty - 1)" aria-label="Decrease quantity">−</button>
                    <input [id]="'q' + it.key" type="number" min="1" max="10" [ngModel]="it.qty" (ngModelChange)="cart.setQty(it.key, +$event || 1)" />
                    <button type="button" class="step" (click)="cart.setQty(it.key, it.qty + 1)" aria-label="Increase quantity">+</button>
                  </div>
                  <span class="price">{{ money(p.priceInr * it.qty) }}</span>
                </li>
              } @else { <li class="card item"><p>This design is no longer available.</p><button class="link" type="button" (click)="cart.remove(it.key)">Remove</button></li> }
            }
          </ul>

          <aside class="card sum" aria-label="Order summary">
            <h2>Summary</h2>
            <form class="coupon" (submit)="$event.preventDefault(); apply()">
              <label class="sr-only" for="coupon">Coupon code</label>
              <input id="coupon" [(ngModel)]="code" name="code" placeholder="Coupon code" autocomplete="off" /><button class="btn soft small" type="submit">Apply</button>
            </form>
            @if (cart.quote(); as q) {
              @if (q.couponMessage) { <p class="hint" role="status">{{ q.couponMessage }}</p> }
              <div class="r"><span>Subtotal</span><span>{{ money(q.subtotal) }}</span></div>
              @if (q.discount) { <div class="r"><span>Discount ({{ q.couponApplied }})</span><span>−{{ money(q.discount) }}</span></div> }
              <div class="r"><span>Delivery</span><span>Digital · free</span></div>
              <div class="r tot"><span>Total</span><span>{{ money(q.total) }}</span></div>
              <p class="muted fine">Final prices and discounts are confirmed by our server at checkout.</p>
            } @else { <div class="skeleton" style="height: 90px"></div> }
            <a class="btn wide" routerLink="/checkout" [class.dis]="!cart.quote()">Continue to checkout</a>
            <p class="muted fine">Digital products: please read our <a routerLink="/refunds">refund policy</a> and <a routerLink="/delivery">delivery details</a>.</p>
          </aside>
        </div>
      }
    </div>
  `,
  styles: [`
    .top { padding-block: 32px 64px; } .grid { display: grid; grid-template-columns: 1fr 360px; gap: 28px; align-items: start; }
    .items { list-style: none; padding: 0; margin: 0; display: grid; gap: 14px; }
    .item { display: grid; grid-template-columns: 96px 1fr auto auto; gap: 16px; padding: 14px; align-items: start; img { border-radius: 12px; object-fit: cover; width: 96px; height: 120px; } }
    .t { font-family: var(--font-serif); font-size: 1.3rem; font-weight: 600; text-decoration: none; } .s { font-size: .85rem; margin: .1rem 0; }
    .link { background: none; border: 0; padding: 0; color: var(--rose); text-decoration: underline; font-size: .85rem; }
    .cs { display: grid; grid-template-columns: 80px 1fr; gap: .2rem .8rem; font-size: .85rem; dt { color: var(--muted); } dd { margin: 0; } }
    details summary { cursor: pointer; font-size: .85rem; font-weight: 600; margin: .3rem 0; }
    .qty { display: flex; align-items: center; gap: 4px; input { width: 48px; text-align: center; padding: .4rem 0; border-radius: 10px; border: 1px solid var(--line); font: inherit; } .step { width: 32px; height: 32px; border-radius: 50%; border: 1px solid var(--line); background: var(--white); } }
    .sum { padding: 22px; position: sticky; top: calc(var(--header-h) + 16px); } .coupon { display: flex; gap: .5rem; margin-bottom: .6rem; input { flex: 1; min-width: 0; padding: .6rem .9rem; border-radius: 999px; border: 1px solid var(--line); font: inherit; } }
    .r { display: flex; justify-content: space-between; padding: .4rem 0; } .tot { font-weight: 700; font-size: 1.15rem; border-top: 1px solid var(--line); margin-top: .4rem; padding-top: .8rem; }
    .wide { width: 100%; margin: 1rem 0 .5rem; } .dis { pointer-events: none; opacity: .5; } .fine { font-size: .78rem; } .hint { font-size: .85rem; color: var(--berry); }
    @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } .sum { position: static; } .item { grid-template-columns: 72px 1fr; img { width: 72px; height: 92px; } .qty, .price { grid-column: 2; } } }
  `],
})
export class CartPage implements OnInit {
  cart = inject(CartService);
  private catalog = inject(CatalogService);
  private seo = inject(SeoService);
  money = formatInr;
  code = '';
  product = (it: CartItem) => this.catalog.byId(it.productId);
  ngOnInit() {
    void this.catalog.load();
    this.code = this.cart.coupon();
    this.seo.set({ title: 'Your bag', path: '/cart' });
  }
  apply() { this.cart.coupon.set(this.code.trim()); }
}

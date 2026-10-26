import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Backend } from '../core/backend';
import { PaymentSession } from '../core/models';
import { CartService, formatInr, SeoService } from '../core/services';

declare global { interface Window { Razorpay?: new (o: Record<string, unknown>) => { open(): void; on(e: string, cb: (r: unknown) => void): void } } }

function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => res();
    s.onerror = () => rej(new Error('Could not load the payment window. Check your connection and try again.'));
    document.head.appendChild(s);
  });
}

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="container top">
      <h1>Checkout</h1>
      @if (!cart.items().length && !session()) {
        <div class="empty"><h3>Your bag is empty</h3><a class="btn" routerLink="/shop">Browse the shop</a></div>
      } @else {
        <div class="grid">
          <form class="card form" [formGroup]="f" (ngSubmit)="pay()" novalidate>
            <h2>Your details</h2>
            @if (!backend.session()) {
              <div class="alert warn">Please <a routerLink="/account" [queryParams]="{ next: 'checkout' }">sign in or create an account</a> first, so your downloads stay in your account.</div>
            }
            <div class="field"><label for="c-name">Full name *</label><input id="c-name" formControlName="name" autocomplete="name" />@if (bad('name')) { <span class="err">Please enter your name.</span> }</div>
            <div class="field"><label for="c-email">Email *</label><input id="c-email" type="email" formControlName="email" autocomplete="email" />@if (bad('email')) { <span class="err">Please enter a valid email.</span> }</div>
            <div class="field"><label for="c-phone">Phone *</label><input id="c-phone" type="tel" formControlName="phone" autocomplete="tel" inputmode="tel" />@if (bad('phone')) { <span class="err">Enter a 10–13 digit phone number.</span> }</div>
            <label class="check"><input type="checkbox" formControlName="terms" /> <span>I understand these are digital products delivered electronically, and I accept the <a routerLink="/terms" target="_blank">terms</a>, <a routerLink="/refunds" target="_blank">refund & cancellation policy</a> and <a routerLink="/delivery" target="_blank">delivery details</a>.</span></label>
            @if (bad('terms')) { <span class="err">Please accept to continue.</span> }
            @if (error()) { <div class="alert error" role="alert">{{ error() }}</div> }
            @if (!session()) { <button class="btn" type="submit" [disabled]="busy()">{{ busy() ? 'Preparing payment…' : 'Pay ' + (cart.quote() ? money(cart.quote()!.total) : '') }}</button> }
            <p class="muted fine">We never see or store your card details. Payments are handled by the payment provider.</p>
          </form>

          <aside class="card sum" aria-label="Order summary">
            <h2>Order summary</h2>
            @if (cart.quote(); as q) {
              @for (l of q.lines; track l.key) { <div class="r"><span>{{ l.title }} × {{ l.qty }}</span><span>{{ money(l.total) }}</span></div> }
              @if (q.discount) { <div class="r"><span>Discount ({{ q.couponApplied }})</span><span>−{{ money(q.discount) }}</span></div> }
              <div class="r tot"><span>Total</span><span>{{ money(q.total) }}</span></div>
            }
            <a routerLink="/cart" class="fine">Edit bag</a>
          </aside>
        </div>
      }

      @if (session(); as s) {
        <div class="scrim"></div>
        <div class="modal card" role="dialog" aria-modal="true" aria-labelledby="dev-h">
          <p class="demo-tag">Development payment simulator</p>
          <h2 id="dev-h">Simulate the payment result</h2>
          <p class="muted">No real payment is taken. In production, Razorpay’s secure window opens here and the result is verified on the server before any download is granted.</p>
          <div class="opts">
            <button class="btn" type="button" (click)="simulate('success')">Payment succeeds</button>
            <button class="btn ghost" type="button" (click)="simulate('pending')">Payment pending</button>
            <button class="btn ghost" type="button" (click)="simulate('failed')">Payment fails</button>
            <button class="btn ghost" type="button" (click)="simulate('cancelled')">Customer cancels</button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .top { padding-block: 32px 64px; } .grid { display: grid; grid-template-columns: 1fr 360px; gap: 28px; align-items: start; }
    .form, .sum { padding: clamp(18px, 3vw, 30px); } .r { display: flex; justify-content: space-between; gap: 1rem; padding: .4rem 0; font-size: .92rem; }
    .tot { font-weight: 700; border-top: 1px solid var(--line); margin-top: .4rem; padding-top: .8rem; } .fine { font-size: .8rem; margin-top: 1rem; display: block; }
    .err { color: #a3263f; font-size: .82rem; } .scrim { position: fixed; inset: 0; background: rgba(71,54,51,.55); z-index: 90; }
    .modal { position: fixed; z-index: 91; inset: 0; margin: auto; width: min(480px, calc(100% - 24px)); height: fit-content; padding: 28px; background: var(--ivory); } .opts { display: grid; gap: .6rem; margin-top: 1rem; }
    @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
  `],
})
export class CheckoutPage implements OnInit {
  cart = inject(CartService);
  backend = inject(Backend);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private seo = inject(SeoService);
  money = formatInr;
  busy = signal(false);
  error = signal('');
  session = signal<PaymentSession | null>(null);

  f = this.fb.nonNullable.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required, Validators.pattern(/^\+?[0-9\s-]{10,16}$/)]],
    terms: [false, Validators.requiredTrue],
  });

  ngOnInit() {
    this.seo.set({ title: 'Checkout', path: '/checkout' });
    try { const saved = JSON.parse(sessionStorage.getItem('a2.checkout') ?? 'null'); if (saved) this.f.patchValue(saved); } catch { /* ignore */ }
    const s = this.backend.session();
    if (s) this.f.patchValue({ name: s.name, email: s.email });
  }

  bad(c: 'name' | 'email' | 'phone' | 'terms') {
    const x = this.f.controls[c];
    return x.invalid && x.touched;
  }

  async pay() {
    this.f.markAllAsTouched();
    if (this.f.invalid) return;
    if (!this.backend.session()) { this.error.set('Please sign in or create an account first, so your downloads stay in your account.'); return; }
    this.busy.set(true);
    this.error.set('');
    try {
      const v = this.f.getRawValue();
      try { sessionStorage.setItem('a2.checkout', JSON.stringify({ name: v.name, email: v.email, phone: v.phone })); } catch { /* ignore */ }
      // Only product ids, quantities and customization go to the server; it computes every price itself.
      const s = await this.backend.createOrder({
        items: this.cart.items(), coupon: this.cart.coupon() || undefined,
        customer: { name: v.name, email: v.email, phone: v.phone }, acceptedTerms: v.terms,
      });
      if (s.provider === 'simulator') this.session.set(s);
      else await this.openRazorpay(s);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }

  private async openRazorpay(s: PaymentSession) {
    await loadRazorpay();
    const v = this.f.getRawValue();
    const rz = new window.Razorpay!({
      key: s.keyId,
      order_id: s.providerOrderId,
      amount: s.amountPaise,
      currency: 'INR',
      name: 'A2 Craft Studio',
      prefill: { name: v.name, email: v.email, contact: v.phone },
      theme: { color: '#e60023' },
      handler: (r: Record<string, string>) => void this.finish(s, r),
      modal: { ondismiss: () => void this.router.navigate(['/order', s.orderId], { queryParams: { state: 'cancelled' } }) },
    });
    rz.on('payment.failed', () => void this.router.navigate(['/order', s.orderId], { queryParams: { state: 'failed' } }));
    rz.open();
  }

  simulate(outcome: string) { void this.finish(this.session()!, { outcome }); }

  private async finish(s: PaymentSession, payload: Record<string, string>) {
    try {
      const order = await this.backend.verifyPayment(s, payload);
      if (order.paymentVerified) this.cart.clear();
      void this.router.navigate(['/order', order.id]);
    } catch (e) {
      this.session.set(null);
      this.error.set(`We couldn’t verify the payment: ${(e as Error).message} If money was deducted, it will be reconciled automatically; check your orders shortly.`);
    }
  }
}

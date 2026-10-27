import { RoleBadgeComponent } from '../shared/role-badge.component';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Backend } from '../core/backend';
import { Inquiry, Order } from '../core/models';
import { AuthService, CatalogService, FavoritesService, formatInr, ConsentService, RecentlyViewedService, SeoService, SessionActions, ToastService } from '../core/services';
import { MasonryComponent } from '../shared/masonry.component';

type Mode = 'signin' | 'signup' | 'forgot';

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, MasonryComponent, RoleBadgeComponent],
  template: `
    <div class="container top">
      @if (resetToken()) {
        <div class="auth card">
          <h1>Choose a new password</h1>
          <p class="muted">Pick something at least 8 characters long. This link works once and expires an hour after it was sent.</p>
          <form [formGroup]="rf" (ngSubmit)="submitReset()" novalidate>
            <div class="field"><label for="r-pw">New password</label><input id="r-pw" type="password" formControlName="password" autocomplete="new-password" />@if (rf.controls.password.touched && rf.controls.password.invalid) { <span class="err">Use at least 8 characters.</span> }</div>
            @if (error()) { <div class="alert error" role="alert">{{ error() }}</div> }
            <button class="btn wide" type="submit" [disabled]="busy()">Save new password</button>
          </form>
          <p class="sw"><button class="link" type="button" (click)="resetToken.set('')">Back to sign in</button></p>
        </div>
      } @else if (!auth.session()) {
        <div class="auth card">
          <h1>{{ mode() === 'signup' ? 'Create your account' : mode() === 'forgot' ? 'Reset your password' : 'Welcome back' }}</h1>
          <p class="muted">You can browse and shop without an account; sign in to keep orders, downloads and saved designs together.</p>
          <form [formGroup]="af" (ngSubmit)="submitAuth()" novalidate>
            @if (mode() === 'signup') { <div class="field"><label for="a-name">Name</label><input id="a-name" formControlName="name" autocomplete="name" />@if (bad('name')) { <span class="err">Please enter your name.</span> }</div> }
            <div class="field"><label for="a-email">Email</label><input id="a-email" type="email" formControlName="email" autocomplete="email" />@if (bad('email')) { <span class="err">Please enter a valid email.</span> }</div>
            @if (mode() !== 'forgot') { <div class="field"><label for="a-pw">Password</label><input id="a-pw" type="password" formControlName="password" [autocomplete]="mode() === 'signup' ? 'new-password' : 'current-password'" />
              @if (bad('password')) { <span class="err">Use at least 8 characters.</span> }</div> }
            @if (mode() === 'signup') { <label class="check"><input type="checkbox" formControlName="terms" /> <span>I agree to the <a routerLink="/terms" target="_blank">Terms of service</a> and <a routerLink="/privacy" target="_blank">Privacy policy</a>.</span></label>
              @if (bad('terms')) { <span class="err">Please accept to create your account.</span> } }
            @if (error()) { <div class="alert error" role="alert">{{ error() }}</div> }
            @if (info()) { <div class="alert" role="status">{{ info() }}</div> }
            <button class="btn wide" type="submit" [disabled]="busy()">{{ mode() === 'signup' ? 'Create account' : mode() === 'forgot' ? 'Send reset link' : 'Sign in' }}</button>
          </form>
          <p class="sw">
            @if (mode() !== 'signin') { <button class="link" type="button" (click)="setMode('signin')">I have an account</button> }
            @if (mode() !== 'signup') { <button class="link" type="button" (click)="setMode('signup')">Create an account</button> }
            @if (mode() === 'signin') { <button class="link" type="button" (click)="setMode('forgot')">Forgot password?</button> }
          </p>
        </div>
      } @else {
        <p class="eyebrow">My account</p>
        <h1>Hello, {{ auth.session()!.name || 'there' }} <app-role-badge [role]="auth.session()?.role" [superAdmin]="!!auth.session()?.superAdmin" /></h1>
        <div class="tabs" role="tablist">
          @for (t of tabs; track t.id) { <button role="tab" type="button" class="chip" [class.active]="tab() === t.id" [attr.aria-selected]="tab() === t.id" (click)="tab.set(t.id)">{{ t.label }}</button> }
          @if (auth.isAdmin()) { <a class="chip" routerLink="/admin">Admin dashboard</a> }
          <button class="chip" type="button" (click)="logout()">Log out</button>
        </div>

        @switch (tab()) {
          @case ('orders') {
            @if (!orders().length) { <div class="empty"><h3>No orders yet</h3><a class="btn" routerLink="/shop">Browse the shop</a></div> }
            @for (o of orders(); track o.id) {
              <article class="card ord"><div><strong>#{{ o.id.slice(0, 8).toUpperCase() }}</strong> <span class="pill" [class.green]="o.status === 'delivered' || o.status === 'paid'" [class.amber]="o.status === 'in_progress' || o.status === 'pending'" [class.red]="o.status === 'failed'">{{ label(o.status) }}</span><p class="muted s">{{ o.createdAt.slice(0, 10) }} · {{ money(o.total) }}</p>
                <p class="s">{{ names(o) }}</p></div><a class="btn small ghost" [routerLink]="['/order', o.id]">View</a></article>
            }
          }
          @case ('downloads') {
            @if (!paid().length) { <div class="empty"><h3>No downloads yet</h3><p>Downloads appear here after a verified payment.</p></div> }
            @for (o of paid(); track o.id) { @for (i of o.items; track $index) {
              <article class="card ord"><div><strong>{{ i.title }}</strong><p class="muted s">Order #{{ o.id.slice(0, 8).toUpperCase() }}</p></div>@if (i.customization && !i.deliverable) { <span class="pill amber">Being prepared</span> } @else { <button class="btn small" type="button" (click)="download(o.id, i.productId)">{{ i.deliverable ? 'Download final files' : 'Download' }}</button> }</article>
            } }
          }
          @case ('saved') {
            <app-masonry [products]="saved()" [loading]="catalog.loading()" (clear)="tab.set('orders')" />
          }
          @case ('history') {
            <p class="muted s">Designs you looked at on this device, newest first. It is never sent to our server.</p>
            @if (!history().length) { <div class="empty"><h3>Nothing viewed yet</h3><p>Open any design and it will show up here.</p><a class="btn" routerLink="/shop">Browse the shop</a></div> }
            @else {
              <div class="row"><button class="btn ghost small" type="button" (click)="recent.clear()">Clear history</button></div>
              <app-masonry [products]="history()" />
            }
          }
          @case ('custom') {
            @if (!inquiries().length) { <div class="empty"><h3>No custom requests</h3><a class="btn" routerLink="/custom-order">Start one</a></div> }
            @for (i of inquiries(); track i.id) {
              <article class="card ord"><div><strong>{{ i.productType }}</strong> <span class="pill" [class.green]="i.status === 'completed'" [class.amber]="i.status === 'in_progress' || i.status === 'quoted'">{{ i.status.replace('_', ' ') }}</span><p class="muted s">{{ i.id }} · deadline {{ i.deadline }}</p></div></article>
            }
          }
          @case ('profile') {
            <form class="card prof" [formGroup]="pf" (ngSubmit)="saveProfile()" novalidate>
              <div class="field"><label for="p-name">Name</label><input id="p-name" formControlName="name" /></div>
              <div class="field"><label for="p-email">Email</label><input id="p-email" [value]="auth.session()!.email" disabled /><span class="hint">To change your email, contact us.</span></div>
              <div class="field"><label>Account type</label><p><app-role-badge [role]="auth.session()?.role" [superAdmin]="!!auth.session()?.superAdmin" [showCustomer]="true" /></p></div>
              <button class="btn" type="submit">Save profile</button>
            </form>
            <form class="card prof" [formGroup]="pw" (ngSubmit)="savePassword()" novalidate>
              <h3>Change password</h3>
              <div class="field"><label for="p-new">New password</label><input id="p-new" type="password" formControlName="password" autocomplete="new-password" />@if (pw.controls.password.touched && pw.controls.password.invalid) { <span class="err">Use at least 8 characters.</span> }</div>
              <button class="btn" type="submit">Update password</button>
            </form>
            <div class="card prof"><h3>Your account is private</h3><p class="muted s">Your orders, downloads, saved designs, viewing history and requests are visible only to you. Our team sees order details only to fulfil them. You can sign out at any time, and on a shared computer use the options below.</p>
              <div class="row"><button class="btn small" type="button" (click)="logout()">Log out</button><button class="btn ghost small" type="button" (click)="logoutAndClear()">Log out and clear this device</button><button class="btn ghost small" type="button" (click)="clearDevice()">Clear this device only</button></div></div>
            <div class="card prof"><h3>Privacy choices</h3><p class="muted s">Visit analytics: {{ consent.choice() === 'granted' ? 'on. Pages and designs you view are recorded and linked to your account while you are signed in.' : 'off. Nothing you browse is recorded.' }}</p>
              <button class="btn ghost small" type="button" (click)="consent.set(consent.choice() === 'granted' ? 'denied' : 'granted')">{{ consent.choice() === 'granted' ? 'Turn off analytics' : 'Turn on analytics' }}</button></div>
            <div class="card prof"><h3>Your data</h3><p class="muted s">You can ask for a copy of your data or ask us to delete your account. We reply within 30 days. Records we must keep by law (like invoices) are kept for the legal period.</p>
              <div class="row"><button class="btn ghost small" type="button" (click)="dataRequest('download')">Request my data</button><button class="btn ghost small" type="button" (click)="dataRequest('delete')">Delete my account</button></div></div>
          }
        }
      }
    </div>
  `,
  styles: [`
    .top { padding-block: 32px 64px; } .auth { max-width: 460px; margin: 0 auto; padding: clamp(22px, 4vw, 40px); } .wide { width: 100%; }
    .sw { display: flex; gap: 1rem; flex-wrap: wrap; justify-content: center; margin: 1rem 0 0; } .link { background: none; border: 0; text-decoration: underline; color: var(--berry); font-size: .9rem; }
    .tabs { display: flex; gap: .5rem; flex-wrap: wrap; margin: 1rem 0 1.5rem; .chip { cursor: pointer; } }
    .ord { display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding: 1rem 1.3rem; margin-bottom: 12px; p { margin: .1rem 0; } } .s { font-size: .85rem; }
    .pill { background: var(--blush); border-radius: 999px; padding: .1rem .6rem; font-size: .72rem; font-weight: 600; text-transform: capitalize; margin-left: .4rem; }
    .prof { max-width: 480px; padding: 1.6rem; margin-top: 14px; } .row { display: flex; gap: .5rem; flex-wrap: wrap; } .err { color: #a3263f; font-size: .82rem; }
  `],
})
export class AccountPage implements OnInit {
  auth = inject(AuthService);
  backend = inject(Backend);
  catalog = inject(CatalogService);
  fav = inject(FavoritesService);
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toast = inject(ToastService);
  private seo = inject(SeoService);
  money = formatInr;
  tabs = [
    { id: 'orders', label: 'Orders' }, { id: 'downloads', label: 'Downloads' }, { id: 'saved', label: 'Saved' }, { id: 'history', label: 'History' },
    { id: 'custom', label: 'Custom orders' }, { id: 'profile', label: 'Profile' },
  ];
  mode = signal<Mode>('signin');
  tab = signal('orders');
  busy = signal(false);
  error = signal('');
  info = signal('');
  orders = signal<Order[]>([]);
  inquiries = signal<Inquiry[]>([]);
  paid = computed(() => this.orders().filter((o) => o.paymentVerified));
  recent = inject(RecentlyViewedService);
  consent = inject(ConsentService);
  private sessionActions = inject(SessionActions);
  history = computed(() => this.recent.ids().map((id) => this.catalog.byId(id)).filter((p): p is NonNullable<typeof p> => !!p));
  saved = computed(() => this.catalog.products().filter((p) => this.fav.has(p.id)));

  af = this.fb.nonNullable.group({ terms: [false], name: [''], email: ['', [Validators.required, Validators.email]], password: ['', [Validators.required, Validators.minLength(8)]] });
  pf = this.fb.nonNullable.group({ name: [''] });
  pw = this.fb.nonNullable.group({ password: ['', [Validators.required, Validators.minLength(8)]] });
  rf = this.fb.nonNullable.group({ password: ['', [Validators.required, Validators.minLength(8)]] });
  resetToken = signal('');

  ngOnInit() {
    this.seo.set({ title: 'My account', path: '/account' });
    void this.catalog.load();
    // Arriving from a password-reset email: ?reset=<token> shows the "choose a new password" form.
    this.resetToken.set(this.route.snapshot.queryParamMap.get('reset') ?? '');
    const t = this.route.snapshot.queryParamMap.get('tab');
    if (t) this.tab.set(t);
    this.pf.patchValue({ name: this.auth.session()?.name ?? '' });
    void this.refresh();
  }

  async refresh() {
    if (!this.auth.session()) return;
    this.orders.set(await this.backend.listMyOrders().catch(() => []));
    this.inquiries.set(await this.backend.listMyInquiries().catch(() => []));
  }

  setMode(m: Mode) {
    this.mode.set(m);
    this.error.set('');
    this.info.set('');
    const pw = this.af.controls.password;
    m === 'forgot' ? pw.clearValidators() : pw.setValidators([Validators.required, Validators.minLength(8)]);
    pw.updateValueAndValidity();
    const nm = this.af.controls.name;
    m === 'signup' ? nm.setValidators(Validators.required) : nm.clearValidators();
    const tm = this.af.controls.terms;
    m === 'signup' ? tm.setValidators(Validators.requiredTrue) : tm.clearValidators();
    tm.updateValueAndValidity();
    nm.updateValueAndValidity();
  }

  bad(c: 'name' | 'email' | 'password' | 'terms') {
    const x = this.af.controls[c];
    return x.invalid && x.touched;
  }

  async submitAuth() {
    this.af.markAllAsTouched();
    if (this.af.invalid) return;
    this.busy.set(true);
    this.error.set('');
    this.info.set('');
    const v = this.af.getRawValue();
    try {
      if (this.mode() === 'forgot') {
        await this.auth.resetPassword(v.email);
        this.info.set('If an account exists for that email, a reset link is on its way.');
      } else if (this.mode() === 'signup') {
        const r = await this.auth.signUp(v.name, v.email, v.password);
        if (r.needsConfirmation) this.info.set('Almost there! Check your email to confirm your account.');
      } else await this.auth.signIn(v.email, v.password);
      if (this.auth.session()) {
        const next = this.route.snapshot.queryParamMap.get('next');
        if (next) void this.router.navigate(['/' + next]);
        else { this.pf.patchValue({ name: this.auth.session()!.name }); void this.refresh(); }
      }
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }

  async submitReset() {
    this.rf.markAllAsTouched();
    if (this.rf.invalid) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.backend.completePasswordReset(this.resetToken(), this.rf.controls.password.value);
      this.resetToken.set('');
      this.toast.show('Your password has been changed. You are signed in.');
      void this.router.navigate(['/account']);
      void this.refresh();
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }

  async logout() {
    this.orders.set([]);
    await this.sessionActions.logout();
  }

  async logoutAndClear() {
    this.orders.set([]);
    await this.sessionActions.logoutAndClear();
  }

  clearDevice() {
    if (!confirm('Clear your bag, viewing history, saved drafts and checkout details from this device? You stay signed in.')) return;
    this.sessionActions.clearDevice();
    this.toast.show('This device has been cleared.');
  }

  async saveProfile() {
    await this.auth.updateProfile(this.pf.controls.name.value);
    this.toast.show('Profile saved');
  }

  async savePassword() {
    this.pw.markAllAsTouched();
    if (this.pw.invalid) return;
    try { await this.backend.changePassword(this.pw.controls.password.value); this.pw.reset(); this.toast.show('Password updated'); }
    catch (e) { this.toast.show((e as Error).message, 'error'); }
  }

  async dataRequest(kind: 'download' | 'delete') {
    const s = this.auth.session();
    if (!s) return;
    if (kind === 'delete' && !confirm('Ask us to delete your account and personal data? Orders already placed stay on record as required by law.')) return;
    try {
      await this.backend.submitContact({ name: s.name || s.email, email: s.email, message: 'DATA REQUEST (' + kind.toUpperCase() + '): please process for account ' + s.email + '.' });
      this.toast.show('Request sent. We will reply within 30 days.');
    } catch (e) { this.toast.show((e as Error).message, 'error'); }
  }

  label = (s: Order['status']) => ({ pending: 'Awaiting payment', paid: 'Paid', in_progress: 'In progress', delivered: 'Delivered', failed: 'Payment failed', cancelled: 'Cancelled', refunded: 'Refunded' })[s];
  names = (o: Order) => o.items.map((i) => i.title).join(', ');

  async download(orderId: string, productId: string) {
    try {
      const a = document.createElement('a');
      a.href = await this.backend.getDownloadUrl(orderId, productId);
      a.download = '';
      a.click();
    } catch (e) {
      this.toast.show((e as Error).message, 'error');
    }
  }
}


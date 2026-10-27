import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Backend } from '../../core/backend';
import { BusinessHours, ContactMessage, Coupon, Customer, DayKey, Order, Review, SiteSettings, Subscriber } from '../../core/models';
import { DAYS, DEFAULT_HOURS, fmtRange, validateHours } from '../../core/hours';
import { AuthService, CatalogService, formatInr, SettingsService, ToastService } from '../../core/services';
import { RoleBadgeComponent } from '../../shared/role-badge.component';
import { StarsComponent } from '../../shared/stars.component';
import { AdminStateService } from './admin-state.service';

function download(name: string, rows: string[][]) {
  const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([rows.map((r) => r.map(cell).join(',')).join('\n')], { type: 'text/csv' }));
  a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ---------------------------------------------------------------- Customers
@Component({
  selector: 'app-customers-tab',
  standalone: true,
  imports: [FormsModule, RoleBadgeComponent],
  template: `
    <div class="adm-bar">
      <input type="search" aria-label="Search customers" placeholder="Search by name or email" [ngModel]="q()" (ngModelChange)="q.set($event)" />
      <button class="btn small ghost grow" type="button" (click)="exportCsv()">Export CSV</button>
    </div>
    @if (error()) { <div class="alert error" role="alert">{{ error() }}</div> }
    <div class="table-wrap"><table class="tbl">
      <thead><tr><th>Customer</th><th>Role</th><th>Paid orders</th><th>Total spent</th><th>Joined</th><th></th></tr></thead>
      <tbody>
        @for (c of shown(); track c.id) {
          <tr><td><strong>{{ c.name || '—' }}</strong><br /><span class="muted">{{ c.email }}</span></td><td>@if (c.role === 'admin') { <app-role-badge role="admin" [superAdmin]="isSuper(c)" /> } @else { <span class="pill">customer</span> }</td><td>{{ c.orders }}</td><td>{{ money(c.spent) }}</td><td>{{ c.joined ? c.joined.slice(0, 10) : '—' }}</td>
            <td><button class="btn small ghost" type="button" (click)="open.set(open() === c.id ? '' : c.id)" [attr.aria-expanded]="open() === c.id">{{ open() === c.id ? 'Hide' : 'Orders' }}</button>
              @if (canManageRoles() && c.id !== me()?.id && !isSuper(c)) {
                <button class="btn small" type="button" [disabled]="busy() === c.id" (click)="setRole(c, c.role === 'admin' ? 'customer' : 'admin')">{{ c.role === 'admin' ? 'Remove admin' : 'Make admin' }}</button>
              }</td></tr>
          @if (open() === c.id) {
            <tr class="det"><td colspan="6">
              @for (o of ordersOf(c); track o.id) { <div class="o"><span>#{{ o.id.slice(0, 8).toUpperCase() }} · {{ o.createdAt.slice(0, 10) }}</span><span>{{ o.items.map(titleOf).join(', ') }}</span><span class="pill">{{ o.status.replace('_', ' ') }}</span><strong>{{ money(o.total) }}</strong></div> }
              @empty { <p class="muted">No orders yet.</p> }
              <a class="btn small" [href]="'mailto:' + c.email">Email {{ c.name.split(' ')[0] || 'customer' }}</a>
            </td></tr>
          }
        } @empty { <tr><td colspan="6" class="muted">No customers match.</td></tr> }
      </tbody></table></div>
    <p class="muted s">@if (canManageRoles()) { As the super admin you can make any account an admin or remove admin rights. } @else { Only the super admin can change roles. }</p>
  `,
  styles: [`.s { font-size: .82rem; } .det > td { background: #fafafa; } .o { display: grid; grid-template-columns: 1.1fr 2fr auto auto; gap: 1rem; padding: .45rem 0; border-bottom: 1px solid var(--line); font-size: .9rem; align-items: center; } .btn { margin-top: .6rem; }`],
})
export class CustomersTabComponent implements OnInit {
  private backend = inject(Backend);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  money = formatInr;
  me = this.auth.session;
  canManageRoles = computed(() => !!this.me()?.superAdmin);
  busy = signal('');
  isSuper = (c: Customer) => !!c.superAdmin;
  list = signal<Customer[]>([]);
  orders = signal<Order[]>([]);
  q = signal('');
  open = signal('');
  error = signal('');
  shown = computed(() => this.list().filter((c) => !this.q() || (c.name + c.email).toLowerCase().includes(this.q().toLowerCase())));
  ordersOf = (c: Customer) => this.orders().filter((o) => o.email === c.email);
  titleOf = (i: Order['items'][number]) => i.title;
  async ngOnInit() {
    try { const [c, o] = await Promise.all([this.backend.listCustomers(), this.backend.listAllOrders()]); this.list.set(c); this.orders.set(o); } catch (e) { this.error.set((e as Error).message); }
  }
  async setRole(c: Customer, role: 'customer' | 'admin') {
    if (!confirm(role === 'admin' ? `Make ${c.email} an admin? They will be able to manage the whole shop.` : `Remove admin rights from ${c.email}?`)) return;
    this.busy.set(c.id);
    try { await this.backend.setUserRole(c.id, role); this.list.update((l) => l.map((x) => (x.id === c.id ? { ...x, role } : x))); this.toast.show(role === 'admin' ? 'Admin added.' : 'Admin removed.'); } catch (e) { this.error.set((e as Error).message); } finally { this.busy.set(''); }
  }
  exportCsv() { download('customers', [['Name', 'Email', 'Role', 'Paid orders', 'Total spent INR', 'Joined']].concat(this.shown().map((c) => [c.name, c.email, c.role, String(c.orders), String(c.spent), c.joined.slice(0, 10)]))); }
}

// ---------------------------------------------------------------- Reviews
@Component({
  selector: 'app-reviews-tab',
  standalone: true,
  imports: [StarsComponent],
  template: `
    <div class="adm-bar"><div class="adm-seg" role="group" aria-label="Show">
      @for (f of filters; track f.id) { <button type="button" [class.on]="filter() === f.id" [attr.aria-pressed]="filter() === f.id" (click)="filter.set(f.id)">{{ f.label }} ({{ n(f.id) }})</button> }</div></div>
    @if (error()) { <div class="alert error" role="alert">{{ error() }}</div> }
    @for (r of shown(); track r.id) {
      <article class="adm-card rev"><div><app-stars [value]="r.rating" /> <strong>{{ productName(r.productId) }}</strong>
        <p>{{ r.body }}</p><span class="muted s">{{ r.authorName }} · {{ r.createdAt.slice(0, 10) }} · {{ r.consentToPublish ? 'agreed to publish' : 'did not agree to publish, private feedback' }}</span></div>
        <div class="acts"><span class="pill" [class.green]="r.approved" [class.amber]="!r.approved && r.consentToPublish">{{ r.approved ? 'Live' : r.consentToPublish ? 'Waiting' : 'Private' }}</span>
          <button class="btn small" type="button" (click)="set(r, !r.approved)" [disabled]="!r.consentToPublish && !r.approved">{{ r.approved ? 'Hide' : 'Approve and publish' }}</button></div></article>
    } @empty { <div class="adm-empty"><p>Nothing here. Verified buyers can leave reviews from their order page.</p></div> }
  `,
  styles: [`.rev { display: flex; justify-content: space-between; gap: 1rem; p { margin: .3rem 0; } } .s { font-size: .82rem; } .acts { display: grid; gap: .4rem; align-content: start; justify-items: end; }`],
})
export class ReviewsTabComponent implements OnInit {
  private backend = inject(Backend);
  private catalog = inject(CatalogService);
  private toast = inject(ToastService);
  private state = inject(AdminStateService);
  filters = [{ id: 'waiting', label: 'Waiting' }, { id: 'live', label: 'Live' }, { id: 'all', label: 'All' }];
  filter = signal('waiting');
  list = signal<Review[]>([]);
  error = signal('');
  productName = (id: string) => this.catalog.byId(id)?.title ?? 'Product';
  n = (f: string) => this.list().filter((r) => this.match(r, f)).length;
  private match(r: Review, f: string) { return f === 'all' || (f === 'live' ? r.approved : !r.approved && r.consentToPublish); }
  shown = computed(() => this.list().filter((r) => this.match(r, this.filter())));
  async ngOnInit() { void this.catalog.load(); await this.load(); if (!this.n('waiting')) this.filter.set('all'); }
  async load() { try { this.list.set(await this.backend.listAllReviews()); } catch (e) { this.error.set((e as Error).message); } }
  async set(r: Review, approved: boolean) {
    try { await this.backend.moderateReview(r.id, approved); this.toast.show(approved ? 'Review published' : 'Review hidden'); await this.load(); void this.state.refresh(); }
    catch (e) { this.error.set((e as Error).message); }
  }
}

// ---------------------------------------------------------------- Coupons
@Component({
  selector: 'app-coupons-tab',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <form class="adm-card" [formGroup]="f" (ngSubmit)="save()" novalidate>
      <h2 class="adm-h">{{ editing() ? 'Edit coupon ' + f.controls.code.value : 'Create a coupon' }}</h2>
      <p class="adm-intro">Choose either a percent off or a flat amount. The discount is always checked again on the server at checkout.</p>
      <div class="adm-grid">
        <div class="field"><label for="cp-code">Code *</label><input id="cp-code" formControlName="code" placeholder="DIWALI20" [readonly]="editing()" /></div>
        <div class="field"><label for="cp-pct">Percent off</label><input id="cp-pct" type="number" min="0" max="100" formControlName="percent" /></div>
        <div class="field"><label for="cp-flat">Or flat ₹ off</label><input id="cp-flat" type="number" min="0" formControlName="flatInr" /></div>
        <div class="field"><label for="cp-min">Minimum order ₹</label><input id="cp-min" type="number" min="0" formControlName="minSubtotal" /></div>
        <div class="field"><label for="cp-end">Last day it works</label><input id="cp-end" type="date" formControlName="endsAt" /><span class="hint">Optional. Ends at midnight India time.</span></div>
        <div class="field"><label for="cp-max">Maximum uses</label><input id="cp-max" type="number" min="0" formControlName="maxUses" /><span class="hint">Optional. 0 or empty means unlimited.</span></div>
      </div>
      <label class="check"><input type="checkbox" formControlName="active" /> Active (customers can use it now)</label>
      @if (error()) { <div class="alert error" role="alert">{{ error() }}</div> }
      <div class="adm-actions"><button class="btn" type="submit">{{ editing() ? 'Save changes' : 'Create coupon' }}</button>@if (editing()) { <button class="btn ghost" type="button" (click)="clear()">Cancel</button> }</div>
    </form>
    <div class="table-wrap"><table class="tbl"><thead><tr><th>Code</th><th>Discount</th><th>Minimum order</th><th>Ends</th><th>Used</th><th>Status</th><th></th></tr></thead><tbody>
      @for (c of list(); track c.code) {
        <tr><td><strong>{{ c.code }}</strong></td><td>{{ c.percent ? c.percent + '% off' : '₹' + c.flatInr + ' off' }}</td><td>{{ c.minSubtotal ? '₹' + c.minSubtotal : '—' }}</td><td>{{ c.endsAt || '—' }}</td><td>{{ c.used ?? 0 }}{{ c.maxUses ? ' / ' + c.maxUses : '' }}</td><td><span class="pill" [class.green]="state(c) === 'Active'" [class.red]="state(c) === 'Expired' || state(c) === 'Used up'">{{ state(c) }}</span></td>
          <td><div class="adm-actions"><button class="btn small ghost" type="button" (click)="edit(c)">Edit</button><button class="btn small ghost" type="button" (click)="toggle(c)">{{ c.active ? 'Turn off' : 'Turn on' }}</button><button class="btn small ghost" type="button" (click)="remove(c)">Delete</button></div></td></tr>
      } @empty { <tr><td colspan="7" class="muted">No coupons yet.</td></tr> }</tbody></table></div>
  `,
  styles: [`.field { margin-bottom: 1rem; }`],
})
export class CouponsTabComponent implements OnInit {
  private backend = inject(Backend);
  private fb = inject(FormBuilder);
  private toast = inject(ToastService);
  list = signal<Coupon[]>([]);
  editing = signal(false);
  error = signal('');
  f = this.fb.nonNullable.group({ code: [''], percent: [0], flatInr: [0], minSubtotal: [0], active: [true], endsAt: [''], maxUses: [0] });
  state = (c: Coupon) => !c.active ? 'Off' : c.endsAt && Date.now() > new Date(c.endsAt + 'T23:59:59+05:30').getTime() ? 'Expired' : c.maxUses && (c.used ?? 0) >= c.maxUses ? 'Used up' : 'Active';
  ngOnInit() { void this.load(); }
  async load() { try { this.list.set(await this.backend.listCoupons()); } catch (e) { this.error.set((e as Error).message); } }
  edit(c: Coupon) { this.editing.set(true); this.f.reset({ code: c.code, percent: c.percent ?? 0, flatInr: c.flatInr ?? 0, minSubtotal: c.minSubtotal, active: c.active, endsAt: c.endsAt ?? '', maxUses: c.maxUses ?? 0 }); scrollTo({ top: 0 }); }
  clear() { this.editing.set(false); this.f.reset({ active: true, percent: 0, flatInr: 0, minSubtotal: 0, code: '', endsAt: '', maxUses: 0 }); }
  async save() {
    this.error.set('');
    const v = this.f.getRawValue();
    try {
      await this.backend.saveCoupon({ code: v.code, percent: v.percent || undefined, flatInr: v.percent ? undefined : v.flatInr || undefined, minSubtotal: v.minSubtotal, active: v.active, endsAt: v.endsAt || undefined, maxUses: v.maxUses || undefined, used: this.list().find((x) => x.code === v.code.trim().toUpperCase())?.used });
      this.toast.show('Coupon saved');
      this.clear();
      await this.load();
    } catch (e) { this.error.set((e as Error).message); }
  }
  async toggle(c: Coupon) { await this.backend.saveCoupon({ ...c, active: !c.active }); await this.load(); }
  async remove(c: Coupon) { if (confirm(`Delete coupon ${c.code}?`)) { await this.backend.deleteCoupon(c.code); await this.load(); } }
}

// ---------------------------------------------------------------- Messages
@Component({
  selector: 'app-messages-tab',
  standalone: true,
  template: `
    <div class="adm-bar"><div class="adm-seg" role="group" aria-label="Show">
      <button type="button" [class.on]="filter() === 'new'" (click)="filter.set('new')">To answer ({{ count('new') }})</button><button type="button" [class.on]="filter() === 'replied'" (click)="filter.set('replied')">Answered ({{ count('replied') }})</button><button type="button" [class.on]="filter() === ''" (click)="filter.set('')">All ({{ list().length }})</button></div></div>
    @if (error()) { <div class="alert error" role="alert">{{ error() }}</div> }
    @for (m of shown(); track m.id) {
      <article class="adm-card msg"><div><strong>{{ m.name }}</strong> <span class="muted">· {{ m.email }} · {{ m.createdAt.slice(0, 10) }}</span><p>{{ m.message }}</p></div>
        <div class="adm-actions"><a class="btn small" [href]="mailto(m)">Reply by email</a>
          <button class="btn small ghost" type="button" (click)="toggle(m)">{{ m.status === 'new' ? 'Mark answered' : 'Answered ✓ (undo)' }}</button></div></article>
    } @empty { <div class="adm-empty"><p>{{ filter() === 'new' ? 'Inbox zero. Nothing to answer.' : 'No messages.' }}</p></div> }
  `,
  styles: [`.msg { display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; p { margin: .4rem 0 0; } }`],
})
export class MessagesTabComponent implements OnInit {
  private backend = inject(Backend);
  private state = inject(AdminStateService);
  list = signal<ContactMessage[]>([]);
  filter = signal('new');
  error = signal('');
  count = (s: string) => this.list().filter((m) => m.status === s).length;
  shown = computed(() => this.list().filter((m) => !this.filter() || m.status === this.filter()));
  mailto = (m: ContactMessage) => `mailto:${m.email}?subject=${encodeURIComponent('Re: your message to us')}&body=${encodeURIComponent(`Hi ${m.name.split(' ')[0]},\n\n`)}`;
  async ngOnInit() { await this.load(); if (!this.count('new')) this.filter.set(''); }
  async load() { try { this.list.set(await this.backend.listContacts()); } catch (e) { this.error.set((e as Error).message); } }
  async toggle(m: ContactMessage) { await this.backend.updateContactStatus(m.id, m.status === 'new' ? 'replied' : 'new'); await this.load(); void this.state.refresh(); }
}

// ---------------------------------------------------------------- Subscribers
@Component({
  selector: 'app-subscribers-tab',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="adm-bar">
      <input type="search" aria-label="Search subscribers" placeholder="Search emails" [ngModel]="q()" (ngModelChange)="q.set($event)" />
      <button class="btn small ghost" type="button" (click)="copy()">Copy all emails</button>
      <button class="btn small ghost grow" type="button" (click)="exportCsv()">Export CSV</button>
    </div>
    @if (error()) { <div class="alert error" role="alert">{{ error() }}</div> }
    <p class="muted s">{{ list().length }} subscriber(s). Everyone here ticked the consent box. Send newsletters from your email tool and always include an unsubscribe link.</p>
    <div class="table-wrap"><table class="tbl"><thead><tr><th>Email</th><th>Joined</th><th></th></tr></thead><tbody>
      @for (s of shown(); track s.email) { <tr><td>{{ s.email }}</td><td>{{ s.createdAt ? s.createdAt.slice(0, 10) : '—' }}</td><td><button class="btn small ghost" type="button" (click)="remove(s)">Remove</button></td></tr> }
      @empty { <tr><td colspan="3" class="muted">No subscribers yet.</td></tr> }
    </tbody></table></div>
  `,
  styles: [`.s { font-size: .85rem; }`],
})
export class SubscribersTabComponent implements OnInit {
  private backend = inject(Backend);
  private toast = inject(ToastService);
  list = signal<Subscriber[]>([]);
  q = signal('');
  error = signal('');
  shown = computed(() => this.list().filter((s) => !this.q() || s.email.toLowerCase().includes(this.q().toLowerCase())));
  ngOnInit() { void this.load(); }
  async load() { try { this.list.set(await this.backend.listSubscribers()); } catch (e) { this.error.set((e as Error).message); } }
  async remove(s: Subscriber) { if (confirm(`Remove ${s.email} from the list?`)) { await this.backend.removeSubscriber(s.email); this.toast.show('Subscriber removed'); await this.load(); } }
  async copy() {
    try { await navigator.clipboard.writeText(this.shown().map((s) => s.email).join(', ')); this.toast.show('Emails copied'); } catch { this.toast.show('Could not copy. Use Export CSV instead.', 'error'); }
  }
  exportCsv() { download('subscribers', [['Email', 'Joined']].concat(this.shown().map((s) => [s.email, s.createdAt.slice(0, 10)]))); }
}

// ---------------------------------------------------------------- Settings
@Component({
  selector: 'app-settings-tab',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <form [formGroup]="f" (ngSubmit)="save()" novalidate>
      <section class="adm-card"><h2 class="adm-h">Announcement and chat</h2>
        <div class="field"><label for="st-ann">Announcement bar</label><input id="st-ann" formControlName="announcement" maxlength="140" placeholder="e.g. Diwali sale: 20% off with code DIWALI20" /><span class="hint">Shown at the very top of every page. Leave empty to hide it.</span></div>
        <div class="field"><label for="st-wa">WhatsApp number</label><input id="st-wa" formControlName="whatsapp" inputmode="tel" placeholder="919876543210" /><span class="hint">Country code and digits only. Adds a “Chat with us” button. Leave empty to hide it.</span></div>
      </section>

      <section class="adm-card"><h2 class="adm-h">Business details</h2>
        <p class="adm-intro">These appear in the site footer and are filled into your Terms, Privacy, Refund and Grievance pages automatically. Indian online shops are expected to show them.</p>
        <div class="adm-grid">
          <div class="field"><label for="b-name">Registered business or owner name</label><input id="b-name" formControlName="legalName" /></div>
          <div class="field"><label for="b-gst">GSTIN</label><input id="b-gst" formControlName="gstin" placeholder="Or write: Not registered" /></div>
          <div class="field"><label for="b-mail">Support email</label><input id="b-mail" type="email" formControlName="supportEmail" /></div>
        </div>
        <div class="field"><label for="b-addr">Postal address</label><textarea id="b-addr" formControlName="address" style="min-height: 70px"></textarea></div>
        <div class="adm-grid">
          <div class="field"><label for="b-go">Grievance Officer name</label><input id="b-go" formControlName="grievanceOfficer" /><span class="hint">You can be your own officer.</span></div>
          <div class="field"><label for="b-ge">Grievance email</label><input id="b-ge" type="email" formControlName="grievanceEmail" /></div>
          <div class="field"><label for="b-j">City for legal disputes</label><input id="b-j" formControlName="jurisdiction" placeholder="e.g. Pune, Maharashtra" /></div>
        </div>
        <p class="hint">Leave a box empty to keep the [placeholder] until you know the answer. <a routerLink="/terms" target="_blank">Preview the policies ↗</a></p>
      </section>
      <section class="adm-card"><h2 class="adm-h">Opening hours</h2>
        <p class="adm-intro">When you answer chat, calls and inquiries. Shown on the Contact page, footer and home page with a live “online now” badge. Times are India Standard Time.</p>
        <div class="hrs">
          @for (d of days; track d.key) {
            <div class="row">
              <label class="check day"><input type="checkbox" [checked]="!!hours()[d.key]" (change)="toggleDay(d.key)" /> {{ d.long }}</label>
              @if (hours()[d.key]; as h) {
                <label class="sr-only" [for]="'o' + d.key">{{ d.long }} opens</label><input [id]="'o' + d.key" type="time" [value]="h.open" (change)="setTime(d.key, 'open', $any($event.target).value)" />
                <span>to</span>
                <label class="sr-only" [for]="'c' + d.key">{{ d.long }} closes</label><input [id]="'c' + d.key" type="time" [value]="h.close" (change)="setTime(d.key, 'close', $any($event.target).value)" />
              } @else { <span class="muted">Closed</span> }
            </div>
          }
        </div>
        <div class="adm-actions"><button class="btn small ghost" type="button" (click)="copyMonday()">Copy Monday to Tue–Sat</button><button class="btn small ghost" type="button" (click)="hours.set(defaults())">Reset to default</button></div>
        <p class="hint">Preview: <strong>{{ preview() }}</strong></p>
        @if (hoursError()) { <p class="adm-err" role="alert">{{ hoursError() }}</p> }
      </section>
      <div class="adm-sticky"><button class="btn" type="submit" [disabled]="busy()">Save settings</button></div>
    </form>

  `,
  styles: [`.field { margin-bottom: 1rem; } .demo { margin-top: 14px; } .hrs { display: grid; gap: 8px; margin: .6rem 0 1rem; } .row { display: flex; gap: .6rem; align-items: center; flex-wrap: wrap; min-height: 40px; } .day { width: 130px; margin: 0; } .row input[type=time] { padding: .45rem .8rem; border-radius: 999px; border: 0; background: #efefef; font: inherit; }`],
})
export class SettingsTabComponent implements OnInit {
  backend = inject(Backend);
  private fb = inject(FormBuilder);
  private toast = inject(ToastService);
  private live = inject(SettingsService);
  busy = signal(false);
  days = DAYS;
  hours = signal<BusinessHours>(structuredClone(DEFAULT_HOURS));
  hoursError = signal('');
  defaults = () => structuredClone(DEFAULT_HOURS);
  preview = () => DAYS.map((d) => d.short + ' ' + fmtRange(this.hours()[d.key])).join(' · ');
  toggleDay(k: DayKey) { this.hours.update((h) => ({ ...h, [k]: h[k] ? null : { open: '16:00', close: '23:00' } })); }
  setTime(k: DayKey, w: 'open' | 'close', v: string) { this.hours.update((h) => ({ ...h, [k]: h[k] ? { ...h[k]!, [w]: v } : h[k] })); }
  copyMonday() { const m = this.hours().mon; this.hours.update((h) => ({ ...h, tue: m && { ...m }, wed: m && { ...m }, thu: m && { ...m }, fri: m && { ...m }, sat: m && { ...m } })); }
  private current: SiteSettings = { announcement: '', whatsapp: '', supportEmail: '' };
  f = this.fb.nonNullable.group({
    announcement: [''], whatsapp: [''], legalName: [''], gstin: [''], supportEmail: [''], address: [''], grievanceOfficer: [''], grievanceEmail: [''], jurisdiction: [''],
  });

  async ngOnInit() {
    this.current = await this.backend.getSettings();
    if (this.current.hours) this.hours.set(structuredClone(this.current.hours));
    const b = this.current.business ?? {};
    this.f.patchValue({ announcement: this.current.announcement, whatsapp: this.current.whatsapp, ...b, supportEmail: b.supportEmail ?? this.current.supportEmail });
  }

  async save() {
    const v = this.f.getRawValue();
    const business = { legalName: v.legalName.trim(), gstin: v.gstin.trim(), supportEmail: v.supportEmail.trim(), address: v.address.trim(), grievanceOfficer: v.grievanceOfficer.trim(), grievanceEmail: v.grievanceEmail.trim(), jurisdiction: v.jurisdiction.trim() };
    // Keep the FAQ and About edits that live on the same record.
    this.hoursError.set(validateHours(this.hours()) ?? '');
    if (this.hoursError()) return;
    const s: SiteSettings = { ...this.current, announcement: v.announcement.trim(), whatsapp: v.whatsapp.trim(), supportEmail: business.supportEmail, business, hours: this.hours() };
    this.busy.set(true);
    try { await this.backend.saveSettings(s); this.current = s; await this.live.load(); this.toast.show('Settings saved. The site is updated.'); }
    catch (e) { this.toast.show((e as Error).message, 'error'); }
    finally { this.busy.set(false); }
  }
}

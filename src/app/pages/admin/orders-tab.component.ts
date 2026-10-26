import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Backend } from '../../core/backend';
import { Order, OrderStatus } from '../../core/models';
import { formatInr, ToastService } from '../../core/services';
import { AdminStateService } from './admin-state.service';

const STATUSES: OrderStatus[] = ['pending', 'paid', 'in_progress', 'delivered', 'failed', 'cancelled', 'refunded'];
const LABEL: Record<OrderStatus, string> = { pending: 'Awaiting payment', paid: 'Paid', in_progress: 'In progress', delivered: 'Delivered', failed: 'Failed', cancelled: 'Cancelled', refunded: 'Refunded' };
const TONE: Record<OrderStatus, string> = { pending: 'amber', paid: 'green', in_progress: 'amber', delivered: 'green', failed: 'red', cancelled: '', refunded: 'dark' };

type View = 'make' | 'waiting' | 'all';

@Component({
  selector: 'app-orders-tab',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="adm-bar">
      <div class="adm-seg" role="group" aria-label="View">
        <button type="button" [class.on]="view() === 'make'" [attr.aria-pressed]="view() === 'make'" (click)="view.set('make')">To make and deliver ({{ toMake().length }})</button>
        <button type="button" [class.on]="view() === 'waiting'" [attr.aria-pressed]="view() === 'waiting'" (click)="view.set('waiting')">Awaiting payment ({{ waiting().length }})</button>
        <button type="button" [class.on]="view() === 'all'" [attr.aria-pressed]="view() === 'all'" (click)="view.set('all')">All ({{ orders().length }})</button>
      </div>
      <button class="btn small ghost grow" type="button" (click)="exportCsv()">Export CSV</button>
    </div>
    <div class="adm-bar">
      <label class="sr-only" for="o-q">Search orders</label>
      <input id="o-q" type="search" placeholder="Search by order number, name or email" [ngModel]="q()" (ngModelChange)="q.set($event)" />
      <label class="sr-only" for="o-s">Filter by status</label>
      <select id="o-s" [ngModel]="status()" (ngModelChange)="status.set($event)"><option value="">Any status</option>@for (s of statuses; track s) { <option [value]="s">{{ label[s] }}</option> }</select>
    </div>
    @if (error()) { <div class="alert error" role="alert">{{ error() }}</div> }
    @if (view() === 'make') { <p class="adm-intro">Paid orders with personalized items. Open <strong>Details</strong>, read the customer’s brief and photos, make the file, then press <strong>Upload final file</strong>. The customer is notified automatically.</p> }

    <div class="table-wrap"><table class="tbl">
      <thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th><th></th></tr></thead>
      <tbody>
        @for (o of shown(); track o.id) {
          <tr><td><strong>#{{ o.id.slice(0, 8).toUpperCase() }}</strong><br /><span class="muted s">{{ o.createdAt.slice(0, 10) }}</span></td>
            <td>{{ o.customerName }}<br /><span class="muted s">{{ o.email }}</span></td>
            <td class="s">{{ names(o) }}@if (needs(o)) { <br /><span class="pill red">needs delivery</span> }</td>
            <td>{{ money(o.total) }}<br /><span class="muted s">{{ o.paymentVerified ? 'payment verified' : 'not paid' }}</span></td>
            <td><span class="pill" [class]="'pill ' + tone[o.status]">{{ label[o.status] }}</span></td>
            <td><button class="btn small ghost" type="button" (click)="open.set(open() === o.id ? '' : o.id)" [attr.aria-expanded]="open() === o.id">{{ open() === o.id ? 'Hide' : 'Details' }}</button></td></tr>
          @if (open() === o.id) {
            <tr class="det"><td colspan="6">
              <div class="top"><div><strong>{{ o.customerName }}</strong> · <a [href]="'mailto:' + o.email">{{ o.email }}</a></div>
                <div class="adm-actions"><label class="sr-only" [for]="'st' + o.id">Change status</label>
                  <select [id]="'st' + o.id" (change)="setStatus(o, $any($event.target).value)">@for (s of statuses; track s) { <option [value]="s" [selected]="s === o.status">{{ label[s] }}</option> }</select></div></div>
              @for (i of o.items; track $index) {
                <div class="item adm-card">
                  <div><strong>{{ i.title }}</strong> × {{ i.qty }} · {{ money(i.unit * i.qty) }}
                    @if (i.customization; as c) {
                      <dl class="cs"><dt>Name(s)</dt><dd>{{ c.fields['name'] }}</dd><dt>Date</dt><dd>{{ c.fields['date'] }}</dd>
                        @if (c.fields['message']) { <dt>Message</dt><dd>{{ c.fields['message'] }}</dd> }
                        @if (c.fields['extra']) { <dt>Extra</dt><dd>{{ c.fields['extra'] }}</dd> }
                        <dt>Style</dt><dd>{{ c.paletteId }} · {{ c.fontId }}</dd>
                        @if (c.notes) { <dt>Notes</dt><dd>{{ c.notes }}</dd> }</dl>
                      <div class="photos">@for (p of c.photos; track $index) { <a [href]="photoUrl(p)" target="_blank" rel="noopener"><img [src]="photoUrl(p)" alt="Customer photo {{ $index + 1 }}" width="64" height="64" /></a> }</div>
                    }</div>
                  @if (o.paymentVerified) {
                    <div class="deliver">
                      @if (i.deliverable) { <p class="muted s">Delivered: {{ i.deliverable }}</p> }
                      @if (i.customization || i.deliverable) { <label class="btn small soft up"><input type="file" class="sr-only" (change)="deliver(o, i.productId, $event)" />{{ i.deliverable ? 'Replace final file' : 'Upload final file' }}</label> }
                      @else { <p class="muted s">Ready-made: the customer downloads it themselves.</p> }
                    </div>
                  } @else { <p class="muted s">Payment not verified, so nothing to deliver yet.</p> }
                </div>
              }
              <div class="field"><label [for]="'note' + o.id">Private note (only you can see this)</label>
                <textarea [id]="'note' + o.id" [value]="o.adminNote ?? ''" (blur)="saveNote(o, $any($event.target).value)" placeholder="Called customer, waiting for better photos…"></textarea></div>
              @if (o.paymentVerified && o.status !== 'refunded') { <p class="muted s">To refund, issue it from the Razorpay dashboard, then set the status to “Refunded” here.</p> }
            </td></tr>
          }
        } @empty { <tr><td colspan="6"><div class="adm-empty"><p>{{ view() === 'make' ? 'Nothing to make right now. 🎉' : 'No orders match.' }}</p></div></td></tr> }
      </tbody></table></div>
  `,
  styles: [`
    .s { font-size: .82rem; } .tbl select, .adm-actions select { padding: .4rem .7rem; border-radius: 999px; border: 1px solid var(--line); font: inherit; background: #fff; }
    .det > td { background: #fafafa; } .top { display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; align-items: center; margin-bottom: .8rem; }
    .item { display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
    .cs { display: grid; grid-template-columns: 90px 1fr; gap: .2rem .8rem; font-size: .85rem; margin: .6rem 0; dt { color: var(--muted); } dd { margin: 0; } }
    .photos { display: flex; gap: 6px; img { width: 64px; height: 64px; object-fit: cover; border-radius: 10px; } } .up { cursor: pointer; } .up:has(:focus-visible) { outline: 3px solid var(--rose); }
    textarea { min-height: 70px; } .field { margin: .6rem 0; }
  `],
})
export class OrdersTabComponent implements OnInit {
  private backend = inject(Backend);
  private toast = inject(ToastService);
  private state = inject(AdminStateService);
  money = formatInr;
  statuses = STATUSES; label = LABEL; tone = TONE;
  orders = signal<Order[]>([]);
  view = signal<View>('make');
  q = signal('');
  status = signal('');
  open = signal('');
  error = signal('');
  private urls = new Map<string, string>();

  names = (o: Order) => o.items.map((i) => `${i.title}${i.qty > 1 ? ' ×' + i.qty : ''}`).join(', ');
  needs = (o: Order) => o.paymentVerified && (o.status === 'paid' || o.status === 'in_progress') && o.items.some((i) => i.customization && !i.deliverable);
  toMake = computed(() => this.orders().filter((o) => this.needs(o)));
  waiting = computed(() => this.orders().filter((o) => o.status === 'pending'));

  shown = computed(() => {
    const q = this.q().trim().toLowerCase();
    const base = this.view() === 'make' ? this.toMake() : this.view() === 'waiting' ? this.waiting() : this.orders();
    return base.filter((o) => (!this.status() || o.status === this.status()) && (!q || (o.id + o.customerName + o.email).toLowerCase().includes(q)));
  });

  async ngOnInit() {
    await this.load();
    if (!this.toMake().length) this.view.set('all');
  }

  async load() {
    try { this.orders.set(await this.backend.listAllOrders()); } catch (e) { this.error.set((e as Error).message); }
  }

  /** Customer photos are private storage paths; each is turned into a short-lived signed URL on demand. */
  photoUrl(p: string) {
    if (/^https?:|^data:/.test(p)) return p;
    const cached = this.urls.get(p);
    if (cached) return cached;
    this.urls.set(p, '');
    void this.backend.resolveUpload(p).then((u) => { this.urls.set(p, u); this.orders.update((o) => [...o]); });
    return '';
  }

  async setStatus(o: Order, s: OrderStatus) {
    try { await this.backend.updateOrderStatus(o.id, s); this.toast.show('Order updated'); await this.load(); void this.state.refresh(); }
    catch (e) { this.error.set((e as Error).message); await this.load(); }
  }

  async deliver(o: Order, productId: string, e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try { await this.backend.uploadDeliverable(o.id, productId, file); this.toast.show('Final file delivered. The customer is notified.'); await this.load(); void this.state.refresh(); }
    catch (err) { this.error.set((err as Error).message); }
    input.value = '';
  }

  async saveNote(o: Order, note: string) {
    if ((o.adminNote ?? '') === note) return;
    try { await this.backend.updateOrderNote(o.id, note); this.orders.update((l) => l.map((x) => (x.id === o.id ? { ...x, adminNote: note } : x))); this.toast.show('Note saved'); }
    catch (e) { this.error.set((e as Error).message); }
  }

  exportCsv() {
    const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['Order', 'Date', 'Customer', 'Email', 'Items', 'Total INR', 'Payment verified', 'Status', 'Note']].concat(
      this.shown().map((o) => [o.id, o.createdAt.slice(0, 10), o.customerName, o.email, this.names(o), String(o.total), o.paymentVerified ? 'yes' : 'no', o.status, o.adminNote ?? '']),
    );
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([rows.map((r) => r.map(cell).join(',')).join('\n')], { type: 'text/csv' }));
    a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
}

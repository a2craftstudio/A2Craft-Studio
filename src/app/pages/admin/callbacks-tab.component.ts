import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Backend } from '../../core/backend';
import { istStamp } from '../../core/format';
import { CallbackRequest } from '../../core/models';
import { ToastService } from '../../core/services';
import { AdminStateService } from './admin-state.service';

type Status = CallbackRequest['status'];
const LABEL: Record<Status, string> = { new: 'To call', called: 'Called', no_answer: 'No answer' };
const TONE: Record<Status, string> = { new: 'red', called: 'green', no_answer: 'amber' };

@Component({
  selector: 'app-callbacks-tab',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="adm-bar">
      <div class="adm-seg" role="group" aria-label="Show">
        <button type="button" [class.on]="filter() === 'new'" [attr.aria-pressed]="filter() === 'new'" (click)="filter.set('new')">To call ({{ count('new') }})</button>
        <button type="button" [class.on]="filter() === 'no_answer'" [attr.aria-pressed]="filter() === 'no_answer'" (click)="filter.set('no_answer')">No answer ({{ count('no_answer') }})</button>
        <button type="button" [class.on]="filter() === 'called'" [attr.aria-pressed]="filter() === 'called'" (click)="filter.set('called')">Called ({{ count('called') }})</button>
        <button type="button" [class.on]="filter() === ''" [attr.aria-pressed]="filter() === ''" (click)="filter.set('')">All ({{ list().length }})</button>
      </div>
      <input type="search" aria-label="Search call-backs" placeholder="Search name or number" [ngModel]="q()" (ngModelChange)="q.set($event)" />
      <button class="btn small ghost grow" type="button" (click)="exportCsv()">Export CSV</button>
    </div>
    <p class="adm-intro">Visitors leave their number instead of you publishing one. Call them in your opening hours, then mark the result. Numbers are visible only here and are deleted after 90 days.</p>
    @if (error()) { <div class="alert error" role="alert">{{ error() }}</div> }

    @for (c of shown(); track c.id) {
      <article class="adm-card cb">
        <header>
          <div><strong class="nm">{{ c.name }}</strong><br /><a class="ph" [href]="tel(c)">{{ c.phone }}</a></div>
          <div class="adm-actions"><span class="pill" [class]="'pill ' + tone[c.status]">{{ label[c.status] }}</span>
            <span class="muted s">{{ ago(c) }}</span></div>
        </header>
        <dl class="meta"><div><dt>About</dt><dd>{{ c.topic }}</dd></div><div><dt>Best time</dt><dd>{{ c.preferred }}</dd></div><div><dt>Received</dt><dd>{{ ist(c.createdAt) }} IST</dd></div></dl>
        @if (c.note) { <p class="note">“{{ c.note }}”</p> }
        <div class="field"><label [for]="'cn' + c.id">Private note</label><textarea [id]="'cn' + c.id" [value]="c.adminNote ?? ''" (blur)="saveNote(c, $any($event.target).value)" placeholder="What was agreed…"></textarea></div>
        <div class="adm-actions">
          <a class="btn small" [href]="tel(c)">Call now</a>
          <a class="btn small ghost" [href]="wa(c)" target="_blank" rel="noopener noreferrer">WhatsApp</a>
          @if (c.status !== 'called') { <button class="btn small soft" type="button" (click)="set(c, 'called')">Mark called</button> }
          @if (c.status !== 'no_answer') { <button class="btn small ghost" type="button" (click)="set(c, 'no_answer')">No answer</button> }
          @if (c.status !== 'new') { <button class="btn small ghost" type="button" (click)="set(c, 'new')">Back to “to call”</button> }
        </div>
      </article>
    } @empty { <div class="adm-empty"><p>{{ filter() === 'new' ? 'No one is waiting for a call. 🎉' : 'Nothing here.' }}</p></div> }
  `,
  styles: [`
    .cb header { display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; align-items: flex-start; } .nm { font-size: 1.1rem; }
    .ph { font-size: 1.25rem; font-weight: 700; color: #111; text-decoration: none; letter-spacing: .02em; &:hover { text-decoration: underline; } } .s { font-size: .82rem; }
    .meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: .4rem 1.2rem; margin: .8rem 0; div { display: grid; } dt { font-size: .75rem; color: var(--muted); } dd { margin: 0; } }
    .note { background: #f6f6f6; border-radius: 14px; padding: .7rem 1rem; margin: 0 0 .8rem; } textarea { min-height: 64px; } .field { margin-bottom: .8rem; }
  `],
})
export class CallbacksTabComponent implements OnInit {
  protected ist = istStamp;
  private backend = inject(Backend);
  private toast = inject(ToastService);
  private state = inject(AdminStateService);
  label = LABEL; tone = TONE;
  list = signal<CallbackRequest[]>([]);
  filter = signal<string>('new');
  q = signal('');
  error = signal('');
  count = (s: Status) => this.list().filter((c) => c.status === s).length;
  shown = computed(() => {
    const q = this.q().trim().toLowerCase().replace(/\s/g, '');
    return this.list().filter((c) => (!this.filter() || c.status === this.filter()) && (!q || (c.name + c.phone).toLowerCase().replace(/\s/g, '').includes(q)));
  });

  async ngOnInit() { await this.load(); if (!this.count('new')) this.filter.set(''); }
  async load() { try { this.list.set(await this.backend.listCallbacks()); } catch (e) { this.error.set((e as Error).message); } }

  /** Digits only, with +91 added for 10-digit Indian numbers, so tel: and wa.me links work. */
  private e164(c: CallbackRequest) {
    const d = c.phone.replace(/\D/g, '');
    return d.length === 10 ? '91' + d : d;
  }
  tel = (c: CallbackRequest) => 'tel:+' + this.e164(c);
  wa = (c: CallbackRequest) => `https://wa.me/${this.e164(c)}?text=${encodeURIComponent(`Hi ${c.name.split(' ')[0]}, this is A2 Craft Studio returning your call request. `)}`;
  ago(c: CallbackRequest) {
    const h = Math.floor((Date.now() - new Date(c.createdAt).getTime()) / 3600000);
    return h < 1 ? 'just now' : h < 24 ? h + ' h ago' : Math.floor(h / 24) + ' d ago';
  }

  async set(c: CallbackRequest, status: Status) {
    try { await this.backend.updateCallback(c.id, { status }); this.toast.show(status === 'called' ? 'Marked as called' : status === 'new' ? 'Moved back to “to call”' : 'Marked as no answer'); await this.load(); void this.state.refresh(); }
    catch (e) { this.error.set((e as Error).message); }
  }
  async saveNote(c: CallbackRequest, note: string) {
    if ((c.adminNote ?? '') === note) return;
    try { await this.backend.updateCallback(c.id, { adminNote: note }); this.list.update((l) => l.map((x) => (x.id === c.id ? { ...x, adminNote: note } : x))); this.toast.show('Note saved'); }
    catch (e) { this.error.set((e as Error).message); }
  }

  exportCsv() {
    const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['Received', 'Name', 'Phone', 'About', 'Best time', 'Status', 'Note']].concat(this.shown().map((c) => [istStamp(c.createdAt), c.name, c.phone, c.topic, c.preferred, c.status, c.adminNote ?? '']));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([rows.map((r) => r.map(cell).join(',')).join('\n')], { type: 'text/csv' }));
    a.download = `callbacks-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
}

import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Backend } from '../../core/backend';
import { Inquiry } from '../../core/models';
import { ToastService } from '../../core/services';
import { AdminStateService } from './admin-state.service';

const STATUSES: Inquiry['status'][] = ['new', 'in_progress', 'quoted', 'completed', 'declined'];
const LABEL: Record<Inquiry['status'], string> = { new: 'New', in_progress: 'In progress', quoted: 'Quoted', completed: 'Completed', declined: 'Declined' };
const TONE: Record<Inquiry['status'], string> = { new: 'red', in_progress: 'amber', quoted: 'amber', completed: 'green', declined: '' };

@Component({
  selector: 'app-inquiries-tab',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="adm-bar">
      <input type="search" aria-label="Search requests" placeholder="Search by name, email or idea" [ngModel]="q()" (ngModelChange)="q.set($event)" />
      <div class="adm-seg" role="group" aria-label="Status">
        <button type="button" [class.on]="!status()" (click)="status.set('')">All ({{ list().length }})</button>
        @for (s of statuses; track s) { <button type="button" [class.on]="status() === s" [attr.aria-pressed]="status() === s" (click)="status.set(s)">{{ label[s] }} ({{ count(s) }})</button> }
      </div>
      <button class="btn small ghost grow" type="button" (click)="exportCsv()">Export CSV</button>
    </div>
    @if (error()) { <div class="alert error" role="alert">{{ error() }}</div> }

    @for (i of shown(); track i.id) {
      <article class="adm-card inq">
        <header><div><strong>{{ i.productType }}</strong> <span class="muted">· {{ i.occasion }}</span><br />
          <span class="muted s">{{ i.id }} · received {{ i.createdAt.slice(0, 10) }}</span></div>
          <div class="adm-actions"><span class="pill" [class]="'pill ' + tone[i.status]">{{ label[i.status] }}</span>
            <label class="sr-only" [for]="'is' + i.id">Change status</label>
            <select [id]="'is' + i.id" (change)="setStatus(i, $any($event.target).value)">@for (s of statuses; track s) { <option [value]="s" [selected]="s === i.status">{{ label[s] }}</option> }</select></div></header>

        <dl class="meta"><div><dt>From</dt><dd>{{ i.name }} · <a [href]="mailto(i)">{{ i.email }}</a></dd></div>
          <div><dt>Deadline</dt><dd>{{ i.deadline || 'not given' }} @if (overdue(i)) { <span class="pill red">overdue</span> } @else if (soon(i)) { <span class="pill amber">due soon</span> }</dd></div>
          <div><dt>Budget</dt><dd>{{ i.budget || '—' }}</dd></div>@if (i.style) { <div><dt>Style</dt><dd>{{ i.style }}</dd></div> }</dl>
        <p class="desc">{{ i.description }}</p>
        @if (i.referenceImages.length) { <div class="refs">@for (r of i.referenceImages; track $index) { <a [href]="url(r)" target="_blank" rel="noopener"><img [src]="url(r)" alt="Reference image {{ $index + 1 }}" width="64" height="64" /></a> }</div> }

        <div class="field"><label [for]="'n' + i.id">Private note (only you can see this)</label>
          <textarea [id]="'n' + i.id" [value]="i.adminNote ?? ''" (blur)="saveNote(i, $any($event.target).value)" placeholder="Quote sent, waiting for photos…"></textarea></div>
        <div class="adm-actions"><a class="btn small" [href]="mailto(i)">Reply by email</a>
          @if (i.status === 'new') { <button class="btn small soft" type="button" (click)="setStatus(i, 'in_progress')">Start working</button> }
          @if (i.status === 'in_progress') { <button class="btn small soft" type="button" (click)="setStatus(i, 'quoted')">Mark as quoted</button> }
          @if (i.status === 'quoted') { <button class="btn small soft" type="button" (click)="setStatus(i, 'completed')">Mark completed</button> }</div>
      </article>
    } @empty { <div class="adm-empty"><p>{{ list().length ? 'No requests match.' : 'No custom requests yet. They appear here when customers use the Custom Orders form.' }}</p></div> }
  `,
  styles: [`
    .inq header { display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; align-items: flex-start; } .s { font-size: .82rem; }
    .meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: .4rem 1.2rem; margin: .8rem 0; div { display: grid; } dt { font-size: .75rem; color: var(--muted); } dd { margin: 0; } }
    .desc { margin: .4rem 0 .8rem; } .refs { display: flex; gap: 6px; margin-bottom: .8rem; img { width: 64px; height: 64px; object-fit: cover; border-radius: 10px; } }
    select { padding: .4rem .7rem; border-radius: 999px; border: 1px solid var(--line); font: inherit; background: #fff; } textarea { min-height: 70px; }
    .field { margin-bottom: .8rem; }
  `],
})
export class InquiriesTabComponent implements OnInit {
  private backend = inject(Backend);
  private toast = inject(ToastService);
  private state = inject(AdminStateService);
  statuses = STATUSES; label = LABEL; tone = TONE;
  list = signal<Inquiry[]>([]);
  q = signal('');
  status = signal('');
  error = signal('');
  count = (s: Inquiry['status']) => this.list().filter((i) => i.status === s).length;

  shown = computed(() => {
    const q = this.q().trim().toLowerCase();
    return this.list().filter((i) => (!this.status() || i.status === this.status()) && (!q || (i.name + i.email + i.productType + i.description).toLowerCase().includes(q)));
  });

  ngOnInit() { void this.load(); }
  async load() { try { this.list.set(await this.backend.listAllInquiries()); } catch (e) { this.error.set((e as Error).message); } }

  private days(i: Inquiry) { return i.deadline ? Math.ceil((new Date(i.deadline).getTime() - Date.now()) / 86400000) : null; }
  open = (i: Inquiry) => i.status !== 'completed' && i.status !== 'declined';
  overdue = (i: Inquiry) => this.open(i) && (this.days(i) ?? 1) < 0;
  soon = (i: Inquiry) => this.open(i) && (this.days(i) ?? 99) >= 0 && (this.days(i) ?? 99) <= 3;

  mailto(i: Inquiry) {
    const subject = encodeURIComponent(`Re: your ${i.productType} request (${i.id})`);
    const body = encodeURIComponent(`Hi ${i.name.split(' ')[0]},\n\nThank you for your request. `);
    return `mailto:${i.email}?subject=${subject}&body=${body}`;
  }
  url(r: string) { return /^https?:|^data:/.test(r) ? r : ''; }

  async setStatus(i: Inquiry, s: Inquiry['status']) {
    try { await this.backend.updateInquiryStatus(i.id, s); this.toast.show(`Marked as ${LABEL[s].toLowerCase()}`); await this.load(); void this.state.refresh(); } catch (e) { this.error.set((e as Error).message); }
  }
  async saveNote(i: Inquiry, note: string) {
    if ((i.adminNote ?? '') === note) return;
    try { await this.backend.updateInquiryNote(i.id, note); this.list.update((l) => l.map((x) => (x.id === i.id ? { ...x, adminNote: note } : x))); this.toast.show('Note saved'); } catch (e) { this.error.set((e as Error).message); }
  }

  exportCsv() {
    const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['ID', 'Received', 'Name', 'Email', 'Type', 'Occasion', 'Deadline', 'Budget', 'Status', 'Note']].concat(
      this.shown().map((i) => [i.id, i.createdAt.slice(0, 10), i.name, i.email, i.productType, i.occasion, i.deadline, i.budget, i.status, i.adminNote ?? ''])
    );
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([rows.map((r) => r.map(cell).join(',')).join('\n')], { type: 'text/csv' }));
    a.download = `custom-requests-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
}

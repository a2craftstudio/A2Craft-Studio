import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Backend } from '../../core/backend';
import { istStamp } from '../../core/format';
import { VisitEvent } from '../../core/models';
import { CatalogService } from '../../core/services';

interface Journey { id: string; label: string; signedIn: boolean; last: string; pages: number; products: string[]; events: VisitEvent[] }

/** Who browsed what. Only visitors who opted in to visit analytics appear here. */
@Component({
  selector: 'app-visitors-tab',
  standalone: true,
  template: `
    <p class="muted">Only visitors who chose “Allow” in the privacy notice are counted. Visitors are anonymous (a random ID on their device) unless they were signed in. Admin visits are never recorded.</p>
    <div class="range" role="group" aria-label="Date range">
      @for (r of ranges; track r.days) { <button type="button" [class.on]="days() === r.days" [attr.aria-pressed]="days() === r.days" (click)="days.set(r.days)">{{ r.label }}</button> }
    </div>
    @if (error()) { <div class="alert error" role="alert">{{ error() }}</div> }

    <div class="stats">
      <div class="card stat"><span>Page views</span><strong>{{ pageViews() }}</strong></div>
      <div class="card stat"><span>Visitors</span><strong>{{ journeys().length }}</strong></div>
      <div class="card stat"><span>Signed-in visitors</span><strong>{{ signedIn() }}</strong></div>
      <div class="card stat"><span>Design views</span><strong>{{ designViews() }}</strong></div>
      <div class="card stat"><span>Likes (saves)</span><strong>{{ likes() }}</strong></div>
    </div>

    <div class="two">
      <div class="card box"><h2>Top pages</h2>
        @for (p of topPages(); track p.path) { <div class="row"><span>{{ p.path }}</span><strong>{{ p.views }}</strong></div> } @empty { <p class="muted">No page views in this period.</p> }</div>
    </div>

    <h2 class="h">Visitor journeys</h2>
    <div class="table-wrap"><table class="tbl">
      <thead><tr><th>Visitor</th><th>Last seen (IST)</th><th>Pages</th><th>Designs viewed</th><th></th></tr></thead>
      <tbody>
        @for (j of journeys(); track j.id) {
          <tr><td><strong>{{ j.label }}</strong>@if (j.signedIn) { <span class="pill">signed in</span> }</td><td>{{ ist(j.last) }}</td><td>{{ j.pages }}</td>
            <td>{{ j.products.join(', ') || '—' }}</td>
            <td><button class="btn small ghost" type="button" (click)="open.set(open() === j.id ? '' : j.id)" [attr.aria-expanded]="open() === j.id">{{ open() === j.id ? 'Hide' : 'Timeline' }}</button></td></tr>
          @if (open() === j.id) {
            <tr class="det"><td colspan="5"><ol class="tl">@for (e of j.events; track e.id) { <li><time>{{ ist(e.at).slice(5) }}</time> {{ describe(e) }}</li> }</ol></td></tr>
          }
        } @empty { <tr><td colspan="5" class="muted">No recorded visits yet. They appear once visitors accept the privacy notice.</td></tr> }
      </tbody></table></div>
  `,
  styles: [`
    .range { display: inline-flex; background: #efefef; border-radius: 999px; padding: 4px; margin: .5rem 0 1rem; button { border: 0; background: transparent; font-weight: 700; padding: .45rem 1rem; border-radius: 999px; &.on { background: #111; color: #fff; } } }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 14px; margin-bottom: 14px; } .stat { padding: 1.1rem; span { display: block; font-size: .8rem; color: var(--muted); } strong { font-size: 2rem; } }
    .two { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 14px; } .box { padding: 1.2rem 1.4rem; h2 { font-size: 1.15rem; } }
    .row { display: flex; justify-content: space-between; gap: 1rem; padding: .45rem 0; border-bottom: 1px solid var(--line); font-size: .9rem; }
    .h { font-size: 1.3rem; margin: 1.4rem 0 .4rem; } .pill { margin-left: .5rem; font-size: .7rem; font-weight: 700; background: #e60023; color: #fff; border-radius: 999px; padding: .1rem .55rem; }
    .det > td { background: #fafafa; } .tl { list-style: none; padding: 0; margin: 0; font-size: .85rem; display: grid; gap: 4px; time { color: var(--muted); margin-right: .6rem; font-variant-numeric: tabular-nums; } }
  `],
})
export class VisitorsTabComponent implements OnInit {
  protected ist = istStamp;
  private backend = inject(Backend);
  private catalog = inject(CatalogService);
  ranges = [{ days: 1, label: 'Today' }, { days: 7, label: '7 days' }, { days: 30, label: '30 days' }];
  days = signal(30);
  open = signal('');
  error = signal('');
  events = signal<VisitEvent[]>([]);

  inRange = computed(() => {
    const since = this.days() === 1 ? new Date(new Date().setHours(0, 0, 0, 0)).getTime() : Date.now() - this.days() * 86400000;
    return this.events().filter((e) => new Date(e.at).getTime() >= since);
  });
  pageViews = computed(() => this.inRange().filter((e) => e.type === 'page').length);
  designViews = computed(() => this.inRange().filter((e) => e.type === 'product').length);
  likes = computed(() => this.inRange().filter((e) => e.type === 'like').length);
  signedIn = computed(() => new Set(this.inRange().filter((e) => e.userId).map((e) => e.userId)).size);

  title = (id?: string) => (id ? this.catalog.byId(id)?.title ?? id : '');

  topPages = computed(() => {
    const m = new Map<string, number>();
    for (const e of this.inRange().filter((x) => x.type === 'page' && !x.path.startsWith('/product/'))) m.set(e.path, (m.get(e.path) ?? 0) + 1);
    return [...m.entries()].map(([path, views]) => ({ path, views })).sort((a, b) => b.views - a.views).slice(0, 6);
  });

  journeys = computed<Journey[]>(() => {
    const m = new Map<string, VisitEvent[]>();
    for (const e of this.inRange()) m.set(e.visitorId, [...(m.get(e.visitorId) ?? []), e]);
    return [...m.entries()].map(([id, evs]) => {
      const sorted = [...evs].sort((a, b) => a.at.localeCompare(b.at));
      const user = evs.find((e) => e.userLabel);
      return {
        id, label: user?.userLabel ?? 'Visitor ' + id.replace(/^v-/, '').slice(0, 4), signedIn: !!user, last: sorted[sorted.length - 1].at,
        pages: evs.filter((e) => e.type === 'page').length,
        products: [...new Set(sorted.filter((e) => e.type === 'product').map((e) => this.title(e.productId)))],
        events: sorted,
      };
    }).sort((a, b) => b.last.localeCompare(a.last));
  });

  describe(e: VisitEvent) {
    if (e.type === 'like') return 'Saved design: ' + this.title(e.productId);
    return e.type === 'product' ? 'Viewed design: ' + this.title(e.productId) : 'Opened ' + e.path;
  }

  async ngOnInit() {
    void this.catalog.load();
    try { this.events.set(await this.backend.listEvents()); } catch (e) { this.error.set((e as Error).message); }
  }
}

import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Backend } from '../../core/backend';
import { VisitEvent } from '../../core/models';
import { dailySeries, rankDesigns, sortBy } from '../../core/popularity';
import { CatalogService } from '../../core/services';

/** "What people like most": designs ranked by likes (saves) or views, plus a daily trend. Opted-in visitors only. */
@Component({
  selector: 'app-popularity-chart',
  standalone: true,
  template: `
    <section class="card wrap" aria-labelledby="pop-h">
      <div class="top">
        <div><h2 id="pop-h">What people like most</h2>
          <p class="muted s">Based on visitors who allowed visit analytics. A like is a saved design.</p></div>
        <div class="ctl">
          <div class="seg" role="group" aria-label="Rank by">
            @for (m of metrics; track m.id) { <button type="button" [class.on]="metric() === m.id" [attr.aria-pressed]="metric() === m.id" (click)="metric.set(m.id)">{{ m.label }}</button> }
          </div>
          <div class="seg" role="group" aria-label="Period">
            @for (r of ranges; track r.days) { <button type="button" [class.on]="days() === r.days" [attr.aria-pressed]="days() === r.days" (click)="days.set(r.days)">{{ r.label }}</button> }
          </div>
        </div>
      </div>

      @if (error()) { <div class="alert error" role="alert">{{ error() }}</div> }
      @else if (!ranked().length) { <p class="muted">No {{ metric() }} recorded in this period yet.</p> }
      @else {
        <ol class="bars" [attr.aria-label]="'Top designs by ' + metric()">
          @for (r of ranked(); track r.id; let i = $index) {
            <li>
              <span class="rank">{{ i + 1 }}</span>
              <img [src]="thumb(r.id)" alt="" width="40" height="50" loading="lazy" />
              <div class="body">
                <div class="line"><strong>{{ title(r.id) }}</strong><span class="num">{{ value(r) }} {{ metric() }} <small>· {{ other(r) }}</small></span></div>
                <div class="track" aria-hidden="true"><span class="fill" [class.views]="metric() === 'views'" [style.width.%]="(value(r) / max()) * 100"></span></div>
              </div>
            </li>
          }
        </ol>
      }

      <h3 class="sub">Daily activity, last {{ trendDays }} days</h3>
      <div class="trend" role="img" [attr.aria-label]="'Daily likes and views for the last ' + trendDays + ' days'">
        @for (d of series(); track d.day) {
          <div class="day" [title]="d.day + ': ' + d.views + ' views, ' + d.likes + ' likes'">
            <span class="b v" [style.height.%]="(d.views / trendMax()) * 100"></span><span class="b l" [style.height.%]="(d.likes / trendMax()) * 100"></span>
            <small>{{ d.day.slice(8) }}</small>
          </div>
        }
      </div>
      <p class="legend"><i class="v"></i> Views <i class="l"></i> Likes</p>
    </section>
  `,
  styles: [`
    .wrap { padding: 1.3rem 1.5rem; margin-bottom: 14px; } .top { display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; align-items: flex-start; h2 { font-size: 1.35rem; margin: 0; } }
    .s { font-size: .82rem; margin: .2rem 0 0; } .ctl { display: flex; gap: .6rem; flex-wrap: wrap; }
    .seg { display: inline-flex; background: #efefef; border-radius: 999px; padding: 3px; button { border: 0; background: transparent; font-weight: 700; font-size: .82rem; padding: .4rem .9rem; border-radius: 999px; &.on { background: #111; color: #fff; } } }
    .bars { list-style: none; padding: 0; margin: 1rem 0 0; display: grid; gap: 10px; }
    .bars li { display: grid; grid-template-columns: 22px 40px 1fr; gap: 10px; align-items: center; }
    .rank { font-weight: 800; color: var(--muted); text-align: center; } img { width: 40px; height: 50px; object-fit: cover; border-radius: 8px; background: #efefef; }
    .line { display: flex; justify-content: space-between; gap: .8rem; font-size: .9rem; margin-bottom: 4px; } .num { white-space: nowrap; font-weight: 700; small { font-weight: 400; color: var(--muted); } }
    .track { height: 12px; background: #f1f1f1; border-radius: 999px; overflow: hidden; }
    .fill { display: block; height: 100%; min-width: 4px; border-radius: 999px; background: #e60023; transition: width .7s var(--ease); &.views { background: #111; } }
    .sub { font-size: 1rem; margin: 1.5rem 0 .5rem; }
    .trend { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 4px; height: 120px; align-items: end; }
    .day { height: 100%; display: flex; align-items: flex-end; justify-content: center; gap: 2px; position: relative; padding-bottom: 16px; small { position: absolute; bottom: 0; font-size: .65rem; color: var(--muted); } }
    .b { width: 38%; max-width: 14px; min-height: 2px; border-radius: 4px 4px 0 0; transition: height .6s var(--ease); } .b.v { background: #111; } .b.l { background: #e60023; }
    .legend { font-size: .78rem; color: var(--muted); display: flex; align-items: center; gap: .4rem; margin: .4rem 0 0; i { width: 10px; height: 10px; border-radius: 3px; display: inline-block; &.v { background: #111; } &.l { background: #e60023; margin-left: .6rem; } } }
  `],
})
export class PopularityChartComponent implements OnInit {
  private backend = inject(Backend);
  private catalog = inject(CatalogService);
  metrics: { id: 'likes' | 'views'; label: string }[] = [{ id: 'likes', label: 'Most liked' }, { id: 'views', label: 'Most viewed' }];
  ranges = [{ days: 7, label: '7 days' }, { days: 30, label: '30 days' }];
  trendDays = 14;
  metric = signal<'likes' | 'views'>('likes');
  days = signal(30);
  events = signal<VisitEvent[]>([]);
  error = signal('');

  ranked = computed(() => {
    const since = Date.now() - this.days() * 86400000;
    return sortBy(rankDesigns(this.events(), since), this.metric()).filter((r) => r[this.metric()] > 0).slice(0, 8);
  });
  max = computed(() => Math.max(1, ...this.ranked().map((r) => this.value(r))));
  series = computed(() => dailySeries(this.events(), this.trendDays));
  trendMax = computed(() => Math.max(1, ...this.series().flatMap((d) => [d.views, d.likes])));

  value = (r: { likes: number; views: number }) => r[this.metric()];
  other = (r: { likes: number; views: number }) => (this.metric() === 'likes' ? r.views + ' views' : r.likes + ' likes');
  title = (id: string) => this.catalog.byId(id)?.title ?? id;
  thumb = (id: string) => this.catalog.byId(id)?.gallery[0]?.url ?? '';

  async ngOnInit() {
    void this.catalog.load();
    try { this.events.set(await this.backend.listEvents()); } catch (e) { this.error.set((e as Error).message); }
  }
}

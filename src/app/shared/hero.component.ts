import { Component, computed, DestroyRef, effect, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BRAND } from '../core/config';
import { CatalogService, SettingsService } from '../core/services';
import { IconComponent } from './icon.component';

/** One rotating headline per category that has photos. Everything here comes from the live catalog. */
interface Theme { word: string; color: string; imgs: string[] }
const COLORS = ['#c2185b', '#0a94a8', '#7a4330', '#d97706', '#e60023'];

/**
 * Landing hero: the headline word and accent colour change every few seconds while seven columns of photos
 * wave out and back in. Rotation stops for visitors who prefer reduced motion.
 */
@Component({
  selector: 'app-hero',
  standalone: true,
  imports: [RouterLink, IconComponent],
  template: `
    <section class="phero" [class.noimg]="!colCount()" [style.--wc]="theme().color" aria-label="Welcome">
      <div class="inner">
        <h1>Get your next
          <span class="word-wrap" aria-live="polite">
            @for (t of themes(); track t.word; let i = $index) {
              <span class="word" [class.on]="i === idx()" [class.off]="i === prev()" [style.--wc]="t.color" [attr.aria-hidden]="i !== idx()">{{ t.word }}</span>
            }
          </span>
        </h1>
        @if (themes().length > 1) {
        <div class="dots" role="tablist" aria-label="Pick a theme">
          @for (t of themes(); track t.word; let i = $index) {
            <button type="button" role="tab" [class.on]="i === idx()" [attr.aria-selected]="i === idx()" [attr.aria-label]="'Show ' + t.word" (click)="go(i)"></button>
          }
        </div>
        }
        <p class="sub">{{ brand.description }}</p>
        <div class="cta">
          <a class="btn primary" href="#feed-sec">Start exploring <app-icon name="down" [size]="18" /></a>
          <a class="btn ghost" routerLink="/custom-order"><app-icon name="wand" [size]="18" /> Request something custom</a>
          <a class="status" routerLink="/contact" [class.closed]="!status().open" [attr.aria-label]="status().label"><i></i> {{ status().open ? 'Online now · ' : 'Offline · ' }}{{ status().short }}</a>
        </div>
      </div>

      @if (colCount()) {
      <div class="cols" aria-hidden="true">
        @for (c of colIdx(); track c) {
          <div class="col" [style.--c]="c">
            @for (k of [0, 1]; track k) { <img [src]="src(c, k)" alt="" [class.on]="visible()" width="236" height="350" loading="eager" /> }
          </div>
        }
        <div class="fade"></div>
      </div>
      <a href="#feed-sec" class="cue">See today’s picks <app-icon name="down" [size]="16" /></a>
      }
    </section>
  `,
  styles: [`
    .phero { position: relative; min-height: min(100vh, 980px); padding-top: 80px; overflow: hidden; text-align: center; background: #fff; }
    .phero.noimg { min-height: 0; padding-bottom: 56px; }
    .inner { position: relative; z-index: 2; padding-inline: 16px; }
    h1 { font-size: clamp(40px, 5.4vw, 72px); line-height: 1.05; font-weight: 800; letter-spacing: -0.03em; margin: 0; -webkit-text-fill-color: initial; }
    .word-wrap { position: relative; display: block; height: 1.2em; overflow: hidden; filter: drop-shadow(0 6px 14px color-mix(in srgb, var(--wc) 22%, transparent)); }
    .word { position: absolute; inset: 0; font-family: 'Fraunces', Georgia, serif; font-style: italic; font-weight: 600; color: var(--wc); opacity: 0; translate: 0 40px; transition: opacity .6s, translate .8s var(--ease); }
    .word.on { opacity: 1; translate: 0 0; } .word.off { opacity: 0; translate: 0 -40px; }
    .dots { display: flex; justify-content: center; gap: 10px; margin-top: 22px; }
    .dots button { width: 11px; height: 11px; padding: 0; border: 0; border-radius: 50%; background: #e1e1e1; transition: background .4s, scale .3s; }
    .dots button.on { background: var(--wc); scale: 1.25; }
    .sub { max-width: 560px; margin: 18px auto 0; color: #5f5f5f; font-size: 18px; }
    .cta { display: flex; justify-content: center; flex-wrap: wrap; gap: 12px; margin-top: 26px; align-items: center; }
    .btn.primary { background: #e60023; color: #fff; box-shadow: 0 12px 28px -8px rgba(230,0,35,.4); }
    .btn.ghost { background: rgba(255,255,255,.9); box-shadow: inset 0 0 0 1px var(--line); color: #111; }
    .btn.ghost:hover { background: #fff; color: #e60023; }
    .status { display: inline-flex; align-items: center; gap: 8px; padding: .55rem 1rem; border-radius: 999px; background: rgba(255,255,255,.92); box-shadow: 0 6px 18px -10px rgba(0,0,0,.35); font-weight: 600; font-size: .9rem; }
    .status { text-decoration: none; color: #111; transition: transform .2s var(--ease); } .status:hover { transform: translateY(-2px); }
    .status.closed i { background: #9a9a9a; animation: none; }
    .status i { width: 9px; height: 9px; border-radius: 50%; background: #e60023; animation: pulse 1.8s ease-in-out infinite; }
    @keyframes pulse { 50% { box-shadow: 0 0 0 7px rgba(230,0,35,.18); } }
    .cols { position: relative; display: flex; justify-content: center; gap: 16px; height: 640px; margin-top: 46px; }
    .col { flex: 0 0 236px; display: flex; flex-direction: column; gap: 16px; }
    .col:nth-child(1), .col:nth-child(7) { margin-top: 0; } .col:nth-child(2), .col:nth-child(6) { margin-top: 80px; }
    .col:nth-child(3), .col:nth-child(5) { margin-top: 160px; } .col:nth-child(4) { margin-top: 240px; }
    .col img { width: 100%; height: 350px; border-radius: 22px; object-fit: cover; background: #efefef; box-shadow: 0 18px 40px -20px rgba(0,0,0,.45);
      opacity: 0; translate: 0 40px; transition: opacity .7s, translate .9s var(--ease); transition-delay: calc(var(--c) * .08s); }
    .col img.on { opacity: 1; translate: 0 0; }
    .fade { position: absolute; inset: auto 0 0; height: 260px; background: linear-gradient(rgba(255,255,255,0), #fff 78%); pointer-events: none; z-index: 2; }
    .cue { position: absolute; left: 50%; bottom: 30px; z-index: 3; translate: -50% 0; display: flex; align-items: center; gap: 8px; padding: 10px 18px; border-radius: 999px; background: var(--wc); color: #fff; font-weight: 700; text-decoration: none; transition: background .5s, transform .25s var(--ease); box-shadow: 0 10px 24px -8px color-mix(in srgb, var(--wc) 55%, transparent); }
    .cue:hover { transform: translateY(-3px); }
    @media (max-width: 1100px) { .col { flex-basis: 150px; } .col img { height: 230px; border-radius: 16px; } .cols { height: 470px; gap: 10px; } .col { gap: 10px; }
      .col:nth-child(2), .col:nth-child(6) { margin-top: 50px; } .col:nth-child(3), .col:nth-child(5) { margin-top: 100px; } .col:nth-child(4) { margin-top: 150px; } }
    @media (max-width: 640px) { .phero { padding-top: 40px; } .sub { font-size: 16px; } .col { flex-basis: 110px; } .col img { height: 170px; } .cols { height: 360px; } }
    @media (prefers-reduced-motion: reduce) { .word, .col img { transition-duration: .01ms; } .status i { animation: none; } }
  `],
})
export class HeroComponent implements OnInit {
  brand = BRAND;
  status = inject(SettingsService).status;
  private catalog = inject(CatalogService);

  themes = computed<Theme[]>(() => {
    const photos = (p: { gallery: { kind: string; url: string }[] }) => p.gallery.filter((m) => m.kind === 'image').map((m) => m.url);
    const published = this.catalog.products();
    const byCat = this.catalog.categories()
      .map((c) => ({ name: c.name, imgs: [...new Set(published.filter((p) => p.category === c.id).flatMap(photos))] }))
      .filter((c) => c.imgs.length)
      .sort((a, b) => b.imgs.length - a.imgs.length)
      .slice(0, 5)
      .map((c, i) => ({ word: c.name.toLowerCase(), color: COLORS[i % COLORS.length], imgs: c.imgs }));
    if (byCat.length) return byCat;
    const all = [...new Set(published.flatMap(photos))];
    return [{ word: 'keepsake', color: COLORS[4], imgs: all }];
  });

  idx = signal(0);
  prev = signal(-1);
  /** Images shown now; swapped to the next theme while columns are faded out. */
  shownTheme = signal(0);
  visible = signal(false);
  theme = computed(() => this.themes()[Math.min(this.idx(), this.themes().length - 1)]);
  /** Number of photo columns: none for an empty shop, up to seven for a full one. */
  colCount = computed(() => { const n = this.themes()[Math.min(this.shownTheme(), this.themes().length - 1)].imgs.length; return n ? Math.min(7, Math.max(3, n)) : 0; });
  colIdx = computed(() => Array.from({ length: this.colCount() }, (_, i) => i));
  private timer: ReturnType<typeof setInterval> | null = null;
  private destroy = inject(DestroyRef);

  constructor() {
    // When the catalog (re)loads, start again from the first headline and preload its photos.
    effect(() => {
      const t = this.themes();
      this.idx.set(0); this.shownTheme.set(0);
      t.forEach((x) => x.imgs.forEach((u) => { const i = new Image(); i.src = u; }));
      this.visible.set(false);
      requestAnimationFrame(() => this.visible.set(true));
      if (t.length > 1 && !matchMedia('(prefers-reduced-motion: reduce)').matches) this.start(); else this.stop();
    });
  }

  src(c: number, k: number) {
    const imgs = this.themes()[this.shownTheme()]?.imgs ?? [];
    return imgs.length ? imgs[(c * 2 + k) % imgs.length] : '';
  }

  ngOnInit() {
    void this.catalog.load();
    this.destroy.onDestroy(() => this.stop());
  }

  private start() { this.stop(); this.timer = setInterval(() => this.go(this.idx() + 1, false), 4800); }
  private stop() { if (this.timer) clearInterval(this.timer); this.timer = null; }

  go(i: number, manual = true) {
    const n = this.themes().length;
    const next = (i + n) % n;
    if (next === this.idx()) return;
    if (manual) this.start(); // restart the countdown after a click
    this.prev.set(this.idx());
    this.idx.set(next);
    setTimeout(() => this.prev.set(-1), 800);
    this.visible.set(false);
    setTimeout(() => { this.shownTheme.set(next); this.visible.set(true); }, 650);
  }
}

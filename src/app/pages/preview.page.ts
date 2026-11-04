import { Component, computed, effect, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { DomSanitizer } from '@angular/platform-browser';
import { SeoService } from '../core/services';
import { templateBySlug, templateUrl } from '../core/templates';

type Device = 'desktop' | 'tablet' | 'mobile';

@Component({
  selector: 'app-preview',
  standalone: true,
  imports: [RouterLink],
  template: `
    @if (ready(); as t) {
      <div class="pv">
        <header class="bar">
          <a class="back" routerLink="/templates">&larr; All templates</a>
          <div class="who"><strong>{{ t.title }}</strong><span>{{ t.subtitle }}</span></div>
          <div class="tools">
            @for (d of devices; track d) {
              <button type="button" [class.on]="device() === d" (click)="device.set(d)" [attr.aria-pressed]="device() === d">{{ d }}</button>
            }
            <a class="edit" [routerLink]="['/customize', t.slug]">Edit</a>
            <a class="open" [href]="url()" target="_blank" rel="noopener">Open &#8599;</a>
          </div>
        </header>
        <div class="stage" [attr.data-device]="device()">
          <iframe [src]="src()" [title]="t.title + ' preview'"></iframe>
        </div>
      </div>
    } @else {
      <div class="container empty">
        <p class="eyebrow">Preview</p>
        <h1>This template isn’t available</h1>
        <a class="btn" routerLink="/templates">See all templates</a>
      </div>
    }
  `,
  styles: [`
    .pv { display: flex; flex-direction: column; height: calc(100vh - var(--header-h)); }
    .bar { display: flex; align-items: center; gap: 1rem; padding: .7rem 1rem; border-bottom: 1px solid rgba(0,0,0,.08); background: #fff; }
    .back { text-decoration: none; color: var(--berry); font-weight: 600; white-space: nowrap; }
    .who { display: flex; flex-direction: column; line-height: 1.2; min-width: 0; }
    .who strong { font-size: 1rem; }
    .who span { font-size: .82rem; opacity: .65; }
    .tools { margin-left: auto; display: flex; align-items: center; gap: .35rem; }
    .tools button { text-transform: capitalize; border: 1px solid rgba(0,0,0,.14); background: #fff; border-radius: 999px; padding: .35rem .8rem; cursor: pointer; font: inherit; font-size: .82rem; }
    .tools button.on { background: var(--berry); border-color: var(--berry); color: #fff; }
    .edit { text-decoration: none; font-size: .82rem; font-weight: 600; background: var(--berry); color: #fff; border-radius: 999px; padding: .35rem .9rem; white-space: nowrap; }
    .open { margin-left: .4rem; text-decoration: none; font-size: .82rem; font-weight: 600; color: var(--berry); white-space: nowrap; }
    .stage { flex: 1; min-height: 0; background: var(--blush); padding: 1rem; display: flex; justify-content: center; }
    .stage iframe { width: 100%; height: 100%; border: 0; background: #fff; border-radius: 10px; box-shadow: 0 6px 24px rgba(0,0,0,.12); }
    .stage[data-device='tablet'] iframe { max-width: 820px; }
    .stage[data-device='mobile'] iframe { max-width: 414px; }
    @media (max-width: 720px) { .who { display: none; } .stage { padding: .5rem; } }
  `],
})
export class PreviewPage {
  private route = inject(ActivatedRoute);
  private sanitizer = inject(DomSanitizer);
  private seo = inject(SeoService);
  private doc = inject(DOCUMENT);

  devices: Device[] = ['desktop', 'tablet', 'mobile'];
  device = signal<Device>('desktop');

  private slug = toSignal(this.route.paramMap.pipe(map((m) => m.get('slug') ?? '')), { initialValue: '' });
  item = computed(() => templateBySlug(this.slug()));
  /** Empty when the slug matches no template, or when that template isn't hosted anywhere yet. */
  url = computed(() => { const t = this.item(); return t ? templateUrl(t, this.doc.baseURI) : ''; });
  /** The template only when there is something to show in the frame. */
  ready = computed(() => (this.url() ? this.item() : undefined));
  src = computed(() => this.sanitizer.bypassSecurityTrustResourceUrl(this.url()));

  constructor() {
    effect(() => {
      const t = this.item();
      this.seo.set({ title: t ? `${t.title} preview` : 'Template not found' });
    });
  }
}

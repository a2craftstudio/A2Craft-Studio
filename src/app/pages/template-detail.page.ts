import { Component, computed, effect, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { DomSanitizer } from '@angular/platform-browser';
import { SeoService } from '../core/services';
import { categorySlug, templateBySlug, templateUrl, WEB_TEMPLATES } from '../core/templates';

@Component({
  selector: 'app-template-detail',
  standalone: true,
  imports: [RouterLink],
  template: `
    @if (item(); as t) {
      <div class="container">
        <nav class="crumbs" aria-label="Breadcrumb">
          <a routerLink="/templates">Templates</a> ·
          <a [routerLink]="['/templates/c', slugOf(t.category)]">{{ t.category }}</a>
        </nav>

        <div class="top">
          <div class="shot">
            @if (src()) {
              <iframe [src]="src()" [title]="t.title" loading="lazy" tabindex="-1" aria-hidden="true"></iframe>
            } @else {
              <span class="soon">Not hosted yet</span>
            }
          </div>

          <div class="about">
            <p class="eyebrow">{{ t.category }}</p>
            <h1>{{ t.title }}</h1>
            <p class="subtitle">{{ t.subtitle }}</p>
            <p class="blurb">{{ t.blurb }}</p>

            @if (src()) {
              <div class="actions">
                <a class="btn" [routerLink]="['/customize', t.slug]">Edit this design</a>
                <a class="btn soft" [routerLink]="['/preview', t.slug]">Full preview</a>
                <a class="btn ghost" [href]="url()" target="_blank" rel="noopener">Open in a new tab &#8599;</a>
              </div>
              <p class="note">Editing changes the names, dates, wording and photos right in the preview.
                Nothing is published until you order.</p>
            } @else {
              <div class="actions"><a class="btn" routerLink="/custom-order">Ask us for this design</a></div>
              <p class="note">This one isn’t live on our servers yet. Tell us and we’ll set it up for you.</p>
            }
          </div>
        </div>

        @if (siblings().length) {
          <section class="more">
            <h2>More {{ t.category }} designs</h2>
            <div class="row">
              @for (s of siblings(); track s.slug) {
                <a [routerLink]="['/templates', s.slug]">{{ s.title }}</a>
              }
            </div>
          </section>
        }
      </div>
    } @else {
      <div class="container empty">
        <h1>This template isn’t available</h1>
        <a class="btn" routerLink="/templates">See all templates</a>
      </div>
    }
  `,
  styles: [`
    .crumbs { padding-block: 20px 4px; font-size: .88rem; a { color: var(--berry); } }
    .top { display: grid; grid-template-columns: 1.1fr .9fr; gap: clamp(20px, 4vw, 48px); align-items: start; padding-block: 16px 40px; }
    .shot { position: relative; aspect-ratio: 16/11; overflow: hidden; border-radius: 14px; border: 1px solid rgba(0,0,0,.09); background: var(--blush); }
    .shot iframe { position: absolute; inset: 0; width: 1400px; height: 963px; border: 0; transform: scale(.44); transform-origin: top left; pointer-events: none; }
    .soon { position: absolute; inset: 0; display: grid; place-items: center; opacity: .55; font-size: .9rem; }
    .about h1 { margin: .2rem 0 .1rem; }
    .subtitle { opacity: .65; margin: 0 0 .9rem; }
    .blurb { margin-bottom: 1.4rem; }
    .actions { display: flex; flex-wrap: wrap; gap: .6rem; }
    .note { font-size: .82rem; opacity: .6; margin-top: .9rem; max-width: 42ch; }
    .more h2 { font-size: 1rem; margin-bottom: .7rem; }
    .more .row { display: flex; flex-wrap: wrap; gap: .5rem; padding-bottom: 3rem; }
    .more a { text-decoration: none; color: inherit; border: 1px solid rgba(0,0,0,.14); border-radius: 999px; padding: .35rem .95rem; font-size: .85rem; }
    .empty { padding-block: 3rem; }
    @media (max-width: 860px) { .top { grid-template-columns: 1fr; } }
  `],
})
export class TemplateDetailPage {
  private route = inject(ActivatedRoute);
  private sanitizer = inject(DomSanitizer);
  private seo = inject(SeoService);
  private doc = inject(DOCUMENT);

  slugOf = categorySlug;

  private slug = toSignal(this.route.paramMap.pipe(map((m) => m.get('slug') ?? '')), { initialValue: '' });
  item = computed(() => templateBySlug(this.slug()));
  /** Empty when the template isn't hosted anywhere yet, in which case no frame is rendered. */
  url = computed(() => { const t = this.item(); return t ? templateUrl(t, this.doc.baseURI) : ''; });
  src = computed(() => { const u = this.url(); return u ? this.sanitizer.bypassSecurityTrustResourceUrl(u) : null; });
  siblings = computed(() => {
    const t = this.item();
    return t ? WEB_TEMPLATES.filter((x) => x.category === t.category && x.slug !== t.slug) : [];
  });

  constructor() {
    effect(() => {
      const t = this.item();
      if (t) this.seo.set({ title: t.title, description: t.blurb, path: '/templates/' + t.slug });
      else this.seo.set({ title: 'Template not found' });
    });
  }
}

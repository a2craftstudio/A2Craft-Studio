import { Component, computed, effect, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { DomSanitizer } from '@angular/platform-browser';
import { SeoService } from '../core/services';
import {
  Category, categoryFromSlug, categorySlug, stockedCategories, templatesByCategory, templateThumb, templateUrl, WebTemplate,
} from '../core/templates';

@Component({
  selector: 'app-templates',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="container">
      <p class="eyebrow">Website templates</p>
      <h1>Websites you can <em>preview and edit</em></h1>
      <p class="lede">Invitations, greetings and shop fronts. Open any design to walk through the whole page,
        then change the words and photos and watch it update as you type.</p>

      <nav class="chips" aria-label="Template categories">
        <a routerLink="/templates" [class.on]="!active()">All</a>
        @for (c of categories; track c) {
          <a [routerLink]="['/templates/c', slugOf(c)]" [class.on]="active() === c">{{ c }}</a>
        }
      </nav>

      @for (group of groups(); track group.category) {
        <section class="group">
          <h2>{{ group.category }}</h2>
          <div class="grid">
            @for (t of group.items; track t.slug) {
              <a class="card" [routerLink]="['/templates', t.slug]">
                <span class="shot">
                  @if (t.still) {
                    <img [src]="t.still" alt="" loading="lazy" />
                  } @else if (t.src) {
                    <iframe [src]="t.src" [title]="t.title" loading="lazy" tabindex="-1" aria-hidden="true"></iframe>
                  } @else {
                    <span class="soon">Coming soon</span>
                  }
                </span>
                <span class="meta"><strong>{{ t.title }}</strong><span>{{ t.subtitle }}</span></span>
                <span class="blurb">{{ t.blurb }}</span>
                <span class="cta">Preview &amp; edit &rarr;</span>
              </a>
            }
          </div>
        </section>
      } @empty {
        <p class="muted">Nothing in this category yet.</p>
      }
    </div>
  `,
  styles: [`
    .lede { opacity: .7; margin-bottom: 1.4rem; max-width: 46ch; }
    .chips { display: flex; flex-wrap: wrap; gap: .45rem; margin-bottom: 2rem; }
    .chips a { text-decoration: none; color: inherit; border: 1px solid rgba(0,0,0,.14); border-radius: 999px; padding: .35rem .95rem; font-size: .85rem; }
    .chips a.on { background: var(--berry); border-color: var(--berry); color: #fff; }
    .group { margin-bottom: 2.5rem; }
    .group h2 { font-size: 1.1rem; margin-bottom: .9rem; }
    .grid { display: grid; gap: 1.2rem; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
    .card { display: block; text-decoration: none; color: inherit; border: 1px solid rgba(0,0,0,.09); border-radius: 14px; overflow: hidden; background: #fff; transition: box-shadow .25s, transform .25s; }
    .card:hover { box-shadow: 0 10px 28px rgba(0,0,0,.12); transform: translateY(-2px); }
    .shot { display: block; position: relative; aspect-ratio: 16/11; overflow: hidden; background: var(--blush); }
    .shot iframe { position: absolute; inset: 0; width: 1280px; height: 880px; border: 0; transform: scale(.32); transform-origin: top left; pointer-events: none; }
    .shot img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
    .soon { position: absolute; inset: 0; display: grid; place-items: center; font-size: .85rem; opacity: .55; }
    .meta { display: flex; flex-direction: column; gap: .15rem; padding: .85rem 1rem .2rem; }
    .meta strong { font-size: 1rem; }
    .meta span { font-size: .85rem; opacity: .65; }
    .blurb { display: block; padding: .3rem 1rem 0; font-size: .82rem; opacity: .7; }
    .cta { display: block; padding: .5rem 1rem 1rem; font-size: .85rem; font-weight: 600; color: var(--berry); }
  `],
})
export class TemplatesPage {
  private seo = inject(SeoService);
  private sanitizer = inject(DomSanitizer);
  private route = inject(ActivatedRoute);
  private doc = inject(DOCUMENT);

  /** Only the categories we have designs for: a chip onto an empty category is a dead end. */
  categories = stockedCategories();
  slugOf = categorySlug;

  /** Set on /templates/c/:category; unset on /templates, which shows every category. */
  active = toSignal(this.route.paramMap.pipe(map((m) => categoryFromSlug(m.get('category') ?? ''))), {
    initialValue: undefined as Category | undefined,
  });

  groups = computed(() => {
    const only = this.active();
    return templatesByCategory()
      .filter((g) => !only || g.category === only)
      .map((g) => ({ ...g, items: g.items.map((t) => this.withThumb(t)) }));
  });

  /**
   * Thumbnails are live iframes, so each src must be trusted as a resource URL. A template
   * with no resolved URL isn't hosted yet and shows a placeholder instead of an empty frame.
   */
  private withThumb(t: WebTemplate) {
    const url = templateUrl(t, this.doc.baseURI);
    // No url means the template is not reachable, whatever artwork it ships: the card says so
    // rather than showing a picture of something nobody can open.
    if (!url) return { ...t, still: null, src: null };
    // A still where the template ships one. A whole gallery of live frames is several hundred
    // megabytes of invitation; the frame is kept only for templates with no artwork of their own.
    const still = templateThumb(t, this.doc.baseURI);
    return {
      ...t,
      still,
      src: still ? null : this.sanitizer.bypassSecurityTrustResourceUrl(url),
    };
  }

  constructor() {
    effect(() => {
      const c = this.active();
      this.seo.set({ title: c ? `${c} website templates` : 'Website templates' });
    });
  }
}

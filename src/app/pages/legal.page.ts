import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { buildPages, LegalDoc, POLICY_LINKS } from '../core/pages-content';
import { SeoService, SettingsService } from '../core/services';

@Component({
  selector: 'app-legal',
  standalone: true,
  imports: [RouterLink],
  template: `
    @if (doc(); as d) {
      <div class="container layout">
        <aside class="side" aria-label="Policies">
          <p class="eyebrow">Policies</p>
          @for (l of links; track l.slug) { <a [routerLink]="['/' + l.slug]" [class.on]="l.slug === slug()">{{ l.label }}</a> }
          <a routerLink="/faq">FAQ</a><a routerLink="/contact">Contact us</a>
        </aside>
        <article class="doc">
          <h1>{{ d.title }}</h1>
          <p class="muted upd">Last updated {{ d.updated }}</p>
          @for (s of d.sections; track s.h) { <section><h2>{{ s.h }}</h2>@for (p of s.p; track p) { <p>{{ p }}</p> }</section> }
          @if (slug() === 'about') { <a class="btn" routerLink="/custom-order">Start a custom order</a> }
          @if (settings.businessIncomplete()) {
            <p class="alert warn" role="note">Owner reminder (disappears once complete): fill in your business details in <strong>Admin → Settings</strong>, replace any [bracketed] text in <code>src/app/core/pages-content.ts</code>, and have these policies reviewed by a professional before launch.</p>
          }
        </article>
      </div>
    }
  `,
  styles: [`
    .layout { display: grid; grid-template-columns: 220px 1fr; gap: clamp(20px, 5vw, 56px); padding-block: 40px 72px; align-items: start; }
    .side { position: sticky; top: calc(var(--header-h) + 16px); display: flex; flex-direction: column; gap: 2px;
      a { text-decoration: none; padding: .5rem .8rem; border-radius: 12px; font-size: .9rem; color: var(--brown); &:hover { background: #efefef; } &.on { background: #111; color: #fff; font-weight: 600; } } }
    .doc { max-width: 760px; } .upd { font-size: .85rem; margin-top: -.5rem; } section { margin-bottom: 1.6rem; } h2 { font-size: 1.5rem; }
    @media (max-width: 860px) { .layout { grid-template-columns: 1fr; } .side { position: static; flex-direction: row; flex-wrap: wrap; gap: 6px; } }
  `],
})
export class LegalPage implements OnInit {
  private route = inject(ActivatedRoute);
  private seo = inject(SeoService);
  links = POLICY_LINKS;
  settings = inject(SettingsService);
  slug = signal('');
  /** Rebuilt whenever the owner edits business details or the About text. */
  doc = computed<LegalDoc | null>(() => buildPages({ ...this.settings.business() }, this.settings.about())[this.slug()] ?? null);
  ngOnInit() {
    const s = this.route.snapshot.data['slug'] as string;
    this.slug.set(s);
    const d = this.doc();
    if (d) this.seo.set({ title: d.title, description: d.description, path: '/' + s });
  }
}

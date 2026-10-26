import { Component, computed, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { FAQ, FaqGroup } from '../core/faq-content';
import { SettingsService } from '../core/services';
import { inject } from '@angular/core';
import { BRAND } from '../core/config';
import { RevealDirective } from './reveal.directive';

/** Grouped accordion FAQ. `compact` shows the first few questions only (for the home page). */
@Component({
  selector: 'app-faq',
  standalone: true,
  imports: [FormsModule, RouterLink, RevealDirective],
  template: `
    <section class="fq" id="faq" aria-labelledby="faq-h">
      <div class="head" [appReveal]="0">
        @if (page()) { <h1 id="faq-h">Frequently asked <em>questions</em></h1> } @else { <h2 id="faq-h">Frequently asked <em>questions</em></h2> }
        <p>Everything you need to know before you start. Still stuck? Write to <a [href]="'mailto:' + email()">{{ email() }}</a>.</p>
        @if (!compact()) {
          <label class="sr-only" for="faq-q">Search the FAQ</label>
          <input id="faq-q" class="search" type="search" placeholder="Search questions…" [ngModel]="q()" (ngModelChange)="q.set($event)" />
        }
      </div>

      <div class="grid">
        @for (g of groups(); track g.label; let i = $index) {
          <div class="card" [appReveal]="i * 80">
            <div class="label">{{ g.label }}</div>
            @for (it of g.items; track it.q) {
              <details class="q" [attr.name]="'faq-' + g.label" [open]="!!q() && g.items.length > 0">
                <summary><span>{{ it.q }}</span><i aria-hidden="true"></i></summary>
                <p>{{ it.a }}</p>
              </details>
            }
          </div>
        } @empty {
          <div class="empty"><h3>No matching questions</h3><p>Try different words, or <a routerLink="/contact">ask us directly</a>.</p></div>
        }
      </div>

      @if (compact()) { <p class="more"><a class="btn ghost" routerLink="/faq">See all questions</a></p> }
    </section>
  `,
  styles: [`
    .fq { max-width: 1100px; margin: 0 auto; padding: 24px 16px; }
    .head { text-align: center; margin-bottom: 28px; h1, h2 { font-size: clamp(1.8rem, 4vw, 2.6rem); } em { font-style: normal; color: #e60023; } p { color: var(--muted); } a { color: #111; } }
    .search { width: min(420px, 100%); padding: .8rem 1.2rem; border-radius: 999px; border: 0; background: #efefef; font: inherit; margin-top: .5rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; align-items: start; }
    .card { background: #fff; border: 1px solid var(--line); border-radius: 28px; padding: 22px 24px 10px; }
    .label { text-transform: uppercase; letter-spacing: .12em; font-size: .72rem; font-weight: 700; color: #e60023; margin-bottom: 6px; }
    .q { border-top: 1px solid var(--line); &:first-of-type { border-top: 0; }
      summary { list-style: none; display: flex; justify-content: space-between; align-items: center; gap: 14px; padding: 14px 0; cursor: pointer; font-weight: 600; &::-webkit-details-marker { display: none; } &:focus-visible { outline: 3px solid var(--rose); outline-offset: 2px; border-radius: 8px; } }
      i { position: relative; flex: none; width: 28px; height: 28px; border-radius: 50%; background: #efefef; transition: background .25s, transform .35s var(--ease); &::before, &::after { content: ''; position: absolute; left: 8px; right: 8px; top: 13px; height: 2px; background: #111; border-radius: 2px; transition: transform .35s var(--ease); } &::after { transform: rotate(90deg); } }
      &[open] i { background: #e60023; transform: rotate(180deg); &::before, &::after { background: #fff; } &::after { transform: rotate(0); } }
      p { margin: 0 0 16px; color: var(--muted); font-size: .94rem; animation: open .35s var(--ease) both; } }
    .more { text-align: center; margin-top: 20px; }
    .empty { grid-column: 1 / -1; text-align: center; padding: 32px; color: var(--muted); }
    @keyframes open { from { opacity: 0; transform: translateY(-6px); } }
  `],
})
export class FaqComponent {
  compact = input(false);
  /** True on the dedicated /faq page so it has the page-level h1. */
  page = input(false);
  q = signal('');
  private settings = inject(SettingsService);
  private all = computed(() => this.settings.faq() ?? FAQ);
  email = () => this.settings.settings().supportEmail || BRAND.contactEmail;

  groups = computed<FaqGroup[]>(() => {
    const FAQ_ = this.all();
    if (this.compact()) return FAQ_.slice(0, 3).map((g) => ({ ...g, items: g.items.slice(0, 2) }));
    const t = this.q().trim().toLowerCase();
    if (!t) return FAQ_;
    return FAQ_.map((g) => ({ ...g, items: g.items.filter((i) => (i.q + ' ' + i.a).toLowerCase().includes(t)) })).filter((g) => g.items.length);
  });
}

import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CatalogService } from '../core/services';
import { suggest } from '../core/search';
import { IconComponent } from './icon.component';

/** Debounced search with keyboard-navigable suggestions (combobox pattern). */
@Component({
  selector: 'app-search-box',
  standalone: true,
  imports: [FormsModule, IconComponent],
  template: `
    <form class="sb" role="search" (submit)="$event.preventDefault(); go(term())" [class.large]="large()" [class.compact]="compact()">
      <app-icon name="search" />
      <label class="sr-only" [attr.for]="id">Search designs</label>
      <input [id]="id" type="search" autocomplete="off" role="combobox" aria-autocomplete="list" [attr.aria-expanded]="open()" [attr.aria-controls]="id + '-list'"
        [attr.aria-activedescendant]="active() >= 0 ? id + '-opt' + active() : null"
        [placeholder]="placeholder()" [ngModel]="term()" (ngModelChange)="onType($event)" name="q"
        (keydown.arrowdown)="move(1, $event)" (keydown.arrowup)="move(-1, $event)" (keydown.escape)="open.set(false)" (blur)="close()" (focus)="open.set(true)" />
      @if (large()) { <button class="btn small" type="submit">Search</button> }
      @if (open() && items().length) {
        <ul class="list" role="listbox" [id]="id + '-list'">
          @for (s of items(); track s; let i = $index) {
            <li role="option" [id]="id + '-opt' + i" [class.on]="i === active()" [attr.aria-selected]="i === active()" (mousedown)="go(s)">{{ s }}</li>
          }
        </ul>
      }
    </form>
  `,
  styles: [`
    .sb { position: relative; display: flex; align-items: center; gap: .6rem; background: #efefef; border: 0; border-radius: 999px; padding: 0 1rem; height: 48px; color: #767676; }
    .sb.compact { height: 38px; padding: 0 .8rem; gap: .4rem; font-size: .88rem; }
    .sb.compact input { font-size: .88rem; }
    .sb.large { height: 60px; padding-right: .6rem; }
    .sb:focus-within { outline: 3px solid rgba(199,131,145,.45); }
    input { flex: 1; min-width: 0; border: 0; background: transparent; font: inherit; color: var(--brown); height: 100%; outline: none; }
    .list { position: absolute; left: 0; right: 0; top: calc(100% + 8px); z-index: 60; margin: 0; padding: 6px; list-style: none; background: var(--white); border: 1px solid var(--line); border-radius: 18px; box-shadow: var(--shadow-md); }
    li { padding: .55rem .9rem; border-radius: 12px; cursor: pointer; color: var(--brown); font-size: .92rem; }
    li.on, li:hover { background: var(--blush); }
  `],
})
export class SearchBoxComponent {
  private catalog = inject(CatalogService);
  private router = inject(Router);
  large = input(false);
  compact = input(false);
  placeholder = input('Find something beautiful...');
  initial = input('');
  committed = output<string>();
  readonly id = 'sb-' + Math.random().toString(36).slice(2, 7);
  term = signal('');
  debounced = signal('');
  open = signal(false);
  active = signal(-1);
  private t: ReturnType<typeof setTimeout> | null = null;
  items = computed(() => suggest(this.catalog.products(), this.debounced()));

  ngOnInit() { this.term.set(this.initial()); }

  onType(v: string) {
    this.term.set(v);
    this.active.set(-1);
    this.open.set(true);
    if (this.t) clearTimeout(this.t);
    this.t = setTimeout(() => this.debounced.set(v), 200);
  }
  move(d: number, e: Event) {
    e.preventDefault();
    const n = this.items().length;
    if (n) this.active.set((this.active() + d + n) % n);
  }
  close() { setTimeout(() => this.open.set(false), 120); }
  go(v: string) {
    const picked = this.active() >= 0 ? this.items()[this.active()] : v;
    this.open.set(false);
    this.term.set(picked);
    this.committed.emit(picked);
    this.router.navigate(['/shop'], { queryParams: { q: picked || null } });
  }
}

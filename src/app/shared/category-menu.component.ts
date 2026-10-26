import { Component, computed, ElementRef, HostListener, inject, input, output, signal } from '@angular/core';
import { CatalogService } from '../core/services';
import { IconComponent } from './icon.component';

/** Category picker: one button that opens a panel showing every category at once (no sideways scrolling). */
@Component({
  selector: 'app-category-menu',
  standalone: true,
  imports: [IconComponent],
  template: `
    <div class="cm">
      <button type="button" class="trigger" (click)="open.set(!open())" [attr.aria-expanded]="open()" aria-haspopup="true" [attr.aria-controls]="'cm-panel'">
        <app-icon name="filter" [size]="18" /> {{ label() }}
        <svg class="chev" [class.up]="open()" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 5l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      @if (value()) { <button type="button" class="clear" (click)="pick('')" aria-label="Clear category filter">× {{ label() }}</button> }

      @if (open()) {
        <div id="cm-panel" class="panel" role="menu" (keydown.escape)="open.set(false)">
          <button type="button" role="menuitemradio" class="opt" [class.on]="!value()" [attr.aria-checked]="!value()" (click)="pick('')">All designs</button>
          @for (c of catalog.categories(); track c.id) {
            <button type="button" role="menuitemradio" class="opt" [class.on]="value() === c.id" [class.none]="!count(c.id)" [attr.aria-checked]="value() === c.id" (click)="pick(c.id)">
              <strong>{{ c.name }} <span class="n">{{ count(c.id) }}</span></strong><small>{{ c.blurb }}</small>
            </button>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .cm { position: relative; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .trigger { display: inline-flex; align-items: center; gap: .5rem; border: 0; background: #111; color: #fff; font-weight: 700; padding: .75rem 1.2rem; border-radius: 999px; transition: background .2s, transform .2s var(--ease); }
    .trigger:hover { background: #333; } .trigger:active { transform: scale(.96); }
    .chev { transition: transform .3s var(--ease); } .chev.up { transform: rotate(180deg); }
    .clear { border: 0; background: #efefef; font-weight: 600; padding: .6rem 1rem; border-radius: 999px; }
    .clear:hover { background: #e2e2e2; }
    .panel { position: absolute; z-index: 60; top: calc(100% + 10px); left: 0; width: min(760px, calc(100vw - 32px)); background: #fff; border: 1px solid var(--line); border-radius: 24px;
      box-shadow: 0 16px 48px rgba(0,0,0,.16); padding: 12px; display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 6px; animation: drop .25s var(--ease) both; max-height: min(70vh, 560px); overflow: auto; }
    .opt { text-align: left; border: 0; background: transparent; border-radius: 16px; padding: .7rem .9rem; display: flex; flex-direction: column; gap: 2px; transition: background .15s; }
    .opt:hover { background: #efefef; } .opt.on { background: #fde8ec; box-shadow: inset 0 0 0 2px #e60023; }
    .opt strong { font-size: .95rem; } .opt small { color: var(--muted); font-size: .78rem; line-height: 1.3; }
    .n { font-weight: 600; font-size: .72rem; color: var(--muted); background: #efefef; border-radius: 999px; padding: .05rem .5rem; margin-left: .3rem; } .opt.none { opacity: .55; }
    @keyframes drop { from { opacity: 0; transform: translateY(-8px) scale(.98); } }
  `],
})
export class CategoryMenuComponent {
  catalog = inject(CatalogService);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  value = input('');
  changed = output<string>();
  open = signal(false);
  label = computed(() => (this.value() ? this.catalog.categoryName(this.value()) : 'Categories'));

  count = (id: string) => this.catalog.products().filter((p) => p.category === id).length;

  pick(id: string) {
    this.changed.emit(id);
    this.open.set(false);
  }

  @HostListener('document:click', ['$event'])
  outside(e: Event) {
    if (this.open() && !this.host.nativeElement.contains(e.target as Node)) this.open.set(false);
  }
}

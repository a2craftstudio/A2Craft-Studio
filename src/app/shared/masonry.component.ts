import { Component, input, output } from '@angular/core';
import { Product } from '../core/models';
import { ProductCardComponent } from './product-card.component';
import { RevealDirective } from './reveal.directive';

const SKELETON_RATIOS = [1.3, 1.6, 1.2, 1.5, 1.8, 1.35, 1.45, 1.25];

@Component({
  selector: 'app-masonry',
  standalone: true,
  imports: [ProductCardComponent, RevealDirective],
  template: `
    @if (error()) {
      <div class="empty" role="alert">
        <h3>We couldn’t load the designs</h3>
        <p>{{ error() }}</p>
        <button class="btn" type="button" (click)="retry.emit()">Try again</button>
      </div>
    } @else if (loading()) {
      <div class="masonry" aria-busy="true" aria-label="Loading designs">
        @for (r of ratios; track $index) { <div class="skeleton sk" [style.aspect-ratio]="'1 / ' + r"></div> }
      </div>
    } @else if (!products().length) {
      <div class="empty">
        <h3>Nothing matches yet</h3>
        <p>Try a different search or clear a filter or two.</p>
        <button class="btn soft" type="button" (click)="clear.emit()">Clear filters</button>
      </div>
    } @else {
      <div class="masonry">
        @for (p of products(); track p.id; let i = $index) {
          <div [appReveal]="(i % 6) * 70"><app-product-card [p]="p" /></div>
        }
      </div>
    }
  `,
  styles: [`
    .masonry { columns: 5 236px; column-gap: 16px; }
    .sk { break-inside: avoid; margin-bottom: 16px; }
    @media (max-width: 560px) { .masonry { columns: 2; column-gap: 12px; } }
  `],
})
export class MasonryComponent {
  products = input.required<Product[]>();
  loading = input(false);
  error = input<string | null>(null);
  retry = output<void>();
  clear = output<void>();
  ratios = SKELETON_RATIOS;
}

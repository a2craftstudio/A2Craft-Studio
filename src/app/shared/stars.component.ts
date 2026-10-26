import { Component, input } from '@angular/core';

@Component({
  selector: 'app-stars',
  standalone: true,
  template: `<span class="s" role="img" [attr.aria-label]="value() + ' out of 5 stars'">@for (n of [1, 2, 3, 4, 5]; track n) { <span [class.on]="n <= value()">★</span> }</span>`,
  styles: [`.s { letter-spacing: 2px; color: #cfcfcf; font-size: 1.05rem; } .on { color: #e60023; }`],
})
export class StarsComponent {
  value = input(0);
}

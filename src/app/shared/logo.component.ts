import { Component, input } from '@angular/core';

/** Animated brand mark: a gift-wrapped heart that gently beats; the sparkle twinkles. */
@Component({
  selector: 'app-logo-mark',
  standalone: true,
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <rect width="48" height="48" rx="14" fill="#e60023" />
      <g class="beat"><path d="M24 36C11 27.500 14 16.500 21 17.500c2 .3 3 1.600 3 3 0-1.400 1-2.700 3-3 7-1 10 10 -3 18.500Z" fill="#fff" /></g>
      <path class="spark" d="M37 8l1.500 4 4 1.500-4 1.500L37 19l-1.500-4-4-1.500 4-1.500Z" fill="#fff" />
    </svg>
  `,
  styles: [`
    :host { display: inline-flex; line-height: 0; }
    .beat { transform-origin: 24px 26px; animation: beat 2.8s ease-in-out infinite; }
    .spark { transform-origin: 37px 13.500px; animation: twinkle 2.8s ease-in-out infinite; }
    :host-context(a:hover) .beat { animation-duration: .9s; }
    @keyframes beat { 0%, 60%, 100% { transform: scale(1); } 20% { transform: scale(1.14); } 35% { transform: scale(.97); } 45% { transform: scale(1.08); } }
    @keyframes twinkle { 0%, 100% { opacity: .25; transform: scale(.6) rotate(0); } 50% { opacity: 1; transform: scale(1) rotate(45deg); } }
  `],
})
export class LogoMarkComponent {
  size = input(38);
}

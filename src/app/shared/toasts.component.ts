import { Component, inject } from '@angular/core';
import { ToastService } from '../core/services';

@Component({
  selector: 'app-toasts',
  standalone: true,
  template: `
    <div class="wrap" role="status" aria-live="polite">
      @for (m of toast.messages(); track m.id) { <div class="t" [class.error]="m.tone === 'error'">{{ m.text }}</div> }
    </div>
  `,
  styles: [`
    .wrap { position: fixed; z-index: 120; bottom: 20px; left: 50%; transform: translateX(-50%); display: grid; gap: 8px; width: min(420px, calc(100% - 24px)); }
    .t { background: var(--berry); color: #fff; padding: .8rem 1.2rem; border-radius: 14px; box-shadow: var(--shadow-md); font-size: .92rem; animation: in .35s var(--ease) both; }
    .t.error { background: #8a1f36; }
    @keyframes in { from { opacity: 0; transform: translateY(14px); } }
  `],
})
export class ToastsComponent {
  toast = inject(ToastService);
}

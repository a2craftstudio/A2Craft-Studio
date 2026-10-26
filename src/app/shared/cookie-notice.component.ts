import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ConsentService } from '../core/services';
import { WelcomeService } from './welcome.component';

/** Asks once whether we may count visits. Essential storage (sign-in, bag, favourites) is always on and needs no consent. */
@Component({
  selector: 'app-cookie-notice',
  standalone: true,
  imports: [RouterLink],
  template: `
    @if (consent.asking() && !welcome.open()) {
      <div class="bar" role="dialog" aria-label="Privacy choices" aria-live="polite">
        <p>Can we count visits to see which designs people like? Anonymous unless you’re signed in. Essential storage (sign-in, bag, favourites) is always on. <a routerLink="/cookies">Details</a></p>
        <div class="btns">
          <button class="btn small ghost" type="button" (click)="consent.set('denied')">No thanks</button>
          <button class="btn small" type="button" (click)="consent.set('granted')">Allow</button>
        </div>
      </div>
    }
  `,
  styles: [`
    .bar { position: fixed; z-index: 80; left: 16px; bottom: 16px; max-width: min(480px, calc(100vw - 32px)); background: #111; color: #fff; border-radius: 22px; padding: 16px; display: grid; gap: 12px; box-shadow: 0 10px 30px rgba(0,0,0,.3); animation: up .5s var(--ease) .4s both; }
    p { margin: 0; font-size: .85rem; line-height: 1.45; } a { color: #fff; }
    .btns { display: flex; gap: 8px; justify-content: flex-end; }
    .btn.ghost { background: transparent; color: #fff; box-shadow: inset 0 0 0 1px rgba(255,255,255,.4); } .btn.ghost:hover { background: rgba(255,255,255,.12); color: #fff; }
    .btn:not(.ghost) { background: #fff; color: #111; }
    @keyframes up { from { opacity: 0; transform: translateY(20px); } }
    @media (max-width: 600px) { .bar { bottom: 78px; } }
  `],
})
export class CookieNoticeComponent {
  consent = inject(ConsentService);
  /** One prompt at a time: the privacy question waits until the welcome tour is closed. */
  welcome = inject(WelcomeService);
}

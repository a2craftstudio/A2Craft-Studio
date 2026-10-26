import { Component, effect, ElementRef, inject, Injectable, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { BRAND } from '../core/config';
import { LogoMarkComponent } from './logo.component';

const KEY = 'a2.welcomed';
const SKIP_ROUTES = /^\/(checkout|order|admin|account)/;

@Injectable({ providedIn: 'root' })
export class WelcomeService {
  readonly open = signal(false);
  private router = inject(Router);

  /** Opens automatically only for first-time visitors, and never mid-checkout or in the admin. */
  maybeShowFirstTime() {
    let seen = false;
    try { seen = !!localStorage.getItem(KEY); } catch { /* storage blocked: treat as seen so we never nag */ seen = true; }
    if (!seen && !SKIP_ROUTES.test(location.pathname)) setTimeout(() => this.open.set(true), 700);
  }
  show() { this.open.set(true); }
  close() {
    this.open.set(false);
    try { localStorage.setItem(KEY, '1'); } catch { /* ignore */ }
  }
  go(url: string, query?: Record<string, string>) {
    this.close();
    void this.router.navigate([url], { queryParams: query });
  }
}

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [LogoMarkComponent],
  template: `
    @if (w.open()) {
      <div class="scrim" (click)="w.close()"></div>
      <div class="dlg" role="dialog" aria-modal="true" aria-labelledby="wl-title" tabindex="-1" #dlg (keydown.escape)="w.close()">
        <button class="x" type="button" (click)="w.close()" aria-label="Skip introduction">Skip</button>

        @switch (step()) {
          @case (0) {
            <div class="slide" [attr.aria-live]="'polite'">
              <app-logo-mark [size]="64" />
              <p class="eyebrow">Welcome</p>
              <h2 id="wl-title">Hi, we’re {{ brand.name }}</h2>
              <p class="lead">A small creative studio making invitations, memory books, scrapbooks, animated videos and personalized digital gifts, designed by hand for the people you love.</p>
            </div>
          }
          @case (1) {
            <div class="slide">
              <p class="eyebrow">What you’ll find</p>
              <h2 id="wl-title">Made to be given</h2>
              <ul class="cards">
                <li><strong>Ready-made designs</strong>Download instantly and print or share.</li>
                <li><strong>Personalized with a preview</strong>Add names, dates and photos and see it live.</li>
                <li><strong>Made just for you</strong>Videos and custom gifts, crafted by hand.</li>
              </ul>
            </div>
          }
          @default {
            <div class="slide">
              <p class="eyebrow">Easy as 1-2-3</p>
              <h2 id="wl-title">How to get started</h2>
              <ol class="steps"><li><span>1</span>Browse and save what you love</li><li><span>2</span>Personalize it and pay securely</li><li><span>3</span>Download, or we’ll email your custom order</li></ol>
              <div class="cta">
                <button class="btn" type="button" (click)="w.close()">Start exploring</button>
                <button class="btn ghost" type="button" (click)="w.go('/custom-order')">Request something custom</button>
              </div>
            </div>
          }
        }

        <div class="foot">
          <div class="dots" aria-hidden="true">@for (n of [0, 1, 2]; track n) { <span [class.on]="n === step()"></span> }</div>
          <div class="nav">
            @if (step() > 0) { <button class="btn ghost small" type="button" (click)="step.set(step() - 1)">Back</button> }
            @if (step() < 2) { <button class="btn small" type="button" (click)="step.set(step() + 1)">Next</button> }
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .scrim { position: fixed; inset: 0; background: rgba(0,0,0,.5); z-index: 110; animation: fade .3s both; backdrop-filter: blur(3px); }
    .dlg { position: fixed; z-index: 111; inset: 0; margin: auto; width: min(560px, calc(100% - 24px)); height: fit-content; max-height: calc(100dvh - 24px); overflow: auto;
      background: #fff; border-radius: 32px; padding: clamp(24px, 5vw, 44px); box-shadow: 0 20px 60px rgba(0,0,0,.3); animation: pop .5s var(--ease) both; outline: none; }
    .x { position: absolute; top: 16px; right: 18px; border: 0; background: none; font-weight: 600; color: var(--muted); padding: .4rem .6rem; border-radius: 999px; &:hover { background: #efefef; } }
    .slide { animation: slide .45s var(--ease) both; min-height: 270px; display: flex; flex-direction: column; justify-content: center; }
    h2 { font-size: clamp(1.8rem, 5vw, 2.4rem); } .lead { color: var(--muted); font-size: 1.05rem; }
    .cards { list-style: none; padding: 0; margin: 0; display: grid; gap: 10px; li { background: #efefef; border-radius: 18px; padding: 14px 18px; color: var(--muted); font-size: .92rem; strong { display: block; color: #111; font-size: 1.02rem; } } }
    .steps { list-style: none; padding: 0; margin: 0 0 1rem; display: grid; gap: 10px; li { display: flex; align-items: center; gap: 12px; } span { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 50%; background: #e60023; color: #fff; font-weight: 700; flex: none; } }
    .cta { display: flex; gap: .6rem; flex-wrap: wrap; }
    .foot { display: flex; justify-content: space-between; align-items: center; margin-top: 1.4rem; }
    .dots { display: flex; gap: 6px; span { width: 8px; height: 8px; border-radius: 50%; background: #d9d9d9; transition: all .3s var(--ease); &.on { width: 24px; border-radius: 999px; background: #e60023; } } }
    .nav { display: flex; gap: .5rem; }
    @keyframes fade { from { opacity: 0 } } @keyframes pop { from { opacity: 0; transform: translateY(24px) scale(.96) } } @keyframes slide { from { opacity: 0; transform: translateX(18px) } }
  `],
})
export class WelcomeComponent {
  w = inject(WelcomeService);
  brand = BRAND;
  step = signal(0);
  dlg = viewChild<ElementRef<HTMLElement>>('dlg');

  constructor() {
    effect(() => {
      const el = this.dlg()?.nativeElement;
      if (el) queueMicrotask(() => el.focus());
      if (!this.w.open()) this.step.set(0);
    });
    this.w.maybeShowFirstTime();
  }
}

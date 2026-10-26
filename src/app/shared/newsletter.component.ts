import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Backend } from '../core/backend';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-newsletter',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    @if (done()) {
      <p class="ok" role="status">Thank you. You’re on the list.</p>
    } @else {
      <form [formGroup]="f" (ngSubmit)="submit()" novalidate>
        <div class="row">
          <div class="field">
            <label for="nl-email">Email address</label>
            <input id="nl-email" type="email" formControlName="email" autocomplete="email" placeholder="you@example.com" />
            @if (f.controls.email.touched && f.controls.email.invalid) { <span class="err">Please enter a valid email.</span> }
          </div>
          <button class="btn" type="submit" [disabled]="busy()">Subscribe</button>
        </div>
        <label class="check"><input type="checkbox" formControlName="consent" /> <span>I agree to receive occasional emails about new designs. I can unsubscribe at any time. See the <a routerLink="/privacy">privacy policy</a>.</span></label>
        @if (f.controls.consent.touched && f.controls.consent.invalid) { <span class="err">Please tick the consent box to subscribe.</span> }
        @if (error()) { <div class="alert error" role="alert">{{ error() }}</div> }
      </form>
    }
  `,
  styles: [`.row { display: flex; gap: .8rem; align-items: flex-end; flex-wrap: wrap; .field { flex: 1 1 240px; margin: 0 } .btn { margin-bottom: 0; height: 46px } } .ok { font-weight: 600; color: var(--berry); } .err { color: #a3263f; font-size: .82rem; }`],
})
export class NewsletterComponent {
  private fb = inject(FormBuilder);
  private backend = inject(Backend);
  done = signal(false);
  busy = signal(false);
  error = signal('');
  f = this.fb.nonNullable.group({ email: ['', [Validators.required, Validators.email]], consent: [false, Validators.requiredTrue] });

  async submit() {
    this.f.markAllAsTouched();
    if (this.f.invalid) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.backend.subscribeNewsletter(this.f.controls.email.value);
      this.done.set(true);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }
}

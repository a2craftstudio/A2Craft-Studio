import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Backend } from '../core/backend';
import { Review } from '../core/models';
import { ToastService } from '../core/services';
import { StarsComponent } from './stars.component';

/** Reviews on a product page. Only approved reviews from verified buyers who agreed to publish are shown. */
@Component({
  selector: 'app-reviews-section',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, StarsComponent],
  template: `
    <section class="rev" aria-labelledby="rev-title">
      <h2 id="rev-title">Reviews</h2>
      @if (reviews().length) {
        <p class="avg"><app-stars [value]="avgRounded()" /> <strong>{{ avg() }}</strong> <span class="muted">({{ reviews().length }})</span></p>
        <ul class="list">@for (r of reviews(); track r.id) { <li class="card"><app-stars [value]="r.rating" /><p>{{ r.body }}</p><span class="muted">{{ r.authorName }} · verified buyer</span></li> }</ul>
      } @else { <p class="muted">No reviews yet. Reviews appear here after verified buyers share them.</p> }

      @if (done()) { <p class="alert" role="status">Thank you! Your review will appear after we approve it.</p> }
      @else if (can()) {
        <form class="card form" [formGroup]="f" (ngSubmit)="submit()" novalidate>
          <h3>Share your experience</h3>
          <fieldset class="rate"><legend>Your rating</legend>
            @for (n of [1, 2, 3, 4, 5]; track n) { <label [class.on]="n <= f.controls.rating.value"><input type="radio" class="sr-only" [value]="n" formControlName="rating" />★<span class="sr-only">{{ n }} stars</span></label> }
          </fieldset>
          <div class="field"><label for="rv-body">Your review</label><textarea id="rv-body" formControlName="body" maxlength="600"></textarea></div>
          <label class="check"><input type="checkbox" formControlName="consent" /> <span>You may publish my review and first name on this site.</span></label>
          @if (error()) { <div class="alert error" role="alert">{{ error() }}</div> }
          <button class="btn" type="submit">Submit review</button>
        </form>
      } @else if (!backend.session()) {
        <p class="muted"><a routerLink="/account">Sign in</a> to review products you’ve bought.</p>
      }
    </section>
  `,
  styles: [`
    .rev { margin-top: 40px; max-width: 760px; margin-inline: auto; } .avg { display: flex; gap: .5rem; align-items: center; }
    .list { list-style: none; padding: 0; display: grid; gap: 12px; li { padding: 1rem 1.2rem; p { margin: .4rem 0; } } }
    .form { padding: 1.4rem; margin-top: 1rem; } .rate { border: 0; padding: 0; margin: 0 0 1rem; display: flex; gap: 4px; legend { font-size: .85rem; font-weight: 600; margin-bottom: .3rem; }
      label { font-size: 1.8rem; color: #cfcfcf; cursor: pointer; line-height: 1; &.on { color: #e60023; } &:has(:focus-visible) { outline: 3px solid var(--rose); } } }
  `],
})
export class ReviewsSectionComponent {
  productId = input.required<string>();
  backend = inject(Backend);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);
  reviews = signal<Review[]>([]);
  can = signal(false);
  done = signal(false);
  error = signal('');
  f = this.fb.nonNullable.group({ rating: [5], body: ['', [Validators.required, Validators.minLength(5)]], consent: [true] });
  avg = computed(() => (this.reviews().reduce((s, r) => s + r.rating, 0) / (this.reviews().length || 1)).toFixed(1));
  avgRounded = computed(() => Math.round(Number(this.avg())));

  constructor() {
    effect(() => {
      const id = this.productId();
      this.backend.session(); // re-check eligibility on sign-in/out
      this.done.set(false);
      void this.backend.listReviews(id).then((r) => this.reviews.set(r)).catch(() => this.reviews.set([]));
      void this.backend.canReview(id).then((c) => this.can.set(c)).catch(() => this.can.set(false));
    });
  }

  async submit() {
    this.f.markAllAsTouched();
    if (this.f.invalid) { this.error.set('Please write a few words about your experience.'); return; }
    const v = this.f.getRawValue();
    try {
      await this.backend.submitReview({ productId: this.productId(), rating: v.rating, body: v.body, consentToPublish: v.consent });
      this.done.set(true);
      this.can.set(false);
      this.toast.show('Review submitted for approval');
    } catch (e) { this.error.set((e as Error).message); }
  }
}

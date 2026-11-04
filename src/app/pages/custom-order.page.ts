import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Backend } from '../core/backend';
import { SeoService } from '../core/services';

const TYPES = ['Personalized birthday gift', 'Anniversary / couple memory book', 'Custom invitation video', 'Scrapbook', 'Personalized digital card', 'Other custom digital design'];
const BUDGETS = ['Under ₹1,000', '₹1,000 – ₹2,500', '₹2,500 – ₹5,000', '₹5,000+', 'Not sure yet'];

@Component({
  selector: 'app-custom-order',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="container page">
      <div class="intro">
        <p class="eyebrow">Custom orders</p>
        <h1>Let’s make something just for them</h1>
        @if (!doneId()) {
          <ol class="steps" aria-label="Progress">
            @for (s of stepNames; track s; let i = $index) { <li [class.on]="i === step()" [class.done]="i < step()" [attr.aria-current]="i === step() ? 'step' : null">{{ i + 1 }}. {{ s }}</li> }
          </ol>
        }
      </div>
      <div class="panel">
      @if (doneId()) {
        <div class="card done reveal" role="status">
          <h2>Request received</h2>
          <p>Thank you! Your reference is <strong>{{ doneId() }}</strong>. We’ll email you at {{ f.controls.email.value }} with a quote and timeline.</p>
          <p class="muted">Typical reply time is 1–2 working days. You can track the status in your account.</p>
          <a class="btn" routerLink="/">Back to home</a>
        </div>
      } @else {
        <form class="card form" [formGroup]="f" (ngSubmit)="next()" novalidate>
          @switch (step()) {
            @case (0) {
              <div class="field"><label for="co-name">Your name *</label><input id="co-name" formControlName="name" autocomplete="name" />@if (bad('name')) { <span class="err">Please enter your name.</span> }</div>
              <div class="field"><label for="co-email">Email *</label><input id="co-email" type="email" formControlName="email" autocomplete="email" />@if (bad('email')) { <span class="err">Please enter a valid email.</span> }</div>
            }
            @case (1) {
              <div class="field"><label for="co-type">What would you like? *</label><select id="co-type" formControlName="productType"><option value="">Choose one…</option>@for (t of types; track t) { <option>{{ t }}</option> }</select>@if (bad('productType')) { <span class="err">Please choose a type.</span> }</div>
              <div class="field"><label for="co-occ">Occasion *</label><input id="co-occ" formControlName="occasion" placeholder="Birthday, anniversary, wedding…" />@if (bad('occasion')) { <span class="err">Tell us the occasion.</span> }</div>
              <div class="field"><label for="co-dl">Deadline *</label><input id="co-dl" type="date" formControlName="deadline" [min]="today" />@if (bad('deadline')) { <span class="err">Please choose a date today or later.</span> }<span class="hint">Rush timelines may cost more.</span></div>
              <div class="field"><label for="co-b">Budget *</label><select id="co-b" formControlName="budget"><option value="">Choose a range…</option>@for (b of budgets; track b) { <option>{{ b }}</option> }</select>@if (bad('budget')) { <span class="err">Please pick a range.</span> }</div>
            }
            @case (2) {
              <div class="field"><label for="co-style">Style preferences</label><input id="co-style" formControlName="style" placeholder="Romantic, minimal, floral, vintage…" /></div>
              <div class="field"><label for="co-desc">Project description *</label><textarea id="co-desc" formControlName="description" maxlength="2000"></textarea>@if (bad('description')) { <span class="err">Please describe your idea (at least 20 characters).</span> }</div>
              <div class="field"><label for="co-ref">Reference images (optional, up to 5)</label>
                <input id="co-ref" type="file" accept="image/jpeg,image/png,image/webp" multiple (change)="onFiles($event)" />
                @if (uploadError()) { <span class="err" role="alert">{{ uploadError() }}</span> }
                @if (refs().length) { <span class="hint">{{ refs().length }} image(s) attached.</span> }</div>
              <label class="check"><input type="checkbox" formControlName="consent" /> <span>I agree that {{ 'A2 Craft Studio' }} may use these details to reply to my request. See the <a routerLink="/privacy">privacy policy</a>.</span></label>
              @if (bad('consent')) { <span class="err">Please give consent so we can contact you.</span> }
            }
          }
          @if (error()) { <div class="alert error" role="alert">{{ error() }}</div> }
          <div class="nav">
            @if (step() > 0) { <button class="btn ghost" type="button" (click)="step.set(step() - 1)">Back</button> }
            <button class="btn" type="submit" [disabled]="busy()">{{ step() < 2 ? 'Continue' : busy() ? 'Sending…' : 'Send request' }}</button>
          </div>
        </form>
      }
      </div>
    </div>
  `,
  styles: [`
    .page { max-width: 760px; padding-block: 40px 64px; }
    .intro { text-align: center; margin-bottom: 28px; h1 { font-size: clamp(2.2rem, 3.2vw, 3.1rem); } .steps { justify-content: center; } }
    .steps { display: flex; gap: .5rem; flex-wrap: wrap; list-style: none; padding: 0; margin: 1rem 0; li { padding: .35rem .9rem; border-radius: 999px; background: var(--blush); font-size: .82rem; color: var(--muted); &.on { background: var(--berry); color: #fff; } &.done { color: var(--berry); } } }
    .form, .done { padding: clamp(20px, 4vw, 36px); }
    .nav { display: flex; justify-content: space-between; gap: .6rem; margin-top: .6rem; .btn:last-child { margin-left: auto; } }
    .err { color: #a3263f; font-size: .82rem; }
  `],
})
export class CustomOrderPage implements OnInit {
  private fb = inject(FormBuilder);
  private backend = inject(Backend);
  private route = inject(ActivatedRoute);
  private seo = inject(SeoService);
  types = TYPES;
  budgets = BUDGETS;
  stepNames = ['About you', 'Your project', 'Details'];
  today = new Date().toISOString().slice(0, 10);
  step = signal(0);
  busy = signal(false);
  error = signal('');
  uploadError = signal('');
  doneId = signal('');
  refs = signal<string[]>([]);

  f = this.fb.nonNullable.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    productType: ['', Validators.required],
    occasion: ['', Validators.required],
    deadline: ['', [Validators.required, (c: { value: string }) => (c.value && c.value < this.today ? { past: true } : null)]],
    budget: ['', Validators.required],
    style: [''],
    description: ['', [Validators.required, Validators.minLength(20)]],
    consent: [false, Validators.requiredTrue],
  });
  private fields: Record<number, (keyof typeof this.f.controls)[]> = {
    0: ['name', 'email'], 1: ['productType', 'occasion', 'deadline', 'budget'], 2: ['description', 'consent'],
  };

  ngOnInit() {
    this.seo.set({ title: 'Custom orders', description: 'Request a personalized gift, memory book, scrapbook or invitation video.', path: '/custom-order' });
    const ref = this.route.snapshot.queryParamMap.get('ref');
    if (ref) this.f.patchValue({ description: `I’d love something similar to “${ref}”. ` });
    const s = this.backend.session();
    if (s) this.f.patchValue({ name: s.name, email: s.email });
  }

  bad(c: keyof typeof this.f.controls) {
    const x = this.f.controls[c];
    return x.invalid && x.touched;
  }

  async onFiles(e: Event) {
    const input = e.target as HTMLInputElement;
    this.uploadError.set('');
    for (const file of Array.from(input.files ?? [])) {
      if (this.refs().length >= 5) { this.uploadError.set('You can attach up to 5 images.'); break; }
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { this.uploadError.set(`“${file.name}” is not a JPG, PNG or WebP image.`); continue; }
      if (file.size > 5 * 1024 * 1024) { this.uploadError.set(`“${file.name}” is larger than 5 MB.`); continue; }
      try {
        const url = await this.backend.uploadAsset(file, 'reference');
        this.refs.update((l) => [...l, url]);
      } catch (err) {
        this.uploadError.set(`Upload failed for “${file.name}”: ${(err as Error).message}`);
      }
    }
    input.value = '';
  }

  async next() {
    const names = this.fields[this.step()];
    names.forEach((n) => this.f.controls[n].markAsTouched());
    if (names.some((n) => this.f.controls[n].invalid)) return;
    if (this.step() < 2) { this.step.update((n) => n + 1); return; }
    this.busy.set(true);
    this.error.set('');
    try {
      const v = this.f.getRawValue();
      const id = await this.backend.submitInquiry({
        name: v.name, email: v.email, productType: v.productType, occasion: v.occasion, deadline: v.deadline,
        budget: v.budget, style: v.style, description: v.description, referenceImages: this.refs(),
      });
      this.doneId.set(id);
    } catch (e) {
      this.error.set(`We couldn’t send your request: ${(e as Error).message} Your answers are still here, so you can try again.`);
    } finally {
      this.busy.set(false);
    }
  }
}

import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { FONTS, PALETTES } from '../core/config';
import { Customization } from '../core/models';
import { CartService, CatalogService, formatInr, SeoService, ToastService } from '../core/services';

const MAX_PHOTOS = 6;
const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Downscale to keep drafts small and uploads quick. */
async function downscale(file: File, max = 1000): Promise<string> {
  const bmp = await createImageBitmap(file);
  const r = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * r);
  c.height = Math.round(bmp.height * r);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.82);
}

@Component({
  selector: 'app-studio',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    @if (item(); as p) {
      <div class="container">
        <nav class="crumbs" aria-label="Breadcrumb"><a [routerLink]="['/product', p.slug]">← Back to {{ p.title }}</a></nav>
        <h1>{{ video() ? 'Tell us your story' : 'Customization studio' }}</h1>
        <p class="muted">{{ video()
          ? 'Video creation is handled by hand. Share your details and photos, and we’ll produce your finished video. The panel shows a summary, not a rendered video.'
          : 'Edit the text, choose a palette and font, and preview. The preview is a layout guide; final print-ready files are prepared and checked by us after your order.' }}</p>

        <div class="grid">
          <form class="card form" [formGroup]="f" (ngSubmit)="submit(false)" novalidate>
            <div class="field"><label for="n1">{{ video() ? 'Names of the people in the video' : 'Name(s)' }} *</label>
              <input id="n1" formControlName="name" maxlength="40" />
              @if (show('name')) { <span class="err">Please enter a name (up to 40 characters).</span> }</div>
            <div class="field"><label for="dt">Date or occasion line *</label>
              <input id="dt" formControlName="date" maxlength="40" placeholder="e.g. 14 February 2027" />
              @if (show('date')) { <span class="err">Please add a date or short line.</span> }</div>
            <div class="field"><label for="msg">{{ video() ? 'Your story and what to include' : 'Message' }} {{ video() ? '*' : '' }}</label>
              <textarea id="msg" formControlName="message" [maxLength]="video() ? 1200 : 180"></textarea>
              <span class="hint">{{ f.controls.message.value.length }} / {{ video() ? 1200 : 180 }}</span>
              @if (show('message')) { <span class="err">{{ video() ? 'Please tell us a little about what you’d like.' : 'Message is too long.' }}</span> }</div>
            @if (!video()) { <div class="field"><label for="ex">Extra line (venue, hashtag…)</label><input id="ex" formControlName="extra" maxlength="50" /></div> }
            @if (video()) { <div class="field"><label for="mood">Mood / music style</label><input id="mood" formControlName="extra" maxlength="80" placeholder="e.g. soft acoustic, upbeat" /></div> }

            @if (!video()) {
              <fieldset class="opts"><legend>Palette</legend>
                @for (pl of palettes; track pl.id) {
                  <label class="sw" [class.on]="f.controls.paletteId.value === pl.id"><input type="radio" formControlName="paletteId" [value]="pl.id" class="sr-only" /><span [style.background]="pl.bg" [style.color]="pl.ink">Aa</span>{{ pl.name }}</label>
                }
              </fieldset>
              <fieldset class="opts"><legend>Font</legend>
                @for (ft of fonts; track ft.id) {
                  <label class="sw wide" [class.on]="f.controls.fontId.value === ft.id"><input type="radio" formControlName="fontId" [value]="ft.id" class="sr-only" /><span [style.font-family]="ft.css">{{ ft.name }}</span></label>
                }
              </fieldset>
            }

            @if (p.customizationKind !== 'text') {
              <div class="field"><label for="ph">Photos (up to {{ max }}, JPG/PNG/WebP, 5 MB each)</label>
                <input id="ph" type="file" accept="image/jpeg,image/png,image/webp" multiple (change)="onPhotos($event)" />
                @if (photoError()) { <span class="err" role="alert">{{ photoError() }}</span> }
                <div class="thumbs">@for (ph of photos(); track $index) { <span><img [src]="ph" alt="Uploaded photo {{ $index + 1 }}" width="64" height="64" /><button type="button" (click)="removePhoto($index)" [attr.aria-label]="'Remove photo ' + ($index + 1)">×</button></span> }</div>
                <span class="hint">By uploading you confirm you have the right to use these photos.</span>
              </div>
            }
            <div class="field"><label for="nt">Notes for the designer</label><textarea id="nt" formControlName="notes" maxlength="500" style="min-height: 80px"></textarea></div>

            <div class="row">
              <button class="btn" type="submit">Add to bag · {{ money(p.priceInr) }}</button>
              <button class="btn soft" type="button" (click)="submit(true)">Buy now</button>
              <button class="btn ghost" type="button" (click)="saveDraft()">Save draft</button>
              <button class="btn ghost" type="button" (click)="reset()">Reset</button>
            </div>
            @if (draftSaved()) { <p class="hint" role="status">Draft saved on this device.</p> }
          </form>

          <div class="preview">
            @if (!video()) {
              <svg viewBox="0 0 400 560" role="img" [attr.aria-label]="'Live preview: ' + v().name + ' ' + v().date">
                <rect width="400" height="560" rx="18" [attr.fill]="pal().bg" />
                <rect x="16" y="16" width="368" height="528" rx="12" fill="none" [attr.stroke]="pal().accent" stroke-width="2" />
                <rect x="24" y="24" width="352" height="512" rx="8" fill="none" [attr.stroke]="pal().accent" stroke-width="0.8" stroke-dasharray="3 5" />
                @if (photos()[0]; as ph) {
                  <clipPath id="pc"><circle cx="200" cy="170" r="84" /></clipPath>
                  <image [attr.href]="ph" x="116" y="86" width="168" height="168" preserveAspectRatio="xMidYMid slice" clip-path="url(#pc)" />
                  <circle cx="200" cy="170" r="84" fill="none" [attr.stroke]="pal().accent" stroke-width="3" />
                } @else {
                  <path d="M200 215C140 175 160 120 200 148c40-28 60 27 0 67z" [attr.fill]="pal().accent" opacity=".85" />
                }
                <text x="200" y="330" text-anchor="middle" font-size="40" [attr.fill]="pal().ink" [style.font-family]="font().css">{{ v().name || 'Names here' }}</text>
                <text x="200" y="368" text-anchor="middle" font-size="17" letter-spacing="2" [attr.fill]="pal().accent" font-family="Inter, sans-serif">{{ (v().date || 'Date here').toUpperCase() }}</text>
                @for (l of lines(); track $index) { <text x="200" [attr.y]="410 + $index * 24" text-anchor="middle" font-size="17" [attr.fill]="pal().ink" [style.font-family]="font().css">{{ l }}</text> }
                @if (v().extra) { <text x="200" y="510" text-anchor="middle" font-size="14" [attr.fill]="pal().accent" font-family="Inter, sans-serif">{{ v().extra }}</text> }
              </svg>
              <p class="hint">Live preview. Layout is illustrative; the final file is checked and finished by hand.</p>
            } @else {
              <div class="card summary">
                <h2>Your video brief</h2>
                <dl>
                  <dt>Names</dt><dd>{{ v().name || '—' }}</dd><dt>Date / occasion</dt><dd>{{ v().date || '—' }}</dd>
                  <dt>Mood</dt><dd>{{ v().extra || '—' }}</dd><dt>Photos</dt><dd>{{ photos().length }} uploaded</dd>
                </dl>
                <p class="muted">{{ v().message || 'Your story will appear here.' }}</p>
                <p class="alert">Turnaround: {{ p.delivery }}. We’ll email you if we need anything else.</p>
              </div>
            }
          </div>
        </div>
      </div>
    } @else if (!catalog.loading()) {
      <div class="container empty"><h1>Design not found</h1><a class="btn" routerLink="/shop">Back to the shop</a></div>
    }
  `,
  styles: [`
    .crumbs { padding-block: 20px 4px; font-size: .88rem; }
    .grid { display: grid; grid-template-columns: 1.05fr .95fr; gap: clamp(20px, 4vw, 48px); align-items: start; padding-block: 16px 48px; }
    .form { padding: clamp(18px, 3vw, 32px); }
    .opts { border: 0; padding: 0; margin: 0 0 1rem; display: flex; gap: .5rem; flex-wrap: wrap; legend { font-size: .85rem; font-weight: 600; margin-bottom: .4rem; } }
    .sw { display: inline-flex; align-items: center; gap: .5rem; padding: .35rem .8rem .35rem .35rem; border: 2px solid var(--line); border-radius: 999px; cursor: pointer; font-size: .85rem;
      span { width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; font-family: var(--font-serif); font-weight: 700; border: 1px solid var(--line); }
      &.wide span { width: auto; height: auto; border-radius: 0; border: 0; padding: 0 .4rem; font-size: 1.05rem; } &.on { border-color: var(--berry); background: var(--blush); } &:has(:focus-visible) { outline: 3px solid var(--rose); } }
    .thumbs { display: flex; gap: 8px; flex-wrap: wrap; span { position: relative; img { width: 64px; height: 64px; object-fit: cover; border-radius: 12px; } button { position: absolute; top: -6px; right: -6px; width: 22px; height: 22px; border-radius: 50%; border: 0; background: var(--berry); color: #fff; line-height: 1; } } }
    .row { display: flex; gap: .6rem; flex-wrap: wrap; }
    .preview { position: sticky; top: calc(var(--header-h) + 16px); svg { width: 100%; max-width: 420px; margin-inline: auto; border-radius: 18px; box-shadow: var(--shadow-md); } .hint { text-align: center; color: var(--muted); font-size: .8rem; } }
    .summary { padding: 1.6rem; dl { display: grid; grid-template-columns: 130px 1fr; gap: .4rem 1rem; dt { color: var(--muted); font-size: .85rem; } dd { margin: 0; } } }
    @media (max-width: 860px) { .grid { grid-template-columns: 1fr; } .preview { position: static; order: -1; } }
  `],
})
export class StudioPage {
  catalog = inject(CatalogService);
  private cart = inject(CartService);
  private toast = inject(ToastService);
  private seo = inject(SeoService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  money = formatInr;
  palettes = PALETTES;
  fonts = FONTS;
  max = MAX_PHOTOS;

  private slug = toSignal(this.route.paramMap.pipe(map((m) => m.get('slug') ?? '')), { initialValue: '' });
  item = computed(() => this.catalog.bySlug(this.slug()));
  video = computed(() => this.item()?.customizationKind === 'video-request');

  f = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(40)]],
    date: ['', [Validators.required, Validators.maxLength(40)]],
    message: ['', [Validators.maxLength(1200)]],
    extra: [''],
    paletteId: ['blush'],
    fontId: ['sans'],
    notes: [''],
  });
  photos = signal<string[]>([]);
  photoError = signal('');
  draftSaved = signal(false);
  private tick = signal(0);

  v = toSignal(this.f.valueChanges, { initialValue: this.f.getRawValue() });
  pal = computed(() => PALETTES.find((x) => x.id === this.v().paletteId) ?? PALETTES[0]);
  font = computed(() => FONTS.find((x) => x.id === this.v().fontId) ?? FONTS[0]);
  lines = computed(() => {
    const words = (this.v().message ?? '').split(/\s+/).filter(Boolean);
    const out: string[] = [];
    let cur = '';
    for (const w of words) {
      if ((cur + ' ' + w).trim().length > 34) { out.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
    }
    if (cur) out.push(cur);
    return out.slice(0, 4);
  });

  constructor() {
    void this.catalog.load();
    effect(() => {
      const p = this.item();
      if (!p) return;
      this.seo.set({ title: `Customize ${p.title}`, path: '/studio/' + p.slug });
      if (p.customizationKind === 'video-request') {
        this.f.controls.message.setValidators([Validators.required, Validators.maxLength(1200)]);
        this.f.controls.message.updateValueAndValidity();
      }
      this.loadDraft(p.slug);
    });
  }

  show(c: 'name' | 'date' | 'message') {
    const x = this.f.controls[c];
    return x.invalid && (x.touched || this.tick() > 0);
  }

  private key = (slug: string) => 'a2.draft.' + slug;

  private loadDraft(slug: string) {
    try {
      const raw = localStorage.getItem(this.key(slug));
      if (!raw) return;
      const d = JSON.parse(raw) as { form: Record<string, string>; photos: string[] };
      this.f.patchValue(d.form);
      this.photos.set(d.photos ?? []);
    } catch { /* ignore corrupt draft */ }
  }

  saveDraft() {
    try {
      localStorage.setItem(this.key(this.item()!.slug), JSON.stringify({ form: this.f.getRawValue(), photos: this.photos() }));
      this.draftSaved.set(true);
      this.toast.show('Draft saved on this device');
    } catch {
      this.toast.show('Could not save the draft (storage full). Try fewer photos.', 'error');
    }
  }

  reset() {
    this.f.reset();
    this.photos.set([]);
    this.photoError.set('');
    try { localStorage.removeItem(this.key(this.item()!.slug)); } catch { /* ignore */ }
  }

  async onPhotos(e: Event) {
    const input = e.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    this.photoError.set('');
    for (const file of files) {
      if (this.photos().length >= MAX_PHOTOS) { this.photoError.set(`You can add up to ${MAX_PHOTOS} photos.`); break; }
      if (!OK_TYPES.includes(file.type)) { this.photoError.set(`“${file.name}” is not a JPG, PNG or WebP image.`); continue; }
      if (file.size > 5 * 1024 * 1024) { this.photoError.set(`“${file.name}” is larger than 5 MB.`); continue; }
      try {
        const url = await downscale(file);
        this.photos.update((l) => [...l, url]);
      } catch {
        this.photoError.set(`We couldn’t read “${file.name}”. Please try another image.`);
      }
    }
    input.value = '';
  }
  removePhoto(i: number) { this.photos.update((l) => l.filter((_, x) => x !== i)); }

  submit(buyNow: boolean) {
    this.f.markAllAsTouched();
    this.tick.update((n) => n + 1);
    if (this.f.invalid) { this.toast.show('Please complete the required fields.', 'error'); return; }
    const v = this.f.getRawValue();
    const c: Customization = {
      fields: { name: v.name, date: v.date, message: v.message, extra: v.extra },
      paletteId: v.paletteId, fontId: v.fontId, photos: this.photos(), notes: v.notes,
    };
    this.cart.add(this.item()!.id, c);
    try { localStorage.removeItem(this.key(this.item()!.slug)); } catch { /* ignore */ }
    this.toast.show('Added to your bag with your customization');
    void this.router.navigate([buyNow ? '/checkout' : '/cart']);
  }
}


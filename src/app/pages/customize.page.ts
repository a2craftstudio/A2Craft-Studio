import { Component, computed, effect, ElementRef, inject, OnDestroy, signal, viewChild } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { DomSanitizer } from '@angular/platform-browser';
import { SeoService, ToastService } from '../core/services';
import { isSameOrigin, templateBySlug, templateUrl } from '../core/templates';
import {
  clearOverlay, emptyOverlay, highlightSlots, ImageSlot, loadOverlay,
  overlayIsEmpty, saveOverlay, TemplateOverlay, TextSlot,
} from '../core/template-overlay';

type Device = 'desktop' | 'tablet' | 'mobile';

const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Downscale so a photo-heavy draft still fits in localStorage. */
async function downscale(file: File, max = 1400): Promise<string> {
  const bmp = await createImageBitmap(file);
  const r = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * r);
  c.height = Math.round(bmp.height * r);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.82);
}

@Component({
  selector: 'app-customize',
  standalone: true,
  imports: [RouterLink],
  template: `
    @if (item(); as t) {
      <div class="cz">
        <header class="bar">
          <a class="back" [routerLink]="['/templates', t.slug]">&larr; {{ t.title }}</a>
          <div class="tools">
            @for (d of devices; track d) {
              <button type="button" [class.on]="device() === d" (click)="device.set(d)" [attr.aria-pressed]="device() === d">{{ d }}</button>
            }
          </div>
        </header>

        @if (!url()) {
          <div class="container empty">
            <h1>Not ready to edit yet</h1>
            <p class="muted">This design isn’t hosted yet, so there is nothing to open. Ask us for it and we’ll set it up.</p>
            <a class="btn" routerLink="/custom-order">Request this design</a>
          </div>
        } @else {
          <div class="split">
            <aside class="panel" [attr.aria-busy]="!ready()">
              @if (!ready()) {
                <p class="muted loading">Reading the design…</p>
                @if (!sameOrigin()) {
                  <p class="hint">This one is hosted elsewhere. It can only be edited once its copy includes
                    <code>template-bridge.js</code>.</p>
                }
              } @else {
                <h2>The details</h2>
                @for (h of highlights(); track h.slot.id) {
                  <div class="field">
                    <label [attr.for]="h.slot.id">{{ h.label }}</label>
                    <input [id]="h.slot.id" [value]="valueOf(h.slot)" (input)="setText(h.slot, $event)" />
                    <span class="hint">was “{{ h.slot.text.trim() }}”</span>
                  </div>
                }

                @if (images().length) {
                  <h2>Photos</h2>
                  <div class="shots">
                    @for (im of images(); track im.id) {
                      <label class="shot">
                        <img [src]="imageOf(im)" alt="" loading="lazy" />
                        <input type="file" accept="image/jpeg,image/png,image/webp" (change)="setImage(im, $event)" class="sr-only" />
                        <span>Replace</span>
                      </label>
                    }
                  </div>
                  @if (photoError()) { <p class="err" role="alert">{{ photoError() }}</p> }
                }

                <h2>
                  <button type="button" class="link" (click)="showAll.set(!showAll())" [attr.aria-expanded]="showAll()">
                    All wording ({{ slots().length }}) {{ showAll() ? '▾' : '▸' }}
                  </button>
                </h2>
                @if (showAll()) {
                  <div class="all">
                    @for (s of slots(); track s.id) {
                      <div class="field small">
                        <label [attr.for]="'all-' + s.id">{{ s.tag }} · {{ s.size }}px</label>
                        <textarea [id]="'all-' + s.id" rows="2" [value]="valueOf(s)" (input)="setText(s, $event)"></textarea>
                      </div>
                    }
                  </div>
                }
              }

              <div class="actions">
                <button class="btn" type="button" (click)="save()" [disabled]="!ready()">Save draft</button>
                <button class="btn ghost" type="button" (click)="reset()" [disabled]="clean()">Reset</button>
                <a class="btn soft" routerLink="/custom-order">Order this site</a>
              </div>
              @if (saved()) { <p class="hint" role="status">Saved on this device.</p> }
            </aside>

            <div class="stage" [attr.data-device]="device()">
              <iframe #frame [src]="src()" [title]="t.title + ' editor preview'" (load)="onFrameLoad()"></iframe>
            </div>
          </div>
        }
      </div>
    } @else {
      <div class="container empty">
        <h1>This template isn’t available</h1>
        <a class="btn" routerLink="/templates">See all templates</a>
      </div>
    }
  `,
  styles: [`
    .cz { display: flex; flex-direction: column; height: calc(100vh - var(--header-h)); }
    .bar { display: flex; align-items: center; gap: 1rem; padding: .7rem 1rem; border-bottom: 1px solid rgba(0,0,0,.08); background: #fff; }
    .back { text-decoration: none; color: var(--berry); font-weight: 600; white-space: nowrap; }
    .tools { margin-left: auto; display: flex; gap: .35rem; }
    .tools button { text-transform: capitalize; border: 1px solid rgba(0,0,0,.14); background: #fff; border-radius: 999px; padding: .35rem .8rem; cursor: pointer; font: inherit; font-size: .82rem; }
    .tools button.on { background: var(--berry); border-color: var(--berry); color: #fff; }
    .split { flex: 1; min-height: 0; display: grid; grid-template-columns: 340px 1fr; }
    .panel { overflow-y: auto; padding: 1rem 1.1rem 2rem; border-right: 1px solid rgba(0,0,0,.08); background: #fff; }
    .panel h2 { font-size: .95rem; margin: 1.2rem 0 .6rem; }
    .panel h2:first-child { margin-top: 0; }
    .loading { margin-top: .5rem; }
    .field { margin-bottom: .9rem; display: flex; flex-direction: column; gap: .25rem; }
    .field label { font-size: .8rem; font-weight: 600; }
    .field input, .field textarea { font: inherit; padding: .45rem .6rem; border: 1px solid rgba(0,0,0,.16); border-radius: 8px; resize: vertical; }
    .field.small label { font-weight: 400; opacity: .55; font-size: .72rem; text-transform: uppercase; letter-spacing: .04em; }
    .hint { font-size: .75rem; opacity: .6; }
    .err { font-size: .8rem; color: #b00020; }
    .link { background: none; border: 0; padding: 0; font: inherit; font-size: .95rem; font-weight: 600; cursor: pointer; color: var(--berry); }
    .shots { display: grid; grid-template-columns: repeat(3, 1fr); gap: .5rem; }
    .shot { position: relative; cursor: pointer; border-radius: 8px; overflow: hidden; border: 1px solid rgba(0,0,0,.12); aspect-ratio: 1; }
    .shot img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .shot span { position: absolute; inset: auto 0 0 0; background: rgba(0,0,0,.6); color: #fff; font-size: .7rem; text-align: center; padding: .15rem; }
    .all { max-height: 50vh; overflow-y: auto; padding-right: .3rem; }
    .actions { display: flex; flex-wrap: wrap; gap: .5rem; margin-top: 1.4rem; }
    .stage { min-height: 0; background: var(--blush); padding: 1rem; display: flex; justify-content: center; }
    .stage iframe { width: 100%; height: 100%; border: 0; background: #fff; border-radius: 10px; box-shadow: 0 6px 24px rgba(0,0,0,.12); }
    .stage[data-device='tablet'] iframe { max-width: 820px; }
    .stage[data-device='mobile'] iframe { max-width: 414px; }
    .empty { padding-block: 3rem; }
    @media (max-width: 900px) { .cz { height: auto; } .split { grid-template-columns: 1fr; } .panel { border-right: 0; border-bottom: 1px solid rgba(0,0,0,.08); } .stage { height: 70vh; } }
  `],
})
export class CustomizePage implements OnDestroy {
  private route = inject(ActivatedRoute);
  private sanitizer = inject(DomSanitizer);
  private seo = inject(SeoService);
  private toast = inject(ToastService);
  private doc = inject(DOCUMENT);
  private frame = viewChild<ElementRef<HTMLIFrameElement>>('frame');

  devices: Device[] = ['desktop', 'tablet', 'mobile'];
  device = signal<Device>('desktop');
  showAll = signal(false);
  ready = signal(false);
  saved = signal(false);
  photoError = signal('');
  slots = signal<TextSlot[]>([]);
  images = signal<ImageSlot[]>([]);
  overlay = signal<TemplateOverlay>(emptyOverlay());

  private slug = toSignal(this.route.paramMap.pipe(map((m) => m.get('slug') ?? '')), { initialValue: '' });
  item = computed(() => templateBySlug(this.slug()));
  url = computed(() => { const t = this.item(); return t ? templateUrl(t, this.doc.baseURI) : ''; });
  src = computed(() => this.sanitizer.bypassSecurityTrustResourceUrl(this.url()));
  sameOrigin = computed(() => { const t = this.item(); return !!t && isSameOrigin(t, this.doc.baseURI); });
  highlights = computed(() => highlightSlots(this.slots()));
  clean = computed(() => overlayIsEmpty(this.overlay()));

  private onMessage = (e: MessageEvent) => {
    const win = this.frame()?.nativeElement.contentWindow;
    if (!win || e.source !== win) return;
    const d = e.data as { type?: string; slots?: TextSlot[]; images?: ImageSlot[] };
    if (d?.type !== 'a2:slots') return;
    this.slots.set(d.slots ?? []);
    this.images.set(d.images ?? []);
    this.ready.set(true);
    this.push();
  };

  constructor() {
    window.addEventListener('message', this.onMessage);
    effect(() => {
      const t = this.item();
      this.seo.set({ title: t ? `Customize ${t.title}` : 'Template not found' });
      if (t) this.overlay.set(loadOverlay(t.slug));
    });
  }

  ngOnDestroy() { window.removeEventListener('message', this.onMessage); }

  /**
   * A template served from this app gets the bridge injected here, so the template files
   * stay untouched. One hosted elsewhere is out of reach and has to carry it itself.
   */
  onFrameLoad() {
    this.ready.set(false);
    const el = this.frame()?.nativeElement;
    if (!el || !this.sameOrigin()) return;
    try {
      const d = el.contentDocument;
      if (!d) return;
      const s = d.createElement('script');
      s.src = new URL('template-bridge.js', this.doc.baseURI).toString();
      d.body.appendChild(s);
    } catch {
      /* cross-origin after a redirect; the page has to carry the bridge */
    }
  }

  private push() {
    const o = this.overlay();
    this.frame()?.nativeElement.contentWindow?.postMessage({ type: 'a2:apply', text: o.text, images: o.images }, '*');
  }

  valueOf = (s: TextSlot) => this.overlay().text[s.id] ?? s.text;
  imageOf = (im: ImageSlot) =>
    this.overlay().images[im.id] ?? (im.kind === 'img' ? im.src : im.src.replace(/^url\(["']?|["']?\)$/g, ''));

  setText(s: TextSlot, e: Event) {
    const value = (e.target as HTMLInputElement | HTMLTextAreaElement).value;
    this.overlay.update((o) => {
      const text = { ...o.text };
      if (value === s.text) delete text[s.id];
      else text[s.id] = value;
      return { ...o, text };
    });
    this.saved.set(false);
    this.push();
  }

  async setImage(im: ImageSlot, e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    this.photoError.set('');
    if (!file) return;
    if (!OK_TYPES.includes(file.type)) { this.photoError.set(`“${file.name}” is not a JPG, PNG or WebP image.`); return; }
    if (file.size > 8 * 1024 * 1024) { this.photoError.set(`“${file.name}” is larger than 8 MB.`); return; }
    try {
      const url = await downscale(file);
      this.overlay.update((o) => ({ ...o, images: { ...o.images, [im.id]: url } }));
      this.saved.set(false);
      this.push();
    } catch {
      this.photoError.set(`We couldn’t read “${file.name}”. Please try another image.`);
    }
  }

  save() {
    if (saveOverlay(this.slug(), this.overlay())) {
      this.saved.set(true);
      this.toast.show('Draft saved on this device');
    } else {
      this.toast.show('Could not save the draft (storage full). Try fewer photos.', 'error');
    }
  }

  reset() {
    this.overlay.set(emptyOverlay());
    clearOverlay(this.slug());
    this.saved.set(false);
    this.photoError.set('');
    this.push();
  }
}

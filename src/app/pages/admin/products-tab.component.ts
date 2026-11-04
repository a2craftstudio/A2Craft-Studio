import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Backend } from '../../core/backend';
import { CustomizationKind, FaqItem, MediaItem, Motif, Product, ProductStatus } from '../../core/models';
import { discountPercent } from '../../core/search';
import { FORMAT_OPTIONS as FORMAT_LIST, OCCASION_SUGGESTIONS } from '../../core/options';
import { CatalogService, formatInr, ToastService } from '../../core/services';
import { AdminStateService } from './admin-state.service';

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const FORMAT_OPTIONS = FORMAT_LIST;
const KIND_HELP: Record<CustomizationKind, string> = {
  none: 'Ready-made. The customer buys and downloads the file you attach.',
  text: 'The customer types names, a date and a message, previews it, and you finish the file by hand.',
  'photo-text': 'Same as text, plus the customer uploads photos.',
  'video-request': 'The customer shares details and photos; you make the video and upload it to their order.',
};

type Editing = Product & { isNew?: boolean; filePath?: string };

@Component({
  selector: 'app-products-tab',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, RouterLink],
  template: `
    @if (error()) { <div class="alert error" role="alert">{{ error() }}</div> }

    @if (editing(); as e) {
      <form [formGroup]="pf" (ngSubmit)="save(false)" novalidate>
        <div class="adm-card"><h2 class="adm-h">{{ e.isNew ? 'New product' : 'Edit product' }}</h2><p class="adm-intro">Fields marked * are required. Nothing is visible to customers until the status is <strong>Published</strong>.</p></div>

        <section class="adm-card"><h3>1. Basics</h3><div class="adm-grid">
          <div class="field"><label for="p-title">Title *</label><input id="p-title" formControlName="title" maxlength="120" />@if (bad('title')) { <span class="adm-err">Please enter a title.</span> }</div>
          <div class="field"><label for="p-tag">Short tagline</label><input id="p-tag" formControlName="tagline" maxlength="100" /></div>
          <div class="field"><label for="p-slug">Web address (slug)</label><input id="p-slug" formControlName="slug" /><span class="hint">/product/{{ pf.controls.slug.value || 'auto-from-title' }}</span>@if (slugTaken()) { <span class="adm-err">Another product already uses this address.</span> }</div>
        </div>
          <div class="field"><label for="p-desc">Description</label><textarea id="p-desc" formControlName="description"></textarea></div></section>

        <section class="adm-card"><h3>2. Price</h3><div class="adm-grid">
          <div class="field"><label for="p-price">Price (₹) *</label><input id="p-price" type="number" min="1" formControlName="priceInr" />@if (bad('priceInr')) { <span class="adm-err">Enter a price of at least ₹1.</span> }</div>
          <div class="field"><label for="p-orig">Original price (₹)</label><input id="p-orig" type="number" min="0" formControlName="originalPriceInr" />
            <span class="hint">Only fill this for a genuine discount. {{ discountNote() }}</span></div>
        </div></section>

        <section class="adm-card"><h3>3. Organise</h3><div class="adm-grid">
          <div class="field"><label for="p-cat">Category</label><select id="p-cat" formControlName="category">@for (c of catalog.categories(); track c.id) { <option [value]="c.id">{{ c.name }}</option> }</select></div>
          <div class="field"><label for="p-occ">Occasion</label><input id="p-occ" formControlName="occasion" list="occasions" /><datalist id="occasions">@for (o of occasions; track o) { <option [value]="o"></option> }</datalist></div>
          <div class="field"><label for="p-style">Style</label><input id="p-style" formControlName="style" placeholder="Romantic, minimal…" /></div>
          <div class="field"><label for="p-tags">Tags (comma separated)</label><input id="p-tags" formControlName="tags" placeholder="birthday, floral, printable" /></div>
        </div>
          <fieldset class="fmts"><legend>File formats you deliver</legend>
            @for (f of formatOptions; track f) { <label class="check"><input type="checkbox" [checked]="formats().includes(f)" (change)="toggleFormat(f)" /> {{ f }}</label> }
            <input class="other" formControlName="otherFormats" placeholder="Other formats, comma separated" aria-label="Other formats" /></fieldset></section>

        <section class="adm-card"><h3>4. What the customer gets</h3>
          <div class="field"><label for="p-ck">Personalization</label><select id="p-ck" formControlName="customizationKind"><option value="none">None (ready-made)</option><option value="text">Names and message</option><option value="photo-text">Photos + names and message</option><option value="video-request">Video made for them</option></select>
            <span class="hint">{{ kindHelp() }}</span></div>
          <div class="field"><label for="p-del">Delivery method</label><input id="p-del" formControlName="delivery" /></div>
          <div class="field"><label for="p-lic">License and usage</label><textarea id="p-lic" formControlName="license" style="min-height: 80px"></textarea></div>
          <div class="field"><label for="p-file">Downloadable file (private)</label><input id="p-file" type="file" (change)="onFile($event)" /><span class="hint">{{ e.filePath || 'No file attached. Personalized items are delivered per order instead.' }}</span></div></section>

        <section class="adm-card"><h3>5. Photos and video</h3>
          <div class="media">
            @for (m of e.gallery; track m.url + $index; let i = $index) {
              <figure><img [src]="m.url" [alt]="m.alt" width="96" height="120" />
                @if (i === 0) { <span class="cover">Cover</span> }
                <div class="mv"><button type="button" (click)="move(i, -1)" [disabled]="i === 0" [attr.aria-label]="'Move image ' + (i + 1) + ' earlier'">←</button><button type="button" (click)="move(i, 1)" [disabled]="i === e.gallery.length - 1" [attr.aria-label]="'Move image ' + (i + 1) + ' later'">→</button><button type="button" (click)="removeImage(i)" [attr.aria-label]="'Remove image ' + (i + 1)">×</button></div></figure>
            } @empty { <p class="muted">No photos yet. A neutral generated cover is used until you add some.</p> }
          </div>
          <div class="field"><label for="p-img">Add photos</label><input id="p-img" type="file" accept="image/*" multiple (change)="onImages($event)" /><span class="hint">The first photo is the cover shown on cards.</span></div>
          <div class="adm-grid"><div class="field"><label for="p-vid">Preview video link</label><input id="p-vid" formControlName="videoUrl" placeholder="https://…/preview.mp4" /></div>
            <div class="field"><label for="p-vidf">…or upload a video</label><input id="p-vidf" type="file" accept="video/*" (change)="onVideo($event)" /></div></div></section>

        <section class="adm-card"><h3>6. Questions customers ask about this product</h3>
          @for (f of faq(); track $index; let i = $index) {
            <div class="faqrow"><div class="field"><label [for]="'fq' + i">Question</label><input [id]="'fq' + i" [value]="f.q" (input)="setFaq(i, 'q', $any($event.target).value)" /></div>
              <div class="field"><label [for]="'fa' + i">Answer</label><input [id]="'fa' + i" [value]="f.a" (input)="setFaq(i, 'a', $any($event.target).value)" /></div>
              <button type="button" class="btn small ghost" (click)="removeFaq(i)">Remove</button></div>
          }
          <button type="button" class="btn small ghost" (click)="addFaq()">Add a question</button></section>

        <section class="adm-card"><h3>7. Visibility</h3><div class="adm-grid">
          <div class="field"><label for="p-status">Status</label><select id="p-status" formControlName="status"><option value="draft">Draft (hidden)</option><option value="published">Published (live)</option><option value="archived">Archived (hidden, kept)</option></select></div></div>
          <div class="flags"><label class="check"><input type="checkbox" formControlName="featured" /> Featured</label><label class="check"><input type="checkbox" formControlName="trending" /> Trending</label>
            <label class="check"><input type="checkbox" formControlName="bestseller" /> Bestseller</label></div></section>

        <div class="adm-sticky">
          <button class="btn" type="submit" [disabled]="busy()">Save</button>
          @if (pf.controls.status.value !== 'published') { <button class="btn soft" type="button" [disabled]="busy()" (click)="save(true)">Save and publish</button> }
          <button class="btn ghost" type="button" (click)="cancel()">Cancel</button>
          @if (pf.dirty) { <span class="muted dirty">Unsaved changes</span> }
        </div>
      </form>
    } @else {
      <div class="adm-kpis">
        <div class="adm-kpi"><span>Products</span><strong>{{ products().length }}</strong></div>
        <div class="adm-kpi good"><span>Published</span><strong>{{ count('published') }}</strong></div>
        <div class="adm-kpi" [class.warn]="count('draft')"><span>Drafts</span><strong>{{ count('draft') }}</strong></div>
        <div class="adm-kpi"><span>Archived</span><strong>{{ count('archived') }}</strong></div>
      </div>
      <div class="adm-bar">
        <input type="search" aria-label="Search products" placeholder="Search by name or tag" [ngModel]="q()" (ngModelChange)="q.set($event)" />
        <select aria-label="Filter by status" [ngModel]="status()" (ngModelChange)="status.set($event)"><option value="">All statuses ({{ products().length }})</option><option value="published">Published ({{ count('published') }})</option><option value="draft">Draft ({{ count('draft') }})</option><option value="archived">Archived ({{ count('archived') }})</option></select>
        <select aria-label="Filter by category" [ngModel]="cat()" (ngModelChange)="cat.set($event)"><option value="">All categories</option>@for (c of catalog.categories(); track c.id) { <option [value]="c.id">{{ c.name }}</option> }</select>
        <select aria-label="Sort" [ngModel]="sort()" (ngModelChange)="sort.set($event)"><option value="new">Newest first</option><option value="title">Title A–Z</option><option value="price-asc">Price low to high</option><option value="price-desc">Price high to low</option></select>
        <button class="btn grow" type="button" (click)="create()">Add product</button>
      </div>

      @if (selected().size) {
        <div class="adm-bar bulk" role="region" aria-label="Bulk actions"><strong>{{ selected().size }} selected</strong>
          <button class="btn small" type="button" (click)="bulk('published')">Publish</button><button class="btn small ghost" type="button" (click)="bulk('draft')">Unpublish</button>
          <button class="btn small ghost" type="button" (click)="bulk('archived')">Archive</button><button class="btn small ghost" type="button" (click)="selected.set(emptySet)">Clear selection</button></div>
      }

      @if (!shown().length) { <div class="adm-empty"><p>No products match.</p>@if (!products().length) { <button class="btn" type="button" (click)="create()">Add your first product</button> }</div> }
      @else {
        <div class="table-wrap"><table class="tbl">
          <thead><tr><th class="cb"><input type="checkbox" aria-label="Select all shown" [checked]="allSelected()" (change)="toggleAll()" /></th><th>Product</th><th>Category</th><th>Price</th><th>Status</th><th></th></tr></thead>
          <tbody>
            @for (p of shown(); track p.id) {
              <tr><td class="cb"><input type="checkbox" [attr.aria-label]="'Select ' + p.title" [checked]="selected().has(p.id)" (change)="toggle(p.id)" /></td>
                <td><div class="prod"><img class="adm-thumb" [src]="p.gallery.at(0)?.url" alt="" width="44" height="55" loading="lazy" /><div><strong>{{ p.title }}</strong>
                  <div class="tags">@if (p.featured) { <span class="pill dark">featured</span> } @if (p.trending) { <span class="pill amber">trending</span> } @if (p.bestseller) { <span class="pill green">bestseller</span> }</div></div></div></td>
                <td>{{ catalog.categoryName(p.category) }}</td>
                <td>{{ money(p.priceInr) }}@if (off(p)) { <br /><span class="muted s"><s>{{ money(p.originalPriceInr!) }}</s> {{ off(p) }}% off</span> }</td>
                <td><label class="sr-only" [for]="'st' + p.id">Status of {{ p.title }}</label>
                  <select [id]="'st' + p.id" class="st" [class.live]="p.status === 'published'" (change)="setStatus(p, $any($event.target).value)"><option value="draft" [selected]="p.status === 'draft'">Draft</option><option value="published" [selected]="p.status === 'published'">Published</option><option value="archived" [selected]="p.status === 'archived'">Archived</option></select></td>
                <td><div class="adm-actions"><button class="btn small ghost" type="button" (click)="edit(p)">Edit</button><button class="btn small ghost" type="button" (click)="duplicate(p)">Duplicate</button>
                  @if (p.status === 'published') { <a class="btn small ghost" [routerLink]="['/product', p.slug]" target="_blank">View ↗</a> }</div></td></tr>
            }
          </tbody></table></div>
      }
    }
  `,
  styles: [`
    h3 { font-size: 1.15rem; } .fmts { border: 0; padding: 0; margin: .4rem 0 0; display: flex; gap: .4rem 1rem; flex-wrap: wrap; align-items: center; legend { font-size: .85rem; font-weight: 600; margin-bottom: .4rem; width: 100%; } .other { padding: .5rem .9rem; border-radius: 999px; border: 0; background: #efefef; font: inherit; flex: 1 1 200px; } .check { margin: 0; } }
    .media { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 1rem; figure { margin: 0; position: relative; width: 96px; img { width: 96px; height: 120px; object-fit: cover; border-radius: 12px; background: #efefef; } }
      .cover { position: absolute; top: 6px; left: 6px; background: #111; color: #fff; font-size: .65rem; font-weight: 700; padding: .1rem .5rem; border-radius: 999px; }
      .mv { display: flex; gap: 4px; margin-top: 4px; justify-content: center; button { width: 28px; height: 28px; border-radius: 50%; border: 0; background: #efefef; &:disabled { opacity: .35; } } } }
    .faqrow { display: grid; grid-template-columns: 1fr 1.6fr auto; gap: .6rem; align-items: end; .field { margin-bottom: .6rem; } .btn { margin-bottom: .6rem; } } @media (max-width: 760px) { .faqrow { grid-template-columns: 1fr; } }
    .flags { display: flex; gap: 1.2rem; flex-wrap: wrap; } .dirty { font-size: .85rem; } .bulk { background: #fde8ec; padding: .6rem 1rem; border-radius: 18px; }
    .cb { width: 36px; } .prod { display: flex; gap: 12px; align-items: center; } .tags { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 2px; } .s { font-size: .8rem; }
    .st { padding: .35rem .6rem; border-radius: 999px; border: 1px solid var(--line); font: inherit; background: #fff; &.live { background: #dff5e3; border-color: #bfe8c6; } }
    .field { margin-bottom: 1rem; } textarea { min-height: 110px; }
  `],
})
export class ProductsTabComponent implements OnInit {
  private backend = inject(Backend);
  catalog = inject(CatalogService);
  private toast = inject(ToastService);
  private state = inject(AdminStateService);
  private fb = inject(FormBuilder);
  money = formatInr;
  off = discountPercent;
  occasions = OCCASION_SUGGESTIONS;
  formatOptions = FORMAT_OPTIONS;
  emptySet = new Set<string>();

  products = signal<Product[]>([]);
  q = signal('');
  status = signal('');
  cat = signal('');
  sort = signal('new');
  selected = signal<Set<string>>(new Set());
  editing = signal<Editing | null>(null);
  formats = signal<string[]>([]);
  faq = signal<FaqItem[]>([]);
  error = signal('');
  busy = signal(false);

  pf = this.fb.nonNullable.group({
    title: ['', Validators.required], tagline: [''], slug: [''], description: [''], priceInr: [0, [Validators.required, Validators.min(1)]],
    originalPriceInr: [0], category: [''], status: ['draft' as ProductStatus], occasion: ['Any'], style: [''], tags: [''], otherFormats: [''],
    customizationKind: ['none' as CustomizationKind], videoUrl: [''], delivery: ['Instant download after verified payment'], license: [''],
    featured: [false], trending: [false], bestseller: [false],
  });

  count = (s: ProductStatus) => this.products().filter((p) => p.status === s).length;
  kindHelp = () => KIND_HELP[this.pf.controls.customizationKind.value];
  discountNote = () => {
    const { priceInr, originalPriceInr } = this.pf.getRawValue();
    return originalPriceInr > priceInr && priceInr > 0 ? `Shows ${Math.round((1 - priceInr / originalPriceInr) * 100)}% off.` : originalPriceInr ? 'Must be higher than the price to show as a discount.' : '';
  };
  bad = (c: 'title' | 'priceInr') => this.pf.controls[c].invalid && (this.pf.controls[c].touched || this.pf.controls[c].dirty);
  slugTaken = () => {
    const s = this.pf.controls.slug.value.trim();
    return !!s && this.products().some((p) => p.slug === s && p.id !== this.editing()?.id);
  };

  shown = computed(() => {
    const q = this.q().trim().toLowerCase();
    const list = this.products().filter((p) => (!this.status() || p.status === this.status()) && (!this.cat() || p.category === this.cat()) && (!q || (p.title + ' ' + p.tags.join(' ')).toLowerCase().includes(q)));
    switch (this.sort()) {
      case 'title': return [...list].sort((a, b) => a.title.localeCompare(b.title));
      case 'price-asc': return [...list].sort((a, b) => a.priceInr - b.priceInr);
      case 'price-desc': return [...list].sort((a, b) => b.priceInr - a.priceInr);
      default: return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
  });
  allSelected = computed(() => this.shown().length > 0 && this.shown().every((p) => this.selected().has(p.id)));

  async ngOnInit() { await this.reload(); }

  async reload() {
    try {
      const [p] = await Promise.all([this.backend.listProducts(true), this.catalog.load(true)]);
      this.products.set(p);
    } catch (e) { this.error.set((e as Error).message); }
  }

  toggle(id: string) { const s = new Set(this.selected()); s.has(id) ? s.delete(id) : s.add(id); this.selected.set(s); }
  toggleAll() { this.selected.set(this.allSelected() ? new Set() : new Set(this.shown().map((p) => p.id))); }

  private async run(fn: () => Promise<void>, ok: string) {
    this.error.set('');
    this.busy.set(true);
    try { await fn(); this.toast.show(ok); await this.reload(); void this.state.refresh(); } catch (e) { this.error.set((e as Error).message); } finally { this.busy.set(false); }
  }

  setStatus(p: Product, status: ProductStatus) { void this.run(() => this.backend.saveProduct({ ...p, status }), `“${p.title}” is now ${status}`); }
  bulk(status: ProductStatus) {
    const ids = this.selected();
    void this.run(async () => {
      for (const p of this.products().filter((x) => ids.has(x.id))) await this.backend.saveProduct({ ...p, status });
      this.selected.set(new Set());
    }, `${ids.size} product(s) set to ${status}`);
  }

  private load(p: Editing) {
    const known = p.formats.filter((f) => FORMAT_OPTIONS.includes(f));
    this.formats.set(known);
    this.faq.set(p.faq.map((f) => ({ ...f })));
    this.pf.reset({
      title: p.title, tagline: p.tagline, slug: p.slug, description: p.description, priceInr: p.priceInr, originalPriceInr: p.originalPriceInr ?? 0,
      category: p.category || this.catalog.categories()[0]?.id || '', status: p.status, occasion: p.occasion, style: p.style, tags: p.tags.join(', '),
      otherFormats: p.formats.filter((f) => !FORMAT_OPTIONS.includes(f)).join(', '), customizationKind: p.customizationKind, videoUrl: p.videoUrl ?? '',
      delivery: p.delivery, license: p.license, featured: p.featured, trending: p.trending, bestseller: p.bestseller,
    });
    this.editing.set({ ...p, gallery: p.gallery.filter((m) => !m.url.startsWith('data:')) });
    scrollTo({ top: 0 });
  }

  create() {
    this.load({ isNew: true, id: crypto.randomUUID(), slug: '', title: '', tagline: '', description: '', priceInr: 0, category: '', tags: [], occasion: 'Any', style: '', formats: ['PDF'],
      delivery: 'Instant download after verified payment', customizable: false, customizationKind: 'none', aspect: 1.4, palette: ['#F2F2F2', '#9A9A9A'], motif: 'floral', gallery: [],
      license: '', faq: [], status: 'draft', featured: false, trending: false, bestseller: false, createdAt: new Date().toISOString().slice(0, 10) });
  }
  edit(p: Product) { this.load({ ...p }); }
  duplicate(p: Product) {
    const title = 'Copy of ' + p.title;
    this.load({ ...p, isNew: true, id: crypto.randomUUID(), title, slug: slugify(title) + '-' + Math.random().toString(36).slice(2, 5), status: 'draft', featured: false, createdAt: new Date().toISOString().slice(0, 10) });
    this.pf.markAsDirty();
  }
  cancel() {
    if (this.pf.dirty && !confirm('Discard your unsaved changes?')) return;
    this.editing.set(null);
  }

  toggleFormat(f: string) { this.formats.update((l) => (l.includes(f) ? l.filter((x) => x !== f) : [...l, f])); this.pf.markAsDirty(); }
  addFaq() { this.faq.update((l) => [...l, { q: '', a: '' }]); this.pf.markAsDirty(); }
  removeFaq(i: number) { this.faq.update((l) => l.filter((_, x) => x !== i)); this.pf.markAsDirty(); }
  setFaq(i: number, k: 'q' | 'a', v: string) { this.faq.update((l) => l.map((f, x) => (x === i ? { ...f, [k]: v } : f))); this.pf.markAsDirty(); }

  async onImages(e: Event) {
    const input = e.target as HTMLInputElement;
    try {
      for (const f of Array.from(input.files ?? [])) {
        const url = await this.backend.uploadAsset(f, 'media');
        const m: MediaItem = { url, alt: this.pf.controls.title.value || f.name, kind: 'image' };
        this.editing.update((p) => p && { ...p, gallery: [...p.gallery, m] });
      }
      this.pf.markAsDirty();
    } catch (err) { this.error.set((err as Error).message); }
    input.value = '';
  }
  removeImage(i: number) { this.editing.update((p) => p && { ...p, gallery: p.gallery.filter((_, x) => x !== i) }); this.pf.markAsDirty(); }
  move(i: number, d: number) {
    this.editing.update((p) => {
      if (!p) return p;
      const g = [...p.gallery];
      [g[i], g[i + d]] = [g[i + d], g[i]];
      return { ...p, gallery: g };
    });
    this.pf.markAsDirty();
  }
  async onVideo(e: Event) {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    if (!f) return;
    try { this.pf.controls.videoUrl.setValue(await this.backend.uploadAsset(f, 'media')); this.pf.markAsDirty(); } catch (err) { this.error.set((err as Error).message); }
    input.value = '';
  }
  async onFile(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    try { const path = await this.backend.uploadAsset(f, 'file'); this.editing.update((p) => p && { ...p, filePath: path }); this.pf.markAsDirty(); } catch (err) { this.error.set((err as Error).message); }
  }

  async save(publish: boolean) {
    this.pf.markAllAsTouched();
    this.error.set('');
    const v = this.pf.getRawValue();
    if (this.pf.invalid) { this.error.set('Please fix the highlighted fields: a title and a price of at least ₹1 are required.'); return; }
    if (this.slugTaken()) { this.error.set('That web address is already used by another product.'); return; }
    const e = this.editing()!;
    const list = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);
    const formats = [...this.formats(), ...list(v.otherFormats)];
    if (!formats.length) { this.error.set('Choose at least one file format.'); return; }
    const palette: [string, string] = e.palette ?? ['#F2F2F2', '#9A9A9A'];
    const motif: Motif = e.motif ?? this.catalog.categories().find((c) => c.id === v.category)?.motif ?? 'floral';
    const aspect = e.aspect ?? 1.4;
    const gallery = e.gallery.filter((m) => !m.url.startsWith('data:'));
    const { isNew: _n, filePath: _f, ...rest } = e;
    const p: Product = {
      ...(rest as Product), id: e.id, slug: v.slug.trim() || slugify(v.title) || e.id, title: v.title.trim(), tagline: v.tagline, description: v.description,
      priceInr: v.priceInr, originalPriceInr: v.originalPriceInr > v.priceInr ? v.originalPriceInr : undefined, category: v.category, status: publish ? 'published' : v.status,
      occasion: v.occasion, style: v.style, formats, tags: list(v.tags), customizationKind: v.customizationKind, customizable: v.customizationKind !== 'none',
      videoUrl: v.videoUrl.trim() || undefined, delivery: v.delivery, license: v.license, featured: v.featured, trending: v.trending, bestseller: v.bestseller,
      faq: this.faq().filter((f) => f.q.trim() && f.a.trim()), palette, motif, aspect, gallery, createdAt: e.createdAt ?? new Date().toISOString().slice(0, 10),
    };
    await this.run(async () => {
      await this.backend.saveProduct(p);
      if (e.filePath) await this.backend.setProductFile(p.id, e.filePath);
      this.pf.markAsPristine();
      this.editing.set(null);
    }, publish ? `“${p.title}” saved and published` : `“${p.title}” saved`);
  }
}

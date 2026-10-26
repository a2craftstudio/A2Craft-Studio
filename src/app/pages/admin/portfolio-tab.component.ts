import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Backend } from '../../core/backend';
import { coverArt } from '../../core/cover-art';
import { PortfolioProject } from '../../core/models';
import { CatalogService, ToastService } from '../../core/services';

@Component({
  selector: 'app-portfolio-tab',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    @if (error()) { <div class="alert error" role="alert">{{ error() }}</div> }

    @if (editing(); as e) {
      <form class="adm-card" [formGroup]="f" (ngSubmit)="save()" novalidate>
        <h2 class="adm-h">{{ e.isNew ? 'New project' : 'Edit project' }}</h2>
        <div class="adm-grid">
          <div class="field"><label for="w-t">Title *</label><input id="w-t" formControlName="title" />@if (f.controls.title.touched && f.controls.title.invalid) { <span class="adm-err">Please enter a title.</span> }</div>
          <div class="field"><label for="w-c">Category *</label><input id="w-c" formControlName="category" list="w-cats" placeholder="Invitations, Memory books…" />
            <datalist id="w-cats">@for (c of categories(); track c) { <option [value]="c"></option> }</datalist>
            @if (f.controls.category.touched && f.controls.category.invalid) { <span class="adm-err">Please enter a category.</span> }</div>
        </div>
        <div class="field"><label for="w-s">The story behind it</label><textarea id="w-s" formControlName="story" style="min-height: 100px"></textarea></div>
        <div class="field"><label for="w-img">Cover photo</label>
          @if (e.image) { <div class="cover"><img [src]="e.image" alt="Current cover" width="120" height="150" /><button type="button" class="btn small ghost" (click)="clearImage()">Remove photo</button></div> }
          <input id="w-img" type="file" accept="image/*" (change)="onImage($event)" /></div>
        <div class="field"><label for="w-v">Video link (optional)</label><input id="w-v" formControlName="videoUrl" placeholder="https://…" /></div>
        <label class="check"><input type="checkbox" formControlName="beforeAfter" /> Show a before / after slider</label>
        <label class="check"><input type="checkbox" formControlName="published" /> Published (visible on “Our work”)</label>
        <div class="adm-sticky"><button class="btn" type="submit">Save</button><button class="btn ghost" type="button" (click)="editing.set(null)">Cancel</button></div>
      </form>
    } @else {
      <div class="adm-bar"><span class="muted">{{ list().length }} project(s)</span><button class="btn grow" type="button" (click)="create()">Add project</button></div>
      @if (!list().length) { <div class="adm-empty"><p>No projects yet. Showcase finished work to build trust.</p><button class="btn" type="button" (click)="create()">Add your first project</button></div> }
      <ul class="cards">
        @for (w of list(); track w.id; let i = $index) {
          <li class="adm-card">
            <img [src]="preview(w)" alt="" width="90" height="110" loading="lazy" />
            <div class="body"><strong>{{ w.title }}</strong><span class="muted s">{{ w.category }}</span>
              <div><span class="pill" [class.green]="w.published">{{ w.published ? 'Live' : 'Hidden' }}</span></div></div>
            <div class="adm-actions">
              <button class="mv" type="button" (click)="move(i, -1)" [disabled]="i === 0" [attr.aria-label]="'Move ' + w.title + ' earlier'">↑</button>
              <button class="mv" type="button" (click)="move(i, 1)" [disabled]="i === list().length - 1" [attr.aria-label]="'Move ' + w.title + ' later'">↓</button>
              <button class="btn small ghost" type="button" (click)="togglePub(w)">{{ w.published ? 'Hide' : 'Publish' }}</button>
              <button class="btn small ghost" type="button" (click)="edit(w)">Edit</button>
              <button class="btn small ghost" type="button" (click)="remove(w)">Delete</button>
            </div>
          </li>
        }
      </ul>
    }
  `,
  styles: [`
    .cards { list-style: none; padding: 0; margin: 0; display: grid; gap: 10px; li { display: flex; gap: 14px; align-items: center; margin: 0; flex-wrap: wrap; img { width: 90px; height: 110px; object-fit: cover; border-radius: 12px; background: #efefef; } .body { flex: 1; min-width: 180px; display: grid; gap: 2px; } } }
    .mv { width: 30px; height: 30px; border-radius: 50%; border: 0; background: #efefef; &:disabled { opacity: .35; } } .s { font-size: .85rem; } .field { margin-bottom: 1rem; }
    .cover { display: flex; gap: 12px; align-items: end; margin-bottom: .6rem; img { border-radius: 12px; object-fit: cover; } }
  `],
})
export class PortfolioTabComponent implements OnInit {
  private backend = inject(Backend);
  private catalog = inject(CatalogService);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);
  list = signal<PortfolioProject[]>([]);
  editing = signal<(PortfolioProject & { isNew?: boolean }) | null>(null);
  error = signal('');
  categories = () => [...new Set(this.list().map((w) => w.category))];
  f = this.fb.nonNullable.group({ title: ['', Validators.required], category: ['', Validators.required], story: [''], videoUrl: [''], beforeAfter: [false], published: [false] });

  preview = (w: PortfolioProject) => w.image ?? coverArt({ seed: w.id, title: w.title, label: ' ', palette: w.palette, motif: w.motif, aspect: 1.3 });

  ngOnInit() { void this.reload(); }

  async reload() {
    try { this.list.set(await this.backend.listPortfolio(true)); await this.catalog.load(true); } catch (e) { this.error.set((e as Error).message); }
  }

  private async run(fn: () => Promise<void>, ok: string) {
    this.error.set('');
    try { await fn(); this.toast.show(ok); await this.reload(); } catch (e) { this.error.set((e as Error).message); }
  }

  create() {
    this.f.reset({ title: '', category: '', story: '', videoUrl: '', beforeAfter: false, published: false });
    this.editing.set({ isNew: true, id: crypto.randomUUID(), title: '', category: '', story: '', palette: ['#F2F2F2', '#9A9A9A'], motif: 'frame', aspect: 1.4, beforeAfter: false, published: false, sortOrder: this.list().length + 1 });
  }
  edit(w: PortfolioProject) {
    this.f.reset({ title: w.title, category: w.category, story: w.story, videoUrl: w.videoUrl ?? '', beforeAfter: w.beforeAfter, published: w.published });
    this.editing.set({ ...w });
  }

  async onImage(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try { const url = await this.backend.uploadAsset(file, 'media'); this.editing.update((w) => w && { ...w, image: url }); } catch (err) { this.error.set((err as Error).message); }
    input.value = '';
  }
  clearImage() { this.editing.update((w) => w && { ...w, image: undefined }); }

  async save() {
    this.f.markAllAsTouched();
    if (this.f.invalid) return;
    const { isNew: _n, ...base } = this.editing()!;
    const v = this.f.getRawValue();
    const w: PortfolioProject = { ...base, ...v, title: v.title.trim(), category: v.category.trim(), videoUrl: v.videoUrl.trim() || undefined };
    await this.run(async () => { await this.backend.savePortfolio(w); this.editing.set(null); }, 'Project saved');
  }

  togglePub(w: PortfolioProject) { void this.run(() => this.backend.savePortfolio({ ...w, published: !w.published }), w.published ? 'Project hidden' : 'Project published'); }
  remove(w: PortfolioProject) { if (confirm(`Delete “${w.title}”? This can’t be undone.`)) void this.run(() => this.backend.deletePortfolio(w.id), 'Project deleted'); }

  /** Swaps sort order with the neighbour and renumbers so the list always stays 1..n. */
  move(i: number, d: number) {
    const l = [...this.list()];
    [l[i], l[i + d]] = [l[i + d], l[i]];
    void this.run(async () => { for (const [n, w] of l.entries()) if (w.sortOrder !== n + 1) await this.backend.savePortfolio({ ...w, sortOrder: n + 1 }); }, 'Order updated');
  }
}

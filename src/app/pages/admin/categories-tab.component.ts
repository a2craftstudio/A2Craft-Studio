import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Backend } from '../../core/backend';
import { Category, Motif } from '../../core/models';
import { SUGGESTED_CATEGORIES } from '../../core/options';
import { CatalogService, ToastService } from '../../core/services';

const MOTIFS: { id: Motif; label: string }[] = [
  { id: 'cake', label: 'Cake (birthdays)' }, { id: 'rings', label: 'Rings (weddings)' }, { id: 'book', label: 'Book' }, { id: 'frame', label: 'Photo frame' },
  { id: 'story', label: 'Phone story' }, { id: 'letter', label: 'Love letter' }, { id: 'video', label: 'Video' }, { id: 'card', label: 'Card' },
  { id: 'hearts', label: 'Hearts' }, { id: 'lamp', label: 'Festive lamp' }, { id: 'floral', label: 'Flowers' },
];

@Component({
  selector: 'app-categories-tab',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    @if (error()) { <div class="alert error" role="alert">{{ error() }}</div> }
    <div class="adm-bar"><button class="btn grow" type="button" (click)="create()">Add category</button></div>
    @if (loaded() && !list().length && !editing()) {
      <div class="adm-empty"><h3>No categories yet</h3><p>Categories are the groups customers browse by. Start with a ready-made set of 12 and rename, reorder or delete any of them, or add your own.</p>
        <button class="btn" type="button" (click)="addSuggested()" [disabled]="busy()">{{ busy() ? 'Adding…' : 'Add suggested categories' }}</button></div>
    }

    @if (editing(); as e) {
      <form class="adm-card" [formGroup]="f" (ngSubmit)="save()" novalidate>
        <h2 class="adm-h">{{ e.id ? 'Edit category' : 'New category' }}</h2>
        <div class="adm-grid">
          <div class="field"><label for="c-name">Name *</label><input id="c-name" formControlName="name" maxlength="40" />@if (f.controls.name.touched && f.controls.name.invalid) { <span class="adm-err">Please enter a name.</span> }</div>
          <div class="field"><label for="c-motif">Fallback drawing</label><select id="c-motif" formControlName="motif">@for (m of motifs; track m.id) { <option [value]="m.id">{{ m.label }}</option> }</select></div>
        </div>
        <div class="field"><label for="c-blurb">Short description</label><input id="c-blurb" formControlName="blurb" maxlength="80" placeholder="Shown under the category name" /></div>
        <div class="adm-actions"><button class="btn" type="submit">Save</button><button class="btn ghost" type="button" (click)="editing.set(null)">Cancel</button></div>
      </form>
    }

    <div class="table-wrap"><table class="tbl">
      <thead><tr><th>Order</th><th>Category</th><th>Designs</th><th></th></tr></thead>
      <tbody>
        @for (c of list(); track c.id; let i = $index) {
          <tr><td><div class="adm-actions"><button type="button" class="mv" (click)="move(i, -1)" [disabled]="i === 0" [attr.aria-label]="'Move ' + c.name + ' up'">↑</button><button type="button" class="mv" (click)="move(i, 1)" [disabled]="i === list().length - 1" [attr.aria-label]="'Move ' + c.name + ' down'">↓</button></div></td>
            <td><strong>{{ c.name }}</strong><br /><span class="muted s">{{ c.blurb }}</span></td><td>{{ usage(c.id) }}</td>
            <td><div class="adm-actions"><button class="btn small ghost" type="button" (click)="edit(c)">Edit</button><button class="btn small ghost" type="button" (click)="remove(c)" [disabled]="usage(c.id) > 0" [title]="usage(c.id) ? 'Move its products to another category first' : ''">Delete</button></div></td></tr>
        }
      </tbody></table></div>
    <p class="muted s">The order here is the order customers see. A category can only be deleted when no product uses it.</p>
  `,
  styles: [`.mv { width: 30px; height: 30px; border-radius: 50%; border: 0; background: #efefef; &:disabled { opacity: .35; } } .s { font-size: .82rem; } .field { margin-bottom: 1rem; }`],
})
export class CategoriesTabComponent implements OnInit {
  private backend = inject(Backend);
  private catalog = inject(CatalogService);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);
  motifs = MOTIFS;
  list = signal<Category[]>([]);
  counts = signal<Record<string, number>>({});
  editing = signal<Category | null>(null);
  error = signal('');
  loaded = signal(false);
  busy = signal(false);
  f = this.fb.nonNullable.group({ name: ['', Validators.required], blurb: [''], motif: ['floral' as Motif] });
  usage = (id: string) => this.counts()[id] ?? 0;

  ngOnInit() { void this.reload(); }

  async reload() {
    try {
      const [cats, products] = await Promise.all([this.backend.listCategories(), this.backend.listProducts(true)]);
      this.list.set(cats);
      const m: Record<string, number> = {};
      products.forEach((p) => (m[p.category] = (m[p.category] ?? 0) + 1));
      this.counts.set(m);
      await this.catalog.load(true);
    } catch (e) { this.error.set((e as Error).message); }
    this.loaded.set(true);
  }

  async addSuggested() {
    this.busy.set(true);
    this.error.set('');
    try {
      for (const s of SUGGESTED_CATEGORIES) await this.backend.saveCategory({ id: '', ...s });
      this.toast.show('Suggested categories added');
      await this.reload();
    } catch (e) { this.error.set((e as Error).message); } finally { this.busy.set(false); }
  }

  create() { this.f.reset({ name: '', blurb: '', motif: 'floral' }); this.editing.set({ id: '', name: '', blurb: '', motif: 'floral' }); }
  edit(c: Category) { this.f.reset({ name: c.name, blurb: c.blurb, motif: c.motif }); this.editing.set(c); }

  async save() {
    this.f.markAllAsTouched();
    if (this.f.invalid) return;
    this.error.set('');
    try {
      await this.backend.saveCategory({ id: this.editing()!.id, ...this.f.getRawValue() });
      this.toast.show('Category saved');
      this.editing.set(null);
      await this.reload();
    } catch (e) { this.error.set((e as Error).message); }
  }

  async remove(c: Category) {
    if (!confirm(`Delete the category “${c.name}”?`)) return;
    this.error.set('');
    try { await this.backend.deleteCategory(c.id); this.toast.show('Category deleted'); await this.reload(); } catch (e) { this.error.set((e as Error).message); }
  }

  /** Persists the new order by re-saving in sequence (the backend keeps array/sort order). */
  async move(i: number, d: number) {
    const l = [...this.list()];
    [l[i], l[i + d]] = [l[i + d], l[i]];
    this.list.set(l);
    try { await this.backend.reorderCategories(l.map((c) => c.id)); await this.catalog.load(true); } catch (e) { this.error.set((e as Error).message); await this.reload(); }
  }
}

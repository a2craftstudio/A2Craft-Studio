import { Component, inject, OnInit, signal } from '@angular/core';
import { Backend } from '../../core/backend';
import { FAQ } from '../../core/faq-content';
import { ContentSection, FaqGroup, SiteSettings } from '../../core/models';
import { SettingsService, ToastService } from '../../core/services';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

/** Edit the FAQ and the About page without touching code. Each editor can be reset to the built-in text. */
@Component({
  selector: 'app-content-tab',
  standalone: true,
  template: `
    @if (error()) { <div class="alert error" role="alert">{{ error() }}</div> }
    <div class="adm-seg" role="group" aria-label="What to edit">
      <button type="button" [class.on]="mode() === 'faq'" (click)="mode.set('faq')">FAQ</button><button type="button" [class.on]="mode() === 'about'" (click)="mode.set('about')">About page</button>
    </div>

    @if (mode() === 'faq') {
      <p class="adm-intro">Questions are grouped. Customers can search them on the FAQ page, and Google can show them in search results.</p>
      @for (g of faq(); track $index; let gi = $index) {
        <section class="adm-card">
          <div class="gh"><div class="field"><label [for]="'gl' + gi">Group name</label><input [id]="'gl' + gi" [value]="g.label" (input)="setLabel(gi, $any($event.target).value)" /></div>
            <div class="adm-actions"><button class="mv" type="button" (click)="moveGroup(gi, -1)" [disabled]="gi === 0" [attr.aria-label]="'Move group ' + g.label + ' up'">↑</button><button class="mv" type="button" (click)="moveGroup(gi, 1)" [disabled]="gi === faq().length - 1" [attr.aria-label]="'Move group ' + g.label + ' down'">↓</button>
              <button class="btn small ghost" type="button" (click)="removeGroup(gi)">Delete group</button></div></div>
          @for (it of g.items; track $index; let ii = $index) {
            <div class="qa"><div class="field"><label [for]="'q' + gi + '-' + ii">Question</label><input [id]="'q' + gi + '-' + ii" [value]="it.q" (input)="setItem(gi, ii, 'q', $any($event.target).value)" /></div>
              <div class="field"><label [for]="'a' + gi + '-' + ii">Answer</label><textarea [id]="'a' + gi + '-' + ii" [value]="it.a" (input)="setItem(gi, ii, 'a', $any($event.target).value)"></textarea></div>
              <button class="btn small ghost" type="button" (click)="removeItem(gi, ii)">Remove</button></div>
          }
          <button class="btn small ghost" type="button" (click)="addItem(gi)">Add a question</button>
        </section>
      }
      <div class="adm-actions"><button class="btn ghost small" type="button" (click)="addGroup()">Add a group</button></div>
    } @else {
      <p class="adm-intro">Sections appear in order on the About page. Use <code>{{ '{legalName}' }}</code>, <code>{{ '{address}' }}</code> or <code>{{ '{supportEmail}' }}</code> to insert your business details automatically.</p>
      @for (s of about(); track $index; let i = $index) {
        <section class="adm-card">
          <div class="field"><label [for]="'sh' + i">Heading</label><input [id]="'sh' + i" [value]="s.h" (input)="setSection(i, 'h', $any($event.target).value)" /></div>
          <div class="field"><label [for]="'sp' + i">Text (a blank line starts a new paragraph)</label><textarea [id]="'sp' + i" style="min-height: 130px" [value]="s.p.join('\n\n')" (input)="setSection(i, 'p', $any($event.target).value)"></textarea></div>
          <div class="adm-actions"><button class="mv" type="button" (click)="moveSection(i, -1)" [disabled]="i === 0" [attr.aria-label]="'Move section ' + s.h + ' up'">↑</button><button class="mv" type="button" (click)="moveSection(i, 1)" [disabled]="i === about().length - 1" [attr.aria-label]="'Move section ' + s.h + ' down'">↓</button>
            <button class="btn small ghost" type="button" (click)="removeSection(i)">Delete section</button></div>
        </section>
      }
      <button class="btn ghost small" type="button" (click)="addSection()">Add a section</button>
    }

    <div class="adm-sticky"><button class="btn" type="button" (click)="save()" [disabled]="busy()">Save {{ mode() === 'faq' ? 'FAQ' : 'About page' }}</button>
      <button class="btn ghost" type="button" (click)="reset()">Reset to the built-in text</button>
      <a class="btn ghost" [href]="mode() === 'faq' ? '/faq' : '/about'" target="_blank">Preview ↗</a></div>
  `,
  styles: [`
    .adm-seg { margin-bottom: 1rem; } .gh { display: flex; gap: 1rem; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; .field { flex: 1 1 240px; } }
    .qa { display: grid; grid-template-columns: 1fr 1.8fr auto; gap: .8rem; align-items: start; margin-top: .4rem; .btn { margin-top: 1.7rem; } } @media (max-width: 800px) { .qa { grid-template-columns: 1fr; .btn { margin-top: 0; } } }
    .mv { width: 30px; height: 30px; border-radius: 50%; border: 0; background: #efefef; &:disabled { opacity: .35; } } .field { margin-bottom: .8rem; } textarea { min-height: 80px; }
  `],
})
export class ContentTabComponent implements OnInit {
  private backend = inject(Backend);
  private live = inject(SettingsService);
  private toast = inject(ToastService);
  mode = signal<'faq' | 'about'>('faq');
  faq = signal<FaqGroup[]>(clone(FAQ));
  about = signal<ContentSection[]>([]);
  error = signal('');
  busy = signal(false);
  private current: SiteSettings = { announcement: '', whatsapp: '', supportEmail: '' };

  async ngOnInit() {
    try {
      this.current = await this.backend.getSettings();
      this.faq.set(clone(this.current.faq?.length ? this.current.faq : FAQ));
      this.about.set(clone(this.current.about?.length ? this.current.about : this.rawAbout()));
    } catch (e) { this.error.set((e as Error).message); }
  }

  /** The built-in About sections with {tokens} kept, so owners can keep using them. */
  private rawAbout(): ContentSection[] {
    return [
      { h: 'Hello, we’re {brand}', p: ['Tell visitors who you are, why you started, and what you love making.', 'We design invitations, memory books, scrapbooks, animated videos and personalized digital gifts, crafted by hand and delivered digitally.'] },
      { h: 'How we work', p: ['Ready-made designs are delivered as digital files the moment payment is verified. Personalized and video products are prepared by hand after you share your details, so please allow the turnaround listed on each product.'] },
      { h: 'Who is behind the shop', p: ['{legalName}, {address}.', 'Questions? Email {supportEmail}.'] },
    ];
  }

  // ---- FAQ
  private edit(fn: (g: FaqGroup[]) => void) { const g = clone(this.faq()); fn(g); this.faq.set(g); }
  setLabel(gi: number, v: string) { this.edit((g) => (g[gi].label = v)); }
  setItem(gi: number, ii: number, k: 'q' | 'a', v: string) { this.edit((g) => (g[gi].items[ii][k] = v)); }
  addItem(gi: number) { this.edit((g) => g[gi].items.push({ q: '', a: '' })); }
  removeItem(gi: number, ii: number) { this.edit((g) => g[gi].items.splice(ii, 1)); }
  addGroup() { this.edit((g) => g.push({ label: 'New group', items: [{ q: '', a: '' }] })); }
  removeGroup(gi: number) { if (confirm('Delete this whole group of questions?')) this.edit((g) => g.splice(gi, 1)); }
  moveGroup(gi: number, d: number) { this.edit((g) => { [g[gi], g[gi + d]] = [g[gi + d], g[gi]]; }); }

  // ---- About
  private editA(fn: (s: ContentSection[]) => void) { const s = clone(this.about()); fn(s); this.about.set(s); }
  setSection(i: number, k: 'h' | 'p', v: string) { this.editA((s) => { if (k === 'h') s[i].h = v; else s[i].p = v.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean); }); }
  addSection() { this.editA((s) => s.push({ h: 'New section', p: [''] })); }
  removeSection(i: number) { if (confirm('Delete this section?')) this.editA((s) => s.splice(i, 1)); }
  moveSection(i: number, d: number) { this.editA((s) => { [s[i], s[i + d]] = [s[i + d], s[i]]; }); }

  async save() {
    this.error.set('');
    const cleanFaq = this.faq().map((g) => ({ label: g.label.trim(), items: g.items.filter((i) => i.q.trim() && i.a.trim()) })).filter((g) => g.label && g.items.length);
    const cleanAbout = this.about().map((s) => ({ h: s.h.trim(), p: s.p.filter((x) => x.trim()) })).filter((s) => s.h && s.p.length);
    if (this.mode() === 'faq' && !cleanFaq.length) { this.error.set('Add at least one question with an answer, or use “Reset to the built-in text”.'); return; }
    if (this.mode() === 'about' && !cleanAbout.length) { this.error.set('Add at least one section with a heading and text, or use “Reset to the built-in text”.'); return; }
    this.busy.set(true);
    try {
      const next: SiteSettings = this.mode() === 'faq' ? { ...this.current, faq: cleanFaq } : { ...this.current, about: cleanAbout };
      await this.backend.saveSettings(next);
      this.current = next;
      await this.live.load();
      this.toast.show(this.mode() === 'faq' ? 'FAQ saved. It’s live on the site.' : 'About page saved. It’s live on the site.');
    } catch (e) { this.error.set((e as Error).message); } finally { this.busy.set(false); }
  }

  async reset() {
    if (!confirm('Replace your edits with the built-in text? This saves immediately.')) return;
    const next: SiteSettings = { ...this.current };
    if (this.mode() === 'faq') { delete next.faq; this.faq.set(clone(FAQ)); } else { delete next.about; this.about.set(clone(this.rawAbout())); }
    try { await this.backend.saveSettings(next); this.current = next; await this.live.load(); this.toast.show('Back to the built-in text'); } catch (e) { this.error.set((e as Error).message); }
  }
}

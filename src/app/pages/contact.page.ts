import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Backend } from '../core/backend';
import { BRAND } from '../core/config';
import { DAYS, fmtRange, istNow } from '../core/hours';
import { SeoService, SettingsService } from '../core/services';

const TOPICS = ['A custom project', 'Help with an order', 'A question about a design', 'Something else'];
const WHEN = ['As soon as possible', 'Weekday evenings', 'Weekends'];

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="container wrap">
      <div>
        <p class="eyebrow">Contact</p>
        <h1>Talk to <span class="hl">us</span></h1>
        <p class="muted">Chat with us, send an inquiry, or leave your number and we’ll call you. We reply during the hours below. Anything sent outside them is answered when we next open.</p>

        <section class="adm-card hours" aria-labelledby="hrs-h">
          <div class="hh"><h2 id="hrs-h">Our hours</h2>
            <span class="live" [class.on]="status().open" role="status"><i></i>{{ status().label }}</span></div>
          <table>
            <caption class="sr-only">Opening hours, India Standard Time</caption>
            <tbody>@for (d of days; track d.key) {
              <tr [class.today]="today().day === d.key" [attr.aria-current]="today().day === d.key ? 'date' : null"><th scope="row">{{ d.long }}@if (today().day === d.key) { <small>today</small> }</th><td>{{ range(d.key) }}</td></tr>
            }</tbody>
          </table>
          <p class="muted tz">All times are India Standard Time (IST).</p>
        </section>

        <h2 class="ways-h">Pick how you’d like to reach us</h2>
        <ul class="ways">
          <li><button type="button" class="way" (click)="show('callback')"><b>Request a call back</b><span>Leave your number and we’ll call you</span><small>No need to share a number publicly, and no waiting on hold</small></button></li>
          @if (waHref(); as wa) { <li><a class="way" [href]="wa" target="_blank" rel="noopener noreferrer"><b>Chat on WhatsApp</b><span>{{ status().open ? 'We’re online now' : 'Leave a message, we’ll reply when we open' }}</span><small>Fastest for quick questions</small></a></li> }
          <li><a class="way" routerLink="/custom-order"><b>Send an inquiry</b><span>Describe a custom gift, book or video</span><small>We reply with a quote and timeline</small></a></li>
          <li><a class="way" [href]="'mailto:' + biz().supportEmail"><b>Email</b><span>{{ biz().supportEmail }}</span><small>Best for files and long messages</small></a></li>
        </ul>
        <p class="muted tz">Instagram: <a [href]="brand.instagramUrl" target="_blank" rel="noopener noreferrer">{{ brand.instagramHandle }}</a></p>
      </div>

      <div id="contact-form">
        <div class="adm-seg mode" role="group" aria-label="How should we get back to you?">
          <button type="button" [class.on]="mode() === 'message'" [attr.aria-pressed]="mode() === 'message'" (click)="show('message')">Send a message</button>
          <button type="button" [class.on]="mode() === 'callback'" [attr.aria-pressed]="mode() === 'callback'" (click)="show('callback')">Request a call back</button>
        </div>

        @if (mode() === 'message') {
          @if (sent()) {
            <div class="adm-card box" role="status"><h2>Message sent</h2><p>Thank you! We’ll get back to you at {{ f.controls.email.value }}. {{ status().open ? 'We’re online now, so it won’t be long.' : status().label + '.' }}</p></div>
          } @else {
            <form class="adm-card box" [formGroup]="f" (ngSubmit)="submit()" novalidate>
              <h2>Send a message</h2>
              <div class="field"><label for="ct-name">Your name *</label><input id="ct-name" formControlName="name" autocomplete="name" />@if (bad('name')) { <span class="err">Please enter your name.</span> }</div>
              <div class="field"><label for="ct-email">Email *</label><input id="ct-email" type="email" formControlName="email" autocomplete="email" />@if (bad('email')) { <span class="err">Please enter a valid email.</span> }</div>
              <div class="field"><label for="ct-msg">Message *</label><textarea id="ct-msg" formControlName="message" maxlength="2000"></textarea>@if (bad('message')) { <span class="err">Please write at least 10 characters.</span> }</div>
              @if (error()) { <div class="alert error" role="alert">{{ error() }}</div> }
              <button class="btn" type="submit" [disabled]="busy()">{{ busy() ? 'Sending…' : 'Send message' }}</button>
            </form>
          }
        } @else {
          @if (cbSent()) {
            <div class="adm-card box" role="status"><h2>We’ll call you</h2>
              <p>Thank you, {{ cb.controls.name.value.split(' ')[0] }}! We’ve got your number and will call you back. {{ status().open ? 'We’re online now, so expect a call soon.' : status().label + '. We’ll call after we open.' }}</p>
              <p class="muted tz">Please keep your phone handy. If we miss you we’ll try once more.</p></div>
          } @else {
            <form class="adm-card box" [formGroup]="cb" (ngSubmit)="submitCallback()" novalidate>
              <h2>Request a call back</h2>
              <p class="muted tz">Leave your number and we’ll call you in our opening hours. Your number is only seen by our team and never shown on the site.</p>
              <div class="field"><label for="cb-name">Your name *</label><input id="cb-name" formControlName="name" autocomplete="name" />@if (cbBad('name')) { <span class="err">Please enter your name.</span> }</div>
              <div class="field"><label for="cb-phone">Phone number *</label><input id="cb-phone" type="tel" inputmode="tel" formControlName="phone" autocomplete="tel" placeholder="98765 43210" />
                @if (cbBad('phone')) { <span class="err">Please enter a valid phone number (10 to 13 digits).</span> }</div>
              <div class="grid2">
                <div class="field"><label for="cb-topic">What is it about?</label><select id="cb-topic" formControlName="topic">@for (t of topics; track t) { <option>{{ t }}</option> }</select></div>
                <div class="field"><label for="cb-when">Best time to call</label><select id="cb-when" formControlName="preferred">@for (w of when; track w) { <option>{{ w }}</option> }</select></div>
              </div>
              <div class="field"><label for="cb-note">Anything we should know? (optional)</label><textarea id="cb-note" formControlName="note" maxlength="500" style="min-height: 80px"></textarea></div>
              <label class="check"><input type="checkbox" formControlName="consent" /> <span>I agree you may call me on this number about my request. See the <a routerLink="/privacy" target="_blank">privacy policy</a>.</span></label>
              @if (cbBad('consent')) { <span class="err">Please tick the box so we can call you.</span> }
              @if (error()) { <div class="alert error" role="alert">{{ error() }}</div> }
              <button class="btn" type="submit" [disabled]="busy()">{{ busy() ? 'Sending…' : 'Call me back' }}</button>
            </form>
          }
        }
      </div>
    </div>
  `,
  styles: [`
    .wrap { display: grid; grid-template-columns: 1.1fr .9fr; gap: clamp(20px, 5vw, 64px); padding-block: 40px 72px; align-items: start; }
    .hours { margin-top: 1.2rem; } .hh { display: flex; justify-content: space-between; gap: .8rem; flex-wrap: wrap; align-items: center; h2 { margin: 0; font-size: 1.3rem; } }
    .live { display: inline-flex; align-items: center; gap: 8px; padding: .4rem .9rem; border-radius: 999px; background: #efefef; font-weight: 700; font-size: .85rem; i { width: 9px; height: 9px; border-radius: 50%; background: #9a9a9a; }
      &.on { background: #dff5e3; color: #14632a; i { background: #1f9d3a; animation: pulse 1.8s ease-in-out infinite; } } }
    @keyframes pulse { 50% { box-shadow: 0 0 0 6px rgba(31,157,58,.2); } }
    table { width: 100%; border-collapse: collapse; margin-top: .8rem; th, td { text-align: left; padding: .5rem .2rem; border-bottom: 1px solid var(--line); font-size: .95rem; } th { font-weight: 500; small { margin-left: .5rem; font-size: .7rem; font-weight: 700; background: #111; color: #fff; padding: .1rem .5rem; border-radius: 999px; } }
      tr.today th, tr.today td { font-weight: 700; } td { text-align: right; font-variant-numeric: tabular-nums; } }
    .tz { font-size: .82rem; margin: .6rem 0 0; } .ways-h { font-size: 1.2rem; margin: 1.6rem 0 .6rem; }
    .ways { list-style: none; padding: 0; margin: 0; display: grid; gap: 10px; }
    .way { display: grid; gap: 1px; width: 100%; text-align: left; border: 0; font: inherit; padding: .9rem 1.1rem; border-radius: 18px; background: #efefef; text-decoration: none; color: #111; cursor: pointer; transition: transform .2s var(--ease), background .2s; &:hover { background: #fde8ec; transform: translateY(-2px); }
      b { font-size: 1rem; } span { font-size: .92rem; } small { color: var(--muted); font-size: .78rem; } }
    .mode { margin-bottom: 12px; } .box { padding: clamp(18px, 3vw, 32px); } .err { color: #a3263f; font-size: .82rem; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0 .8rem; } @media (max-width: 520px) { .grid2 { grid-template-columns: 1fr; } }
    @media (max-width: 860px) { .wrap { grid-template-columns: 1fr; } }
  `],
})
export class ContactPage implements OnInit {
  private fb = inject(FormBuilder);
  private backend = inject(Backend);
  private seo = inject(SeoService);
  private settings = inject(SettingsService);
  private route = inject(ActivatedRoute);
  brand = BRAND;
  days = DAYS;
  topics = TOPICS;
  when = WHEN;
  biz = this.settings.business;
  status = this.settings.status;
  today = computed(() => { this.status(); return istNow(); });
  mode = signal<'message' | 'callback'>('message');
  busy = signal(false);
  sent = signal(false);
  cbSent = signal(false);
  error = signal('');
  f = this.fb.nonNullable.group({
    name: ['', Validators.required], email: ['', [Validators.required, Validators.email]], message: ['', [Validators.required, Validators.minLength(10)]],
  });
  cb = this.fb.nonNullable.group({
    name: ['', Validators.required],
    phone: ['', [Validators.required, (c: { value: string }) => { const n = String(c.value).replace(/\D/g, '').length; return n >= 10 && n <= 13 ? null : { phone: true }; }]],
    topic: [TOPICS[0]], preferred: [WHEN[0]], note: [''], consent: [false, Validators.requiredTrue],
  });

  range = (k: (typeof DAYS)[number]['key']) => fmtRange(this.settings.hours()[k]);
  waHref = computed(() => {
    const n = this.settings.settings().whatsapp.replace(/\D/g, '');
    return n ? 'https://wa.me/' + n : '';
  });

  ngOnInit() {
    this.seo.set({ title: 'Contact', description: 'Chat, request a call back or send an inquiry. Mon–Sat 4 pm–11 pm, Sunday 10 am–12 pm IST.', path: '/contact' });
    void this.settings.load();
    const s = this.backend.session();
    if (s) { this.f.patchValue({ name: s.name, email: s.email }); this.cb.patchValue({ name: s.name }); }
    const order = this.route.snapshot.queryParamMap.get('order');
    if (order) { this.f.patchValue({ message: `About my order ${order}: ` }); this.cb.patchValue({ topic: TOPICS[1], note: `About my order ${order}.` }); }
    if (this.route.snapshot.queryParamMap.get('mode') === 'callback') this.mode.set('callback');
  }

  show(m: 'message' | 'callback') {
    this.mode.set(m);
    this.error.set('');
    setTimeout(() => document.getElementById('contact-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  bad(c: 'name' | 'email' | 'message') { const x = this.f.controls[c]; return x.invalid && x.touched; }
  cbBad(c: 'name' | 'phone' | 'consent') { const x = this.cb.controls[c]; return x.invalid && x.touched; }

  async submit() {
    this.f.markAllAsTouched();
    if (this.f.invalid) return;
    this.busy.set(true);
    this.error.set('');
    try { await this.backend.submitContact(this.f.getRawValue()); this.sent.set(true); }
    catch (e) { this.error.set(`We couldn’t send that: ${(e as Error).message}`); }
    finally { this.busy.set(false); }
  }

  async submitCallback() {
    this.cb.markAllAsTouched();
    if (this.cb.invalid) return;
    this.busy.set(true);
    this.error.set('');
    const { consent: _c, ...v } = this.cb.getRawValue();
    try { await this.backend.submitCallback(v); this.cbSent.set(true); }
    catch (e) { this.error.set(`We couldn’t send that: ${(e as Error).message}`); }
    finally { this.busy.set(false); }
  }
}

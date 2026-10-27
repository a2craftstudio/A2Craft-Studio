import { RoleBadgeComponent } from '../shared/role-badge.component';
import { Component, ElementRef, HostListener, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService, SessionActions } from '../core/services';
import { IconComponent } from '../shared/icon.component';

/** Top-bar account menu: sign in when signed out; the signed-in customer's private areas and Log out otherwise. */
@Component({
  selector: 'app-account-menu',
  standalone: true,
  imports: [RouterLink, IconComponent, RoleBadgeComponent],
  template: `
    <div class="am">
      @if (auth.session(); as s) {
        <button type="button" class="btn-av" (click)="open.set(!open())" [attr.aria-expanded]="open()" aria-haspopup="menu" [attr.aria-label]="'Account menu for ' + (s.name || s.email)">
          <span class="av" [class.crown]="s.superAdmin" aria-hidden="true">{{ initial(s) }}@if (s.superAdmin) { <svg class="cr" viewBox="0 0 24 24" width="14" height="14" focusable="false"><path fill="#d4a017" stroke="#8a6508" stroke-width=".6" d="M3 8l4.5 4L12 5l4.500 7L21 8l-2 11H5L3 8Z"/></svg> }</span>
        </button>
        @if (open()) {
          <div class="panel" role="menu" (keydown.escape)="open.set(false)">
            <div class="who"><strong>{{ s.name || 'My account' }}</strong><span>{{ s.email }}</span><app-role-badge [role]="auth.session()?.role" [superAdmin]="!!auth.session()?.superAdmin" /></div>
            <p class="priv"><app-icon name="check" [size]="14" /> Private to you. Only you can see these.</p>
            <a role="menuitem" routerLink="/account" [queryParams]="{ tab: 'orders' }">My orders</a>
            <a role="menuitem" routerLink="/account" [queryParams]="{ tab: 'downloads' }">Downloads</a>
            <a role="menuitem" routerLink="/account" [queryParams]="{ tab: 'saved' }">Saved designs</a>
            <a role="menuitem" routerLink="/account" [queryParams]="{ tab: 'history' }">Viewing history</a>
            <a role="menuitem" routerLink="/account" [queryParams]="{ tab: 'custom' }">Custom requests</a>
            <a role="menuitem" routerLink="/account" [queryParams]="{ tab: 'profile' }">Profile and privacy</a>
            @if (auth.isAdmin()) { <a role="menuitem" class="adm" routerLink="/admin">Admin dashboard</a> }
            <div class="sep"></div>
            <button role="menuitem" type="button" class="out" (click)="logout()">Log out</button>
            <button role="menuitem" type="button" class="clr" (click)="logoutAndClear()">Log out and clear this device</button>
            <p class="hint">Use the last option on a shared or public computer.</p>
          </div>
        }
      } @else {
        <button type="button" class="btn-in" (click)="open.set(!open())" [attr.aria-expanded]="open()" aria-haspopup="menu" aria-label="Sign in or create an account"><app-icon name="user" /></button>
        @if (open()) {
          <div class="panel" role="menu" (keydown.escape)="open.set(false)">
            <div class="who"><strong>Welcome</strong><span>Sign in to see your orders, downloads and saved designs.</span></div>
            <a role="menuitem" class="primary" routerLink="/account">Sign in</a>
            <a role="menuitem" routerLink="/account">Create an account</a>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .am { position: relative; }
    .btn-av, .btn-in { width: 44px; height: 44px; border-radius: 50%; border: 0; background: transparent; display: grid; place-items: center; color: var(--berry); transition: background .2s; &:hover { background: var(--blush); } }
    .av { width: 34px; height: 34px; border-radius: 50%; background: #111; color: #fff; display: grid; place-items: center; font-weight: 700; font-size: .95rem; }
    .panel { position: absolute; right: 0; top: calc(100% + 8px); z-index: 90; width: min(290px, calc(100vw - 24px)); background: #fff; border: 1px solid var(--line); border-radius: 22px; box-shadow: 0 16px 48px rgba(0,0,0,.18); padding: 10px; display: grid; gap: 2px; animation: drop .22s var(--ease) both; }
    .av { position: relative; } .av.crown { box-shadow: 0 0 0 2px #d4a017; } .av .cr { position: absolute; top: -9px; right: -7px; }
    .who { padding: 8px 12px 6px; display: grid; gap: 1px; strong { font-size: 1.05rem; } span { font-size: .8rem; color: var(--muted); word-break: break-all; } em { justify-self: start; font-style: normal; font-size: .68rem; font-weight: 700; background: #111; color: #fff; padding: .05rem .5rem; border-radius: 999px; margin-top: 4px; } }
    .priv { margin: 0 12px 6px; font-size: .75rem; color: #14632a; display: flex; align-items: center; gap: 4px; }
    a, button[role=menuitem] { display: block; width: 100%; text-align: left; padding: .6rem .8rem; border-radius: 14px; border: 0; background: transparent; font: inherit; font-size: .93rem; color: #111; text-decoration: none; cursor: pointer; &:hover, &:focus-visible { background: #efefef; } }
    a.primary { background: #e60023; color: #fff; font-weight: 700; text-align: center; &:hover { background: #ad081b; } } a.adm { font-weight: 700; }
    .sep { height: 1px; background: var(--line); margin: 6px 4px; } .out { font-weight: 700; } .clr { color: #a3002a; }
    .hint { margin: 2px 12px 6px; font-size: .72rem; color: var(--muted); }
    @keyframes drop { from { opacity: 0; transform: translateY(-6px) scale(.98); } }
  `],
})
export class AccountMenuComponent {
  auth = inject(AuthService);
  private session = inject(SessionActions);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  open = signal(false);

  constructor() {
    inject(Router).events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => this.open.set(false));
  }

  initial(s: { name: string; email: string }) { return (s.name || s.email).trim().charAt(0).toUpperCase() || '?'; }

  async logout() { this.open.set(false); await this.session.logout(); }
  async logoutAndClear() { this.open.set(false); await this.session.logoutAndClear(); }

  @HostListener('document:click', ['$event'])
  outside(e: Event) { if (this.open() && !this.host.nativeElement.contains(e.target as Node)) this.open.set(false); }
}

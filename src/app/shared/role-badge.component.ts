import { Component, computed, input } from '@angular/core';

/** Gold crown badge for the super admin, dark pill for admins, nothing for customers. */
@Component({
  selector: 'app-role-badge',
  standalone: true,
  template: `
    @if (superAdmin()) {
      <span class="rb super" title="Super admin"><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false"><path fill="currentColor" d="M3 8l4.5 4L12 5l4.500 7L21 8l-2 11H5L3 8Zm2.700 13h12.600v1.500H5.700V21Z"/></svg>Super admin</span>
    } @else if (role() === 'admin') {
      <span class="rb">Admin</span>
    } @else if (showCustomer()) {
      <span class="rb plain">Customer</span>
    }
  `,
  styles: [`
    :host { display: inline-flex; vertical-align: middle; }
    .rb { display: inline-flex; align-items: center; gap: .3rem; padding: .15rem .6rem; border-radius: 999px; font-size: .68rem; font-weight: 700; letter-spacing: .02em; background: #6d28d9; color: #fff; line-height: 1.4; }
    .rb.plain { background: #efefef; color: #333; font-weight: 600; }
    .rb.super { background: linear-gradient(135deg, #f7e08a, #d4a017 55%, #b8860b); color: #3a2a00; box-shadow: 0 0 0 1px rgba(184, 134, 11, .55), 0 2px 8px rgba(212, 160, 23, .35); }
  `],
})
export class RoleBadgeComponent {
  role = input<'customer' | 'admin' | undefined>();
  superAdmin = input(false);
  showCustomer = input(false);
  readonly label = computed(() => (this.superAdmin() ? 'Super admin' : this.role() === 'admin' ? 'Admin' : 'Customer'));
}

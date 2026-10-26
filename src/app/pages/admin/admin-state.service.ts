import { inject, Injectable, signal } from '@angular/core';
import { Backend } from '../../core/backend';

export interface AdminCounts { orders: number; inquiries: number; messages: number; reviews: number; drafts: number; callbacks: number }

/** Small counters shown as badges in the admin menu: things that need the owner's attention. */
@Injectable({ providedIn: 'root' })
export class AdminStateService {
  private backend = inject(Backend);
  readonly counts = signal<AdminCounts>({ orders: 0, inquiries: 0, messages: 0, reviews: 0, drafts: 0, callbacks: 0 });

  async refresh() {
    try {
      const [orders, inquiries, contacts, reviews, products, callbacks] = await Promise.all([
        this.backend.listAllOrders(), this.backend.listAllInquiries(), this.backend.listContacts(), this.backend.listAllReviews(), this.backend.listProducts(true), this.backend.listCallbacks(),
      ]);
      this.counts.set({
        // Paid orders that still need the owner to make and upload something by hand.
        orders: orders.filter((o) => o.paymentVerified && (o.status === 'paid' || o.status === 'in_progress') && o.items.some((i) => i.customization && !i.deliverable)).length,
        inquiries: inquiries.filter((i) => i.status === 'new').length,
        messages: contacts.filter((c) => c.status === 'new').length,
        reviews: reviews.filter((r) => !r.approved && r.consentToPublish).length,
        drafts: products.filter((p) => p.status === 'draft').length,
        callbacks: callbacks.filter((c) => c.status === 'new').length,
      });
    } catch { /* badges are a convenience; never block the page */ }
  }
}

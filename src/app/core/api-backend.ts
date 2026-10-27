import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { Backend, InquiryInput } from './backend';
import { coverArt } from './cover-art';
import {
  AppConfig, CallbackRequest, CartItem, Category, CheckoutInput, ContactMessage, Coupon, Customer, Inquiry, Order, OrderStatus, PaymentSession, PortfolioProject, Product, Quote, Review,
  SiteSettings, Subscriber, UserSession, VisitEvent,
} from './models';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const NETWORK_MESSAGE = 'We couldn’t reach the server. Check your connection and try again.';

/** Talks to the Node API (see docs/API.md). Same-origin, cookie session; the browser never sees a token. */
@Injectable()
export class ApiBackend extends Backend {
  private base = environment.apiBase;

  private async req<T = void>(method: string, path: string, body?: unknown, init: { keepalive?: boolean } = {}): Promise<T> {
    let res: Response;
    try {
      res = await fetch(this.base + path, {
        method,
        credentials: 'same-origin',
        headers: body === undefined || body instanceof FormData ? {} : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
        keepalive: init.keepalive,
      });
    } catch {
      throw new ApiError(NETWORK_MESSAGE, 0);
    }
    if (res.status === 204) return undefined as T;
    let data: unknown = null;
    try { data = await res.json(); } catch { /* empty or non-JSON body */ }
    if (!res.ok) throw new ApiError((data as { error?: string } | null)?.error ?? `Something went wrong (${res.status}).`, res.status);
    return data as T;
  }

  private q(params: Record<string, string | undefined>) {
    const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][]).toString();
    return s ? '?' + s : '';
  }

  // ---- start up and auth
  async init() {
    const [config, me] = await Promise.all([
      this.req<AppConfig>('GET', '/config').catch(() => null),
      this.req<{ user: UserSession | null }>('GET', '/auth/me').catch(() => ({ user: null })),
    ]);
    if (config) this.config.set(config);
    this.session.set(me.user);
    this.ready.set(true);
  }

  async signUp(name: string, email: string, password: string) {
    const r = await this.req<{ user: UserSession }>('POST', '/auth/signup', { name, email, password });
    this.session.set(r.user);
    return { needsConfirmation: false };
  }
  async signIn(email: string, password: string) {
    const r = await this.req<{ user: UserSession }>('POST', '/auth/login', { email, password });
    this.session.set(r.user);
  }
  async signOut() {
    try { await this.req('POST', '/auth/logout'); } finally { this.session.set(null); }
  }
  async resetPassword(email: string) { await this.req('POST', '/auth/forgot', { email }); }
  async completePasswordReset(token: string, password: string) {
    const r = await this.req<{ user: UserSession }>('POST', '/auth/reset', { token, password });
    this.session.set(r.user);
  }
  async updateProfile(name: string) {
    const r = await this.req<{ user: UserSession }>('PATCH', '/me', { name });
    this.session.set(r.user);
  }
  async changePassword(password: string) { await this.req('POST', '/me/password', { password }); }

  // ---- catalog
  async listProducts(includeUnpublished = false) { return (await this.req<Product[]>('GET', '/products' + (includeUnpublished ? '?all=1' : ''))).map(withCoverArt); }
  /** Generated placeholder art is only for display; it is never stored. */
  async saveProduct(p: Product) { await this.req('PUT', `/admin/products/${encodeURIComponent(p.id)}`, { ...p, gallery: p.gallery.filter((m) => !m.url.startsWith('data:')) }); }
  async setProductFile(productId: string, path: string) { await this.req('PUT', `/admin/products/${encodeURIComponent(productId)}/file`, { path }); }
  listPortfolio(includeUnpublished = false) { return this.req<PortfolioProject[]>('GET', '/portfolio' + (includeUnpublished ? '?all=1' : '')); }
  async savePortfolio(p: PortfolioProject) { await this.req('PUT', `/admin/portfolio/${encodeURIComponent(p.id)}`, p); }
  async deletePortfolio(id: string) { await this.req('DELETE', `/admin/portfolio/${encodeURIComponent(id)}`); }
  listCategories() { return this.req<Category[]>('GET', '/categories'); }
  async saveCategory(c: Category) { await this.req('POST', '/admin/categories', c); }
  async deleteCategory(id: string) { await this.req('DELETE', `/admin/categories/${encodeURIComponent(id)}`); }
  async reorderCategories(ids: string[]) { await this.req('PUT', '/admin/categories-order', { ids }); }

  // ---- uploads
  async uploadAsset(file: File, kind: 'media' | 'file' | 'reference') {
    const fd = new FormData();
    fd.append('file', file, file.name);
    const r = await this.req<{ path: string; url?: string }>('POST', '/uploads' + this.q({ kind }), fd);
    return kind === 'media' ? r.url ?? r.path : r.path;
  }
  async resolveUpload(pathOrUrl: string) {
    if (/^(https?:|data:|\/media\/)/.test(pathOrUrl)) return pathOrUrl;
    return (await this.req<{ url: string }>('GET', '/uploads/sign' + this.q({ path: pathOrUrl }))).url;
  }

  // ---- quote, orders and payments
  quote(items: CartItem[], coupon?: string) { return this.req<Quote>('POST', '/quote', { items: items.map(slim), coupon: coupon || undefined }); }

  async createOrder(input: CheckoutInput): Promise<PaymentSession> {
    // Customization photos live in the browser as small data URLs; upload them first and send only server paths.
    const items: CartItem[] = [];
    for (const it of input.items) {
      if (!it.customization?.photos.some((p) => p.startsWith('data:'))) { items.push(it); continue; }
      const photos: string[] = [];
      for (const [i, p] of it.customization.photos.entries()) {
        if (!p.startsWith('data:')) { photos.push(p); continue; }
        const blob = await (await fetch(p)).blob();
        const ext = blob.type.split('/')[1] ?? 'jpg';
        photos.push(await this.uploadAsset(new File([blob], `photo-${i + 1}.${ext}`, { type: blob.type }), 'reference'));
      }
      items.push({ ...it, customization: { ...it.customization, photos } });
    }
    return this.req<PaymentSession>('POST', '/orders', { ...input, items, coupon: input.coupon || undefined });
  }

  async verifyPayment(session: PaymentSession, payload: Record<string, string>) {
    return this.req<Order>('POST', `/orders/${encodeURIComponent(session.orderId)}/verify`, payload);
  }
  async getOrder(id: string) {
    try { return await this.req<Order>('GET', `/orders/${encodeURIComponent(id)}`); }
    catch (e) { if (e instanceof ApiError && (e.status === 404 || e.status === 401)) return null; throw e; }
  }
  listMyOrders() { return this.session() ? this.req<Order[]>('GET', '/orders') : Promise.resolve([]); }
  listAllOrders() { return this.req<Order[]>('GET', '/admin/orders'); }
  async updateOrderStatus(id: string, status: OrderStatus) { await this.req('PATCH', `/admin/orders/${encodeURIComponent(id)}`, { status }); }
  async updateOrderNote(id: string, note: string) { await this.req('PUT', `/admin/orders/${encodeURIComponent(id)}/note`, { note }); }
  async getDownloadUrl(orderId: string, productId: string) {
    return (await this.req<{ url: string }>('GET', `/orders/${encodeURIComponent(orderId)}/download/${encodeURIComponent(productId)}`)).url;
  }
  async uploadDeliverable(orderId: string, productId: string, file: File) {
    const fd = new FormData();
    fd.append('file', file, file.name);
    await this.req('POST', `/admin/orders/${encodeURIComponent(orderId)}/deliverables/${encodeURIComponent(productId)}`, fd);
  }

  // ---- inquiries, contact, call-backs, newsletter
  async submitInquiry(input: InquiryInput) { return (await this.req<{ id: string }>('POST', '/inquiries', input)).id; }
  listMyInquiries() { return this.session() ? this.req<Inquiry[]>('GET', '/inquiries') : Promise.resolve([]); }
  listAllInquiries() { return this.req<Inquiry[]>('GET', '/admin/inquiries'); }
  async updateInquiryStatus(id: string, status: Inquiry['status']) { await this.req('PATCH', `/admin/inquiries/${encodeURIComponent(id)}`, { status }); }
  async updateInquiryNote(id: string, note: string) { await this.req('PUT', `/admin/inquiries/${encodeURIComponent(id)}/note`, { note }); }
  async submitContact(m: { name: string; email: string; message: string }) { await this.req('POST', '/contact', m); }
  listContacts() { return this.req<ContactMessage[]>('GET', '/admin/contacts'); }
  async updateContactStatus(id: string, status: ContactMessage['status']) { await this.req('PATCH', `/admin/contacts/${encodeURIComponent(id)}`, { status }); }
  async submitCallback(r: { name: string; phone: string; topic: string; preferred: string; note: string }) { await this.req('POST', '/callbacks', r); }
  listCallbacks() { return this.req<CallbackRequest[]>('GET', '/admin/callbacks'); }
  async updateCallback(id: string, patch: { status?: CallbackRequest['status']; adminNote?: string }) { await this.req('PATCH', `/admin/callbacks/${encodeURIComponent(id)}`, patch); }
  async subscribeNewsletter(email: string) { await this.req('POST', '/newsletter', { email, consent: true }); }
  listSubscribers() { return this.req<Subscriber[]>('GET', '/admin/subscribers'); }
  async removeSubscriber(email: string) { await this.req('DELETE', '/admin/subscribers' + this.q({ email })); }

  // ---- reviews
  listReviews(productId?: string) { return this.req<Review[]>('GET', '/reviews' + this.q({ productId })); }
  listAllReviews() { return this.req<Review[]>('GET', '/admin/reviews'); }
  async canReview(productId: string) {
    if (!this.session()) return false;
    return (await this.req<{ canReview: boolean }>('GET', '/reviews/eligibility' + this.q({ productId }))).canReview;
  }
  async submitReview(r: { productId: string; rating: number; body: string; consentToPublish: boolean }) { await this.req('POST', '/reviews', r); }
  async moderateReview(id: string, approved: boolean) { await this.req('PATCH', `/admin/reviews/${encodeURIComponent(id)}`, { approved }); }

  // ---- coupons, customers, settings
  listCoupons() { return this.req<Coupon[]>('GET', '/admin/coupons'); }
  async saveCoupon(c: Coupon) { await this.req('PUT', `/admin/coupons/${encodeURIComponent(c.code.trim().toUpperCase())}`, c); }
  async deleteCoupon(code: string) { await this.req('DELETE', `/admin/coupons/${encodeURIComponent(code)}`); }
  listCustomers() { return this.req<Customer[]>('GET', '/admin/customers'); }
  async setUserRole(id: string, role: 'customer' | 'admin') { await this.req('PUT', `/admin/users/${encodeURIComponent(id)}/role`, { role }); }
  getSettings() { return this.req<SiteSettings>('GET', '/settings'); }
  async saveSettings(s: SiteSettings) { await this.req('PUT', '/admin/settings', s); }

  // ---- favourites and analytics
  async listFavorites() { return this.session() ? this.req<string[]>('GET', '/favorites') : []; }
  async setFavorite(productId: string, on: boolean) {
    if (!this.session()) return;
    await this.req(on ? 'PUT' : 'DELETE', `/favorites/${encodeURIComponent(productId)}`);
  }
  async trackEvent(e: { visitorId: string; type: VisitEvent['type']; path: string; productId?: string }) {
    await this.req('POST', '/events', e, { keepalive: true });
  }
  listEvents() { return this.req<VisitEvent[]>('GET', '/admin/events'); }
}

/** The server only needs ids, quantities and the personalization; it ignores everything else. */
function slim(i: CartItem): CartItem {
  return { key: i.key, productId: i.productId, qty: i.qty };
}

/** A product without photos still needs something to show: draw line art from its colours and motif. */
function withCoverArt(p: Product): Product {
  if (p.gallery.length) return p;
  const gallery = [0, 1].map((variant) => ({ kind: 'image' as const, alt: p.title, url: coverArt({ seed: p.id, title: p.title, palette: p.palette, motif: p.motif, aspect: variant ? 1.25 : p.aspect, variant }) }));
  return { ...p, gallery };
}

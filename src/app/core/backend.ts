import { signal } from '@angular/core';
import { AppConfig, CallbackRequest, Category, Subscriber, VisitEvent, ContactMessage, Coupon, Customer, Review, SiteSettings, CheckoutInput, Inquiry, Order, OrderStatus, PaymentSession, PortfolioProject, Product, Quote, CartItem, UserSession } from './models';

export type InquiryInput = Omit<Inquiry, 'id' | 'createdAt' | 'status'>;

/** Everything the UI needs from the server. The one real implementation is ApiBackend (HTTP to the Node API). */
export abstract class Backend {
  /** Server-provided settings (payment provider, public keys). */
  readonly config = signal<AppConfig>({ paymentProvider: 'razorpay' });
  readonly session = signal<UserSession | null>(null);
  readonly ready = signal(false);

  abstract init(): Promise<void>;
  abstract signUp(name: string, email: string, password: string): Promise<{ needsConfirmation: boolean }>;
  abstract signIn(email: string, password: string): Promise<void>;
  abstract signOut(): Promise<void>;
  abstract resetPassword(email: string): Promise<void>;
  /** Finishes a password reset from the emailed link and signs the user in. */
  abstract completePasswordReset(token: string, password: string): Promise<void>;
  abstract updateProfile(name: string): Promise<void>;
  abstract changePassword(password: string): Promise<void>;

  abstract listProducts(includeUnpublished?: boolean): Promise<Product[]>;
  abstract saveProduct(p: Product): Promise<void>;
  abstract listPortfolio(includeUnpublished?: boolean): Promise<PortfolioProject[]>;
  abstract savePortfolio(p: PortfolioProject): Promise<void>;
  abstract setProductFile(productId: string, path: string): Promise<void>;
  abstract uploadAsset(file: File, kind: 'media' | 'file' | 'reference'): Promise<string>;

  abstract quote(items: CartItem[], coupon?: string): Promise<Quote>;
  abstract createOrder(input: CheckoutInput): Promise<PaymentSession>;
  /** Razorpay: payload = checkout response, verified server-side. Simulator (non-production only): payload = { outcome }. */
  abstract verifyPayment(session: PaymentSession, payload: Record<string, string>): Promise<Order>;
  abstract getOrder(id: string): Promise<Order | null>;
  abstract listMyOrders(): Promise<Order[]>;
  abstract listAllOrders(): Promise<Order[]>;
  abstract updateOrderStatus(id: string, status: OrderStatus): Promise<void>;
  abstract getDownloadUrl(orderId: string, productId: string): Promise<string>;

  abstract submitInquiry(input: InquiryInput): Promise<string>;
  abstract listMyInquiries(): Promise<Inquiry[]>;
  abstract listAllInquiries(): Promise<Inquiry[]>;
  abstract updateInquiryStatus(id: string, status: Inquiry['status']): Promise<void>;

  abstract uploadDeliverable(orderId: string, productId: string, file: File): Promise<void>;
  /** Turns a stored upload path into a viewable URL (admin only for private buckets). */
  abstract resolveUpload(pathOrUrl: string): Promise<string>;

  abstract listReviews(productId?: string): Promise<Review[]>;
  abstract listAllReviews(): Promise<Review[]>;
  abstract canReview(productId: string): Promise<boolean>;
  abstract submitReview(r: { productId: string; rating: number; body: string; consentToPublish: boolean }): Promise<void>;
  abstract moderateReview(id: string, approved: boolean): Promise<void>;

  abstract listCoupons(): Promise<Coupon[]>;
  abstract saveCoupon(c: Coupon): Promise<void>;
  abstract deleteCoupon(code: string): Promise<void>;

  abstract listCustomers(): Promise<Customer[]>;
  abstract getSettings(): Promise<SiteSettings>;
  abstract saveSettings(s: SiteSettings): Promise<void>;
  abstract submitContact(m: { name: string; email: string; message: string }): Promise<void>;
  abstract listContacts(): Promise<ContactMessage[]>;
  abstract updateContactStatus(id: string, status: ContactMessage['status']): Promise<void>;

  /** Records a view. Callers must only call this after the visitor has given consent. */
  abstract trackEvent(e: { visitorId: string; type: VisitEvent['type']; path: string; productId?: string }): Promise<void>;
  abstract listEvents(): Promise<VisitEvent[]>;

  abstract updateOrderNote(id: string, note: string): Promise<void>;
  abstract updateInquiryNote(id: string, note: string): Promise<void>;
  abstract deletePortfolio(id: string): Promise<void>;
  abstract listCategories(): Promise<Category[]>;
  abstract saveCategory(c: Category): Promise<void>;
  abstract deleteCategory(id: string): Promise<void>;
  abstract reorderCategories(ids: string[]): Promise<void>;
  abstract listSubscribers(): Promise<Subscriber[]>;
  abstract removeSubscriber(email: string): Promise<void>;

  abstract submitCallback(r: { name: string; phone: string; topic: string; preferred: string; note: string }): Promise<void>;
  abstract listCallbacks(): Promise<CallbackRequest[]>;
  abstract updateCallback(id: string, patch: { status?: CallbackRequest['status']; adminNote?: string }): Promise<void>;

  abstract subscribeNewsletter(email: string): Promise<void>;
  abstract listFavorites(): Promise<string[]>;
  abstract setFavorite(productId: string, on: boolean): Promise<void>;
}



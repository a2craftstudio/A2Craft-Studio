export type ProductStatus = 'draft' | 'published' | 'archived';
export type CustomizationKind = 'none' | 'text' | 'photo-text' | 'video-request';
export type Motif = 'cake' | 'lamp' | 'floral' | 'hearts' | 'book' | 'frame' | 'story' | 'letter' | 'video' | 'card' | 'rings';

export interface Category {
  id: string;
  name: string;
  motif: Motif;
  blurb: string;
}

export interface MediaItem {
  url: string;
  alt: string;
  kind: 'image' | 'video';
  poster?: string;
}

export interface FaqItem {
  q: string;
  a: string;
}

export interface Product {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  description: string;
  priceInr: number;
  /** Only set when a genuine discount applies. */
  originalPriceInr?: number;
  category: string;
  tags: string[];
  occasion: string;
  style: string;
  formats: string[];
  delivery: string;
  customizable: boolean;
  customizationKind: CustomizationKind;
  /** Visual aspect ratio (height / width) used for masonry variety. */
  aspect: number;
  palette: [string, string];
  motif: Motif;
  gallery: MediaItem[];
  videoUrl?: string;
  license: string;
  faq: FaqItem[];
  status: ProductStatus;
  featured: boolean;
  trending: boolean;
  bestseller: boolean;
  createdAt: string;
}

export interface PortfolioProject {
  id: string;
  title: string;
  category: string;
  story: string;
  palette: [string, string];
  motif: Motif;
  aspect: number;
  videoUrl?: string;
  beforeAfter: boolean;
  published: boolean;
  sortOrder: number;
  image?: string;
}

export interface Customization {
  fields: Record<string, string>;
  paletteId: string;
  fontId: string;
  photos: string[];
  notes: string;
}

export interface CartItem {
  key: string;
  productId: string;
  qty: number;
  customization?: Customization;
}

export interface Quote {
  lines: { key: string; productId: string; title: string; unit: number; qty: number; total: number }[];
  subtotal: number;
  discount: number;
  total: number;
  couponApplied?: string;
  couponMessage?: string;
}

export type OrderStatus = 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded' | 'in_progress' | 'delivered';

export interface Order {
  id: string;
  createdAt: string;
  status: OrderStatus;
  paymentVerified: boolean;
  total: number;
  email: string;
  customerName: string;
  /** Private note for the studio, never shown to the customer. */
  adminNote?: string;
  items: { productId: string; title: string; qty: number; unit: number; customization?: Customization; deliverable?: string }[];
}

export interface Inquiry {
  id: string;
  createdAt: string;
  name: string;
  email: string;
  productType: string;
  occasion: string;
  deadline: string;
  budget: string;
  style: string;
  description: string;
  referenceImages: string[];
  status: 'new' | 'in_progress' | 'quoted' | 'completed' | 'declined';
  /** Private note for the studio, never shown to the customer. */
  adminNote?: string;
}

export interface UserSession {
  id: string;
  email: string;
  name: string;
  role: 'customer' | 'admin';
  superAdmin?: boolean;
}

export interface CheckoutInput {
  items: CartItem[];
  coupon?: string;
  customer: { name: string; email: string; phone: string };
  acceptedTerms: boolean;
}

export interface PaymentSession {
  provider: 'razorpay' | 'simulator';
  orderId: string;
  providerOrderId?: string;
  amountPaise?: number;
  keyId?: string;
}

export interface Review {
  id: string;
  productId: string;
  authorName: string;
  rating: number;
  body: string;
  consentToPublish: boolean;
  approved: boolean;
  createdAt: string;
}

export interface Coupon {
  code: string;
  percent?: number;
  flatInr?: number;
  minSubtotal: number;
  active: boolean;
  /** Last day the coupon works (YYYY-MM-DD, India time). */
  endsAt?: string;
  /** Total number of times it can be used. */
  maxUses?: number;
  used?: number;
}

export interface Customer {
  id: string;
  email: string;
  name: string;
  role: 'customer' | 'admin';
  orders: number;
  spent: number;
  joined: string;
}

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
/** null means closed that day. Times are 24-hour "HH:mm" in India Standard Time. */
export type DayHours = { open: string; close: string } | null;
export type BusinessHours = Record<DayKey, DayHours>;

export interface BusinessInfo {
  legalName: string;
  address: string;
  gstin: string;
  supportEmail: string;
  grievanceOfficer: string;
  grievanceEmail: string;
  jurisdiction: string;
}

export interface FaqGroup { label: string; items: { q: string; a: string }[] }
export interface ContentSection { h: string; p: string[] }

export interface SiteSettings {
  announcement: string;
  whatsapp: string;
  supportEmail: string;
  /** Business details shown in the footer and filled into the policy pages. */
  business?: Partial<BusinessInfo>;
  /** Opening hours for chat, inquiries and calls. The built-in hours are used when absent. */
  hours?: BusinessHours;
  /** Owner-edited FAQ; the built-in FAQ is used when absent. */
  faq?: FaqGroup[];
  /** Owner-edited About page sections; the built-in copy is used when absent. */
  about?: ContentSection[];
}

export interface Subscriber { email: string; createdAt: string }

export interface ContactMessage {
  id: string;
  createdAt: string;
  name: string;
  email: string;
  message: string;
  status: 'new' | 'replied';
}

/** One page or product view, recorded only for visitors who opted in to visit analytics. */
export interface VisitEvent {
  id: string;
  visitorId: string;
  /** Set only when the visitor was signed in at the time. */
  userId?: string;
  userLabel?: string;
  type: 'page' | 'product' | 'like';
  path: string;
  productId?: string;
  at: string;
}

/** A visitor asked to be phoned. Their number is only ever shown to admins. */
export interface CallbackRequest {
  id: string;
  createdAt: string;
  name: string;
  phone: string;
  topic: string;
  preferred: string;
  note: string;
  status: 'new' | 'called' | 'no_answer';
  adminNote?: string;
}

/** Public settings the server tells the app on start. */
export interface AppConfig {
  /** 'simulator' is only ever offered by a non-production server for testing. */
  paymentProvider: 'razorpay' | 'simulator';
  razorpayKeyId?: string;
}

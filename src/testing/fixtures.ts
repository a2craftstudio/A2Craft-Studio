import { Category, Product } from '../app/core/models';

/** Builds a valid Product for tests. Not used by the app. */
export function makeProduct(over: Partial<Product> = {}): Product {
  const id = over.id ?? 'p-' + Math.random().toString(36).slice(2, 8);
  return {
    id, slug: over.slug ?? id, title: 'Test design', tagline: 'A tagline', description: 'Description', priceInr: 499, category: 'cat-a', tags: [], occasion: 'Birthday', style: '',
    formats: ['PDF'], delivery: 'Instant download', customizable: false, customizationKind: 'none', aspect: 1.4, palette: ['#eee', '#999'], motif: 'floral',
    gallery: [{ url: `/media/${id}.jpg`, alt: 'Test design', kind: 'image' }], license: 'Personal use', faq: [], status: 'published', featured: false, trending: false,
    bestseller: false, createdAt: '2026-01-01', ...over,
  };
}

export const makeCategory = (id: string, name = id): Category => ({ id, name, blurb: '', motif: 'floral' });

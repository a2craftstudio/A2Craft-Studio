import { Product } from './models';

export type KindFilter = '' | 'video' | 'design';
export const isVideo = (p: Product) => p.formats.includes('MP4') || p.customizationKind === 'video-request';

export type SortKey = 'relevance' | 'newest' | 'price-asc' | 'price-desc';

export interface Filters {
  q: string;
  category: string;
  occasion: string;
  format: string;
  minPrice: number | null;
  maxPrice: number | null;
  customizable: boolean;
  kind: KindFilter;
  sort: SortKey;
}

export const EMPTY_FILTERS: Filters = { q: '', category: '', occasion: '', format: '', minPrice: null, maxPrice: null, customizable: false, kind: '', sort: 'relevance' };

export function relevance(p: Product, q: string): number {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return 0;
  let score = 0;
  for (const t of terms) {
    const hit =
      (p.title.toLowerCase().includes(t) ? 5 : 0) +
      (p.tags.some((x) => x.toLowerCase().includes(t)) ? 3 : 0) +
      (p.occasion.toLowerCase().includes(t) ? 3 : 0) +
      (p.style.toLowerCase().includes(t) ? 2 : 0) +
      (p.category.replace(/-/g, ' ').includes(t) ? 2 : 0) +
      (p.description.toLowerCase().includes(t) ? 1 : 0);
    if (!hit) return 0; // every term must match something
    score += hit;
  }
  return score;
}

export function applyFilters(products: Product[], f: Filters): Product[] {
  let out = products.filter((p) => {
    if (f.category && p.category !== f.category) return false;
    if (f.occasion && p.occasion !== f.occasion) return false;
    if (f.format && !p.formats.includes(f.format)) return false;
    if (f.minPrice != null && p.priceInr < f.minPrice) return false;
    if (f.maxPrice != null && p.priceInr > f.maxPrice) return false;
    if (f.customizable && !p.customizable) return false;
    if (f.kind === 'video' && !isVideo(p)) return false;
    if (f.kind === 'design' && isVideo(p)) return false;
    return true;
  });
  const scored = out.map((p) => ({ p, s: relevance(p, f.q) }));
  if (f.q.trim()) out = scored.filter((x) => x.s > 0).map((x) => x.p);
  const score = new Map(scored.map((x) => [x.p.id, x.s]));
  switch (f.sort) {
    case 'newest': return [...out].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    case 'price-asc': return [...out].sort((a, b) => a.priceInr - b.priceInr);
    case 'price-desc': return [...out].sort((a, b) => b.priceInr - a.priceInr);
    default:
      return [...out].sort((a, b) => (score.get(b.id)! - score.get(a.id)!) || Number(b.trending) - Number(a.trending) || b.createdAt.localeCompare(a.createdAt));
  }
}

export function suggest(products: Product[], q: string, limit = 6): string[] {
  const t = q.trim().toLowerCase();
  if (t.length < 2) return [];
  const pool = new Set<string>();
  for (const p of products) {
    if (p.title.toLowerCase().includes(t)) pool.add(p.title);
    p.tags.filter((x) => x.toLowerCase().startsWith(t)).forEach((x) => pool.add(x));
  }
  return [...pool].slice(0, limit);
}

export function discountPercent(p: Product): number {
  return p.originalPriceInr && p.originalPriceInr > p.priceInr ? Math.round((1 - p.priceInr / p.originalPriceInr) * 100) : 0;
}

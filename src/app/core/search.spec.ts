import { applyFilters, discountPercent, EMPTY_FILTERS, isVideo, relevance, suggest } from './search';
import { makeProduct } from '../../testing/fixtures';

const P = [
  makeProduct({ id: 'wed', title: 'Elegant Wedding Invitation', category: 'wedding', occasion: 'Wedding', tags: ['wedding', 'invitation', 'printable'], priceInr: 899, customizable: true, trending: true, createdAt: '2026-09-25' }),
  makeProduct({ id: 'card', title: 'Pink Floral Birthday Card', category: 'cards', occasion: 'Birthday', tags: ['card', 'birthday', 'floral'], priceInr: 149, customizable: true, createdAt: '2026-10-05' }),
  makeProduct({ id: 'story', title: 'Instagram Story Bundle', category: 'social', occasion: 'Any', tags: ['instagram', 'story'], priceInr: 399, formats: ['PNG', 'ZIP'], createdAt: '2026-08-10' }),
  makeProduct({ id: 'vid', title: 'Animated Birthday Invitation', category: 'video', occasion: 'Birthday', tags: ['video', 'birthday'], priceInr: 799, formats: ['MP4'], customizationKind: 'video-request', customizable: true, createdAt: '2026-09-18' }),
];
const f = (p: Partial<typeof EMPTY_FILTERS>) => ({ ...EMPTY_FILTERS, ...p });

describe('search', () => {
  it('requires every search term to match', () => {
    expect(relevance(P[1], 'birthday card')).toBeGreaterThan(0);
    expect(relevance(P[1], 'birthday zebra')).toBe(0);
  });

  it('filters by query across title, tags and occasion', () => {
    expect(applyFilters(P, f({ q: 'wedding' })).map((p) => p.id)).toEqual(['wed']);
    expect(applyFilters(P, f({ q: 'birthday' })).map((p) => p.id).sort()).toEqual(['card', 'vid']);
  });

  it('combines category, price and customizable filters', () => {
    expect(applyFilters(P, f({ category: 'cards', maxPrice: 200, customizable: true })).map((p) => p.id)).toEqual(['card']);
    expect(applyFilters(P, f({ minPrice: 500 })).map((p) => p.id).sort()).toEqual(['vid', 'wed']);
  });

  it('filters by occasion and format', () => {
    expect(applyFilters(P, f({ occasion: 'Birthday' })).length).toBe(2);
    expect(applyFilters(P, f({ format: 'ZIP' })).map((p) => p.id)).toEqual(['story']);
  });

  it('sorts by price ascending and descending, and by newest', () => {
    expect(applyFilters(P, f({ sort: 'price-asc' })).map((p) => p.priceInr)).toEqual([149, 399, 799, 899]);
    expect(applyFilters(P, f({ sort: 'price-desc' })).map((p) => p.priceInr)).toEqual([899, 799, 399, 149]);
    expect(applyFilters(P, f({ sort: 'newest' }))[0].id).toBe('card');
  });

  it('separates videos from cards and designs', () => {
    const v = applyFilters(P, f({ kind: 'video' }));
    const d = applyFilters(P, f({ kind: 'design' }));
    expect(v.map((p) => p.id)).toEqual(['vid']);
    expect(d.some(isVideo)).toBeFalse();
    expect(v.length + d.length).toBe(P.length);
  });

  it('returns an empty list when nothing matches, and for an empty catalog', () => {
    expect(applyFilters(P, f({ q: 'xyzzy' }))).toEqual([]);
    expect(applyFilters([], f({}))).toEqual([]);
  });

  it('suggests titles and tags', () => {
    expect(suggest(P, 'wed')).toContain('Elegant Wedding Invitation');
    expect(suggest(P, 'w')).toEqual([]);
  });

  it('only reports a discount when the original price is higher', () => {
    expect(discountPercent(makeProduct({ priceInr: 500, originalPriceInr: 1000 }))).toBe(50);
    expect(discountPercent(makeProduct({ priceInr: 500 }))).toBe(0);
    expect(discountPercent(makeProduct({ priceInr: 500, originalPriceInr: 400 }))).toBe(0);
  });
});

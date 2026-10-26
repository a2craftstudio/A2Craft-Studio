import { TestBed } from '@angular/core/testing';
import { Backend } from './backend';
import { AuthService, CatalogService, FavoritesService, SettingsService } from './services';
import { makeCategory, makeProduct } from '../../testing/fixtures';
import { TestBackend } from '../../testing/test-backend';

const setup = () => {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [{ provide: Backend, useClass: TestBackend }] });
  return TestBed.inject(Backend) as TestBackend;
};
const settle = () => new Promise((r) => setTimeout(r, 20));

describe('CatalogService (live data only)', () => {
  beforeEach(() => localStorage.clear());

  it('starts empty and fills from the API: no built-in products or categories', async () => {
    const backend = setup().on('listProducts', async () => [makeProduct({ id: 'a', slug: 'a', category: 'c1' })]).on('listCategories', async () => [makeCategory('c1', 'Cards')]);
    const catalog = TestBed.inject(CatalogService);
    expect(catalog.products()).toEqual([]);
    expect(catalog.categories()).toEqual([]);
    await catalog.load();
    expect(catalog.products().length).toBe(1);
    expect(catalog.categoryName('c1')).toBe('Cards');
    expect(backend.called('listCategories').length).toBe(1);
  });

  it('shows an empty shop as empty (not an error) and reports real failures', async () => {
    setup();
    const catalog = TestBed.inject(CatalogService);
    await catalog.load();
    expect(catalog.products()).toEqual([]);
    expect(catalog.error()).toBeNull();

    const failing = setup().on('listProducts', async () => { throw new Error('Server is down'); });
    void failing;
    const c2 = TestBed.inject(CatalogService);
    await c2.load();
    expect(c2.error()).toBe('Server is down');
  });

  it('finds related products by shared category, tags and occasion', async () => {
    setup().on('listProducts', async () => [
      makeProduct({ id: 'a', slug: 'a', category: 'x', tags: ['floral'] }), makeProduct({ id: 'b', slug: 'b', category: 'x' }),
      makeProduct({ id: 'c', slug: 'c', category: 'y', tags: ['floral'], occasion: 'Wedding' }), makeProduct({ id: 'd', slug: 'd', category: 'z', occasion: 'Wedding' }),
    ]);
    const catalog = TestBed.inject(CatalogService);
    await catalog.load();
    expect(catalog.related(catalog.byId('a')!).map((p) => p.id)).toEqual(['b', 'c']);
  });
});

describe('FavoritesService', () => {
  beforeEach(() => localStorage.clear());

  it('keeps a visitor’s favourites on the device and never calls the server', async () => {
    const backend = setup();
    const fav = TestBed.inject(FavoritesService);
    await settle();
    await fav.toggle('p1');
    expect(fav.has('p1')).toBeTrue();
    expect(JSON.parse(localStorage.getItem('a2.favs')!)).toEqual(['p1']);
    expect(backend.called('setFavorite')).toEqual([]);
    await fav.toggle('p1');
    expect(fav.has('p1')).toBeFalse();
  });

  it('merges device favourites into the account on sign-in, then clears the local copy', async () => {
    localStorage.setItem('a2.favs', '["local"]');
    const backend = setup().on('listFavorites', async () => ['server']);
    const fav = TestBed.inject(FavoritesService);
    await settle();
    expect(fav.ids()).toEqual(['local']);
    backend.signedInAs({ email: 'a@b.co' });
    TestBed.flushEffects();
    await settle();
    expect(fav.ids().sort()).toEqual(['local', 'server']);
    expect(backend.called('setFavorite').map((c) => c.args)).toEqual([['local', true]]);
    expect(JSON.parse(localStorage.getItem('a2.favs')!)).toEqual([]);
  });

  it('saves to the account when signed in, and rolls back if the server refuses', async () => {
    const backend = setup().on('listFavorites', async () => []);
    backend.signedInAs({ email: 'a@b.co' });
    const fav = TestBed.inject(FavoritesService);
    TestBed.flushEffects();
    await settle();
    await fav.toggle('p1');
    expect(backend.called('setFavorite').at(-1)!.args).toEqual(['p1', true]);
    backend.on('setFavorite', async () => { throw new Error('nope'); });
    await fav.toggle('p2');
    expect(fav.has('p2')).toBeFalse();
  });
});

describe('SettingsService', () => {
  beforeEach(() => localStorage.clear());

  it('uses the owner’s business details and falls back to placeholders for blanks', async () => {
    setup().on('getSettings', async () => ({ announcement: '', whatsapp: '', supportEmail: '', business: { legalName: 'Rose & Co', gstin: '' } }));
    const s = TestBed.inject(SettingsService);
    await s.load();
    expect(s.business().legalName).toBe('Rose & Co');
    expect(s.business().gstin.startsWith('[')).toBeTrue();
    expect(s.businessIncomplete()).toBeTrue();
  });

  it('is complete once every detail is filled in', async () => {
    setup().on('getSettings', async () => ({
      announcement: '', whatsapp: '', supportEmail: 'hi@rose.example',
      business: { legalName: 'Rose & Co', gstin: 'Not registered', address: '1 Lane, Pune', supportEmail: 'hi@rose.example', grievanceOfficer: 'Asha', grievanceEmail: 'g@rose.example', jurisdiction: 'Pune' },
    }));
    const s = TestBed.inject(SettingsService);
    await s.load();
    expect(s.businessIncomplete()).toBeFalse();
  });

  it('uses the default opening hours until the owner sets their own, then their own', async () => {
    setup().on('getSettings', async () => ({ announcement: '', whatsapp: '', supportEmail: '' }));
    const s = TestBed.inject(SettingsService);
    await s.load();
    expect(s.hoursSummary()).toBe('Mon–Sat 4 pm – 11 pm · Sun 10 am – 12 pm');
    const custom = { mon: { open: '09:00', close: '17:00' }, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null };
    (TestBed.inject(Backend) as TestBackend).on('getSettings', async () => ({ announcement: '', whatsapp: '', supportEmail: '', hours: custom }));
    await s.load();
    expect(s.hoursSummary()).toBe('Mon 9 am – 5 pm · Tue–Sun Closed');
  });

  it('exposes the owner’s FAQ and About only when they have edited them', async () => {
    setup().on('getSettings', async () => ({ announcement: '', whatsapp: '', supportEmail: '' }));
    const s = TestBed.inject(SettingsService);
    await s.load();
    expect(s.faq()).toBeUndefined();
    expect(s.about()).toBeUndefined();
    (TestBed.inject(Backend) as TestBackend).on('getSettings', async () => ({ announcement: '', whatsapp: '', supportEmail: '', faq: [{ label: 'G', items: [{ q: 'Q', a: 'A' }] }], about: [{ h: 'H', p: ['P'] }] }));
    await s.load();
    expect(s.faq()?.[0].label).toBe('G');
    expect(s.about()?.[0].h).toBe('H');
  });
});

describe('AuthService', () => {
  it('reflects the backend session and the admin role', () => {
    const backend = setup();
    const auth = TestBed.inject(AuthService);
    expect(auth.loggedIn()).toBeFalse();
    backend.signedInAs({ email: 'a@b.co', role: 'customer' });
    expect(auth.loggedIn()).toBeTrue();
    expect(auth.isAdmin()).toBeFalse();
    backend.signedInAs({ email: 'a@b.co', role: 'admin' });
    expect(auth.isAdmin()).toBeTrue();
  });
});

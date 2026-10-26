import { TestBed } from '@angular/core/testing';
import { Backend } from './backend';
import { AnalyticsService, ConsentService } from './services';
import { TestBackend } from '../../testing/test-backend';

describe('Visit analytics (client side)', () => {
  let backend: TestBackend;
  let analytics: AnalyticsService;
  let consent: ConsentService;

  const setup = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: Backend, useClass: TestBackend }] });
    backend = TestBed.inject(Backend) as TestBackend;
    analytics = TestBed.inject(AnalyticsService);
    consent = TestBed.inject(ConsentService);
  };
  const sent = () => backend.called('trackEvent').map((c) => c.args[0] as { visitorId: string; type: string; path: string });

  beforeEach(() => { localStorage.clear(); setup(); });

  it('sends nothing until the visitor opts in', () => {
    expect(consent.choice()).toBeNull();
    expect(consent.asking()).toBeTrue();
    analytics.track('page', '/shop');
    expect(sent()).toEqual([]);
  });

  it('sends nothing after the visitor declines, and forgets the anonymous id', () => {
    consent.set('granted');
    analytics.track('page', '/shop');
    consent.set('denied');
    expect(localStorage.getItem('a2.vid')).toBeNull();
    analytics.track('page', '/faq');
    expect(sent().map((e) => e.path)).toEqual(['/shop']);
  });

  it('sends page and design views with one stable anonymous id once allowed', () => {
    consent.set('granted');
    analytics.track('page', '/product/x');
    analytics.track('product', '/product/x', 'x');
    expect(sent().length).toBe(2);
    expect(new Set(sent().map((e) => e.visitorId)).size).toBe(1);
  });

  it('never sends checkout, order or admin pages, or anything for an admin', () => {
    consent.set('granted');
    for (const p of ['/checkout', '/order/abc', '/admin']) analytics.track('page', p);
    expect(sent()).toEqual([]);
    backend.signedInAs({ email: 'a@b.co', role: 'admin' });
    analytics.track('page', '/shop');
    expect(sent()).toEqual([]);
  });

  it('collapses rapid repeats of the same view', () => {
    consent.set('granted');
    analytics.track('page', '/shop');
    analytics.track('page', '/shop');
    expect(sent().length).toBe(1);
  });

  it('survives the server failing: analytics never break the page', () => {
    backend.on('trackEvent', async () => { throw new Error('down'); });
    consent.set('granted');
    expect(() => analytics.track('page', '/shop')).not.toThrow();
  });
});

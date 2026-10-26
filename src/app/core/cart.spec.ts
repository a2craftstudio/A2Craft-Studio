import { TestBed } from '@angular/core/testing';
import { Backend } from './backend';
import { CartService } from './services';
import { TestBackend } from '../../testing/test-backend';

describe('CartService', () => {
  let backend: TestBackend;
  let cart: CartService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [{ provide: Backend, useClass: TestBackend }] });
    backend = TestBed.inject(Backend) as TestBackend;
    cart = TestBed.inject(CartService);
  });

  it('merges identical non-customized items and caps quantity at 10', () => {
    cart.add('a'); cart.add('a');
    expect(cart.items().length).toBe(1);
    expect(cart.count()).toBe(2);
    cart.setQty('a', 50);
    expect(cart.items()[0].qty).toBe(10);
    cart.setQty('a', 0);
    expect(cart.items()[0].qty).toBe(1);
  });

  it('keeps customized items as separate lines', async () => {
    const c = { fields: { name: 'A' }, paletteId: 'blush', fontId: 'sans', photos: [], notes: '' };
    cart.add('wedding', c);
    await new Promise((r) => setTimeout(r, 2));
    cart.add('wedding', { ...c, fields: { name: 'B' } });
    expect(cart.items().length).toBe(2);
  });

  it('persists to the browser so a refresh keeps the bag', () => {
    cart.add('a');
    TestBed.flushEffects();
    expect(JSON.parse(localStorage.getItem('a2.cart')!)[0].productId).toBe('a');
  });

  it('asks the server for the quote (debounced) with the items and coupon, and never prices anything itself', async () => {
    backend.on('quote', async () => ({ lines: [], subtotal: 100, discount: 10, total: 90, couponApplied: 'TEN' }));
    cart.add('a');
    cart.coupon.set('TEN');
    TestBed.flushEffects();
    await new Promise((r) => setTimeout(r, 400));
    const calls = backend.called('quote');
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.at(-1)!.args[1]).toBe('TEN');
    expect(cart.quote()?.total).toBe(90);
  });

  it('removes items and clears the coupon with the bag', () => {
    cart.add('a');
    cart.coupon.set('X');
    cart.remove('a');
    expect(cart.count()).toBe(0);
    cart.clear();
    expect(cart.coupon()).toBe('');
  });
});

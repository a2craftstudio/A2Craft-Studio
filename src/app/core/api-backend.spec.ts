import { TestBed } from '@angular/core/testing';
import { ApiBackend, ApiError } from './api-backend';

type Call = { url: string; init: RequestInit };

describe('ApiBackend (HTTP client)', () => {
  let api: ApiBackend;
  let calls: Call[];
  let responder: (url: string, init: RequestInit) => Response | Promise<Response>;

  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const last = () => calls[calls.length - 1];
  const body = (c: Call) => JSON.parse(String(c.init.body));

  beforeEach(() => {
    calls = [];
    responder = () => json({});
    spyOn(window, 'fetch').and.callFake(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = String(input);
      calls.push({ url, init });
      return responder(url, init);
    });
    TestBed.configureTestingModule({ providers: [ApiBackend] });
    api = TestBed.inject(ApiBackend);
  });

  it('starts by reading the server config and the current session (cookie, same origin)', async () => {
    responder = (url) => (url.endsWith('/config') ? json({ paymentProvider: 'simulator' }) : json({ user: { id: 'u1', email: 'a@b.co', name: 'A', role: 'admin' } }));
    await api.init();
    expect(api.config().paymentProvider).toBe('simulator');
    expect(api.session()?.role).toBe('admin');
    expect(api.ready()).toBeTrue();
    expect(calls.every((c) => c.init.credentials === 'same-origin')).toBeTrue();
  });

  it('still becomes ready when the server is unreachable', async () => {
    responder = () => { throw new TypeError('Failed to fetch'); };
    await api.init();
    expect(api.ready()).toBeTrue();
    expect(api.session()).toBeNull();
  });

  it('turns server errors into messages the UI can show, keeping the status', async () => {
    responder = () => json({ error: 'Incorrect email or password.' }, 401);
    await expectAsync(api.signIn('a@b.co', 'x')).toBeRejectedWithError('Incorrect email or password.');
    try { await api.signIn('a@b.co', 'x'); } catch (e) { expect((e as ApiError).status).toBe(401); }
  });

  it('gives a friendly message on network failure and a generic one for unexpected bodies', async () => {
    responder = () => { throw new TypeError('Failed to fetch'); };
    await expectAsync(api.listProducts()).toBeRejectedWithError(/couldn’t reach the server/);
    responder = () => new Response('<html>oops</html>', { status: 502 });
    await expectAsync(api.listProducts()).toBeRejectedWithError(/Something went wrong \(502\)/);
  });

  it('signs in and out by updating the session from the server’s answer', async () => {
    responder = () => json({ user: { id: 'u1', email: 'a@b.co', name: 'A', role: 'customer' } });
    await api.signIn('a@b.co', 'password123');
    expect(last().url).toBe('/api/auth/login');
    expect(body(last())).toEqual({ email: 'a@b.co', password: 'password123' });
    expect(api.session()?.email).toBe('a@b.co');
    responder = () => new Response(null, { status: 204 });
    await api.signOut();
    expect(api.session()).toBeNull();
  });

  it('even clears the local session if the logout request fails', async () => {
    api.session.set({ id: 'u', email: 'a@b.co', name: '', role: 'customer' });
    responder = () => { throw new TypeError('Failed to fetch'); };
    await expectAsync(api.signOut()).toBeRejected();
    expect(api.session()).toBeNull();
  });

  it('asks for drafts only when told to', async () => {
    responder = () => json([]);
    await api.listProducts();
    expect(last().url).toBe('/api/products');
    await api.listProducts(true);
    expect(last().url).toBe('/api/products?all=1');
  });

  it('draws placeholder art for products without photos, and never sends it back to the server', async () => {
    const bare = { id: 'p1', title: 'Card', palette: ['#f5e1da', '#c2185b'], motif: 'cards', aspect: 1.3, gallery: [] };
    const photo = { ...bare, id: 'p2', gallery: [{ url: '/media/a.jpg', alt: 'a', kind: 'image' }] };
    responder = () => json([bare, photo]);
    const [a, b] = await api.listProducts();
    expect(a.gallery.length).toBe(2);
    expect(a.gallery.every((m) => m.url.startsWith('data:image/svg+xml'))).toBeTrue();
    expect(b.gallery.map((m) => m.url)).toEqual(['/media/a.jpg']);
    responder = () => new Response(null, { status: 204 });
    await api.saveProduct(a);
    expect(body(last()).gallery).toEqual([]);
  });

  it('quotes using only ids and quantities, never prices or personal data', async () => {
    responder = () => json({ lines: [], subtotal: 0, discount: 0, total: 0 });
    await api.quote([{ key: 'k', productId: 'p1', qty: 2, customization: { fields: { name: 'Private' }, paletteId: 'x', fontId: 'y', photos: [], notes: '' } }], 'TEN');
    expect(body(last())).toEqual({ items: [{ key: 'k', productId: 'p1', qty: 2 }], coupon: 'TEN' });
  });

  it('uploads customization photos first and sends only server paths when creating an order', async () => {
    const dataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBD';
    responder = (url) => (url.includes('/uploads') ? json({ path: 'private/abc-photo-1.jpeg' }) : json({ provider: 'simulator', orderId: 'o1' }));
    const s = await api.createOrder({
      items: [{ key: 'k', productId: 'p1', qty: 1, customization: { fields: { name: 'A' }, paletteId: 'x', fontId: 'y', photos: [dataUrl], notes: '' } }],
      customer: { name: 'A', email: 'a@b.co', phone: '9876543210' }, acceptedTerms: true,
    });
    expect(s.orderId).toBe('o1');
    const upload = calls.find((c) => c.url.startsWith('/api/uploads'))!;
    expect(upload.url).toBe('/api/uploads?kind=reference');
    expect(upload.init.body instanceof FormData).toBeTrue();
    expect((upload.init.headers as Record<string, string>)['Content-Type']).toBeUndefined(); // the browser sets the multipart boundary
    const order = calls.find((c) => c.url === '/api/orders')!;
    expect(body(order).items[0].customization.photos).toEqual(['private/abc-photo-1.jpeg']);
    expect(JSON.stringify(body(order))).not.toContain('data:image');
  });

  it('returns null for an order that is missing or not yours, but surfaces other errors', async () => {
    responder = () => json({ error: 'Order not found.' }, 404);
    expect(await api.getOrder('x')).toBeNull();
    responder = () => json({ error: 'boom' }, 500);
    await expectAsync(api.getOrder('x')).toBeRejectedWithError('boom');
  });

  it('does not call the server for account lists when signed out', async () => {
    expect(await api.listMyOrders()).toEqual([]);
    expect(await api.listMyInquiries()).toEqual([]);
    expect(await api.listFavorites()).toEqual([]);
    expect(await api.canReview('p1')).toBeFalse();
    await api.setFavorite('p1', true);
    expect(calls.length).toBe(0);
  });

  it('turns private upload paths into signed links, and leaves public ones alone', async () => {
    responder = () => json({ url: '/files/x?e=1&s=2' });
    expect(await api.resolveUpload('private/abc.jpg')).toBe('/files/x?e=1&s=2');
    expect(last().url).toBe('/api/uploads/sign?path=private%2Fabc.jpg');
    calls.length = 0;
    expect(await api.resolveUpload('/media/a.jpg')).toBe('/media/a.jpg');
    expect(await api.resolveUpload('https://example.com/a.jpg')).toBe('https://example.com/a.jpg');
    expect(calls.length).toBe(0);
  });

  it('returns the public URL for media uploads and the private path for everything else', async () => {
    responder = () => json({ path: 'public/x.jpg', url: '/media/x.jpg' });
    expect(await api.uploadAsset(new File(['x'], 'x.jpg'), 'media')).toBe('/media/x.jpg');
    responder = () => json({ path: 'private/y.pdf' });
    expect(await api.uploadAsset(new File(['x'], 'y.pdf'), 'file')).toBe('private/y.pdf');
  });

  it('puts ids in the path safely encoded and sends the right verbs for admin actions', async () => {
    responder = () => new Response(null, { status: 204 });
    await api.deleteCoupon('A/B');
    expect(last().url).toBe('/api/admin/coupons/A%2FB');
    expect(last().init.method).toBe('DELETE');
    await api.removeSubscriber('a+b@example.com');
    expect(last().url).toBe('/api/admin/subscribers?email=a%2Bb%40example.com');
    await api.updateOrderStatus('o1', 'delivered');
    expect(last().init.method).toBe('PATCH');
    expect(body(last())).toEqual({ status: 'delivered' });
  });

  it('records visits without waiting for the response (keepalive)', async () => {
    responder = () => new Response(null, { status: 204 });
    await api.trackEvent({ visitorId: 'v-1', type: 'page', path: '/shop' });
    expect(last().url).toBe('/api/events');
    expect(last().init.keepalive).toBeTrue();
  });
});

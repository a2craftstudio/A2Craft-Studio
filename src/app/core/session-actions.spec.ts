import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Backend } from './backend';
import { AuthService, CartService, RecentlyViewedService, SessionActions } from './services';
import { TestBackend } from '../../testing/test-backend';

describe('SessionActions', () => {
  let actions: SessionActions;
  let backend: TestBackend;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: '**', children: [] }]), { provide: Backend, useClass: TestBackend }] });
    backend = TestBed.inject(Backend) as TestBackend;
    actions = TestBed.inject(SessionActions);
  });

  it('logout signs out on the server and goes to the home page', async () => {
    backend.signedInAs({ email: 'a@b.co' });
    await TestBed.inject(Router).navigateByUrl('/account');
    await actions.logout();
    expect(backend.called('signOut').length).toBe(1);
    expect(TestBed.inject(AuthService).loggedIn()).toBeFalse();
    expect(TestBed.inject(Router).url).toBe('/');
  });

  it('logout keeps the bag so a visitor can carry on shopping', async () => {
    TestBed.inject(CartService).add('a');
    await actions.logout();
    expect(TestBed.inject(CartService).count()).toBe(1);
  });

  it('log out and clear forgets bag, history, favourites, drafts, checkout details and visitor id, but keeps cookie choices', async () => {
    TestBed.inject(CartService).add('a');
    TestBed.inject(RecentlyViewedService).add('b');
    localStorage.setItem('a2.draft.x', '{}');
    localStorage.setItem('a2.favs', '["z"]');
    localStorage.setItem('a2.vid', 'v-abc');
    localStorage.setItem('a2.consent', 'denied');
    localStorage.setItem('a2.welcomed', '1');
    sessionStorage.setItem('a2.checkout', '{}');
    backend.signedInAs({ email: 'shared@example.com' });
    await actions.logoutAndClear();
    expect(TestBed.inject(AuthService).loggedIn()).toBeFalse();
    expect(TestBed.inject(CartService).count()).toBe(0);
    expect(TestBed.inject(RecentlyViewedService).ids()).toEqual([]);
    for (const k of ['a2.draft.x', 'a2.favs', 'a2.vid']) expect(localStorage.getItem(k)).withContext(k).toBeNull();
    expect(sessionStorage.getItem('a2.checkout')).toBeNull();
    expect(localStorage.getItem('a2.consent')).toBe('denied');
    expect(localStorage.getItem('a2.welcomed')).toBe('1');
  });

  it('clear device only leaves the visitor signed in', () => {
    backend.signedInAs({ email: 'a@b.co' });
    TestBed.inject(RecentlyViewedService).add('a');
    actions.clearDevice();
    expect(TestBed.inject(AuthService).loggedIn()).toBeTrue();
    expect(TestBed.inject(RecentlyViewedService).ids()).toEqual([]);
  });
});

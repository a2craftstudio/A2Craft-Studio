import { TestBed } from '@angular/core/testing';
import { Backend } from './backend';
import { RecentlyViewedService } from './services';
import { TestBackend } from '../../testing/test-backend';

describe('RecentlyViewedService', () => {
  const make = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: Backend, useClass: TestBackend }] });
    return TestBed.inject(RecentlyViewedService);
  };
  beforeEach(() => localStorage.clear());

  it('keeps the newest first without duplicates', () => {
    const r = make();
    r.add('a'); r.add('b'); r.add('a');
    expect(r.ids()).toEqual(['a', 'b']);
  });

  it('keeps at most 12 and persists to storage', () => {
    const r = make();
    for (let i = 0; i < 20; i++) r.add('p' + i);
    expect(r.ids().length).toBe(12);
    expect(JSON.parse(localStorage.getItem('a2.recent')!)[0]).toBe('p19');
  });

  it('can remove one item or clear all', () => {
    const r = make();
    r.add('a'); r.add('b'); r.remove('a');
    expect(r.ids()).toEqual(['b']);
    r.clear();
    expect(r.ids()).toEqual([]);
  });

  it('ignores corrupt stored data', () => {
    localStorage.setItem('a2.recent', '{not json');
    expect(make().ids()).toEqual([]);
  });
});

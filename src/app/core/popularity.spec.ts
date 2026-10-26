import { VisitEvent } from './models';
import { dailySeries, rankDesigns, sortBy } from './popularity';

const NOW = Date.UTC(2026, 9, 26, 12);
const ev = (type: VisitEvent['type'], productId: string | undefined, visitorId: string, daysAgo = 0): VisitEvent => ({
  id: Math.random().toString(36), type, path: '/x', productId, visitorId, at: new Date(NOW - daysAgo * 86400000).toISOString(),
});

describe('popularity', () => {
  const events = [
    ev('product', 'a', 'v1'), ev('product', 'a', 'v2'), ev('product', 'a', 'v1'), ev('like', 'a', 'v1'),
    ev('product', 'b', 'v1'), ev('like', 'b', 'v1'), ev('like', 'b', 'v2'), ev('like', 'b', 'v3'),
    ev('page', undefined, 'v1'), ev('product', 'c', 'v9', 20),
  ];
  const since = NOW - 7 * 86400000;

  it('counts views and likes separately per design, with unique visitors', () => {
    const a = rankDesigns(events, since).find((r) => r.id === 'a')!;
    expect(a).toEqual({ id: 'a', views: 3, likes: 1, visitors: 2 });
  });

  it('ignores plain page events and events outside the period', () => {
    const ids = rankDesigns(events, since).map((r) => r.id).sort();
    expect(ids).toEqual(['a', 'b']);
    expect(rankDesigns(events, NOW - 30 * 86400000).map((r) => r.id)).toContain('c');
  });

  it('ranks by likes or by views', () => {
    const r = rankDesigns(events, since);
    expect(sortBy(r, 'likes')[0].id).toBe('b');
    expect(sortBy(r, 'views')[0].id).toBe('a');
  });

  it('builds a daily series, oldest first, with zero days included', () => {
    const s = dailySeries(events, 14, NOW);
    expect(s.length).toBe(14);
    expect(s[13].day).toBe('2026-10-26');
    expect(s[13]).toEqual({ day: '2026-10-26', views: 4, likes: 4 });
    expect(s[12]).toEqual({ day: '2026-10-25', views: 0, likes: 0 });
    expect(s.map((d) => d.day)).toEqual([...s.map((d) => d.day)].sort());
  });
});

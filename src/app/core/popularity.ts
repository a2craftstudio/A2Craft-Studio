import { VisitEvent } from './models';

export interface DesignStat { id: string; views: number; likes: number; visitors: number }
export interface DayStat { day: string; views: number; likes: number }

/** Ranks designs from opted-in visit events. Likes = saves; views = design page views. */
export function rankDesigns(events: VisitEvent[], sinceMs: number): DesignStat[] {
  const m = new Map<string, { id: string; views: number; likes: number; v: Set<string> }>();
  for (const e of events) {
    if (!e.productId || (e.type !== 'product' && e.type !== 'like') || new Date(e.at).getTime() < sinceMs) continue;
    const r = m.get(e.productId) ?? { id: e.productId, views: 0, likes: 0, v: new Set<string>() };
    if (e.type === 'like') r.likes++; else r.views++;
    r.v.add(e.visitorId);
    m.set(e.productId, r);
  }
  return [...m.values()].map((r) => ({ id: r.id, views: r.views, likes: r.likes, visitors: r.v.size }));
}

export const sortBy = (list: DesignStat[], metric: 'likes' | 'views') =>
  [...list].sort((a, b) => b[metric] - a[metric] || b.views - a.views || b.likes - a.likes);

/** One entry per day for the last `days` days, oldest first (UTC dates). */
export function dailySeries(events: VisitEvent[], days: number, now = Date.now()): DayStat[] {
  const out: DayStat[] = [];
  for (let i = days - 1; i >= 0; i--) out.push({ day: new Date(now - i * 86400000).toISOString().slice(0, 10), views: 0, likes: 0 });
  const idx = new Map(out.map((d, i) => [d.day, i]));
  for (const e of events) {
    const i = idx.get(e.at.slice(0, 10));
    if (i === undefined) continue;
    if (e.type === 'like') out[i].likes++;
    else if (e.type === 'product') out[i].views++;
  }
  return out;
}

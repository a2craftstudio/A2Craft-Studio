import { BusinessHours, DayKey, DayHours } from './models';

export const DAYS: { key: DayKey; short: string; long: string }[] = [
  { key: 'mon', short: 'Mon', long: 'Monday' }, { key: 'tue', short: 'Tue', long: 'Tuesday' }, { key: 'wed', short: 'Wed', long: 'Wednesday' },
  { key: 'thu', short: 'Thu', long: 'Thursday' }, { key: 'fri', short: 'Fri', long: 'Friday' }, { key: 'sat', short: 'Sat', long: 'Saturday' }, { key: 'sun', short: 'Sun', long: 'Sunday' },
];

/** Studio hours for chat, inquiries and calls. All times are India Standard Time. */
export const DEFAULT_HOURS: BusinessHours = {
  mon: { open: '16:00', close: '23:00' }, tue: { open: '16:00', close: '23:00' }, wed: { open: '16:00', close: '23:00' },
  thu: { open: '16:00', close: '23:00' }, fri: { open: '16:00', close: '23:00' }, sat: { open: '16:00', close: '23:00' },
  sun: { open: '10:00', close: '12:00' },
};

export const TIMEZONE = 'Asia/Kolkata';

const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };

/** "16:00" -> "4 pm", "10:30" -> "10:30 am", "12:00" -> "12 pm", "00:00" -> "12 am". */
export function fmtTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, '0')} ${ap}` : `${h12} ${ap}`;
}

export const fmtRange = (d: DayHours) => (d ? `${fmtTime(d.open)} – ${fmtTime(d.close)}` : 'Closed');

/** The current weekday and minutes-since-midnight in India, regardless of the visitor's own time zone. */
export function istNow(now: Date = new Date()): { day: DayKey; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: TIMEZONE, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const day = get('weekday').slice(0, 3).toLowerCase() as DayKey;
  return { day, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

export interface HoursStatus { open: boolean; label: string; short: string }

/** Whether the studio is reachable right now, and the next time that changes. */
export function statusNow(hours: BusinessHours, now: Date = new Date()): HoursStatus {
  const { day, minutes } = istNow(now);
  const today = hours[day];
  if (today && minutes >= toMin(today.open) && minutes < toMin(today.close)) {
    return { open: true, label: `Open now until ${fmtTime(today.close)}`, short: `until ${fmtTime(today.close)}` };
  }
  // Opens later today?
  if (today && minutes < toMin(today.open)) return { open: false, label: `Closed. Opens today at ${fmtTime(today.open)}`, short: `opens ${fmtTime(today.open)}` };
  // Otherwise find the next open day.
  const idx = DAYS.findIndex((d) => d.key === day);
  for (let i = 1; i <= 7; i++) {
    const d = DAYS[(idx + i) % 7];
    const h = hours[d.key];
    if (h) {
      const when = i === 1 ? 'tomorrow' : d.long;
      return { open: false, label: `Closed. Opens ${when} at ${fmtTime(h.open)}`, short: `opens ${when} ${fmtTime(h.open)}` };
    }
  }
  return { open: false, label: 'Closed', short: 'closed' };
}

/** Groups consecutive days that share the same hours: "Mon–Sat 4 pm – 11 pm · Sun 10 am – 12 pm". */
export function summarize(hours: BusinessHours): string {
  const groups: { from: number; to: number; text: string }[] = [];
  DAYS.forEach((d, i) => {
    const text = fmtRange(hours[d.key]);
    const last = groups[groups.length - 1];
    if (last && last.text === text) last.to = i; else groups.push({ from: i, to: i, text });
  });
  return groups.map((g) => `${g.from === g.to ? DAYS[g.from].short : DAYS[g.from].short + '–' + DAYS[g.to].short} ${g.text}`).join(' · ');
}

/** Basic validation for the admin editor: close must be after open. */
export function validateHours(hours: BusinessHours): string | null {
  for (const d of DAYS) {
    const h = hours[d.key];
    if (h && toMin(h.close) <= toMin(h.open)) return `${d.long}: closing time must be after opening time.`;
  }
  return null;
}

import { DEFAULT_HOURS, fmtRange, fmtTime, istNow, statusNow, summarize, validateHours } from './hours';
import { BusinessHours } from './models';

/** Builds a Date from an India Standard Time wall-clock (IST = UTC+5:30). 26 Oct 2026 is a Monday. */
const ist = (day: number, h: number, m = 0) => new Date(Date.UTC(2026, 9, day, h, m) - (5 * 60 + 30) * 60000);
const MON = 26, SAT = 31, SUN = 32; // day 32 rolls over to Sunday 1 Nov 2026

describe('opening hours', () => {
  it('formats times the way people say them', () => {
    expect(fmtTime('16:00')).toBe('4 pm');
    expect(fmtTime('10:30')).toBe('10:30 am');
    expect(fmtTime('12:00')).toBe('12 pm');
    expect(fmtTime('00:00')).toBe('12 am');
    expect(fmtTime('23:00')).toBe('11 pm');
    expect(fmtRange(null)).toBe('Closed');
  });

  it('summarizes the default hours: Mon–Sat 4–11 pm, Sunday 10 am–12 pm', () => {
    expect(summarize(DEFAULT_HOURS)).toBe('Mon–Sat 4 pm – 11 pm · Sun 10 am – 12 pm');
  });

  it('reads the day and time in India regardless of the visitor’s time zone', () => {
    expect(istNow(ist(MON, 16, 5))).toEqual({ day: 'mon', minutes: 16 * 60 + 5 });
    expect(istNow(ist(SUN, 10))).toEqual({ day: 'sun', minutes: 600 });
  });

  it('is closed before 4 pm on a weekday and says when it opens', () => {
    const s = statusNow(DEFAULT_HOURS, ist(MON, 15, 59));
    expect(s.open).toBeFalse();
    expect(s.label).toBe('Closed. Opens today at 4 pm');
  });

  it('opens exactly at 4 pm and stays open until 11 pm', () => {
    expect(statusNow(DEFAULT_HOURS, ist(MON, 16)).open).toBeTrue();
    expect(statusNow(DEFAULT_HOURS, ist(MON, 16)).label).toBe('Open now until 11 pm');
    expect(statusNow(DEFAULT_HOURS, ist(MON, 22, 59)).open).toBeTrue();
  });

  it('closes exactly at 11 pm and points to tomorrow', () => {
    const s = statusNow(DEFAULT_HOURS, ist(MON, 23));
    expect(s.open).toBeFalse();
    expect(s.label).toBe('Closed. Opens tomorrow at 4 pm');
  });

  it('Saturday night rolls over to Sunday morning at 10 am', () => {
    expect(statusNow(DEFAULT_HOURS, ist(SAT, 23, 30)).label).toBe('Closed. Opens tomorrow at 10 am');
  });

  it('Sunday is open 10 am to 12 pm only', () => {
    expect(statusNow(DEFAULT_HOURS, ist(SUN, 9)).label).toBe('Closed. Opens today at 10 am');
    expect(statusNow(DEFAULT_HOURS, ist(SUN, 10)).open).toBeTrue();
    expect(statusNow(DEFAULT_HOURS, ist(SUN, 11, 59)).open).toBeTrue();
    const closed = statusNow(DEFAULT_HOURS, ist(SUN, 12));
    expect(closed.open).toBeFalse();
    expect(closed.label).toBe('Closed. Opens tomorrow at 4 pm');
  });

  it('handles a day that is closed and a week that is closed', () => {
    const noMon: BusinessHours = { ...DEFAULT_HOURS, mon: null };
    expect(statusNow(noMon, ist(MON, 17)).label).toBe('Closed. Opens tomorrow at 4 pm');
    expect(statusNow(noMon, ist(SUN, 13)).label).toBe('Closed. Opens Tuesday at 4 pm');
    const never = { mon: null, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null } as BusinessHours;
    expect(statusNow(never, ist(MON, 12)).label).toBe('Closed');
  });

  it('validates that closing is after opening', () => {
    expect(validateHours(DEFAULT_HOURS)).toBeNull();
    expect(validateHours({ ...DEFAULT_HOURS, tue: { open: '18:00', close: '17:00' } })).toBe('Tuesday: closing time must be after opening time.');
  });
});

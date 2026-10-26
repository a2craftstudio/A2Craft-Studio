const IST = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

/** "2026-10-26 13:07" in India time. The server stores UTC; the owner works in IST. */
export function istStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16).replace('T', ' ');
  const parts = IST.formatToParts(d);
  const part = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')} ${part('hour')}:${part('minute')}`;
}

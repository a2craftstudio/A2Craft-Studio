import crypto from 'node:crypto';

export const uuid = () => crypto.randomUUID();
export const isUuid = (s: unknown): s is string => typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
/** `INQ-3FA9C1`: prefix plus 6 random uppercase hex characters. */
export const shortId = (prefix: string) => `${prefix}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
export const sha256Hex = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
export const hmacHex = (secret: string | Buffer, msg: string | Buffer) => crypto.createHmac('sha256', secret).update(msg).digest('hex');

/** Constant-time string comparison; false when lengths differ. */
export function safeEqual(a: string, b: string): boolean {
  const A = Buffer.from(a, 'utf8');
  const B = Buffer.from(b, 'utf8');
  if (A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
}

export const slugify = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]!);

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export const bool = (v: unknown) => v === 1 || v === true;

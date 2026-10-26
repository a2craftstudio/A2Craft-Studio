import { z } from 'zod';
import { EMAIL_RE, isUuid } from './util.js';

/** Trimmed string with a length cap (and optional minimum). */
export const text = (max: number, min = 0, msg?: string) => {
  let s = z.string().trim().max(max, msg);
  if (min > 0) s = s.min(min, msg);
  return s;
};
/** Optional text that defaults to ''. */
export const textOpt = (max: number) => z.string().trim().max(max).optional().default('');

export const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(200, 'That email address is too long.')
  .refine((v) => EMAIL_RE.test(v), 'Please enter a valid email address.');
/** Email, or an empty string (used for optional contact fields in settings). */
export const emailOrEmpty = z
  .string()
  .trim()
  .max(200)
  .refine((v) => v === '' || EMAIL_RE.test(v), 'Please enter a valid email address.');

export const uuidStr = z.string().trim().refine(isUuid, 'Not a valid id.').transform((s) => s.toLowerCase());

/** A password is limited to 72 bytes because bcrypt ignores everything after that. */
export const password = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .refine((v) => Buffer.byteLength(v, 'utf8') <= 72, 'Use at most 72 characters.');

/** Private upload path as returned by POST /api/uploads (single segment under private/, no traversal). */
export const PRIVATE_PATH_RE = /^private\/[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;
export const privatePath = z.string().trim().regex(PRIVATE_PATH_RE, 'Not a valid file path.');

/** Safe URL for media: our own /media files or http(s). Blocks javascript:, data: and protocol-relative tricks. */
export const mediaUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => /^\/media\/[A-Za-z0-9][A-Za-z0-9._-]*$/.test(v) || /^https?:\/\/[^\s"'<>]+$/i.test(v), 'Use an uploaded file or an http(s) link.');

export const hexColor = z.string().trim().regex(/^#[0-9a-fA-F]{3,8}$/, 'Colours must look like #AABBCC.');
export const palette = z.tuple([hexColor, hexColor]);

export const MOTIFS = ['cake', 'lamp', 'floral', 'hearts', 'book', 'frame', 'story', 'letter', 'video', 'card', 'rings'] as const;
export const motif = z.enum(MOTIFS);

export const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Dates must look like YYYY-MM-DD.')
  .refine((v) => !Number.isNaN(Date.parse(v + 'T00:00:00Z')) && new Date(v + 'T00:00:00Z').toISOString().startsWith(v), 'That date does not exist.');

export const intMoney = (max = 10_000_000) => z.number().int().min(0).max(max);

/** Coerces the usual "?all=1" style flags. */
export const flag = z.enum(['1', 'true']).optional();

export const idParam = z.object({ id: z.string().trim().min(1).max(100) });

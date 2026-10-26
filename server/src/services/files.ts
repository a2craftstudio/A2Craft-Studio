import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Config } from '../config.js';
import { PRIVATE_PATH_RE } from '../schemas.js';
import { hmacHex, safeEqual } from '../util.js';

export const SIGN_TTL_ADMIN = 5 * 60;
export const SIGN_TTL_DOWNLOAD = 60;

export interface StorageDirs {
  root: string;
  publicDir: string;
  privateDir: string;
  tmpDir: string;
}
export function storageDirs(config: Config): StorageDirs {
  const root = config.uploadDir;
  return { root, publicDir: path.join(root, 'public'), privateDir: path.join(root, 'private'), tmpDir: path.join(root, 'tmp') };
}
export function ensureStorage(config: Config): StorageDirs {
  const d = storageDirs(config);
  for (const dir of [d.publicDir, d.privateDir, d.tmpDir]) fs.mkdirSync(dir, { recursive: true });
  return d;
}

// ---------------------------------------------------------------- file store
/** `public/<name>` (served at /media/<name>) or `private/<name>` (served only through signed /files links). */
export const STORE_KEY_RE = /^(public|private)\/[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;

/**
 * Where accepted uploads live. Uploads always arrive as a temp file on disk first (multer); `save` moves it into the
 * store. The default keeps files in UPLOAD_DIR; on Netlify the store is Netlify Blobs (the function disk is temporary).
 */
export interface FileStore {
  save(key: string, tmpFile: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  remove(key: string): Promise<void>;
}

export function diskStore(config: Config): FileStore {
  const { root } = ensureStorage(config);
  const abs = (key: string) => {
    if (!STORE_KEY_RE.test(key)) throw new Error('Not a valid file key.');
    return path.join(root, key);
  };
  return {
    async save(key, tmpFile) {
      fs.renameSync(tmpFile, abs(key));
    },
    async exists(key) {
      return STORE_KEY_RE.test(key) && fs.existsSync(abs(key));
    },
    async remove(key) {
      if (STORE_KEY_RE.test(key)) removeFileQuiet(abs(key));
    },
  };
}

// ---------------------------------------------------------------- signed URLs
const signingKey = (config: Config) => crypto.createHmac('sha256', config.jwtSecret).update('a2-file-signing-v1').digest();

/** HMAC over `path|expiry`. `path` is the stored private path, e.g. private/<random>-<name>. */
export const signPath = (config: Config, filePath: string, expiresAtSec: number) => hmacHex(signingKey(config), `${filePath}|${expiresAtSec}`);

export function signedUrl(config: Config, filePath: string, ttlSec: number, opts: { download?: boolean; now?: number } = {}): string {
  if (!PRIVATE_PATH_RE.test(filePath)) throw new Error('Not a private path.');
  const exp = Math.floor((opts.now ?? Date.now()) / 1000) + ttlSec;
  const name = filePath.slice('private/'.length);
  return `/files/${name}?e=${exp}&s=${signPath(config, filePath, exp)}${opts.download ? '&dl=1' : ''}`;
}

export function verifySignature(config: Config, filePath: string, exp: unknown, sig: unknown, now = Date.now()): boolean {
  if (typeof exp !== 'string' || typeof sig !== 'string' || !/^\d{1,12}$/.test(exp) || !/^[0-9a-f]{64}$/.test(sig)) return false;
  if (Number(exp) * 1000 < now) return false;
  return safeEqual(signPath(config, filePath, Number(exp)), sig);
}

// ---------------------------------------------------------------- names
/** Keeps letters, digits, dot, dash, underscore; max 60 chars. Never empty. */
export function safeName(original: string): string {
  const base = path.basename(String(original ?? '').replace(/\\/g, '/'));
  const clean = base.normalize('NFKD').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[-.]+/, '').replace(/-{2,}/g, '-');
  return (clean.slice(-60) || 'file').replace(/^[-.]+/, '') || 'file';
}
export const randomName = () => crypto.randomBytes(16).toString('hex');
export const extOf = (name: string) => (path.extname(name).slice(1) || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10);

// ---------------------------------------------------------------- magic-byte sniffing
export interface Sniffed {
  kind: 'image' | 'video';
  ext: string;
  mime: string;
}

/** Identifies a file from its first bytes. Returns null for anything that is not a supported image/video (SVG, HTML, ...). */
export function sniffMedia(b: Buffer): Sniffed | null {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { kind: 'image', ext: 'jpg', mime: 'image/jpeg' };
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { kind: 'image', ext: 'png', mime: 'image/png' };
  const head6 = b.subarray(0, 6).toString('latin1');
  if (head6 === 'GIF87a' || head6 === 'GIF89a') return { kind: 'image', ext: 'gif', mime: 'image/gif' };
  if (b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') return { kind: 'image', ext: 'webp', mime: 'image/webp' };
  if (b.subarray(4, 8).toString('latin1') === 'ftyp') {
    const brand = b.subarray(8, 12).toString('latin1');
    if (brand === 'avif' || brand === 'avis') return { kind: 'image', ext: 'avif', mime: 'image/avif' };
    if (/^(heic|heix|hevc|hevx|mif1|msf1)$/.test(brand)) return null;
    if (brand === 'qt  ') return { kind: 'video', ext: 'mov', mime: 'video/quicktime' };
    return { kind: 'video', ext: 'mp4', mime: 'video/mp4' };
  }
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { kind: 'video', ext: 'webm', mime: 'video/webm' };
  return null;
}

export const MEDIA_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'mp4', 'webm', 'mov']);
export const REFERENCE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp']);
export const REFERENCE_TYPES = new Set(['jpg', 'png', 'webp']);

// ---------------------------------------------------------------- serving private files
/** Types that are safe to display inline. Everything else is forced to download as application/octet-stream. */
const INLINE_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
  txt: 'text/plain; charset=utf-8',
};
export const contentTypeFor = (name: string) => INLINE_TYPES[extOf(name)] ?? 'application/octet-stream';
export const isInlineSafe = (name: string) => extOf(name) in INLINE_TYPES;

/** The human-friendly part of a stored name: `<32 hex>-<name>` -> `<name>`. */
export const displayName = (stored: string) => stored.replace(/^[0-9a-f]{32}-/, '');

export function removeFileQuiet(file: string | undefined) {
  if (!file) return;
  try {
    fs.unlinkSync(file);
  } catch {
    /* already gone */
  }
}

/** Reads the first n bytes of a file. */
export function readHead(file: string, n = 32): Buffer {
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.alloc(n);
    const read = fs.readSync(fd, buf, 0, n, 0);
    return buf.subarray(0, read);
  } finally {
    fs.closeSync(fd);
  }
}

/** Absolute path of a stored private file, or null if the path is malformed. */
export function privateFile(config: Config, filePath: string): string | null {
  if (!PRIVATE_PATH_RE.test(filePath)) return null;
  const { privateDir } = storageDirs(config);
  const abs = path.join(privateDir, filePath.slice('private/'.length));
  return abs.startsWith(privateDir + path.sep) ? abs : null;
}

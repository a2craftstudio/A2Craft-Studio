import express, { Router, type NextFunction, type Request, type RequestHandler, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { z } from 'zod';
import type { Ctx } from '../context.js';
import { badRequest, forbidden, notFound, HttpError } from '../errors.js';
import { ah } from '../middleware/async.js';
import { requireAdmin } from '../middleware/auth.js';
import { HOUR, limiter } from '../middleware/rate.js';
import { validateQuery } from '../middleware/validate.js';
import { PRIVATE_PATH_RE } from '../schemas.js';
import {
  MEDIA_EXTS, REFERENCE_EXTS, REFERENCE_TYPES, SIGN_TTL_ADMIN, contentTypeFor, displayName, ensureStorage, extOf, isInlineSafe, privateFile,
  randomName, readHead, removeFileQuiet, safeName, signedUrl, sniffMedia, verifySignature,
} from '../services/files.js';

const MB = 1024 * 1024;
export const LIMITS = { image: 10 * MB, video: 100 * MB, file: 200 * MB, reference: 5 * MB };

const kindQuery = z.object({ kind: z.enum(['media', 'file', 'reference'], { errorMap: () => ({ message: 'kind must be media, file or reference.' }) }) });

/** One disk-backed multer per kind, so the byte limit is enforced while streaming (nothing large sits in memory). */
export function makeUploader(ctx: Ctx, maxBytes: number): RequestHandler {
  const { tmpDir } = ensureStorage(ctx.config);
  const m = multer({
    storage: multer.diskStorage({ destination: tmpDir, filename: (_req, _file, cb) => cb(null, randomName() + '.tmp') }),
    limits: { fileSize: maxBytes, files: 1, fields: 5, parts: 8 },
  });
  return m.single('file');
}

export function uploadRoutes(ctx: Ctx): Router {
  const { config } = ctx;
  const dirs = ensureStorage(config);
  const r = Router();

  const uploaders = {
    media: makeUploader(ctx, LIMITS.video),
    file: makeUploader(ctx, LIMITS.file),
    reference: makeUploader(ctx, LIMITS.reference),
  };
  const referenceLimit = limiter(config, 20, HOUR);

  // Authorization runs BEFORE the body is read, so anonymous callers cannot push large files at admin-only kinds.
  const gate: RequestHandler = (req, res, next) => {
    const kind = (req.query as { kind: keyof typeof uploaders }).kind;
    if (kind === 'reference') return referenceLimit(req, res, next);
    return requireAdmin(req, res, next);
  };
  const receive: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
    uploaders[(req.query as { kind: keyof typeof uploaders }).kind](req, res, next);
  };

  r.post(
    '/uploads',
    validateQuery(kindQuery),
    gate,
    receive,
    ah(async (req, res) => {
      const kind = (req.query as { kind: 'media' | 'file' | 'reference' }).kind;
      const file = req.file;
      if (!file) throw badRequest('Choose a file to upload.');
      const tmp = file.path;
      try {
        const ext = extOf(file.originalname);
        if (kind === 'file') {
          const stored = `${randomName()}-${safeName(file.originalname)}`;
          fs.renameSync(tmp, path.join(dirs.privateDir, stored));
          res.json({ path: `private/${stored}` });
          return;
        }
        const head = readHead(tmp);
        const sniffed = sniffMedia(head);
        if (kind === 'media') {
          if (!MEDIA_EXTS.has(ext)) throw badRequest('Only JPG, PNG, WebP, GIF, AVIF, MP4, WebM or MOV files can be uploaded.');
          if (!sniffed) throw badRequest('That file does not look like a supported image or video.');
          if (sniffed.kind === 'image' && file.size > LIMITS.image) throw new HttpError(413, 'Images can be at most 10 MB.');
          const name = `${randomName()}.${sniffed.ext}`;
          fs.renameSync(tmp, path.join(dirs.publicDir, name));
          res.json({ path: `public/${name}`, url: `/media/${name}` });
          return;
        }
        // reference: customer photos. Extension AND content must both be JPG, PNG or WebP (no SVG, no GIF, no HTML in disguise).
        if (!REFERENCE_EXTS.has(ext)) throw badRequest('Please upload a JPG, PNG or WebP image.');
        if (!sniffed || !REFERENCE_TYPES.has(sniffed.ext)) throw badRequest('That file is not a valid JPG, PNG or WebP image.');
        const name = `${randomName()}.${sniffed.ext}`;
        fs.renameSync(tmp, path.join(dirs.privateDir, name));
        res.json({ path: `private/${name}` });
      } finally {
        removeFileQuiet(tmp);
      }
    }),
  );

  const signQuery = z.object({ path: z.string().trim().regex(PRIVATE_PATH_RE, 'Not a valid file path.') });
  r.get('/uploads/sign', requireAdmin, validateQuery(signQuery), (req, res) => {
    const p = (req.query as { path: string }).path;
    const abs = privateFile(config, p);
    if (!abs || !fs.existsSync(abs)) throw notFound('File not found.');
    res.json({ url: signedUrl(config, p, SIGN_TTL_ADMIN) });
  });

  return r;
}

/** Non-API file serving: /media (public uploads) and /files (HMAC-signed private files). */
export function fileServingRoutes(ctx: Ctx): Router {
  const { config } = ctx;
  const dirs = ensureStorage(config);
  const r = Router();

  r.use(
    '/media',
    express.static(dirs.publicDir, {
      index: false,
      dotfiles: 'ignore',
      maxAge: '30d',
      immutable: true,
      setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
        res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
      },
    }),
  );

  r.get('/files/:name', (req, res) => {
    const name = String(req.params['name']);
    const filePath = `private/${name}`;
    // The signature covers the path and the expiry; any change (or an old link) is a 403.
    if (!PRIVATE_PATH_RE.test(filePath) || !verifySignature(config, filePath, req.query['e'], req.query['s'])) throw forbidden('This link is invalid or has expired.');
    const abs = privateFile(config, filePath);
    if (!abs || !fs.existsSync(abs)) throw notFound('File not found.');
    const download = req.query['dl'] === '1' || !isInlineSafe(name);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.setHeader('Content-Type', contentTypeFor(name));
    if (download) res.setHeader('Content-Disposition', `attachment; filename="${displayName(name)}"`);
    res.sendFile(abs, { dotfiles: 'allow', cacheControl: false, headers: {} });
  });

  return r;
}

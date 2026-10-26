import type { ErrorRequestHandler, RequestHandler } from 'express';
import multer from 'multer';
import { HttpError } from '../errors.js';
import type { Ctx } from '../context.js';

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ error: req.path.startsWith('/api') ? 'Not found.' : 'Not found.' });
};

export const errorHandler = (ctx: Ctx): ErrorRequestHandler => (err, req, res, _next) => {
  const requestId = (req as { id?: string }).id ?? '-';
  let status = 500;
  let message = 'Something went wrong. Please try again.';

  if (err instanceof HttpError) {
    status = err.status;
    message = err.message;
  } else if (err instanceof multer.MulterError) {
    status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'That file is too large.' : 'The upload could not be read.';
  } else if (err && typeof err === 'object' && 'type' in err && (err as { type: string }).type === 'entity.too.large') {
    status = 413;
    message = 'The request is too large.';
  } else if (err && typeof err === 'object' && 'type' in err && ['entity.parse.failed', 'encoding.unsupported', 'charset.unsupported', 'request.aborted', 'request.size.invalid'].includes((err as { type: string }).type)) {
    status = 400;
    message = 'The request body is not valid JSON.';
  } else if (err && typeof err === 'object' && ['22021', '22P05'].includes(String((err as { code?: unknown }).code))) {
    // PostgreSQL cannot store NUL bytes (or characters outside UTF-8) in text: that is bad input, not a server fault.
    status = 400;
    message = 'The request contains characters that are not allowed.';
  } else if (err && typeof err === 'object' && typeof (err as { status?: unknown }).status === 'number') {
    // http-errors from express.static / sendFile (e.g. a malformed range or a missing file).
    const s = (err as { status: number }).status;
    if (s >= 400 && s < 500) {
      status = s;
      message = s === 404 ? 'Not found.' : 'The request could not be completed.';
    }
  }

  if (status >= 500) ctx.log.error(`[${requestId}] ${req.method} ${req.path} -> ${status}`, err);
  if (res.headersSent) return;
  res.status(status).json({ error: message, ...(status >= 500 ? { requestId } : {}) });
};

import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { z, ZodError, type ZodTypeAny } from 'zod';
import { HttpError } from '../errors.js';

const label = (path: (string | number)[]) => {
  const last = [...path].reverse().find((p) => typeof p === 'string');
  return last ? String(last) : 'request';
};

// Friendly defaults. A message passed explicitly to a schema (`.min(8, 'Use at least 8 characters.')`) wins over these.
z.setErrorMap((issue, ctx) => {
  const f = label(issue.path);
  switch (issue.code) {
    case 'invalid_type':
      return { message: issue.received === 'undefined' ? `"${f}" is required.` : `"${f}" has the wrong type.` };
    case 'unrecognized_keys':
      return { message: `Unexpected field: ${issue.keys.slice(0, 3).join(', ')}.` };
    case 'invalid_enum_value':
      return { message: `"${f}" is not an allowed value.` };
    case 'too_small':
      return { message: issue.type === 'string' ? `"${f}" is too short (minimum ${issue.minimum}).` : `"${f}" is too small.` };
    case 'too_big':
      return { message: issue.type === 'string' ? `"${f}" is too long (maximum ${issue.maximum}).` : issue.type === 'array' ? `"${f}" has too many items (maximum ${issue.maximum}).` : `"${f}" is too large.` };
    case 'invalid_string':
      return { message: `"${f}" is not valid.` };
    default:
      return { message: ctx.defaultError };
  }
});

export function zodMessage(e: ZodError): string {
  return e.issues[0]?.message ?? 'The request is not valid.';
}

export function parse<S extends ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const r = schema.safeParse(data);
  if (!r.success) throw new HttpError(400, zodMessage(r.error));
  return r.data;
}

/** Validates and replaces req.body / req.query with the parsed (trimmed, defaulted) value. */
export function validateBody<S extends ZodTypeAny>(schema: S): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.body = parse(schema, req.body ?? {});
    next();
  };
}
export function validateQuery<S extends ZodTypeAny>(schema: S): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    // Express 4: req.query is a plain writable property.
    (req as { query: unknown }).query = parse(schema, req.query);
    next();
  };
}

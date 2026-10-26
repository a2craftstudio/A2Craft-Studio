import type { Config } from '@netlify/functions';
import { contentTypeFor, displayName, isInlineSafe, verifySignature } from '../../server/src/services/files.js';
import { PRIVATE_PATH_RE } from '../../server/src/schemas.js';
import { functionConfig, uploadsStore } from '../lib/server.js';

const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;
const SANDBOX = { 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" };
const text = (status: number, body: string) => new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });

/** Serves uploads from Netlify Blobs: /media/<name> (public photos and videos) and /files/<name> (HMAC-signed private files). */
export default async (req: Request) => {
  const url = new URL(req.url);
  const [, area, name = ''] = url.pathname.match(/^\/(media|files)\/(.*)$/) ?? [];
  if (!NAME_RE.test(name)) return text(area === 'files' ? 403 : 404, area === 'files' ? 'This link is invalid or has expired.' : 'Not found.');

  if (area === 'media') {
    const body = await uploadsStore().get(`public/${name}`, { type: 'stream' });
    if (!body) return text(404, 'Not found.');
    return new Response(body, {
      headers: { ...SANDBOX, 'Content-Type': contentTypeFor(name), 'Cache-Control': 'public, max-age=2592000, immutable', 'Cross-Origin-Resource-Policy': 'same-site' },
    });
  }

  // The signature covers the path and the expiry; any change (or an old link) is a 403.
  const filePath = `private/${name}`;
  const config = functionConfig();
  if (!PRIVATE_PATH_RE.test(filePath) || !verifySignature(config, filePath, url.searchParams.get('e') ?? undefined, url.searchParams.get('s') ?? undefined)) {
    return text(403, 'This link is invalid or has expired.');
  }
  const body = await uploadsStore().get(filePath, { type: 'stream' });
  if (!body) return text(404, 'File not found.');
  const headers: Record<string, string> = { ...SANDBOX, 'Content-Type': contentTypeFor(name), 'Cache-Control': 'private, no-store' };
  if (url.searchParams.get('dl') === '1' || !isInlineSafe(name)) headers['Content-Disposition'] = `attachment; filename="${displayName(name)}"`;
  return new Response(body, { headers });
};

export const config: Config = {
  path: ['/media/*', '/files/*'],
  method: ['GET', 'HEAD'],
};

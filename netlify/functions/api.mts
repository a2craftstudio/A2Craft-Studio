import { connectLambda } from '@netlify/blobs';
import type { Handler } from '@netlify/functions';
import serverless from 'serverless-http';
import { getApp } from '../lib/server.js';

let wrapped: ReturnType<typeof serverless> | undefined;

/** The whole Express API. /api/* is rewritten here (see public/_redirects). */
export const handler: Handler = async (event, context) => {
  connectLambda(event as never);
  // The API routes are mounted at /api; normalize the path in case the rewritten function path is passed through.
  event.path = event.path.replace(/^\/\.netlify\/functions\/api(?=\/|$)/, '/api');
  try {
    wrapped ??= serverless(await getApp());
  } catch (e) {
    console.error(`[api] startup failed: ${e instanceof Error ? e.message : 'unknown error'}`);
    return { statusCode: 503, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify({ error: 'The shop is starting up or misconfigured. Please try again shortly.' }) };
  }
  return (await wrapped(event, context)) as Awaited<ReturnType<Handler>>;
};

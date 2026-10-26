import type { Config } from '@netlify/functions';
import { runRetention } from '../../server/src/services/retention.js';
import { functionConfig, openFunctionDb } from '../lib/server.js';

/** Daily clean-up of old visit events, call-back requests and used password-reset tokens (the server's 24-hour job). */
export default async () => {
  const db = await openFunctionDb(functionConfig());
  try {
    const r = await runRetention(db);
    console.log(`[retention] removed ${r.events} visit events, ${r.callbacks} call-back requests, ${r.resetTokens} reset tokens`);
  } finally {
    await db.close();
  }
};

export const config: Config = { schedule: '@daily' };

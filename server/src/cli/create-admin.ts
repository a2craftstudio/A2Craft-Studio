import 'dotenv/config';
import { upsertAdmin } from '../auth.js';
import { loadConfig } from '../config.js';
import { migrate, openDb, type Db } from '../db.js';
import { createLogger } from '../log.js';
import { createMailer } from '../services/mail.js';
import { EMAIL_RE } from '../util.js';

// Usage: npm run create-admin -- <email> <password> [name]
const [email, password, ...nameParts] = process.argv.slice(2);
if (!email || !password) {
  console.error('Usage: npm run create-admin -- <email> <password> [name]');
  process.exit(2);
}
if (!EMAIL_RE.test(email)) {
  console.error('That does not look like an email address.');
  process.exit(2);
}
if (password.length < 8) {
  console.error('The password must be at least 8 characters.');
  process.exit(2);
}

const config = loadConfig();
let db: Db;
try {
  db = await openDb(config.database);
  await migrate(db);
} catch (e) {
  console.error(e instanceof Error ? e.message : 'Could not open the database.');
  process.exit(1);
}
try {
  const log = createLogger(config.logLevel);
  const result = await upsertAdmin({ config, db, log, mail: createMailer(config, log) }, email, password, nameParts.join(' ') || undefined);
  console.log(result === 'created' ? `Admin ${email.toLowerCase()} created.` : `Existing account ${email.toLowerCase()} is now an admin and its password was reset.`);
} finally {
  await db.close();
}

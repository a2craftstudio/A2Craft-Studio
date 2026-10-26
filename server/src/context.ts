import type { Config } from './config.js';
import type { Db } from './db.js';
import type { Logger } from './log.js';
import type { FileStore } from './services/files.js';
import type { Mailer } from './services/mail.js';

export interface Ctx {
  config: Config;
  db: Db;
  log: Logger;
  mail: Mailer;
  files: FileStore;
}

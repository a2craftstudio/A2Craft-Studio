import type { Config } from './config.js';

export interface Logger {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string, err?: unknown): void;
}

/** Console logger. Callers must never pass secrets, passwords, tokens or request bodies. */
export function createLogger(level: Config['logLevel']): Logger {
  const stamp = () => new Date().toISOString();
  return {
    info: (m) => level === 'info' && console.log(`${stamp()} ${m}`),
    warn: (m) => level !== 'silent' && console.warn(`${stamp()} WARN ${m}`),
    error: (m, err) => {
      if (level === 'silent') return;
      const detail = err instanceof Error ? ` | ${err.name}: ${err.message}\n${err.stack?.split('\n').slice(1, 6).join('\n') ?? ''}` : '';
      console.error(`${stamp()} ERROR ${m}${detail}`);
    },
  };
}

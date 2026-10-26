import 'dotenv/config';
import { loadConfig } from '../config.js';
import { openDb, type Db } from '../db.js';

// Usage:  npm run db                 lists every table with its row count
//         npm run db -- products     prints the rows of one table (newest 50)
//         npm run db -- orders 200   prints up to 200 rows
// Read-only: it never creates tables. Start the API once (npm run dev) and they are created.

const quoteIdent = (s: string) => `"${s.replace(/"/g, '""')}"`;
const HIDDEN = /hash|secret|token|password/i;

export async function listTables(db: Db): Promise<string[]> {
  const rows = await db.all<{ table_name: string }>(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name",
  );
  return rows.map((r) => r.table_name);
}

/** Picks the "newest first" order for a table from its real columns: created_at / updated_at / applied_at, then seq, else the first column. */
export async function newestFirstOrder(db: Db, table: string): Promise<string> {
  const cols = (
    await db.all<{ column_name: string }>("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ? ORDER BY ordinal_position", table)
  ).map((c) => c.column_name);
  const keys = ['created_at', 'updated_at', 'applied_at', 'seq'].filter((k) => cols.includes(k));
  return (keys.length ? keys : cols.slice(0, 1)).map((k) => `${quoteIdent(k)} DESC`).join(', ');
}

/** Newest rows of one table with secret-looking columns hidden. `table` must come from listTables(). */
export async function showTable(db: Db, table: string, limit: number): Promise<Record<string, unknown>[]> {
  const order = await newestFirstOrder(db, table);
  const rows = await db.all<Record<string, unknown>>(`SELECT * FROM ${quoteIdent(table)} ORDER BY ${order} LIMIT ${Math.trunc(limit)}`);
  return rows.map((r) =>
    Object.fromEntries(Object.entries(r).map(([k, v]) => [k, HIDDEN.test(k) ? '(hidden)' : typeof v === 'string' && v.length > 60 ? v.slice(0, 57) + '...' : v])),
  );
}

async function main() {
  const config = loadConfig(process.env, () => {});
  const [table, limitArg] = process.argv.slice(2);
  let db: Db;
  try {
    db = await openDb(config.database);
  } catch (e) {
    console.error(e instanceof Error ? e.message : 'Could not open the database.');
    process.exit(1);
  }
  try {
    const tables = await listTables(db);
    console.log(`Database: ${config.database.label}\n`);
    if (!tables.length) {
      console.log('No tables yet. Start the API once (npm run dev) and they are created.');
    } else if (!table) {
      const counts = [];
      for (const name of tables) counts.push({ table: name, rows: (await db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${quoteIdent(name)}`))!.n });
      console.table(counts);
      console.log('Show one table:  npm run db -- <table>   e.g.  npm run db -- products');
    } else if (!tables.includes(table)) {
      console.log(`No table called "${table}". Tables: ${tables.join(', ')}`);
      process.exitCode = 1;
    } else {
      const limit = Math.min(Math.max(Number(limitArg) || 50, 1), 1000);
      const rows = await showTable(db, table, limit);
      console.table(rows);
      console.log(`${rows.length} row(s) shown (newest first). Secrets such as password hashes are hidden.`);
    }
  } finally {
    await db.close();
  }
}

// Only run when executed directly (tests import the helpers above).
if (process.argv[1] && /db-info\.[tj]s$/.test(process.argv[1])) await main();

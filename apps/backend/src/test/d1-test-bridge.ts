import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'node:path';

const migrationsFolder = path.resolve(__dirname, '../../drizzle');

/**
 * Wrap a better-sqlite3 in-memory database behind the `D1Database` interface so
 * use-cases and routers can run against real SQL (real migrations, real
 * constraints) instead of hand-stubbed query results.
 */
export function createBetterSqliteD1Bridge(sqlite: InstanceType<typeof Database>): D1Database {
  return {
    prepare(query: string) {
      const exec = (params: unknown[]) => ({
        async all() {
          const results = sqlite.prepare(query).all(...params);
          return { results, success: true, meta: {} };
        },
        async first(colName?: string) {
          const result = sqlite.prepare(query).get(...params);
          if (!result) return null;
          if (colName) return (result as Record<string, unknown>)[colName] ?? null;
          return result;
        },
        async run() {
          const info = sqlite.prepare(query).run(...params);
          return {
            success: true,
            meta: { changes: info.changes, last_row_id: info.lastInsertRowid },
          };
        },
        async raw() {
          return sqlite
            .prepare(query)
            .raw()
            .all(...params);
        },
      });

      return { bind: (...params: unknown[]) => exec(params), ...exec([]) };
    },
    async exec(query: string) {
      sqlite.exec(query);
      return { count: 1, duration: 0 };
    },
    async batch(statements: unknown[]) {
      const results = [];
      for (const stmt of statements as Array<{ run: () => Promise<unknown> }>) {
        results.push(await stmt.run());
      }
      return results;
    },
    async dump() {
      throw new Error('Dump not implemented in mock');
    },
  } as unknown as D1Database;
}

/**
 * Create a migrated in-memory database plus its D1 bridge.
 * Returns the raw sqlite handle so callers can `close()` it between tests.
 */
export async function createTestDatabase() {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite);
  await migrate(db, { migrationsFolder });

  return { sqlite, db, d1: createBetterSqliteD1Bridge(sqlite) };
}

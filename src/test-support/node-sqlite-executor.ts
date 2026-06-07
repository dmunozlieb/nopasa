import { DatabaseSync } from 'node:sqlite';
import {
  assertSchemaVersion,
  type SqlExecutor,
  type SqlParam,
} from '../infrastructure/persistence/sqlite/sql-executor';

/**
 * Test-only SqlExecutor backed by Node's built-in synchronous SQLite.
 * Lives in test-support so NO production code imports `node:sqlite`.
 */
export class NodeSqliteExecutor implements SqlExecutor {
  private readonly db: DatabaseSync;

  constructor(path = ':memory:') {
    this.db = new DatabaseSync(path);
  }

  async run(sql: string, params: SqlParam[] = []): Promise<void> {
    this.db.prepare(sql).run(...params);
  }

  async all<T>(sql: string, params: SqlParam[] = []): Promise<T[]> {
    return this.db.prepare(sql).all(...params) as T[];
  }

  async getFirst<T>(sql: string, params: SqlParam[] = []): Promise<T | null> {
    return (this.db.prepare(sql).get(...params) as T | undefined) ?? null;
  }

  async exec(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  async withinTransaction(fn: () => Promise<void>): Promise<void> {
    this.db.exec('BEGIN');
    try {
      await fn();
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  async getUserVersion(): Promise<number> {
    const row = this.db.prepare('PRAGMA user_version').get() as { user_version: number };
    return row.user_version;
  }

  async setUserVersion(version: number): Promise<void> {
    assertSchemaVersion(version);
    this.db.exec(`PRAGMA user_version = ${version}`);
  }
}

import type { SQLiteDatabase } from 'expo-sqlite';
import { assertSchemaVersion, type SqlExecutor, type SqlParam } from './sql-executor';

/** Production SqlExecutor over an expo-sqlite database. */
export class ExpoSqliteExecutor implements SqlExecutor {
  constructor(private readonly db: SQLiteDatabase) {}

  async run(sql: string, params: SqlParam[] = []): Promise<void> {
    await this.db.runAsync(sql, params);
  }

  async all<T>(sql: string, params: SqlParam[] = []): Promise<T[]> {
    return this.db.getAllAsync<T>(sql, params);
  }

  async getFirst<T>(sql: string, params: SqlParam[] = []): Promise<T | null> {
    return (await this.db.getFirstAsync<T>(sql, params)) ?? null;
  }

  async exec(sql: string): Promise<void> {
    await this.db.execAsync(sql);
  }

  async withinTransaction(fn: () => Promise<void>): Promise<void> {
    await this.db.withTransactionAsync(fn);
  }

  async getUserVersion(): Promise<number> {
    const row = await this.db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    return row?.user_version ?? 0;
  }

  async setUserVersion(version: number): Promise<void> {
    assertSchemaVersion(version);
    await this.db.execAsync(`PRAGMA user_version = ${version}`);
  }
}

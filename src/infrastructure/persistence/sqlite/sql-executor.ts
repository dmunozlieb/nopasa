/** A value bindable to a SQL `?` placeholder. */
export type SqlParam = string | number | null;

/**
 * Minimal async database boundary the repository and migrations depend on.
 * Implemented by ExpoSqliteExecutor (production) and NodeSqliteExecutor (tests),
 * over the SAME SQL.
 */
export interface SqlExecutor {
  run(sql: string, params?: SqlParam[]): Promise<void>;
  all<T>(sql: string, params?: SqlParam[]): Promise<T[]>;
  getFirst<T>(sql: string, params?: SqlParam[]): Promise<T | null>;
  exec(sql: string): Promise<void>;
  withinTransaction(fn: () => Promise<void>): Promise<void>;
  getUserVersion(): Promise<number>;
  setUserVersion(version: number): Promise<void>;
}

/** Guards PRAGMA user_version writes (the value cannot be a bound parameter). */
export function assertSchemaVersion(version: number): void {
  if (!Number.isInteger(version) || version < 0) {
    throw new Error(`Invalid schema version: ${version}`);
  }
}

import { MIGRATIONS } from './migrations';
import type { SqlExecutor } from './sql-executor';

/**
 * Applies all migrations newer than the database's user_version, in ascending order.
 * Each migration runs inside its own transaction together with its version bump, so a
 * failure rolls back fully. Idempotent: re-running applies nothing.
 */
export async function runMigrations(executor: SqlExecutor): Promise<void> {
  const current = await executor.getUserVersion();
  const pending = MIGRATIONS.filter((migration) => migration.version > current).sort(
    (a, b) => a.version - b.version,
  );

  for (const migration of pending) {
    await executor.withinTransaction(async () => {
      await executor.exec(migration.sql);
      await executor.setUserVersion(migration.version);
    });
  }
}

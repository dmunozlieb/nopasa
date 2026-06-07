import { openDatabaseAsync } from 'expo-sqlite';
import type { DeadlineRepository } from '../../../ports/deadline-repository';
import { ExpoSqliteExecutor } from './expo-sqlite-executor';
import { runMigrations } from './run-migrations';
import { SqliteDeadlineRepository } from './sqlite-deadline-repository';

/** Opens the on-device database, runs migrations, and returns a ready DeadlineRepository. */
export async function createDeadlineRepository(
  databaseName = 'nopasa.db',
): Promise<DeadlineRepository> {
  const db = await openDatabaseAsync(databaseName);
  const executor = new ExpoSqliteExecutor(db);
  await runMigrations(executor);
  return new SqliteDeadlineRepository(executor);
}

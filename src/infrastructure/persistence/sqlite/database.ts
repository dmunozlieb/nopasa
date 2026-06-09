import { openDatabaseAsync } from 'expo-sqlite';
import { createDatabaseOpener } from './database-opener';
import { ExpoSqliteExecutor } from './expo-sqlite-executor';
import { runMigrations } from './run-migrations';

/** Opens the on-device database and runs migrations exactly once, shared by every
 *  repository (deadlines + settings) so the db is opened and migrated a single time. */
export const openMigratedDatabase = createDatabaseOpener(async () => {
  const db = await openDatabaseAsync('nopasa.db');
  const executor = new ExpoSqliteExecutor(db);
  await runMigrations(executor);
  return executor;
});

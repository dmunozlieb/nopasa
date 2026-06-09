import type { DeadlineRepository } from '../../../ports/deadline-repository';
import { openMigratedDatabase } from './database';
import { SqliteDeadlineRepository } from './sqlite-deadline-repository';

/** Returns a DeadlineRepository over the shared, migrated on-device database. */
export async function createDeadlineRepository(): Promise<DeadlineRepository> {
  const executor = await openMigratedDatabase();
  return new SqliteDeadlineRepository(executor);
}

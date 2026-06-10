import type { SettingsRepository } from '../../../ports/settings-repository';
import { openMigratedDatabase } from './database';
import { SqliteSettingsRepository } from './sqlite-settings-repository';

/** Returns a SettingsRepository over the shared, migrated on-device database. */
export async function createSettingsRepository(): Promise<SettingsRepository> {
  const executor = await openMigratedDatabase();
  return new SqliteSettingsRepository(executor);
}

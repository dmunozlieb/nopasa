import { DEFAULT_SETTINGS } from '../../../domain/settings/settings.schema';
import { NodeSqliteExecutor } from '../../../test-support/node-sqlite-executor';
import { runMigrations } from './run-migrations';
import { SqliteSettingsRepository } from './sqlite-settings-repository';

async function freshRepo() {
  const executor = new NodeSqliteExecutor();
  await runMigrations(executor);
  return { executor, repo: new SqliteSettingsRepository(executor) };
}

describe('SqliteSettingsRepository', () => {
  it('returns DEFAULT_SETTINGS when nothing is stored', async () => {
    const { repo } = await freshRepo();
    expect(await repo.load()).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips saved settings', async () => {
    const { repo } = await freshRepo();
    const settings = { reminderTime: { hour: 8, minute: 30 }, defaultReminderDaysBefore: [7, 1] };
    await repo.save(settings);
    expect(await repo.load()).toEqual(settings);
  });

  it('overwrites on a second save (single row)', async () => {
    const { repo } = await freshRepo();
    await repo.save({ reminderTime: { hour: 8, minute: 0 }, defaultReminderDaysBefore: [30] });
    await repo.save({ reminderTime: { hour: 20, minute: 15 }, defaultReminderDaysBefore: [7] });
    expect(await repo.load()).toEqual({ reminderTime: { hour: 20, minute: 15 }, defaultReminderDaysBefore: [7] });
  });

  it('falls back to defaults on a corrupt row', async () => {
    const { executor, repo } = await freshRepo();
    await executor.run(
      'INSERT OR REPLACE INTO settings (id, reminder_hour, reminder_minute, default_reminder_days_before) VALUES (1, ?, ?, ?)',
      [99, 0, '[7]'],
    );
    expect(await repo.load()).toEqual(DEFAULT_SETTINGS);
  });
});

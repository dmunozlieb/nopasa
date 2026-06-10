import { DEFAULT_SETTINGS } from '../domain/settings/settings.schema';
import { InMemorySettingsRepository } from './in-memory-settings-repository';

describe('InMemorySettingsRepository', () => {
  it('defaults to DEFAULT_SETTINGS', async () => {
    expect(await new InMemorySettingsRepository().load()).toEqual(DEFAULT_SETTINGS);
  });

  it('returns the injected initial settings', async () => {
    const initial = { reminderTime: { hour: 7, minute: 15 }, defaultReminderDaysBefore: [1] };
    expect(await new InMemorySettingsRepository(initial).load()).toEqual(initial);
  });

  it('save then load returns the saved settings', async () => {
    const repo = new InMemorySettingsRepository();
    const next = { reminderTime: { hour: 20, minute: 0 }, defaultReminderDaysBefore: [7, 1] };
    await repo.save(next);
    expect(await repo.load()).toEqual(next);
  });
});

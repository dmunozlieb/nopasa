import { DEFAULT_SETTINGS, type Settings } from '../domain/settings/settings.schema';
import type { SettingsRepository } from '../ports/settings-repository';

/** In-memory SettingsRepository for tests and previews. */
export class InMemorySettingsRepository implements SettingsRepository {
  private settings: Settings;

  constructor(initial: Settings = DEFAULT_SETTINGS) {
    this.settings = initial;
  }

  async load(): Promise<Settings> {
    return this.settings;
  }

  async save(settings: Settings): Promise<void> {
    this.settings = settings;
  }
}

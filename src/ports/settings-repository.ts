import type { Settings } from '../domain/settings/settings.schema';

/** Persistence boundary for user settings. Async by design (SQLite-backed). */
export interface SettingsRepository {
  /** Returns the stored settings, or DEFAULT_SETTINGS when nothing is saved yet. */
  load(): Promise<Settings>;
  save(settings: Settings): Promise<void>;
}

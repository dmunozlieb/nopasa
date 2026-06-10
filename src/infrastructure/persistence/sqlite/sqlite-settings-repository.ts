import { DEFAULT_SETTINGS, type Settings } from '../../../domain/settings/settings.schema';
import type { SettingsRepository } from '../../../ports/settings-repository';
import { consoleLogger, type Logger } from '../../logging/logger';
import { fromRow, toRow, type SettingsRow } from './settings-mapper';
import type { SqlExecutor } from './sql-executor';

const SELECT_SQL =
  'SELECT reminder_hour, reminder_minute, default_reminder_days_before FROM settings WHERE id = 1';
const UPSERT_SQL =
  'INSERT OR REPLACE INTO settings (id, reminder_hour, reminder_minute, default_reminder_days_before) VALUES (1, ?, ?, ?)';

/** SQLite-backed SettingsRepository (single row, id = 1). Resilient: a corrupt row
 *  warns and yields DEFAULT_SETTINGS rather than crashing. */
export class SqliteSettingsRepository implements SettingsRepository {
  constructor(
    private readonly executor: SqlExecutor,
    private readonly logger: Logger = consoleLogger,
  ) {}

  async load(): Promise<Settings> {
    const row = await this.executor.getFirst<SettingsRow>(SELECT_SQL);
    if (row === null) return DEFAULT_SETTINGS;
    try {
      return fromRow(row);
    } catch (error) {
      this.logger.warn('Ignoring corrupt settings row; using defaults', error);
      return DEFAULT_SETTINGS;
    }
  }

  async save(settings: Settings): Promise<void> {
    const row = toRow(settings);
    await this.executor.run(UPSERT_SQL, [row.reminder_hour, row.reminder_minute, row.default_reminder_days_before]);
  }
}

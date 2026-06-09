import { settingsSchema, type Settings } from '../../../domain/settings/settings.schema';

export interface SettingsRow {
  reminder_hour: number;
  reminder_minute: number;
  default_reminder_days_before: string; // JSON array
}

/** Domain → row. The reminders array is JSON-encoded, like the deadline mapper. */
export function toRow(settings: Settings): SettingsRow {
  return {
    reminder_hour: settings.reminderTime.hour,
    reminder_minute: settings.reminderTime.minute,
    default_reminder_days_before: JSON.stringify(settings.defaultReminderDaysBefore),
  };
}

/** Row → domain, validated with the Zod schema at the edge. Throws on a corrupt row. */
export function fromRow(row: SettingsRow): Settings {
  return settingsSchema.parse({
    reminderTime: { hour: row.reminder_hour, minute: row.reminder_minute },
    defaultReminderDaysBefore: JSON.parse(row.default_reminder_days_before),
  });
}

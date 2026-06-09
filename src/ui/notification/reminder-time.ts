/** Local wall-clock time at which reminders fire. */
export interface ReminderTime {
  hour: number;
  minute: number;
}

/** Default fire time until a settings screen exists: 09:00 local. */
export const DEFAULT_REMINDER_TIME: ReminderTime = { hour: 9, minute: 0 };

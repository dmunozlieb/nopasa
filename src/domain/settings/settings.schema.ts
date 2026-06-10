import { z } from 'zod';

/** User preferences. Only fields that are actually wired live here. */
export const settingsSchema = z.object({
  reminderTime: z.object({
    hour: z.number().int().min(0).max(23),
    minute: z.number().int().min(0).max(59),
  }),
  defaultReminderDaysBefore: z.array(z.number().int().nonnegative()),
});

export type Settings = z.infer<typeof settingsSchema>;

/** Returned by the repository when nothing is stored. 09:00, [30, 7]. Mirrors the
 *  planner's DEFAULT_REMINDER_TIME (both 09:00); keep them in sync. */
export const DEFAULT_SETTINGS: Settings = {
  reminderTime: { hour: 9, minute: 0 },
  defaultReminderDaysBefore: [30, 7],
};

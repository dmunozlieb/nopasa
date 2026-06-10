import type { ReminderTime } from './reminder-time';

/** Pure: the local fire-time for each reminderDaysBefore, in the same order. DST-safe —
 *  built from the due date's LOCAL components + the wall-clock reminder time (no ms
 *  arithmetic), so DST shifts between now and the due date never skew it. Single source
 *  of this math: shared by the notification planner and the add-form empty-plan hint. */
export function reminderFireTimes(
  dueDate: Date,
  reminderDaysBefore: number[],
  reminderTime: ReminderTime,
): Date[] {
  return reminderDaysBefore.map(
    (daysBefore) =>
      new Date(
        dueDate.getFullYear(),
        dueDate.getMonth(),
        dueDate.getDate() - daysBefore,
        reminderTime.hour,
        reminderTime.minute,
      ),
  );
}

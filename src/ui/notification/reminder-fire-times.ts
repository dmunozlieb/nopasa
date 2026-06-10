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

/** True iff at least one reminder is selected AND every one fires at/before `now` — i.e.
 *  for this date the user's reminders would all be in the past, producing no future alert.
 *  No reminders selected → false (a deliberate choice, not a "passed" case). */
export function remindersAllInPast(
  dueDate: Date,
  reminderDaysBefore: number[],
  now: Date,
  reminderTime: ReminderTime,
): boolean {
  if (reminderDaysBefore.length === 0) return false;
  return reminderFireTimes(dueDate, reminderDaysBefore, reminderTime).every(
    (fireAt) => fireAt.getTime() <= now.getTime(),
  );
}

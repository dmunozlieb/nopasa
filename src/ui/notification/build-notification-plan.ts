import type { Deadline } from '../../domain/deadline/deadline.schema';
import type { PlannedNotification } from '../../ports/notification-scheduler';
import { buildNotificationContent } from './build-notification-content';
import type { ReminderTime } from './reminder-time';

export interface BuildPlanOptions {
  now: Date;
  reminderTime: ReminderTime;
}

/** Pure: resolves each reminderDaysBefore into a fully-formed notification, dropping
 *  any whose fire time is already at/before `now`. fireAt is built from the due date's
 *  LOCAL components + the wall-clock time (no millisecond arithmetic), so DST shifts
 *  between now and the due date never skew it — same spirit as the domain's daysBetween. */
export function buildNotificationPlan(
  deadline: Deadline,
  options: BuildPlanOptions,
): PlannedNotification[] {
  const plan: PlannedNotification[] = [];
  for (const daysBefore of deadline.reminderDaysBefore) {
    const fireAt = new Date(
      deadline.dueDate.getFullYear(),
      deadline.dueDate.getMonth(),
      deadline.dueDate.getDate() - daysBefore,
      options.reminderTime.hour,
      options.reminderTime.minute,
    );
    if (fireAt.getTime() <= options.now.getTime()) continue;
    plan.push({ fireAt, ...buildNotificationContent(deadline, daysBefore) });
  }
  return plan;
}

import type { Deadline } from '../../domain/deadline/deadline.schema';
import type { PlannedNotification } from '../../ports/notification-scheduler';
import { buildNotificationContent } from './build-notification-content';
import { reminderFireTimes } from './reminder-fire-times';
import type { ReminderTime } from './reminder-time';

export interface BuildPlanOptions {
  now: Date;
  reminderTime: ReminderTime;
}

/** Pure: resolves each reminderDaysBefore into a fully-formed notification, dropping any
 *  whose fire time is already at/before `now`. Fire times come from reminderFireTimes
 *  (DST-safe local-component math), shared with the add-form empty-plan hint. */
export function buildNotificationPlan(
  deadline: Deadline,
  options: BuildPlanOptions,
): PlannedNotification[] {
  const fireTimes = reminderFireTimes(deadline.dueDate, deadline.reminderDaysBefore, options.reminderTime);
  const plan: PlannedNotification[] = [];
  deadline.reminderDaysBefore.forEach((daysBefore, index) => {
    const fireAt = fireTimes[index];
    if (fireAt.getTime() <= options.now.getTime()) return;
    plan.push({ fireAt, ...buildNotificationContent(deadline, daysBefore) });
  });
  return plan;
}

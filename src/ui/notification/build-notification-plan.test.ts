import { buildDeadline } from '../../test-support/build-deadline';
import { buildNotificationPlan } from './build-notification-plan';
import { DEFAULT_REMINDER_TIME } from './reminder-time';

const reminderTime = DEFAULT_REMINDER_TIME;

describe('buildNotificationPlan', () => {
  it('produces one notification per reminder, at the reminder time, preserving order', () => {
    const deadline = buildDeadline({ dueDate: new Date(2026, 8, 1), reminderDaysBefore: [7, 30] });
    const plan = buildNotificationPlan(deadline, { now: new Date(2026, 5, 8), reminderTime });
    expect(plan.map((p) => p.fireAt)).toEqual([
      new Date(2026, 7, 25, 9, 0),
      new Date(2026, 7, 2, 9, 0),
    ]);
  });

  it('builds fireAt from local components (DST-safe across Madrid autumn change)', () => {
    // Madrid falls back on 25 Oct 2026 (a 25-hour day). Due 26 Oct, 7 days before = 19 Oct.
    // Naive `dueDate.getTime() - N*86400000` would drift to 08:00; component math stays 09:00.
    const deadline = buildDeadline({ dueDate: new Date(2026, 9, 26), reminderDaysBefore: [7] });
    const [item] = buildNotificationPlan(deadline, { now: new Date(2026, 0, 1), reminderTime });
    expect(item.fireAt.getFullYear()).toBe(2026);
    expect(item.fireAt.getMonth()).toBe(9);
    expect(item.fireAt.getDate()).toBe(19);
    expect(item.fireAt.getHours()).toBe(9);
    expect(item.fireAt.getMinutes()).toBe(0);
  });

  it('omits reminders whose fire time is already in the past', () => {
    const deadline = buildDeadline({ dueDate: new Date(2026, 5, 20), reminderDaysBefore: [30, 7] });
    // 30-before = 21 May 09:00 (past); 7-before = 13 Jun 09:00 (future).
    const plan = buildNotificationPlan(deadline, { now: new Date(2026, 5, 1, 9, 30), reminderTime });
    expect(plan).toHaveLength(1);
    expect(plan[0].fireAt).toEqual(new Date(2026, 5, 13, 9, 0));
  });

  it('returns an empty plan when all fire times are past or there are no reminders', () => {
    const past = buildDeadline({ dueDate: new Date(2026, 5, 3), reminderDaysBefore: [30, 7] });
    expect(buildNotificationPlan(past, { now: new Date(2026, 5, 2), reminderTime })).toEqual([]);
    const none = buildDeadline({ dueDate: new Date(2026, 8, 1), reminderDaysBefore: [] });
    expect(buildNotificationPlan(none, { now: new Date(2026, 5, 8), reminderTime })).toEqual([]);
  });
});

import { reminderFireTimes } from './reminder-fire-times';
import { DEFAULT_REMINDER_TIME } from './reminder-time';

describe('reminderFireTimes', () => {
  it('returns one local fire-time per reminder, in order, at the reminder time', () => {
    const times = reminderFireTimes(new Date(2026, 8, 1), [7, 30], DEFAULT_REMINDER_TIME);
    expect(times).toEqual([new Date(2026, 7, 25, 9, 0), new Date(2026, 7, 2, 9, 0)]);
  });

  it('builds from local components (DST-safe across the Madrid autumn change)', () => {
    // Madrid falls back on 25 Oct 2026. Due 26 Oct, 7 days before = 19 Oct, still 09:00.
    const [t] = reminderFireTimes(new Date(2026, 9, 26), [7], DEFAULT_REMINDER_TIME);
    expect([t.getFullYear(), t.getMonth(), t.getDate(), t.getHours(), t.getMinutes()]).toEqual([2026, 9, 19, 9, 0]);
  });

  it('returns an empty array when there are no reminders', () => {
    expect(reminderFireTimes(new Date(2026, 8, 1), [], DEFAULT_REMINDER_TIME)).toEqual([]);
  });
});

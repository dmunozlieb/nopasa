import { fromRow, toRow } from './settings-mapper';

const settings = { reminderTime: { hour: 8, minute: 30 }, defaultReminderDaysBefore: [30, 7] };
const row = { reminder_hour: 8, reminder_minute: 30, default_reminder_days_before: '[30,7]' };

describe('settings-mapper', () => {
  it('maps settings → row', () => {
    expect(toRow(settings)).toEqual(row);
  });

  it('round-trips row → settings → row', () => {
    expect(fromRow(row)).toEqual(settings);
    expect(toRow(fromRow(row))).toEqual(row);
  });

  it('throws on a row that violates the schema (out-of-range hour)', () => {
    expect(() => fromRow({ reminder_hour: 99, reminder_minute: 0, default_reminder_days_before: '[7]' })).toThrow();
  });
});

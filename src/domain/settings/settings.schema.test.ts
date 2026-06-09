import { settingsSchema, DEFAULT_SETTINGS } from './settings.schema';

describe('settingsSchema', () => {
  it('accepts a valid settings object', () => {
    const value = { reminderTime: { hour: 8, minute: 30 }, defaultReminderDaysBefore: [30, 7] };
    expect(settingsSchema.parse(value)).toEqual(value);
  });

  it('rejects an out-of-range hour or minute', () => {
    expect(() => settingsSchema.parse({ reminderTime: { hour: 24, minute: 0 }, defaultReminderDaysBefore: [] })).toThrow();
    expect(() => settingsSchema.parse({ reminderTime: { hour: 9, minute: 60 }, defaultReminderDaysBefore: [] })).toThrow();
  });

  it('rejects non-integer / negative reminder days', () => {
    expect(() => settingsSchema.parse({ reminderTime: { hour: 9, minute: 0 }, defaultReminderDaysBefore: [-1] })).toThrow();
  });
});

describe('DEFAULT_SETTINGS', () => {
  it('is 09:00 with [30, 7] and is itself valid', () => {
    expect(DEFAULT_SETTINGS).toEqual({ reminderTime: { hour: 9, minute: 0 }, defaultReminderDaysBefore: [30, 7] });
    expect(settingsSchema.parse(DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS);
  });
});

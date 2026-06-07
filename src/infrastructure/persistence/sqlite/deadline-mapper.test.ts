import { toRow, fromRow, rowToParams } from './deadline-mapper';
import { COLUMNS } from './deadline-row';
import { buildDeadline } from '../../../test-support/build-deadline';

describe('toRow / fromRow round-trip', () => {
  it('round-trips a deadline that has all optional fields present', () => {
    const deadline = buildDeadline({
      id: 'r1',
      subtitle: 'Car technical inspection',
      amount: 49.5,
      amountLabel: 'fee',
      recurrenceMonths: 12,
      photoUri: 'file:///photo.jpg',
      dueDate: new Date(2026, 0, 15),
      createdAt: new Date(2026, 0, 1, 9, 30, 0),
    });
    expect(fromRow(toRow(deadline))).toEqual(deadline);
  });

  it('round-trips a deadline with all optional fields absent', () => {
    const deadline = buildDeadline({ id: 'r2', dueDate: new Date(2026, 5, 7) });
    const restored = fromRow(toRow(deadline));
    expect(restored).toEqual(deadline);
    expect(restored.subtitle).toBeUndefined();
    expect(restored.amount).toBeUndefined();
    expect(restored.recurrenceMonths).toBeUndefined();
  });

  it('preserves the local calendar day of dueDate', () => {
    const deadline = buildDeadline({ dueDate: new Date(2026, 2, 30) });
    expect(fromRow(toRow(deadline)).dueDate).toEqual(new Date(2026, 2, 30));
  });
});

describe('toRow serialization format', () => {
  it('serializes due_date as a date-only string (no time component)', () => {
    const row = toRow(buildDeadline({ dueDate: new Date(2026, 0, 15, 18, 45, 0) }));
    expect(row.due_date).toBe('2026-01-15');
    expect(row.due_date).not.toContain('T');
  });

  it('serializes created_at as a full ISO 8601 instant', () => {
    const createdAt = new Date(2026, 0, 1, 9, 30, 0);
    const row = toRow(buildDeadline({ createdAt }));
    expect(row.created_at).toBe(createdAt.toISOString());
    expect(row.created_at).toContain('T');
  });

  it('serializes reminderDaysBefore as a JSON string', () => {
    const row = toRow(buildDeadline({ reminderDaysBefore: [30, 7] }));
    expect(row.reminder_days_before).toBe('[30,7]');
  });

  it('maps absent optionals to null', () => {
    const row = toRow(buildDeadline({ id: 'r3' }));
    expect(row.subtitle).toBeNull();
    expect(row.amount).toBeNull();
    expect(row.amount_label).toBeNull();
    expect(row.recurrence_months).toBeNull();
    expect(row.photo_uri).toBeNull();
  });
});

describe('rowToParams', () => {
  it('returns positional params in COLUMNS order', () => {
    const params = rowToParams(toRow(buildDeadline({ id: 'r4' })));
    expect(params).toHaveLength(COLUMNS.length);
    expect(params[0]).toBe('r4'); // id is first
    expect(params[COLUMNS.length - 1]).toBe('ACTIVE'); // status is last
  });
});

describe('fromRow edge validation', () => {
  const validRow = () => toRow(buildDeadline({ id: 'v' }));

  it('throws when the status enum is invalid', () => {
    expect(() => fromRow({ ...validRow(), status: 'BOGUS' })).toThrow();
  });

  it('throws when the title is empty', () => {
    expect(() => fromRow({ ...validRow(), title: '' })).toThrow();
  });

  it('throws when reminder_days_before is not valid JSON', () => {
    expect(() => fromRow({ ...validRow(), reminder_days_before: 'not-json' })).toThrow();
  });

  it('throws when reminder_days_before contains a negative number', () => {
    expect(() => fromRow({ ...validRow(), reminder_days_before: '[-5]' })).toThrow();
  });
});

import { deadlineSchema } from './deadline.schema';

const valid = {
  id: 'abc-123',
  type: 'ITV' as const,
  title: 'ITV — Clio',
  dueDate: new Date(2026, 0, 1),
  reminderDaysBefore: [30, 7],
  createdAt: new Date(2026, 0, 1),
  status: 'ACTIVE' as const,
};

describe('deadlineSchema', () => {
  it('accepts a valid minimal deadline (optional fields omitted)', () => {
    expect(() => deadlineSchema.parse(valid)).not.toThrow();
  });

  it('accepts all optional fields when present', () => {
    expect(() =>
      deadlineSchema.parse({
        ...valid,
        subtitle: 'Car technical inspection',
        amount: 49.5,
        amountLabel: 'fee',
        recurrenceMonths: 12,
        photoUri: 'file:///photo.jpg',
      }),
    ).not.toThrow();
  });

  it('rejects an empty title', () => {
    expect(() => deadlineSchema.parse({ ...valid, title: '' })).toThrow();
  });

  it('rejects an unknown type', () => {
    expect(() => deadlineSchema.parse({ ...valid, type: 'CAR' })).toThrow();
  });

  it('rejects a non-positive recurrenceMonths', () => {
    expect(() => deadlineSchema.parse({ ...valid, recurrenceMonths: 0 })).toThrow();
  });

  it('rejects a negative amount', () => {
    expect(() => deadlineSchema.parse({ ...valid, amount: -1 })).toThrow();
  });

  it('rejects negative reminder offsets', () => {
    expect(() => deadlineSchema.parse({ ...valid, reminderDaysBefore: [-5] })).toThrow();
  });

  it('keeps all nine deadline types available', () => {
    const types = [
      'ITV', 'DNI', 'PASSPORT', 'DRIVING_LICENSE', 'INSURANCE',
      'SUBSCRIPTION', 'WARRANTY', 'GAS_INSPECTION', 'OTHER',
    ];
    for (const type of types) {
      expect(() => deadlineSchema.parse({ ...valid, type })).not.toThrow();
    }
  });
});

import { createDeadline, type CreateDeadlineDeps } from './deadline.factory';

const deps: CreateDeadlineDeps = {
  generateId: () => 'generated-id',
  clock: { now: () => new Date(2026, 0, 1, 9, 0, 0) },
};

const baseInput = {
  type: 'SUBSCRIPTION' as const,
  title: 'Netflix',
  dueDate: new Date(2026, 5, 1),
  reminderDaysBefore: [7],
};

describe('createDeadline', () => {
  it('injects id and createdAt from the dependencies', () => {
    const d = createDeadline(baseInput, deps);
    expect(d.id).toBe('generated-id');
    expect(d.createdAt).toEqual(new Date(2026, 0, 1, 9, 0, 0));
  });

  it('defaults status to ACTIVE', () => {
    expect(createDeadline(baseInput, deps).status).toBe('ACTIVE');
  });

  it('honors an explicit status', () => {
    const d = createDeadline({ ...baseInput, status: 'RESOLVED' }, deps);
    expect(d.status).toBe('RESOLVED');
  });

  it('throws on an empty title', () => {
    expect(() => createDeadline({ ...baseInput, title: '' }, deps)).toThrow();
  });

  it('throws on a non-positive recurrenceMonths', () => {
    expect(() => createDeadline({ ...baseInput, recurrenceMonths: 0 }, deps)).toThrow();
  });

  it('throws on a negative amount', () => {
    expect(() => createDeadline({ ...baseInput, amount: -10 }, deps)).toThrow();
  });
});

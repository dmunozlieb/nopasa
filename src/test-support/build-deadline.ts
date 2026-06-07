import type { Deadline } from '../domain/deadline/deadline.schema';

/** Builds a valid Deadline for tests; override any field via `overrides`. */
export function buildDeadline(overrides: Partial<Deadline> = {}): Deadline {
  return {
    id: 'test-id',
    type: 'ITV',
    title: 'ITV — Clio',
    dueDate: new Date(2026, 0, 1),
    reminderDaysBefore: [30, 7],
    createdAt: new Date(2026, 0, 1),
    status: 'ACTIVE',
    ...overrides,
  };
}

import { deadlineSchema, type Deadline, type DeadlineStatus, type DeadlineType } from './deadline.schema';

/** Produces opaque unique ids. Wired to expo-crypto's randomUUID in infrastructure (later). */
export type IdGenerator = () => string;

/** Abstracts the current time so the factory stays pure and testable. */
export interface Clock {
  now(): Date;
}

/** Fields the caller provides; id/createdAt are injected, status defaults to ACTIVE. */
export interface CreateDeadlineInput {
  type: DeadlineType;
  title: string;
  subtitle?: string;
  dueDate: Date;
  amount?: number;
  amountLabel?: string;
  reminderDaysBefore: number[];
  recurrenceMonths?: number;
  photoUri?: string;
  status?: DeadlineStatus;
}

export interface CreateDeadlineDeps {
  generateId: IdGenerator;
  clock: Clock;
}

/** Builds a validated Deadline, injecting id + createdAt and defaulting status to ACTIVE. */
export function createDeadline(input: CreateDeadlineInput, deps: CreateDeadlineDeps): Deadline {
  const candidate = {
    ...input,
    id: deps.generateId(),
    createdAt: deps.clock.now(),
    status: input.status ?? 'ACTIVE',
  };
  return deadlineSchema.parse(candidate);
}

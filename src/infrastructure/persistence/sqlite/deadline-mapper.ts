import { deadlineSchema, type Deadline } from '../../../domain/deadline/deadline.schema';
import { COLUMNS, type DeadlineRow } from './deadline-row';

/** Serializes a Date to a LOCAL calendar-date string "YYYY-MM-DD" (no time, no timezone). */
function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Reconstructs a "YYYY-MM-DD" calendar date as LOCAL midnight. */
function fromLocalDateString(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Domain → row. dueDate becomes a date-only string; createdAt keeps the full ISO instant. */
export function toRow(deadline: Deadline): DeadlineRow {
  return {
    id: deadline.id,
    type: deadline.type,
    title: deadline.title,
    subtitle: deadline.subtitle ?? null,
    due_date: toLocalDateString(deadline.dueDate),
    amount: deadline.amount ?? null,
    amount_label: deadline.amountLabel ?? null,
    reminder_days_before: JSON.stringify(deadline.reminderDaysBefore),
    recurrence_months: deadline.recurrenceMonths ?? null,
    photo_uri: deadline.photoUri ?? null,
    created_at: deadline.createdAt.toISOString(),
    status: deadline.status,
  };
}

/** Positional bind params in canonical COLUMNS order (structurally a SqlParam[]). */
export function rowToParams(row: DeadlineRow): (string | number | null)[] {
  return COLUMNS.map((column) => row[column]);
}

/**
 * Row → domain. Reconstructs raw values (dates, JSON, null→undefined for optionals)
 * and validates with the Zod schema at the edge. Throws on any invalid/corrupt row.
 */
export function fromRow(row: DeadlineRow): Deadline {
  const candidate = {
    id: row.id,
    type: row.type,
    title: row.title,
    subtitle: row.subtitle ?? undefined,
    dueDate: fromLocalDateString(row.due_date),
    amount: row.amount ?? undefined,
    amountLabel: row.amount_label ?? undefined,
    reminderDaysBefore: JSON.parse(row.reminder_days_before),
    recurrenceMonths: row.recurrence_months ?? undefined,
    photoUri: row.photo_uri ?? undefined,
    createdAt: new Date(row.created_at),
    status: row.status,
  };
  return deadlineSchema.parse(candidate);
}

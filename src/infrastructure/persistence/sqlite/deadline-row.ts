/** A raw `deadlines` row: snake_case columns, SQL-primitive values only. */
export interface DeadlineRow {
  id: string;
  type: string;
  title: string;
  subtitle: string | null;
  due_date: string; // calendar date "YYYY-MM-DD"
  amount: number | null;
  amount_label: string | null;
  reminder_days_before: string; // JSON array, e.g. "[30,7]"
  recurrence_months: number | null;
  photo_uri: string | null;
  created_at: string; // full ISO 8601 instant
  status: string;
}

/**
 * Canonical column order — the single source of truth for INSERT/UPDATE
 * parameter binding. `rowToParams` (in the mapper) follows this exact order.
 */
export const COLUMNS = [
  'id',
  'type',
  'title',
  'subtitle',
  'due_date',
  'amount',
  'amount_label',
  'reminder_days_before',
  'recurrence_months',
  'photo_uri',
  'created_at',
  'status',
] as const;

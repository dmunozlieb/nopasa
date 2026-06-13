import type { CreateDeadlineInput } from '../../domain/deadline/deadline.factory';
import type { DeadlineType } from '../../domain/deadline/deadline.schema';
import { startOfDay } from '../../domain/shared/date';

/** Mutable UI state of the add form. `amount` is the raw text the user typed. */
export interface AddFormState {
  type: DeadlineType;
  title: string;
  subtitle: string;
  subtitleTouched: boolean;
  dueDate: Date;
  amount: string;
  reminderDaysBefore: number[];
  recurrenceMonths?: number;
}

export interface AddFormErrors {
  title?: string;
}

export interface AddFormValidation {
  valid: boolean;
  errors: AddFormErrors;
}

/** Title must be non-empty (trimmed). Date is defensively checked for validity. */
export function validateAddForm(state: AddFormState): AddFormValidation {
  const errors: AddFormErrors = {};
  if (state.title.trim().length === 0) errors.title = 'Ponle un nombre';
  const dateOk = state.dueDate instanceof Date && !Number.isNaN(state.dueDate.getTime());
  const valid = Object.keys(errors).length === 0 && dateOk;
  return { valid, errors };
}

/** Parses the raw amount text. Accepts comma decimals; returns undefined unless > 0. */
export function parseAmount(raw: string): number | undefined {
  const normalized = raw.replace(',', '.').trim();
  if (normalized === '') return undefined;
  const n = Number(normalized);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}

/** Largest recurrence we accept; guards against absurd custom input. */
export const MAX_RECURRENCE_MONTHS = 999;

/** Parses the raw custom-recurrence text. Accepts a positive integer up to the cap;
 *  returns undefined for empty, non-numeric, zero, negative, fractional or over-cap. */
export function parseRecurrenceMonths(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (trimmed === '') return undefined;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n <= 0 || n > MAX_RECURRENCE_MONTHS) return undefined;
  return n;
}

/** Maps validated form state to the domain factory input. Omits empty optionals;
 *  normalizes dueDate to local midnight; sorts reminders ascending.
 *  Pass `photoUri` to include the captured photo path in the returned input. */
export function toCreateInput(state: AddFormState, photoUri?: string): CreateDeadlineInput {
  const subtitle = state.subtitle.trim();
  return {
    type: state.type,
    title: state.title.trim(),
    subtitle: subtitle.length > 0 ? subtitle : undefined,
    dueDate: startOfDay(state.dueDate),
    amount: parseAmount(state.amount),
    reminderDaysBefore: [...state.reminderDaysBefore].sort((a, b) => a - b),
    ...(state.recurrenceMonths !== undefined && state.recurrenceMonths > 0
      ? { recurrenceMonths: state.recurrenceMonths }
      : {}),
    ...(photoUri !== undefined ? { photoUri } : {}),
  };
}

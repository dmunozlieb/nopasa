import { startOfDay } from '../shared/date';

/**
 * Adds whole months on LOCAL calendar components, clamping the day to the last
 * day of the target month (31 Jan + 1 month → 28/29 Feb, never March). The result
 * is built at local midnight, so Spain's 23h/25h DST days never skew it.
 */
export function addMonths(date: Date, months: number): Date {
  const total = date.getMonth() + months;
  const targetYear = date.getFullYear() + Math.floor(total / 12);
  const targetMonth = ((total % 12) + 12) % 12;
  const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
  const day = Math.min(date.getDate(), lastDay);
  return new Date(targetYear, targetMonth, day);
}

/**
 * Next due date for a recurring deadline, anchored to the ORIGINAL dueDate so the
 * end-of-month clamp never compounds: each candidate is `addMonths(dueDate,
 * recurrenceMonths × k)` for k = 1, 2, 3…, advancing while the candidate is
 * strictly before today (a candidate equal to today is kept). k starts at 1, so
 * the result is always at least one full period after dueDate.
 */
export function nextDueDate(dueDate: Date, recurrenceMonths: number, now: Date): Date {
  const floor = startOfDay(now).getTime();
  let k = 1;
  let next = addMonths(dueDate, recurrenceMonths * k);
  while (next.getTime() < floor) {
    k += 1;
    next = addMonths(dueDate, recurrenceMonths * k);
  }
  return next;
}

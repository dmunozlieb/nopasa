/** Serializes a Date to a LOCAL calendar-date string "YYYY-MM-DD" (no time, no timezone). */
export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Reconstructs a "YYYY-MM-DD" calendar date as LOCAL midnight. */
export function fromLocalDateString(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Friendly Spanish label for a recurrence period given in months. */
export function recurrenceLabel(months: number): string {
  if (months === 1) return 'Cada mes';
  if (months === 12) return 'Cada año';
  if (months % 12 === 0) return `Cada ${months / 12} años`;
  return `Cada ${months} meses`;
}

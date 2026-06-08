/** Days in a month/year used to roll days up to coarser units. Tweak to retune. */
export const DAYS_PER_MONTH = 30;
export const DAYS_PER_YEAR = 365;
/** At or below this many days we still count in days; above it we switch to months. */
export const DAYS_UNIT_MAX = 60;

const plural = (n: number, singularForm: string, pluralForm: string) =>
  `${n} ${n === 1 ? singularForm : pluralForm}`;

/** Human countdown for a remaining-days value. Presentation only (UI layer). */
export function formatTimeRemaining(daysRemaining: number): string {
  if (daysRemaining < 0) return 'vencido';
  if (daysRemaining === 0) return 'hoy';
  if (daysRemaining <= DAYS_UNIT_MAX) return plural(daysRemaining, 'día', 'días');
  if (daysRemaining < DAYS_PER_YEAR) {
    return plural(Math.round(daysRemaining / DAYS_PER_MONTH), 'mes', 'meses');
  }
  return plural(Math.round(daysRemaining / DAYS_PER_YEAR), 'año', 'años');
}

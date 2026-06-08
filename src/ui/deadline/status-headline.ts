import { formatTimeRemaining } from './format-time-remaining';

/** Status block headline: "{verb} en {countdown}" for future, "{verb} hoy" today,
 *  "Vencido" when overdue (handles the grammar cases the plain template breaks). */
export function statusHeadline(verb: string, days: number): string {
  if (days < 0) return 'Vencido';
  if (days === 0) return `${verb} hoy`;
  return `${verb} en ${formatTimeRemaining(days)}`;
}

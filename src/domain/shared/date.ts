/** Returns the same local calendar day at midnight (time-of-day stripped). */
export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * DST-safe count of whole calendar days from `from` to `to`.
 *
 * Maps each date's LOCAL year/month/day onto UTC — where every day is exactly
 * 24h — so Spain's 23h/25h DST days never skew the result. `Math.round` is a
 * belt-and-suspenders guard against any floating-point dust.
 */
export function daysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / 86_400_000);
}

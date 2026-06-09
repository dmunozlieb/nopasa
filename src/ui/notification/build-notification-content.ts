import type { Deadline } from '../../domain/deadline/deadline.schema';
import { detailPresentation } from '../deadline/detail-presentation';
import { formatShortDate } from '../deadline/format-date';

/** Pure: the title/body for a reminder. Calm tone, reusing the per-type verb from the
 *  detail screen. Countdown is "hoy" for 0, "en 1 día" / "en N días" otherwise. */
export function buildNotificationContent(
  deadline: Deadline,
  daysBefore: number,
): { title: string; body: string } {
  const verb = detailPresentation(deadline.type).verb;
  const countdown =
    daysBefore === 0 ? 'hoy' : `en ${daysBefore} ${daysBefore === 1 ? 'día' : 'días'}`;
  return {
    title: deadline.title,
    body: `${verb} ${countdown} · ${formatShortDate(deadline.dueDate)}`,
  };
}

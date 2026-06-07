import { daysBetween } from '../shared/date';
import type { Deadline } from './deadline.schema';

/** Urgent when daysRemaining <= this (includes overdue). Change here to retune. */
export const URGENT_MAX_DAYS = 10;
/** Upcoming when daysRemaining <= this; calm beyond it. Change here to retune. */
export const UPCOMING_MAX_DAYS = 60;

export type UrgencyLevel = 'urgent' | 'upcoming' | 'calm';

/** Whole calendar days from `today` to the deadline's dueDate (negative if overdue). */
export function daysRemaining(deadline: Deadline, today: Date): number {
  return daysBetween(today, deadline.dueDate);
}

/** Classifies a deadline's urgency using the named thresholds above. */
export function urgencyLevel(deadline: Deadline, today: Date): UrgencyLevel {
  const days = daysRemaining(deadline, today);
  if (days <= URGENT_MAX_DAYS) return 'urgent';
  if (days <= UPCOMING_MAX_DAYS) return 'upcoming';
  return 'calm';
}

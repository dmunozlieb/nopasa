import { daysRemaining, urgencyLevel, type UrgencyLevel } from './urgency';
import type { Deadline } from './deadline.schema';

/**
 * Stable, language-agnostic group keys. The domain holds NO presentation text;
 * mapping these keys to localized labels ("Requieren atención", etc.) is the
 * UI/i18n layer's job in a later session.
 */
export type DeadlineGroup = 'NEEDS_ATTENTION' | 'UPCOMING' | 'CALM';

export interface GroupedDeadlines {
  NEEDS_ATTENTION: Deadline[];
  UPCOMING: Deadline[];
  CALM: Deadline[];
}

const LEVEL_TO_GROUP: Record<UrgencyLevel, DeadlineGroup> = {
  urgent: 'NEEDS_ATTENTION',
  upcoming: 'UPCOMING',
  calm: 'CALM',
};

/**
 * Groups active deadlines into the three buckets and sorts each by daysRemaining
 * ascending (most urgent first). RESOLVED/CANCELLED items are excluded entirely.
 */
export function groupAndSort(list: Deadline[], today: Date): GroupedDeadlines {
  const groups: GroupedDeadlines = { NEEDS_ATTENTION: [], UPCOMING: [], CALM: [] };

  for (const deadline of list) {
    if (deadline.status === 'RESOLVED' || deadline.status === 'CANCELLED') continue;
    groups[LEVEL_TO_GROUP[urgencyLevel(deadline, today)]].push(deadline);
  }

  for (const key of Object.keys(groups) as DeadlineGroup[]) {
    groups[key].sort((a, b) => daysRemaining(a, today) - daysRemaining(b, today));
  }

  return groups;
}

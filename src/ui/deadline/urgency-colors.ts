import type { UrgencyLevel } from '../../domain/deadline/urgency';
import { colors } from '../theme/colors';

export interface UrgencyColorSet {
  base: string;
  tintBg: string;
}

/** Maps a domain urgency level to its color set (pill text/border + tinted background). */
export function urgencyColors(level: UrgencyLevel): UrgencyColorSet {
  return colors.urgency[level];
}

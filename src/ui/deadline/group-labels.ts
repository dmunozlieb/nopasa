import type { DeadlineGroup } from '../../domain/deadline/grouping';

/** UI layer maps language-agnostic domain group keys to Spanish section labels. */
const LABELS: Record<DeadlineGroup, string> = {
  NEEDS_ATTENTION: 'Requieren atención',
  UPCOMING: 'Próximas',
  CALM: 'Tranquilas',
};

export function groupLabel(group: DeadlineGroup): string {
  return LABELS[group];
}

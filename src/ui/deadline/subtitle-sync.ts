import type { DeadlineType } from '../../domain/deadline/deadline.schema';
import { defaultSubtitle } from './default-subtitle';

/** Decides the subtitle to display. While untouched it mirrors the type default;
 *  once the user has touched the field (any edit, including clearing) the current
 *  value is preserved and no longer overwritten. */
export function syncSubtitle(params: {
  type: DeadlineType;
  current: string;
  touched: boolean;
}): string {
  return params.touched ? params.current : defaultSubtitle(params.type);
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { groupAndSort, type GroupedDeadlines } from '../../domain/deadline/grouping';
import type { Deadline } from '../../domain/deadline/deadline.schema';
import { useDeadlineRepository } from '../repository/repository-context';

export type DeadlinesStatus = 'loading' | 'ready' | 'error';

export interface UseDeadlinesResult {
  status: DeadlinesStatus;
  groups: GroupedDeadlines;
  today: Date;
  /** Number of deadlines stored, all statuses (0 while loading). Lets the home tell
   *  "first use" (empty store) apart from "all caught up" (stored but none active). */
  storedCount: number;
  error: unknown;
  refresh: () => Promise<void>;
}

const EMPTY: GroupedDeadlines = { NEEDS_ATTENTION: [], UPCOMING: [], CALM: [] };

/** Lists deadlines from the repository and groups them with the domain's groupAndSort. */
export function useDeadlines(): UseDeadlinesResult {
  const repo = useDeadlineRepository();
  const [status, setStatus] = useState<DeadlinesStatus>('loading');
  const [list, setList] = useState<Deadline[]>([]);
  const [today, setToday] = useState(() => new Date());
  const [error, setError] = useState<unknown>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await repo.list();
      setList(next);
      setToday(new Date());
      setStatus('ready');
    } catch (e) {
      setError(e);
      setStatus('error');
    }
  }, [repo]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const groups = useMemo(
    () => (status === 'ready' ? groupAndSort(list, today) : EMPTY),
    [status, list, today],
  );

  return { status, groups, today, storedCount: list.length, error, refresh };
}

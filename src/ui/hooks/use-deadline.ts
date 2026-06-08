import { useEffect, useState } from 'react';
import type { Deadline } from '../../domain/deadline/deadline.schema';
import { useDeadlineRepository } from '../repository/repository-context';

export type DeadlineLoadStatus = 'loading' | 'error' | 'not-found' | 'ready';

export interface UseDeadlineResult {
  status: DeadlineLoadStatus;
  deadline: Deadline | null;
}

/** Loads one deadline by id from the repository. Distinguishes not-found (null) from error. */
export function useDeadline(id: string): UseDeadlineResult {
  const repo = useDeadlineRepository();
  const [state, setState] = useState<UseDeadlineResult>({ status: 'loading', deadline: null });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const found = await repo.findById(id);
        if (cancelled) return;
        setState(
          found ? { status: 'ready', deadline: found } : { status: 'not-found', deadline: null },
        );
      } catch {
        if (!cancelled) setState({ status: 'error', deadline: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [repo, id]);

  return state;
}

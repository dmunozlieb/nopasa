import { useCallback } from 'react';
import { createDeadline, type CreateDeadlineInput } from '../../domain/deadline/deadline.factory';
import type { Deadline } from '../../domain/deadline/deadline.schema';
import { useDeadlineRepository } from '../repository/repository-context';
import { useDeadlineDeps } from '../deadline-deps/deadline-deps-context';

/** Returns a function that builds a Deadline via the domain factory (id/clock from
 *  DI) and persists it through the repository, returning the created entity. */
export function useCreateDeadline(): (input: CreateDeadlineInput) => Promise<Deadline> {
  const repository = useDeadlineRepository();
  const deps = useDeadlineDeps();
  return useCallback(
    async (input: CreateDeadlineInput) => {
      const deadline = createDeadline(input, deps);
      await repository.save(deadline);
      return deadline;
    },
    [repository, deps],
  );
}

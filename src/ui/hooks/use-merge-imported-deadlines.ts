import { useCallback } from 'react';
import type { Deadline } from '../../domain/deadline/deadline.schema';
import { useDeadlineRepository } from '../repository/repository-context';
import { useDeadlineDeps } from '../deadline-deps/deadline-deps-context';
import { useNotificationScheduler } from '../notification-scheduler/notification-scheduler-context';
import { useSettings } from '../settings/settings-context';
import { buildNotificationPlan } from '../notification/build-notification-plan';

export interface MergeResult {
  imported: number;
  alreadyExisted: number;
}

/** Returns a function that merges imported deadlines into the store non-destructively:
 *  skips any whose id already exists (never overwrites), saves the rest, and best-effort
 *  reschedules reminders for newly-imported ACTIVE ones. Mirrors useCreateDeadline's effects. */
export function useMergeImportedDeadlines(): (deadlines: Deadline[]) => Promise<MergeResult> {
  const repository = useDeadlineRepository();
  const deps = useDeadlineDeps();
  const scheduler = useNotificationScheduler();
  const { settings } = useSettings();
  return useCallback(
    async (deadlines: Deadline[]) => {
      const existing = new Set((await repository.list()).map((d) => d.id));
      let imported = 0;
      let alreadyExisted = 0;
      for (const deadline of deadlines) {
        if (existing.has(deadline.id)) {
          alreadyExisted += 1;
          continue;
        }
        await repository.save(deadline);
        imported += 1;
        if (deadline.status === 'ACTIVE') {
          try {
            const plan = buildNotificationPlan(deadline, {
              now: deps.clock.now(),
              reminderTime: settings.reminderTime,
            });
            await scheduler.schedule(deadline.id, plan);
          } catch {
            // Reminders are best-effort; never fail the import.
          }
        }
      }
      return { imported, alreadyExisted };
    },
    [repository, deps, scheduler, settings],
  );
}

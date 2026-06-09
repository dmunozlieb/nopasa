import { useCallback } from 'react';
import { createDeadline, type CreateDeadlineInput } from '../../domain/deadline/deadline.factory';
import type { Deadline } from '../../domain/deadline/deadline.schema';
import { useDeadlineRepository } from '../repository/repository-context';
import { useDeadlineDeps } from '../deadline-deps/deadline-deps-context';
import { useNotificationScheduler } from '../notification-scheduler/notification-scheduler-context';
import { useSettings } from '../settings/settings-context';
import { buildNotificationPlan } from '../notification/build-notification-plan';

/** Returns a function that builds a Deadline via the domain factory (id/clock from DI),
 *  persists it, then schedules its reminders at the user's configured reminder time.
 *  Scheduling is best-effort: a scheduler failure never fails the save. */
export function useCreateDeadline(): (input: CreateDeadlineInput) => Promise<Deadline> {
  const repository = useDeadlineRepository();
  const deps = useDeadlineDeps();
  const scheduler = useNotificationScheduler();
  const { settings } = useSettings();
  return useCallback(
    async (input: CreateDeadlineInput) => {
      const deadline = createDeadline(input, deps);
      await repository.save(deadline);
      try {
        const plan = buildNotificationPlan(deadline, {
          now: deps.clock.now(),
          reminderTime: settings.reminderTime,
        });
        await scheduler.schedule(deadline.id, plan);
      } catch {
        // Notifications are best-effort; never fail the save because of them.
      }
      return deadline;
    },
    [repository, deps, scheduler, settings],
  );
}

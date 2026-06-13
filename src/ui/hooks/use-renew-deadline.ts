import { useCallback } from 'react';
import type { Deadline } from '../../domain/deadline/deadline.schema';
import { startOfDay } from '../../domain/shared/date';
import { useDeadlineRepository } from '../repository/repository-context';
import { useDeadlineDeps } from '../deadline-deps/deadline-deps-context';
import { useNotificationScheduler } from '../notification-scheduler/notification-scheduler-context';
import { useSettings } from '../settings/settings-context';
import { buildNotificationPlan } from '../notification/build-notification-plan';

/** Returns a function that rolls a recurring deadline forward to a confirmed date:
 *  updates dueDate (normalized to local midnight, status stays ACTIVE), then cancels
 *  and reschedules its reminders. Rescheduling is best-effort: a scheduler failure
 *  never fails the update. Mirrors useCreateDeadline's effect shape. */
export function useRenewDeadline(): (deadline: Deadline, confirmedDate: Date) => Promise<void> {
  const repository = useDeadlineRepository();
  const deps = useDeadlineDeps();
  const scheduler = useNotificationScheduler();
  const { settings } = useSettings();
  return useCallback(
    async (deadline: Deadline, confirmedDate: Date) => {
      const renewed: Deadline = { ...deadline, dueDate: startOfDay(confirmedDate), status: 'ACTIVE' };
      await repository.update(renewed);
      try {
        await scheduler.cancel(renewed.id);
        const plan = buildNotificationPlan(renewed, {
          now: deps.clock.now(),
          reminderTime: settings.reminderTime,
        });
        await scheduler.schedule(renewed.id, plan);
      } catch {
        // Reminders are best-effort; never fail the update because of them.
      }
    },
    [repository, deps, scheduler, settings],
  );
}

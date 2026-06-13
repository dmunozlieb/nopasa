import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { buildDeadline } from '../../test-support/build-deadline';
import { InMemoryDeadlineRepository } from '../../test-support/in-memory-deadline-repository';
import { FakeNotificationScheduler } from '../../test-support/fake-notification-scheduler';
import { InMemorySettingsRepository } from '../../test-support/in-memory-settings-repository';
import type { NotificationScheduler } from '../../ports/notification-scheduler';
import { RepositoryProvider } from '../repository/repository-context';
import { DeadlineDepsProvider } from '../deadline-deps/deadline-deps-context';
import { NotificationSchedulerProvider } from '../notification-scheduler/notification-scheduler-context';
import { SettingsProvider } from '../settings/settings-context';
import { useRenewDeadline } from './use-renew-deadline';

function wrapperWith(
  repo: InMemoryDeadlineRepository,
  scheduler: NotificationScheduler,
  settingsRepo = new InMemorySettingsRepository(),
) {
  return ({ children }: { children: ReactNode }) => (
    <RepositoryProvider repository={repo}>
      <DeadlineDepsProvider generateId={() => 'x'} clock={{ now: () => new Date(2026, 5, 13) }}>
        <NotificationSchedulerProvider scheduler={scheduler}>
          <SettingsProvider repository={settingsRepo}>{children}</SettingsProvider>
        </NotificationSchedulerProvider>
      </DeadlineDepsProvider>
    </RepositoryProvider>
  );
}

describe('useRenewDeadline', () => {
  it('advances the due date (normalized to midnight), keeps ACTIVE and persists', async () => {
    const repo = new InMemoryDeadlineRepository([
      buildDeadline({ id: '1', dueDate: new Date(2026, 5, 8), recurrenceMonths: 12, status: 'ACTIVE' }),
    ]);
    const { result } = await renderHook(() => useRenewDeadline(), {
      wrapper: wrapperWith(repo, new FakeNotificationScheduler()),
    });
    await waitFor(() => expect(typeof result.current).toBe('function'));

    await result.current((await repo.findById('1'))!, new Date(2027, 5, 8, 14, 0));

    const saved = await repo.findById('1');
    expect(saved?.dueDate).toEqual(new Date(2027, 5, 8));
    expect(saved?.status).toBe('ACTIVE');
  });

  it('cancels then reschedules reminders from the new date', async () => {
    const scheduler = new FakeNotificationScheduler();
    const repo = new InMemoryDeadlineRepository([
      buildDeadline({ id: '1', dueDate: new Date(2026, 5, 8), recurrenceMonths: 12, reminderDaysBefore: [7], status: 'ACTIVE' }),
    ]);
    const { result } = await renderHook(() => useRenewDeadline(), {
      wrapper: wrapperWith(repo, scheduler),
    });
    await waitFor(() => expect(typeof result.current).toBe('function'));

    await result.current((await repo.findById('1'))!, new Date(2027, 5, 8));

    expect(scheduler.cancelled).toEqual(['1']);
    const plan = scheduler.scheduled.get('1')!;
    expect(plan).toHaveLength(1);
    expect(plan[0].fireAt).toEqual(new Date(2027, 5, 1, 9, 0)); // 7 days before, default 09:00
  });

  it('persists the update even when rescheduling throws (best-effort)', async () => {
    const throwing: NotificationScheduler = {
      schedule: async () => {},
      cancel: async () => {
        throw new Error('scheduler down');
      },
    };
    const repo = new InMemoryDeadlineRepository([
      buildDeadline({ id: '1', dueDate: new Date(2026, 5, 8), recurrenceMonths: 12, status: 'ACTIVE' }),
    ]);
    const { result } = await renderHook(() => useRenewDeadline(), {
      wrapper: wrapperWith(repo, throwing),
    });
    await waitFor(() => expect(typeof result.current).toBe('function'));

    await result.current((await repo.findById('1'))!, new Date(2027, 5, 8));

    expect((await repo.findById('1'))?.dueDate).toEqual(new Date(2027, 5, 8));
  });
});

import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { InMemoryDeadlineRepository } from '../../test-support/in-memory-deadline-repository';
import { FakeNotificationScheduler } from '../../test-support/fake-notification-scheduler';
import { InMemorySettingsRepository } from '../../test-support/in-memory-settings-repository';
import type { NotificationScheduler } from '../../ports/notification-scheduler';
import { RepositoryProvider } from '../repository/repository-context';
import { DeadlineDepsProvider } from '../deadline-deps/deadline-deps-context';
import { NotificationSchedulerProvider } from '../notification-scheduler/notification-scheduler-context';
import { SettingsProvider } from '../settings/settings-context';
import { useCreateDeadline } from './use-create-deadline';

function wrapperWith(
  repo: InMemoryDeadlineRepository,
  scheduler: NotificationScheduler,
  settingsRepo = new InMemorySettingsRepository(),
) {
  return ({ children }: { children: ReactNode }) => (
    <RepositoryProvider repository={repo}>
      <DeadlineDepsProvider generateId={() => 'fixed-id'} clock={{ now: () => new Date(2026, 5, 8) }}>
        <NotificationSchedulerProvider scheduler={scheduler}>
          <SettingsProvider repository={settingsRepo}>{children}</SettingsProvider>
        </NotificationSchedulerProvider>
      </DeadlineDepsProvider>
    </RepositoryProvider>
  );
}

const input = {
  type: 'ITV' as const,
  title: 'ITV del coche',
  dueDate: new Date(2026, 8, 1),
  reminderDaysBefore: [7, 30],
};

describe('useCreateDeadline', () => {
  it('builds a Deadline with injected id/clock and persists it', async () => {
    const repo = new InMemoryDeadlineRepository();
    const { result } = await renderHook(() => useCreateDeadline(), {
      wrapper: wrapperWith(repo, new FakeNotificationScheduler()),
    });
    await waitFor(() => expect(typeof result.current).toBe('function'));

    const created = await result.current(input);

    expect(created.id).toBe('fixed-id');
    expect(created.createdAt).toEqual(new Date(2026, 5, 8));
    expect(created.status).toBe('ACTIVE');
    expect(await repo.findById('fixed-id')).toMatchObject({ id: 'fixed-id', title: 'ITV del coche' });
  });

  it('schedules reminders at the time from settings', async () => {
    const repo = new InMemoryDeadlineRepository();
    const scheduler = new FakeNotificationScheduler();
    const settingsRepo = new InMemorySettingsRepository({ reminderTime: { hour: 8, minute: 30 }, defaultReminderDaysBefore: [30, 7] });
    const { result } = await renderHook(() => useCreateDeadline(), {
      wrapper: wrapperWith(repo, scheduler, settingsRepo),
    });
    await waitFor(() => expect(typeof result.current).toBe('function'));

    await result.current(input);

    const plan = scheduler.scheduled.get('fixed-id')!;
    expect(plan.map((p) => [p.fireAt.getHours(), p.fireAt.getMinutes()])).toEqual([
      [8, 30],
      [8, 30],
    ]);
  });

  it('persists even when scheduling throws (best-effort)', async () => {
    const repo = new InMemoryDeadlineRepository();
    const throwing: NotificationScheduler = {
      schedule: async () => {
        throw new Error('scheduler down');
      },
      cancel: async () => {},
    };
    const { result } = await renderHook(() => useCreateDeadline(), {
      wrapper: wrapperWith(repo, throwing),
    });
    await waitFor(() => expect(typeof result.current).toBe('function'));

    const created = await result.current(input);

    expect(created.id).toBe('fixed-id');
    expect(await repo.findById('fixed-id')).not.toBeNull();
  });
});

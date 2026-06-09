import type { ReactNode } from 'react';
import { renderHook } from '@testing-library/react-native';
import { InMemoryDeadlineRepository } from '../../test-support/in-memory-deadline-repository';
import { FakeNotificationScheduler } from '../../test-support/fake-notification-scheduler';
import type { NotificationScheduler } from '../../ports/notification-scheduler';
import { RepositoryProvider } from '../repository/repository-context';
import { DeadlineDepsProvider } from '../deadline-deps/deadline-deps-context';
import { NotificationSchedulerProvider } from '../notification-scheduler/notification-scheduler-context';
import { useCreateDeadline } from './use-create-deadline';

function wrapperWith(repo: InMemoryDeadlineRepository, scheduler: NotificationScheduler) {
  return ({ children }: { children: ReactNode }) => (
    <RepositoryProvider repository={repo}>
      <DeadlineDepsProvider generateId={() => 'fixed-id'} clock={{ now: () => new Date(2026, 5, 8) }}>
        <NotificationSchedulerProvider scheduler={scheduler}>{children}</NotificationSchedulerProvider>
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

    const created = await result.current(input);

    expect(created.id).toBe('fixed-id');
    expect(created.createdAt).toEqual(new Date(2026, 5, 8));
    expect(created.status).toBe('ACTIVE');
    expect(await repo.findById('fixed-id')).toMatchObject({ id: 'fixed-id', title: 'ITV del coche' });
  });

  it('schedules the reminder plan for the new deadline', async () => {
    const repo = new InMemoryDeadlineRepository();
    const scheduler = new FakeNotificationScheduler();
    const { result } = await renderHook(() => useCreateDeadline(), {
      wrapper: wrapperWith(repo, scheduler),
    });

    await result.current(input);

    expect(scheduler.scheduled.get('fixed-id')).toEqual([
      { fireAt: new Date(2026, 7, 25, 9, 0), title: 'ITV del coche', body: 'Caduca en 7 días · 1 sep' },
      { fireAt: new Date(2026, 7, 2, 9, 0), title: 'ITV del coche', body: 'Caduca en 30 días · 1 sep' },
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

    const created = await result.current(input);

    expect(created.id).toBe('fixed-id');
    expect(await repo.findById('fixed-id')).not.toBeNull();
  });
});

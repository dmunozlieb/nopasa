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
import { useMergeImportedDeadlines } from './use-merge-imported-deadlines';

function wrapperWith(repo: InMemoryDeadlineRepository, scheduler: NotificationScheduler) {
  return ({ children }: { children: ReactNode }) => (
    <RepositoryProvider repository={repo}>
      <DeadlineDepsProvider generateId={() => 'x'} clock={{ now: () => new Date(2026, 5, 13) }}>
        <NotificationSchedulerProvider scheduler={scheduler}>
          <SettingsProvider repository={new InMemorySettingsRepository()}>{children}</SettingsProvider>
        </NotificationSchedulerProvider>
      </DeadlineDepsProvider>
    </RepositoryProvider>
  );
}

describe('useMergeImportedDeadlines', () => {
  it('skips existing ids (never overwrites) and saves new ones', async () => {
    const repo = new InMemoryDeadlineRepository([buildDeadline({ id: 'existing', title: 'ITV — Clio' })]);
    const { result } = await renderHook(() => useMergeImportedDeadlines(), {
      wrapper: wrapperWith(repo, new FakeNotificationScheduler()),
    });
    await waitFor(() => expect(typeof result.current).toBe('function'));

    const outcome = await result.current([
      buildDeadline({ id: 'existing', title: 'SHOULD NOT OVERWRITE' }),
      buildDeadline({ id: 'new', title: 'New one' }),
    ]);

    expect(outcome).toEqual({ imported: 1, alreadyExisted: 1 });
    expect((await repo.findById('existing'))?.title).toBe('ITV — Clio');
    expect((await repo.findById('new'))?.title).toBe('New one');
  });

  it('reschedules reminders only for new ACTIVE deadlines', async () => {
    const scheduler = new FakeNotificationScheduler();
    const repo = new InMemoryDeadlineRepository();
    const { result } = await renderHook(() => useMergeImportedDeadlines(), {
      wrapper: wrapperWith(repo, scheduler),
    });
    await waitFor(() => expect(typeof result.current).toBe('function'));

    await result.current([
      buildDeadline({ id: 'active', status: 'ACTIVE', dueDate: new Date(2027, 0, 1), reminderDaysBefore: [7] }),
      buildDeadline({ id: 'resolved', status: 'RESOLVED', dueDate: new Date(2027, 0, 1), reminderDaysBefore: [7] }),
    ]);

    expect(scheduler.scheduled.has('active')).toBe(true);
    expect(scheduler.scheduled.has('resolved')).toBe(false);
  });

  it('saves even if rescheduling throws (best-effort)', async () => {
    const throwing: NotificationScheduler = {
      schedule: async () => { throw new Error('down'); },
      cancel: async () => {},
    };
    const repo = new InMemoryDeadlineRepository();
    const { result } = await renderHook(() => useMergeImportedDeadlines(), {
      wrapper: wrapperWith(repo, throwing),
    });
    await waitFor(() => expect(typeof result.current).toBe('function'));

    const outcome = await result.current([
      buildDeadline({ id: 'a', status: 'ACTIVE', dueDate: new Date(2027, 0, 1), reminderDaysBefore: [7] }),
    ]);

    expect(outcome.imported).toBe(1);
    expect(await repo.findById('a')).not.toBeNull();
  });

  it('counts a duplicate id within one batch as already-existing (no double import)', async () => {
    const repo = new InMemoryDeadlineRepository();
    const { result } = await renderHook(() => useMergeImportedDeadlines(), {
      wrapper: wrapperWith(repo, new FakeNotificationScheduler()),
    });
    await waitFor(() => expect(typeof result.current).toBe('function'));

    const outcome = await result.current([
      buildDeadline({ id: 'dup', title: 'First' }),
      buildDeadline({ id: 'dup', title: 'Second' }),
    ]);

    expect(outcome).toEqual({ imported: 1, alreadyExisted: 1 });
    expect((await repo.findById('dup'))?.title).toBe('First'); // first wins, not overwritten
  });
});

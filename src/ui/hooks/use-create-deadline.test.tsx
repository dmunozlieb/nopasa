import type { ReactNode } from 'react';
import { renderHook } from '@testing-library/react-native';
import { InMemoryDeadlineRepository } from '../../test-support/in-memory-deadline-repository';
import { RepositoryProvider } from '../repository/repository-context';
import { DeadlineDepsProvider } from '../deadline-deps/deadline-deps-context';
import { useCreateDeadline } from './use-create-deadline';

describe('useCreateDeadline', () => {
  it('builds a Deadline with injected id/clock and persists it', async () => {
    const repo = new InMemoryDeadlineRepository();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <RepositoryProvider repository={repo}>
        <DeadlineDepsProvider generateId={() => 'fixed-id'} clock={{ now: () => new Date(2026, 5, 8) }}>
          {children}
        </DeadlineDepsProvider>
      </RepositoryProvider>
    );
    const { result } = await renderHook(() => useCreateDeadline(), { wrapper });

    const created = await result.current({
      type: 'ITV',
      title: 'ITV del coche',
      dueDate: new Date(2026, 8, 1),
      reminderDaysBefore: [30, 7],
    });

    expect(created.id).toBe('fixed-id');
    expect(created.createdAt).toEqual(new Date(2026, 5, 8));
    expect(created.status).toBe('ACTIVE');
    expect(await repo.findById('fixed-id')).toMatchObject({ id: 'fixed-id', title: 'ITV del coche' });
  });
});

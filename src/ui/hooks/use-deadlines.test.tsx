import type { ReactNode } from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { buildDeadline } from '../../test-support/build-deadline';
import { InMemoryDeadlineRepository } from '../../test-support/in-memory-deadline-repository';
import { RepositoryProvider } from '../repository/repository-context';
import { useDeadlines } from './use-deadlines';

const wrapper =
  (repo: InMemoryDeadlineRepository) =>
  ({ children }: { children: ReactNode }) =>
    <RepositoryProvider repository={repo}>{children}</RepositoryProvider>;

describe('useDeadlines', () => {
  it('loads and groups deadlines into ready state', async () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 5); // urgent (<=10 days)
    const repo = new InMemoryDeadlineRepository([buildDeadline({ id: 'a', dueDate: soon })]);

    const { result } = await renderHook(() => useDeadlines(), { wrapper: wrapper(repo) });

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.groups.NEEDS_ATTENTION).toHaveLength(1);
    expect(result.current.groups.UPCOMING).toHaveLength(0);
  });

  it('refresh re-reads the repository', async () => {
    const repo = new InMemoryDeadlineRepository();
    const { result } = await renderHook(() => useDeadlines(), { wrapper: wrapper(repo) });
    await waitFor(() => expect(result.current.status).toBe('ready'));

    const soon = new Date();
    soon.setDate(soon.getDate() + 3);
    await repo.save(buildDeadline({ id: 'b', dueDate: soon }));
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.groups.NEEDS_ATTENTION).toHaveLength(1);
  });

  it('exposes storedCount including resolved/cancelled deadlines', async () => {
    const repo = new InMemoryDeadlineRepository([
      buildDeadline({ id: 'a', status: 'RESOLVED' }),
      buildDeadline({ id: 'b', status: 'CANCELLED' }),
    ]);
    const { result } = await renderHook(() => useDeadlines(), { wrapper: wrapper(repo) });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.storedCount).toBe(2);
    expect(result.current.groups.NEEDS_ATTENTION).toHaveLength(0); // both excluded from groups
  });
});

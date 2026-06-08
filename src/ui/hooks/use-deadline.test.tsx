import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { buildDeadline } from '../../test-support/build-deadline';
import { InMemoryDeadlineRepository } from '../../test-support/in-memory-deadline-repository';
import { RepositoryProvider } from '../repository/repository-context';
import { useDeadline } from './use-deadline';

const wrapper =
  (repo: InMemoryDeadlineRepository) =>
  ({ children }: { children: ReactNode }) =>
    <RepositoryProvider repository={repo}>{children}</RepositoryProvider>;

describe('useDeadline', () => {
  it('loads an existing deadline into ready state', async () => {
    const repo = new InMemoryDeadlineRepository([buildDeadline({ id: 'a', title: 'ITV — Clio' })]);
    const { result } = await renderHook(() => useDeadline('a'), { wrapper: wrapper(repo) });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.deadline?.title).toBe('ITV — Clio');
  });

  it('reports not-found when the id is absent', async () => {
    const repo = new InMemoryDeadlineRepository();
    const { result } = await renderHook(() => useDeadline('missing'), { wrapper: wrapper(repo) });
    await waitFor(() => expect(result.current.status).toBe('not-found'));
    expect(result.current.deadline).toBeNull();
  });

  it('reports error when the repository throws', async () => {
    const repo = { findById: async () => { throw new Error('boom'); } } as unknown as InMemoryDeadlineRepository;
    const { result } = await renderHook(() => useDeadline('a'), { wrapper: wrapper(repo) });
    await waitFor(() => expect(result.current.status).toBe('error'));
  });
});

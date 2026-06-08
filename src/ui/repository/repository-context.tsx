import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { DeadlineRepository } from '../../ports/deadline-repository';
import { createDeadlineRepository } from '../../infrastructure/persistence/sqlite/create-deadline-repository';
import { Loading } from '../components/Loading';

const RepositoryContext = createContext<DeadlineRepository | null>(null);

interface RepositoryProviderProps {
  /** Inject a ready repository (tests/previews). Omit to build the real SQLite one. */
  repository?: DeadlineRepository;
  children: ReactNode;
}

export function RepositoryProvider({ repository, children }: RepositoryProviderProps) {
  const [built, setBuilt] = useState<DeadlineRepository | null>(repository ?? null);

  useEffect(() => {
    if (repository) return;
    let cancelled = false;
    void (async () => {
      const repo = await createDeadlineRepository();
      if (!cancelled) setBuilt(repo);
    })();
    return () => {
      cancelled = true;
    };
  }, [repository]);

  if (!built) return <Loading />;

  return <RepositoryContext.Provider value={built}>{children}</RepositoryContext.Provider>;
}

export function useDeadlineRepository(): DeadlineRepository {
  const repo = useContext(RepositoryContext);
  if (!repo) {
    throw new Error('useDeadlineRepository must be used within a RepositoryProvider');
  }
  return repo;
}

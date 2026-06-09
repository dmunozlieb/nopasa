import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Clock, IdGenerator } from '../../domain/deadline/deadline.factory';
import { expoCryptoIdGenerator } from '../../infrastructure/id/expo-crypto-id-generator';
import { systemClock } from '../../infrastructure/clock/system-clock';

/** Dependencies the domain factory needs. The clock is deliberately exposed here
 *  so it can later graduate into an app-wide cross-cutting dependency. */
export interface DeadlineDeps {
  generateId: IdGenerator;
  clock: Clock;
}

const DeadlineDepsContext = createContext<DeadlineDeps | null>(null);

interface DeadlineDepsProviderProps {
  /** Inject a deterministic id generator (tests). Omit for production. */
  generateId?: IdGenerator;
  /** Inject a fixed clock (tests). Omit for production. */
  clock?: Clock;
  children: ReactNode;
}

export function DeadlineDepsProvider({ generateId, clock, children }: DeadlineDepsProviderProps) {
  const value = useMemo<DeadlineDeps>(
    () => ({ generateId: generateId ?? expoCryptoIdGenerator, clock: clock ?? systemClock }),
    [generateId, clock],
  );
  return <DeadlineDepsContext.Provider value={value}>{children}</DeadlineDepsContext.Provider>;
}

export function useDeadlineDeps(): DeadlineDeps {
  const deps = useContext(DeadlineDepsContext);
  if (!deps) {
    throw new Error('useDeadlineDeps must be used within a DeadlineDepsProvider');
  }
  return deps;
}

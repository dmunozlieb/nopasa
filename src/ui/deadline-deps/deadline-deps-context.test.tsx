import type { ReactNode } from 'react';
import { renderHook } from '@testing-library/react-native';
import { DeadlineDepsProvider, useDeadlineDeps } from './deadline-deps-context';

describe('useDeadlineDeps', () => {
  it('returns the injected generateId and clock', async () => {
    const clock = { now: () => new Date(2026, 5, 8) };
    const generateId = () => 'fixed-id';
    const wrapper = ({ children }: { children: ReactNode }) => (
      <DeadlineDepsProvider generateId={generateId} clock={clock}>{children}</DeadlineDepsProvider>
    );
    const { result } = await renderHook(() => useDeadlineDeps(), { wrapper });
    expect(result.current.generateId()).toBe('fixed-id');
    expect(result.current.clock.now()).toEqual(new Date(2026, 5, 8));
  });

  it('falls back to production defaults when no overrides are given', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <DeadlineDepsProvider>{children}</DeadlineDepsProvider>
    );
    const { result } = await renderHook(() => useDeadlineDeps(), { wrapper });
    expect(typeof result.current.generateId()).toBe('string');
    expect(result.current.clock.now()).toBeInstanceOf(Date);
  });

  it('throws when used outside the provider', async () => {
    await expect(renderHook(() => useDeadlineDeps())).rejects.toThrow(
      'useDeadlineDeps must be used within a DeadlineDepsProvider',
    );
  });
});

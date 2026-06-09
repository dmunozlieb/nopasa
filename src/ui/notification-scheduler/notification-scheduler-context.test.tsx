import type { ReactNode } from 'react';
import { renderHook } from '@testing-library/react-native';
import { FakeNotificationScheduler } from '../../test-support/fake-notification-scheduler';
import {
  NotificationSchedulerProvider,
  useNotificationScheduler,
} from './notification-scheduler-context';

describe('useNotificationScheduler', () => {
  it('returns the injected scheduler', async () => {
    const scheduler = new FakeNotificationScheduler();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NotificationSchedulerProvider scheduler={scheduler}>{children}</NotificationSchedulerProvider>
    );
    const { result } = await renderHook(() => useNotificationScheduler(), { wrapper });
    expect(result.current).toBe(scheduler);
  });

  it('falls back to the production default when none is injected', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NotificationSchedulerProvider>{children}</NotificationSchedulerProvider>
    );
    const { result } = await renderHook(() => useNotificationScheduler(), { wrapper });
    expect(typeof result.current.schedule).toBe('function');
    expect(typeof result.current.cancel).toBe('function');
  });

  it('throws when used outside the provider', async () => {
    await expect(renderHook(() => useNotificationScheduler())).rejects.toThrow(
      'useNotificationScheduler must be used within a NotificationSchedulerProvider',
    );
  });
});

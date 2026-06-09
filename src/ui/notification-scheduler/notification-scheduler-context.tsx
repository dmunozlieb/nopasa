import { createContext, useContext, type ReactNode } from 'react';
import type { NotificationScheduler } from '../../ports/notification-scheduler';
import { expoNotificationScheduler } from '../../infrastructure/notifications/expo-notification-scheduler';

const NotificationSchedulerContext = createContext<NotificationScheduler | null>(null);

interface NotificationSchedulerProviderProps {
  /** Inject a fake (tests). Omit for the production expo-notifications adapter. */
  scheduler?: NotificationScheduler;
  children: ReactNode;
}

export function NotificationSchedulerProvider({
  scheduler,
  children,
}: NotificationSchedulerProviderProps) {
  return (
    <NotificationSchedulerContext.Provider value={scheduler ?? expoNotificationScheduler}>
      {children}
    </NotificationSchedulerContext.Provider>
  );
}

export function useNotificationScheduler(): NotificationScheduler {
  const scheduler = useContext(NotificationSchedulerContext);
  if (!scheduler) {
    throw new Error('useNotificationScheduler must be used within a NotificationSchedulerProvider');
  }
  return scheduler;
}

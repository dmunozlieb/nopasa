import { Platform } from 'react-native';
import type { NotificationScheduler, PlannedNotification } from '../../ports/notification-scheduler';

const ANDROID_CHANNEL_ID = 'reminders';

type ExpoNotifications = typeof import('expo-notifications');

/**
 * Loads expo-notifications lazily, at the moment of use rather than at import.
 *
 * Importing the module eagerly runs its top-level device-push-token
 * auto-registration side effect (DevicePushTokenAutoRegistration.fx), which calls
 * addPushTokenListener → throws in Expo Go on Android (push was removed from Expo
 * Go in SDK 53). An inline require defers that evaluation to first use, keeping app
 * startup working in Expo Go; the calls below run only from the best-effort
 * create/mark flows, so a throw here is swallowed there (no notifications in Expo
 * Go, full support in a development build). Metro optimizes inline requires; jest
 * resolves the mocked module the same way.
 */
function loadNotifications(): ExpoNotifications {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-notifications') as ExpoNotifications;
}

/** Asks for notification permission only when needed. Returns whether it is granted. */
async function ensurePermission(notifications: ExpoNotifications): Promise<boolean> {
  const current = await notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await notifications.requestPermissionsAsync();
  return requested.granted;
}

/** Thin adapter over expo-notifications. Confined to infrastructure; mocked in tests. */
export const expoNotificationScheduler: NotificationScheduler = {
  async schedule(deadlineId: string, plan: PlannedNotification[]): Promise<void> {
    if (plan.length === 0) return; // nothing to schedule → no permission prompt
    const Notifications = loadNotifications();
    if (!(await ensurePermission(Notifications))) return; // best-effort: denied → schedule nothing
    if (Platform.OS === 'android') {
      // Android silently drops scheduled notifications without a channel.
      await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
        name: 'Avisos de vencimientos',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    for (const item of plan) {
      await Notifications.scheduleNotificationAsync({
        content: { title: item.title, body: item.body, data: { deadlineId } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: item.fireAt },
      });
    }
  },

  async cancel(deadlineId: string): Promise<void> {
    const Notifications = loadNotifications();
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const request of scheduled) {
      if (request.content?.data?.deadlineId === deadlineId) {
        await Notifications.cancelScheduledNotificationAsync(request.identifier);
      }
    }
  },
};

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { NotificationScheduler, PlannedNotification } from '../../ports/notification-scheduler';

const ANDROID_CHANNEL_ID = 'reminders';

/** Asks for notification permission only when needed. Returns whether it is granted. */
async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

/** Thin adapter over expo-notifications. Confined to infrastructure; mocked in tests. */
export const expoNotificationScheduler: NotificationScheduler = {
  async schedule(deadlineId: string, plan: PlannedNotification[]): Promise<void> {
    if (plan.length === 0) return; // nothing to schedule → no permission prompt
    if (!(await ensurePermission())) return; // best-effort: denied → schedule nothing
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
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const request of scheduled) {
      if (request.content?.data?.deadlineId === deadlineId) {
        await Notifications.cancelScheduledNotificationAsync(request.identifier);
      }
    }
  },
};

import * as Notifications from 'expo-notifications';
import { expoNotificationScheduler } from './expo-notification-scheduler';
import type { PlannedNotification } from '../../ports/notification-scheduler';

const plan: PlannedNotification[] = [
  { fireAt: new Date(2026, 7, 25, 9, 0), title: 'ITV del coche', body: 'Caduca en 7 días · 1 sep' },
  { fireAt: new Date(2026, 7, 2, 9, 0), title: 'ITV del coche', body: 'Caduca en 30 días · 1 sep' },
];

describe('expoNotificationScheduler', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does nothing for an empty plan (no permission prompt)', async () => {
    await expoNotificationScheduler.schedule('d1', []);
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('schedules one tagged notification per plan item when permission is granted', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    await expoNotificationScheduler.schedule('d1', plan);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
      content: { title: 'ITV del coche', body: 'Caduca en 7 días · 1 sep', data: { deadlineId: 'd1' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(2026, 7, 25, 9, 0) },
    });
  });

  it('requests permission when undetermined and schedules nothing if denied', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });
    await expoNotificationScheduler.schedule('d1', plan);
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('cancels only the notifications tagged with the given deadline id', async () => {
    (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([
      { identifier: 'a', content: { data: { deadlineId: 'd1' } } },
      { identifier: 'b', content: { data: { deadlineId: 'd2' } } },
      { identifier: 'c', content: { data: { deadlineId: 'd1' } } },
    ]);
    await expoNotificationScheduler.cancel('d1');
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(2);
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('a');
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('c');
  });
});

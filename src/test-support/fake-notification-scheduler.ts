import type { NotificationScheduler, PlannedNotification } from '../ports/notification-scheduler';

/** In-memory NotificationScheduler for tests. Records schedule/cancel calls. */
export class FakeNotificationScheduler implements NotificationScheduler {
  readonly scheduled = new Map<string, PlannedNotification[]>();
  readonly cancelled: string[] = [];

  async schedule(deadlineId: string, plan: PlannedNotification[]): Promise<void> {
    this.scheduled.set(deadlineId, plan);
  }

  async cancel(deadlineId: string): Promise<void> {
    this.cancelled.push(deadlineId);
    this.scheduled.delete(deadlineId);
  }
}

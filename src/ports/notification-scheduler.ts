/** A single resolved local notification: when to fire and what to show. */
export interface PlannedNotification {
  fireAt: Date;
  title: string;
  body: string;
}

/**
 * Effects port for local notifications. The UI depends on this, never on
 * expo-notifications directly. Implementations execute a pre-computed plan;
 * planning is pure app logic that lives elsewhere.
 */
export interface NotificationScheduler {
  /** Schedule every notification in `plan`, tagged so it can be cancelled later by id. */
  schedule(deadlineId: string, plan: PlannedNotification[]): Promise<void>;
  /** Cancel all pending notifications previously scheduled for `deadlineId`. */
  cancel(deadlineId: string): Promise<void>;
}

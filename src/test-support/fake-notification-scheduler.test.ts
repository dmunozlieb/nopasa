import { FakeNotificationScheduler } from './fake-notification-scheduler';
import type { PlannedNotification } from '../ports/notification-scheduler';

const plan: PlannedNotification[] = [
  { fireAt: new Date(2026, 7, 25, 9, 0), title: 'ITV del coche', body: 'Caduca en 7 días · 1 sep' },
];

describe('FakeNotificationScheduler', () => {
  it('records a scheduled plan by deadline id', async () => {
    const fake = new FakeNotificationScheduler();
    await fake.schedule('d1', plan);
    expect(fake.scheduled.get('d1')).toEqual(plan);
  });

  it('records cancellations and drops the scheduled plan', async () => {
    const fake = new FakeNotificationScheduler();
    await fake.schedule('d1', plan);
    await fake.cancel('d1');
    expect(fake.cancelled).toEqual(['d1']);
    expect(fake.scheduled.has('d1')).toBe(false);
  });
});

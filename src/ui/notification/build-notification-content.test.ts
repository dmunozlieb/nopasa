import { buildDeadline } from '../../test-support/build-deadline';
import { buildNotificationContent } from './build-notification-content';

describe('buildNotificationContent', () => {
  it('uses the per-type verb, the countdown and a short date (plural)', () => {
    const d = buildDeadline({ type: 'ITV', title: 'ITV del coche', dueDate: new Date(2026, 5, 11) });
    expect(buildNotificationContent(d, 7)).toEqual({
      title: 'ITV del coche',
      body: 'Caduca en 7 días · 11 jun',
    });
  });

  it('uses the singular "día" for one day and the subscription verb', () => {
    const d = buildDeadline({ type: 'SUBSCRIPTION', title: 'Netflix', dueDate: new Date(2026, 5, 12) });
    expect(buildNotificationContent(d, 1)).toEqual({
      title: 'Netflix',
      body: 'Se cobra en 1 día · 12 jun',
    });
  });

  it('says "hoy" when daysBefore is 0', () => {
    const d = buildDeadline({ type: 'GAS_INSPECTION', title: 'Revisión gas', dueDate: new Date(2026, 6, 4) });
    expect(buildNotificationContent(d, 0)).toEqual({
      title: 'Revisión gas',
      body: 'Vence hoy · 4 jul',
    });
  });
});

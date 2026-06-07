import { COLUMNS } from './deadline-row';

describe('COLUMNS', () => {
  it('lists the 12 deadline columns in canonical snake_case order', () => {
    expect(COLUMNS).toEqual([
      'id',
      'type',
      'title',
      'subtitle',
      'due_date',
      'amount',
      'amount_label',
      'reminder_days_before',
      'recurrence_months',
      'photo_uri',
      'created_at',
      'status',
    ]);
  });
});

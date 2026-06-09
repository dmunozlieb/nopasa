import { MIGRATIONS } from './migrations';

describe('MIGRATIONS', () => {
  it('has strictly ascending, unique versions starting at 1', () => {
    const versions = MIGRATIONS.map((m) => m.version);
    expect(versions[0]).toBe(1);
    for (let i = 1; i < versions.length; i++) {
      expect(versions[i]).toBeGreaterThan(versions[i - 1]);
    }
  });

  it('v1 creates the deadlines table with all 12 columns', () => {
    const v1 = MIGRATIONS.find((m) => m.version === 1);
    expect(v1).toBeDefined();
    const sql = v1!.sql;
    expect(sql).toContain('CREATE TABLE deadlines');
    expect(sql).toContain('id TEXT PRIMARY KEY');
    for (const column of [
      'type', 'title', 'subtitle', 'due_date', 'amount', 'amount_label',
      'reminder_days_before', 'recurrence_months', 'photo_uri', 'created_at', 'status',
    ]) {
      expect(sql).toContain(column);
    }
  });

  it('v2 creates the settings table with its columns', () => {
    const v2 = MIGRATIONS.find((m) => m.version === 2);
    expect(v2).toBeDefined();
    const sql = v2!.sql;
    expect(sql).toContain('CREATE TABLE settings');
    for (const column of ['id', 'reminder_hour', 'reminder_minute', 'default_reminder_days_before']) {
      expect(sql).toContain(column);
    }
  });
});

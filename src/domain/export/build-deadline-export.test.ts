import { buildDeadlineExport } from './build-deadline-export';
import { buildDeadline } from '../../test-support/build-deadline';

const exportedAt = new Date(2026, 5, 10, 9, 0, 0);

describe('buildDeadlineExport', () => {
  it('wraps deadlines in the versioned envelope', () => {
    const parsed = JSON.parse(buildDeadlineExport([], { exportedAt }));
    expect(parsed.app).toBe('nopasa');
    expect(parsed.schema).toBe(1);
    expect(parsed.exportedAt).toBe(exportedAt.toISOString());
    expect(parsed.deadlines).toEqual([]);
  });

  it('includes deadlines of every status and round-trips through JSON', () => {
    const deadlines = [
      buildDeadline({ id: 'a', status: 'ACTIVE' }),
      buildDeadline({ id: 'r', status: 'RESOLVED' }),
      buildDeadline({ id: 'c', status: 'CANCELLED' }),
    ];
    const parsed = JSON.parse(buildDeadlineExport(deadlines, { exportedAt }));
    expect(parsed).toEqual({
      app: 'nopasa',
      schema: 1,
      exportedAt: exportedAt.toISOString(),
      deadlines: JSON.parse(JSON.stringify(deadlines)),
    });
    expect(parsed.deadlines.map((d: { status: string }) => d.status)).toEqual([
      'ACTIVE',
      'RESOLVED',
      'CANCELLED',
    ]);
  });
});

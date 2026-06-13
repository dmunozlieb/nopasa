import { buildDeadlineExport } from '../export/build-deadline-export';
import { buildDeadline } from '../../test-support/build-deadline';
import { parseDeadlineImport } from './parse-deadline-import';

describe('parseDeadlineImport', () => {
  it('round-trips a valid export, reconstructing dates as the exact instants', () => {
    const original = [
      buildDeadline({ id: 'a', dueDate: new Date(2027, 5, 19), createdAt: new Date(2026, 0, 2, 9, 30) }),
      buildDeadline({ id: 'b', status: 'RESOLVED' }),
    ];
    const json = buildDeadlineExport(original, { exportedAt: new Date(2026, 5, 10) });

    const { deadlines, invalidCount, schemaError } = parseDeadlineImport(json);

    expect(schemaError).toBeUndefined();
    expect(invalidCount).toBe(0);
    expect(deadlines).toHaveLength(2);
    expect(deadlines[0].id).toBe('a');
    expect(deadlines[0].dueDate).toBeInstanceOf(Date);
    expect(deadlines[0].dueDate).toEqual(new Date(2027, 5, 19)); // exact instant = local midnight in Madrid
    expect(deadlines[0].createdAt).toEqual(new Date(2026, 0, 2, 9, 30));
    expect(deadlines[1].status).toBe('RESOLVED');
  });

  it('rejects a non-JSON file as unreadable', () => {
    expect(parseDeadlineImport('not json {')).toEqual({ deadlines: [], invalidCount: 0, schemaError: 'unreadable' });
  });

  it('rejects a file that is not a Nopasa export as unreadable', () => {
    const json = JSON.stringify({ app: 'otra-app', schema: 1, deadlines: [] });
    expect(parseDeadlineImport(json).schemaError).toBe('unreadable');
  });

  it('rejects an unknown Nopasa schema version as unsupported-version', () => {
    const json = JSON.stringify({ app: 'nopasa', schema: 2, deadlines: [] });
    expect(parseDeadlineImport(json).schemaError).toBe('unsupported-version');
  });

  it('skips corrupt entries and counts them, keeping the valid ones', () => {
    const valid = buildDeadline({ id: 'ok' });
    const json = JSON.stringify({
      app: 'nopasa',
      schema: 1,
      deadlines: [
        JSON.parse(JSON.stringify(valid)),
        { id: 'bad', type: 'NOT_A_TYPE', title: '', dueDate: 'x', reminderDaysBefore: [], createdAt: 'x', status: 'ACTIVE' },
        { nonsense: true },
      ],
    });

    const { deadlines, invalidCount, schemaError } = parseDeadlineImport(json);

    expect(schemaError).toBeUndefined();
    expect(deadlines.map((d) => d.id)).toEqual(['ok']);
    expect(invalidCount).toBe(2);
  });

  it('accepts a valid empty Nopasa export', () => {
    const json = JSON.stringify({ app: 'nopasa', schema: 1, deadlines: [] });
    expect(parseDeadlineImport(json)).toEqual({ deadlines: [], invalidCount: 0 });
  });

  it('ignores unknown fields on an otherwise-valid entry', () => {
    const entry = { ...JSON.parse(JSON.stringify(buildDeadline({ id: 'ok' }))), surprise: 'extra' };
    const json = JSON.stringify({ app: 'nopasa', schema: 1, deadlines: [entry] });

    const { deadlines, invalidCount } = parseDeadlineImport(json);

    expect(invalidCount).toBe(0);
    expect(deadlines.map((d) => d.id)).toEqual(['ok']);
    expect('surprise' in deadlines[0]).toBe(false);
  });
});

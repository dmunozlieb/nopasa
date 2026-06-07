/** @jest-environment node */
import { NodeSqliteExecutor } from '../../../test-support/node-sqlite-executor';
import { runMigrations } from './run-migrations';
import { SqliteDeadlineRepository } from './sqlite-deadline-repository';
import { buildDeadline } from '../../../test-support/build-deadline';
import type { Logger } from '../../logging/logger';

async function freshRepo(logger?: Logger) {
  const db = new NodeSqliteExecutor(':memory:');
  await runMigrations(db);
  return { db, repo: new SqliteDeadlineRepository(db, logger) };
}

describe('SqliteDeadlineRepository', () => {
  it('round-trips a deadline with all optional fields present', async () => {
    const { repo } = await freshRepo();
    const deadline = buildDeadline({
      id: 'a1',
      subtitle: 'Car technical inspection',
      amount: 49.5,
      amountLabel: 'fee',
      recurrenceMonths: 12,
      photoUri: 'file:///p.jpg',
      dueDate: new Date(2026, 0, 15),
      createdAt: new Date(2026, 0, 1, 9, 30, 0),
    });
    await repo.save(deadline);
    expect(await repo.findById('a1')).toEqual(deadline);
  });

  it('round-trips a deadline with all optional fields absent', async () => {
    const { repo } = await freshRepo();
    const deadline = buildDeadline({ id: 'a2', dueDate: new Date(2026, 5, 7) });
    await repo.save(deadline);
    const [restored] = await repo.list();
    expect(restored).toEqual(deadline);
  });

  it('save is a plain INSERT: saving the same id twice throws', async () => {
    const { repo } = await freshRepo();
    const deadline = buildDeadline({ id: 'dup' });
    await repo.save(deadline);
    await expect(repo.save(deadline)).rejects.toThrow();
  });

  it('list() warns about and skips a corrupt row, returning the rest', async () => {
    const warn = jest.fn();
    const { db, repo } = await freshRepo({ warn });
    await repo.save(buildDeadline({ id: 'good' }));
    // Insert a deliberately malformed row directly (empty title fails schema validation).
    await db.run(
      'INSERT INTO deadlines (id, type, title, due_date, reminder_days_before, created_at, status) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['bad', 'ITV', '', '2026-01-01', '[7]', new Date().toISOString(), 'ACTIVE'],
    );

    const result = await repo.list();
    expect(result.map((d) => d.id)).toEqual(['good']);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('findById returns null for a missing id', async () => {
    const { repo } = await freshRepo();
    expect(await repo.findById('nope')).toBeNull();
  });

  it('findById warns and returns null for a corrupt stored row', async () => {
    const warn = jest.fn();
    const { db, repo } = await freshRepo({ warn });
    await db.run(
      'INSERT INTO deadlines (id, type, title, due_date, reminder_days_before, created_at, status) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['corrupt', 'ITV', 'ok', '2026-01-01', 'not-json', new Date().toISOString(), 'ACTIVE'],
    );
    expect(await repo.findById('corrupt')).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('update overwrites an existing record', async () => {
    const { repo } = await freshRepo();
    await repo.save(buildDeadline({ id: 'u1', title: 'Old' }));
    await repo.update(buildDeadline({ id: 'u1', title: 'New' }));
    expect((await repo.findById('u1'))?.title).toBe('New');
  });

  it('delete removes a record', async () => {
    const { repo } = await freshRepo();
    await repo.save(buildDeadline({ id: 'd1' }));
    await repo.delete('d1');
    expect(await repo.findById('d1')).toBeNull();
  });
});

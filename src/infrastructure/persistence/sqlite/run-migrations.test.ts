/** @jest-environment node */
import { NodeSqliteExecutor } from '../../../test-support/node-sqlite-executor';
import { runMigrations } from './run-migrations';

describe('runMigrations', () => {
  it('creates the deadlines table and sets user_version on a fresh database', async () => {
    const db = new NodeSqliteExecutor(':memory:');
    await runMigrations(db);

    expect(await db.getUserVersion()).toBe(2);
    const table = await db.getFirst<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'deadlines'",
    );
    expect(table).toEqual({ name: 'deadlines' });
  });

  it('is idempotent when run again', async () => {
    const db = new NodeSqliteExecutor(':memory:');
    await runMigrations(db);
    await expect(runMigrations(db)).resolves.toBeUndefined();
    expect(await db.getUserVersion()).toBe(2);
  });
});

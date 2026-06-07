/** @jest-environment node */
import { NodeSqliteExecutor } from './node-sqlite-executor';

describe('NodeSqliteExecutor', () => {
  it('runs DDL/insert and reads rows back', async () => {
    const db = new NodeSqliteExecutor(':memory:');
    await db.exec('CREATE TABLE t (id TEXT PRIMARY KEY, n INTEGER)');
    await db.run('INSERT INTO t (id, n) VALUES (?, ?)', ['a', 1]);
    await db.run('INSERT INTO t (id, n) VALUES (?, ?)', ['b', 2]);

    expect(await db.all('SELECT id, n FROM t ORDER BY id')).toEqual([
      { id: 'a', n: 1 },
      { id: 'b', n: 2 },
    ]);
    expect(await db.getFirst('SELECT id, n FROM t WHERE id = ?', ['a'])).toEqual({ id: 'a', n: 1 });
    expect(await db.getFirst('SELECT id FROM t WHERE id = ?', ['missing'])).toBeNull();
  });

  it('reads and writes user_version', async () => {
    const db = new NodeSqliteExecutor(':memory:');
    expect(await db.getUserVersion()).toBe(0);
    await db.setUserVersion(3);
    expect(await db.getUserVersion()).toBe(3);
  });

  it('rolls back the transaction when the callback throws', async () => {
    const db = new NodeSqliteExecutor(':memory:');
    await db.exec('CREATE TABLE t (id TEXT PRIMARY KEY)');
    await expect(
      db.withinTransaction(async () => {
        await db.run('INSERT INTO t (id) VALUES (?)', ['x']);
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await db.all('SELECT id FROM t')).toEqual([]);
  });
});

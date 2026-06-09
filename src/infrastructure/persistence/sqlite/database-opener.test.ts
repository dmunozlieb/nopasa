import { createDatabaseOpener } from './database-opener';
import type { SqlExecutor } from './sql-executor';

const fakeExecutor = {} as SqlExecutor;

describe('createDatabaseOpener', () => {
  it('opens once and memoizes the result across calls', async () => {
    const open = jest.fn(async () => fakeExecutor);
    const get = createDatabaseOpener(open);
    expect(await get()).toBe(fakeExecutor);
    expect(await get()).toBe(fakeExecutor);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('does not cache a rejection: a later call retries', async () => {
    const open = jest
      .fn()
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce(fakeExecutor);
    const get = createDatabaseOpener(open as () => Promise<SqlExecutor>);
    await expect(get()).rejects.toThrow('transient');
    await expect(get()).resolves.toBe(fakeExecutor);
    expect(open).toHaveBeenCalledTimes(2);
  });
});

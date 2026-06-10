import type { SqlExecutor } from './sql-executor';

/**
 * Wraps an async opener so it runs at most once on success (the result is memoized),
 * but a rejection is NOT cached — the memo resets so a later call can retry. This
 * avoids a transient first-open failure permanently bricking every subsequent call.
 */
export function createDatabaseOpener(
  open: () => Promise<SqlExecutor>,
): () => Promise<SqlExecutor> {
  let pending: Promise<SqlExecutor> | null = null;
  return () => {
    if (!pending) {
      pending = open().catch((error) => {
        pending = null;
        throw error;
      });
    }
    return pending;
  };
}

/** A single forward schema migration, applied when its version is newer than user_version. */
export interface Migration {
  version: number;
  sql: string;
}

const CREATE_DEADLINES_TABLE_SQL = `
CREATE TABLE deadlines (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT NULL,
  due_date TEXT NOT NULL,
  amount REAL NULL,
  amount_label TEXT NULL,
  reminder_days_before TEXT NOT NULL,
  recurrence_months INTEGER NULL,
  photo_uri TEXT NULL,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL
);
`;

/**
 * Ordered list of forward migrations. Adding a migration is ADDITIVE: append a new
 * entry with the next version and never edit an existing one.
 */
export const MIGRATIONS: Migration[] = [{ version: 1, sql: CREATE_DEADLINES_TABLE_SQL }];

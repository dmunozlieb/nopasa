# Nopasa SQLite Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement local SQLite persistence behind the existing `DeadlineRepository` port, with pure row↔domain mapping, edge validation, and versioned migrations, plus the concrete `IdGenerator`/`Clock` wiring.

**Architecture:** Hexagonal infrastructure layer. An internal `SqlExecutor` port is implemented by two adapters over the SAME SQL: `ExpoSqliteExecutor` (production, native) and `NodeSqliteExecutor` (test-only, `node:sqlite`). All row mapping, serialization, and migration SQL are pure and fully unit-tested without a DB; real SQL behavior is tested via `node:sqlite` in-memory under the `node` Jest environment.

**Tech Stack:** Expo (managed) + React Native + TypeScript, Jest (`jest-expo`), Zod (existing schema), `expo-sqlite` (prod), `expo-crypto` (prod), `node:sqlite` (test, built into Node 24).

---

## Conventions for every task

- All code/comments in **English**. Commit messages MUST NOT contain any `Co-Authored-By`/Claude/AI signature.
- TDD: write the failing test, run it to see it fail, implement minimally, run to see it pass, commit.
- Test commands: `npm test -- <path>` runs one file; `npm test` runs all. `npm run typecheck` runs `tsc --noEmit`.
- Integration test files (those that touch `node:sqlite`) MUST begin with the docblock `/** @jest-environment node */` as the very first line.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/infrastructure/persistence/sqlite/deadline-row.ts` | `DeadlineRow` type + canonical `COLUMNS` order |
| `src/infrastructure/persistence/sqlite/deadline-mapper.ts` | PURE `toRow`/`rowToParams`/`fromRow` (dates, JSON, null↔undefined, edge validation) |
| `src/infrastructure/persistence/sqlite/migrations.ts` | `Migration` type + `MIGRATIONS` list + v1 CREATE SQL (pure data) |
| `src/infrastructure/persistence/sqlite/sql-executor.ts` | `SqlExecutor` interface + `SqlParam` |
| `src/infrastructure/persistence/sqlite/run-migrations.ts` | `runMigrations(executor)` — applies pending migrations transactionally, idempotent |
| `src/infrastructure/persistence/sqlite/sqlite-deadline-repository.ts` | `SqliteDeadlineRepository implements DeadlineRepository` |
| `src/infrastructure/persistence/sqlite/expo-sqlite-executor.ts` | Prod adapter over `expo-sqlite` (not Jest-tested) |
| `src/infrastructure/persistence/sqlite/create-deadline-repository.ts` | Prod composition root (not Jest-tested) |
| `src/infrastructure/logging/logger.ts` | `Logger` interface + `consoleLogger` default |
| `src/infrastructure/id/expo-crypto-id-generator.ts` | `IdGenerator` via `expo-crypto` (not Jest-tested) |
| `src/infrastructure/clock/system-clock.ts` | `Clock` via system clock |
| `src/test-support/node-sqlite-executor.ts` | Test-only `SqlExecutor` over `node:sqlite` |

---

## Task 1: Install native deps and enable Node types

**Files:**
- Modify: `package.json` (deps), `tsconfig.json` (types)

- [ ] **Step 1: Install Expo native modules**

Run (PowerShell):
```powershell
npx expo install expo-sqlite expo-crypto
```
Expected: `expo-sqlite` and `expo-crypto` added to `package.json` dependencies (SDK-56-compatible versions), no errors. (These are imported only by production files that Jest never loads, so they won't affect the test run.)

- [ ] **Step 2: Enable Node type definitions for the `node:sqlite` test adapter**

In `tsconfig.json`, change the `types` array from `["jest"]` to `["jest", "node"]`.

Before:
```json
    "types": ["jest"]
```
After:
```json
    "types": ["jest", "node"]
```
(Verified: this resolves `node:sqlite` typings and the full-project typecheck stays clean — no conflicts with the Expo/React Native types.)

- [ ] **Step 3: Verify the suite and typecheck are still green**

Run: `npm test`
Expected: existing suites pass (6 suites / 36 tests).

Run: `npm run typecheck`
Expected: no output, exit code 0.

- [ ] **Step 4: Commit**

```powershell
git add package.json package-lock.json tsconfig.json
git commit -m "chore: add expo-sqlite/expo-crypto and enable node types for tests"
```

---

## Task 2: Row shape and canonical column order

**Files:**
- Create: `src/infrastructure/persistence/sqlite/deadline-row.ts`
- Test: `src/infrastructure/persistence/sqlite/deadline-row.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/infrastructure/persistence/sqlite/deadline-row.test.ts`:
```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/infrastructure/persistence/sqlite/deadline-row.test.ts`
Expected: FAIL — "Cannot find module './deadline-row'".

- [ ] **Step 3: Write the minimal implementation**

Create `src/infrastructure/persistence/sqlite/deadline-row.ts`:
```ts
/** A raw `deadlines` row: snake_case columns, SQL-primitive values only. */
export interface DeadlineRow {
  id: string;
  type: string;
  title: string;
  subtitle: string | null;
  due_date: string; // calendar date "YYYY-MM-DD"
  amount: number | null;
  amount_label: string | null;
  reminder_days_before: string; // JSON array, e.g. "[30,7]"
  recurrence_months: number | null;
  photo_uri: string | null;
  created_at: string; // full ISO 8601 instant
  status: string;
}

/**
 * Canonical column order — the single source of truth for INSERT/UPDATE
 * parameter binding. `rowToParams` (in the mapper) follows this exact order.
 */
export const COLUMNS = [
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
] as const;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/infrastructure/persistence/sqlite/deadline-row.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/infrastructure/persistence/sqlite/deadline-row.ts src/infrastructure/persistence/sqlite/deadline-row.test.ts
git commit -m "feat(persistence): add DeadlineRow shape and canonical column order"
```

---

## Task 3: Pure row↔domain mapper

**Files:**
- Create: `src/infrastructure/persistence/sqlite/deadline-mapper.ts`
- Test: `src/infrastructure/persistence/sqlite/deadline-mapper.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/infrastructure/persistence/sqlite/deadline-mapper.test.ts`:
```ts
import { toRow, fromRow, rowToParams } from './deadline-mapper';
import { COLUMNS } from './deadline-row';
import { buildDeadline } from '../../../test-support/build-deadline';

describe('toRow / fromRow round-trip', () => {
  it('round-trips a deadline that has all optional fields present', () => {
    const deadline = buildDeadline({
      id: 'r1',
      subtitle: 'Car technical inspection',
      amount: 49.5,
      amountLabel: 'fee',
      recurrenceMonths: 12,
      photoUri: 'file:///photo.jpg',
      dueDate: new Date(2026, 0, 15),
      createdAt: new Date(2026, 0, 1, 9, 30, 0),
    });
    expect(fromRow(toRow(deadline))).toEqual(deadline);
  });

  it('round-trips a deadline with all optional fields absent', () => {
    const deadline = buildDeadline({ id: 'r2', dueDate: new Date(2026, 5, 7) });
    const restored = fromRow(toRow(deadline));
    expect(restored).toEqual(deadline);
    expect(restored.subtitle).toBeUndefined();
    expect(restored.amount).toBeUndefined();
    expect(restored.recurrenceMonths).toBeUndefined();
  });

  it('preserves the local calendar day of dueDate', () => {
    const deadline = buildDeadline({ dueDate: new Date(2026, 2, 30) });
    expect(fromRow(toRow(deadline)).dueDate).toEqual(new Date(2026, 2, 30));
  });
});

describe('toRow serialization format', () => {
  it('serializes due_date as a date-only string (no time component)', () => {
    const row = toRow(buildDeadline({ dueDate: new Date(2026, 0, 15, 18, 45, 0) }));
    expect(row.due_date).toBe('2026-01-15');
    expect(row.due_date).not.toContain('T');
  });

  it('serializes created_at as a full ISO 8601 instant', () => {
    const createdAt = new Date(2026, 0, 1, 9, 30, 0);
    const row = toRow(buildDeadline({ createdAt }));
    expect(row.created_at).toBe(createdAt.toISOString());
    expect(row.created_at).toContain('T');
  });

  it('serializes reminderDaysBefore as a JSON string', () => {
    const row = toRow(buildDeadline({ reminderDaysBefore: [30, 7] }));
    expect(row.reminder_days_before).toBe('[30,7]');
  });

  it('maps absent optionals to null', () => {
    const row = toRow(buildDeadline({ id: 'r3' }));
    expect(row.subtitle).toBeNull();
    expect(row.amount).toBeNull();
    expect(row.amount_label).toBeNull();
    expect(row.recurrence_months).toBeNull();
    expect(row.photo_uri).toBeNull();
  });
});

describe('rowToParams', () => {
  it('returns positional params in COLUMNS order', () => {
    const params = rowToParams(toRow(buildDeadline({ id: 'r4' })));
    expect(params).toHaveLength(COLUMNS.length);
    expect(params[0]).toBe('r4'); // id is first
    expect(params[COLUMNS.length - 1]).toBe('ACTIVE'); // status is last
  });
});

describe('fromRow edge validation', () => {
  const validRow = () => toRow(buildDeadline({ id: 'v' }));

  it('throws when the status enum is invalid', () => {
    expect(() => fromRow({ ...validRow(), status: 'BOGUS' })).toThrow();
  });

  it('throws when the title is empty', () => {
    expect(() => fromRow({ ...validRow(), title: '' })).toThrow();
  });

  it('throws when reminder_days_before is not valid JSON', () => {
    expect(() => fromRow({ ...validRow(), reminder_days_before: 'not-json' })).toThrow();
  });

  it('throws when reminder_days_before contains a negative number', () => {
    expect(() => fromRow({ ...validRow(), reminder_days_before: '[-5]' })).toThrow();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/infrastructure/persistence/sqlite/deadline-mapper.test.ts`
Expected: FAIL — "Cannot find module './deadline-mapper'".

- [ ] **Step 3: Write the minimal implementation**

Create `src/infrastructure/persistence/sqlite/deadline-mapper.ts`:
```ts
import { deadlineSchema, type Deadline } from '../../../domain/deadline/deadline.schema';
import { COLUMNS, type DeadlineRow } from './deadline-row';

/** Serializes a Date to a LOCAL calendar-date string "YYYY-MM-DD" (no time, no timezone). */
function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Reconstructs a "YYYY-MM-DD" calendar date as LOCAL midnight. */
function fromLocalDateString(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Domain → row. dueDate becomes a date-only string; createdAt keeps the full ISO instant. */
export function toRow(deadline: Deadline): DeadlineRow {
  return {
    id: deadline.id,
    type: deadline.type,
    title: deadline.title,
    subtitle: deadline.subtitle ?? null,
    due_date: toLocalDateString(deadline.dueDate),
    amount: deadline.amount ?? null,
    amount_label: deadline.amountLabel ?? null,
    reminder_days_before: JSON.stringify(deadline.reminderDaysBefore),
    recurrence_months: deadline.recurrenceMonths ?? null,
    photo_uri: deadline.photoUri ?? null,
    created_at: deadline.createdAt.toISOString(),
    status: deadline.status,
  };
}

/** Positional bind params in canonical COLUMNS order (structurally a SqlParam[]). */
export function rowToParams(row: DeadlineRow): (string | number | null)[] {
  return COLUMNS.map((column) => row[column]);
}

/**
 * Row → domain. Reconstructs raw values (dates, JSON, null→undefined for optionals)
 * and validates with the Zod schema at the edge. Throws on any invalid/corrupt row.
 */
export function fromRow(row: DeadlineRow): Deadline {
  const candidate = {
    id: row.id,
    type: row.type,
    title: row.title,
    subtitle: row.subtitle ?? undefined,
    dueDate: fromLocalDateString(row.due_date),
    amount: row.amount ?? undefined,
    amountLabel: row.amount_label ?? undefined,
    reminderDaysBefore: JSON.parse(row.reminder_days_before),
    recurrenceMonths: row.recurrence_months ?? undefined,
    photoUri: row.photo_uri ?? undefined,
    createdAt: new Date(row.created_at),
    status: row.status,
  };
  return deadlineSchema.parse(candidate);
}
```

**Note:** `rowToParams` returns `(string | number | null)[]`, which is structurally identical to the `SqlParam[]` that `SqlExecutor.run` (Task 5) expects — so this task has no forward dependency and typechecks cleanly on its own once Task 2 has landed.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/infrastructure/persistence/sqlite/deadline-mapper.test.ts`
Expected: PASS — all mapper tests green.

- [ ] **Step 5: Commit**

```powershell
git add src/infrastructure/persistence/sqlite/deadline-mapper.ts src/infrastructure/persistence/sqlite/deadline-mapper.test.ts
git commit -m "feat(persistence): add pure row<->domain mapper with calendar-date dueDate"
```

---

## Task 4: Versioned migration list (pure)

**Files:**
- Create: `src/infrastructure/persistence/sqlite/migrations.ts`
- Test: `src/infrastructure/persistence/sqlite/migrations.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/infrastructure/persistence/sqlite/migrations.test.ts`:
```ts
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
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/infrastructure/persistence/sqlite/migrations.test.ts`
Expected: FAIL — "Cannot find module './migrations'".

- [ ] **Step 3: Write the minimal implementation**

Create `src/infrastructure/persistence/sqlite/migrations.ts`:
```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/infrastructure/persistence/sqlite/migrations.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/infrastructure/persistence/sqlite/migrations.ts src/infrastructure/persistence/sqlite/migrations.test.ts
git commit -m "feat(persistence): add versioned migration list with v1 deadlines table"
```

---

## Task 5: SqlExecutor port and node:sqlite test adapter

**Files:**
- Create: `src/infrastructure/persistence/sqlite/sql-executor.ts`
- Create: `src/test-support/node-sqlite-executor.ts`
- Test: `src/test-support/node-sqlite-executor.test.ts`

- [ ] **Step 1: Write the failing integration test**

Create `src/test-support/node-sqlite-executor.test.ts`:
```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/test-support/node-sqlite-executor.test.ts`
Expected: FAIL — "Cannot find module './node-sqlite-executor'".

- [ ] **Step 3: Write the `SqlExecutor` interface**

Create `src/infrastructure/persistence/sqlite/sql-executor.ts`:
```ts
/** A value bindable to a SQL `?` placeholder. */
export type SqlParam = string | number | null;

/**
 * Minimal async database boundary the repository and migrations depend on.
 * Implemented by ExpoSqliteExecutor (production) and NodeSqliteExecutor (tests),
 * over the SAME SQL.
 */
export interface SqlExecutor {
  run(sql: string, params?: SqlParam[]): Promise<void>;
  all<T>(sql: string, params?: SqlParam[]): Promise<T[]>;
  getFirst<T>(sql: string, params?: SqlParam[]): Promise<T | null>;
  exec(sql: string): Promise<void>;
  withinTransaction(fn: () => Promise<void>): Promise<void>;
  getUserVersion(): Promise<number>;
  setUserVersion(version: number): Promise<void>;
}

/** Guards PRAGMA user_version writes (the value cannot be a bound parameter). */
export function assertSchemaVersion(version: number): void {
  if (!Number.isInteger(version) || version < 0) {
    throw new Error(`Invalid schema version: ${version}`);
  }
}
```

- [ ] **Step 4: Write the `node:sqlite` test adapter**

Create `src/test-support/node-sqlite-executor.ts`:
```ts
import { DatabaseSync } from 'node:sqlite';
import {
  assertSchemaVersion,
  type SqlExecutor,
  type SqlParam,
} from '../infrastructure/persistence/sqlite/sql-executor';

/**
 * Test-only SqlExecutor backed by Node's built-in synchronous SQLite.
 * Lives in test-support so NO production code imports `node:sqlite`.
 */
export class NodeSqliteExecutor implements SqlExecutor {
  private readonly db: DatabaseSync;

  constructor(path = ':memory:') {
    this.db = new DatabaseSync(path);
  }

  async run(sql: string, params: SqlParam[] = []): Promise<void> {
    this.db.prepare(sql).run(...params);
  }

  async all<T>(sql: string, params: SqlParam[] = []): Promise<T[]> {
    return this.db.prepare(sql).all(...params) as T[];
  }

  async getFirst<T>(sql: string, params: SqlParam[] = []): Promise<T | null> {
    return (this.db.prepare(sql).get(...params) as T | undefined) ?? null;
  }

  async exec(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  async withinTransaction(fn: () => Promise<void>): Promise<void> {
    this.db.exec('BEGIN');
    try {
      await fn();
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  async getUserVersion(): Promise<number> {
    const row = this.db.prepare('PRAGMA user_version').get() as { user_version: number };
    return row.user_version;
  }

  async setUserVersion(version: number): Promise<void> {
    assertSchemaVersion(version);
    this.db.exec(`PRAGMA user_version = ${version}`);
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- src/test-support/node-sqlite-executor.test.ts`
Expected: PASS — DDL/insert/read, user_version, and rollback all green.

If the run errors with a `node:sqlite` flag requirement, update the `test` script in `package.json` to `cross-env TZ=Europe/Madrid NODE_OPTIONS=--experimental-sqlite jest --passWithNoTests` and re-run. (On Node 24 this is typically NOT needed.)

- [ ] **Step 6: Commit**

```powershell
git add src/infrastructure/persistence/sqlite/sql-executor.ts src/test-support/node-sqlite-executor.ts src/test-support/node-sqlite-executor.test.ts
git commit -m "feat(persistence): add SqlExecutor port and node:sqlite test adapter"
```

---

## Task 6: Migration runner

**Files:**
- Create: `src/infrastructure/persistence/sqlite/run-migrations.ts`
- Test: `src/infrastructure/persistence/sqlite/run-migrations.test.ts`

- [ ] **Step 1: Write the failing integration test**

Create `src/infrastructure/persistence/sqlite/run-migrations.test.ts`:
```ts
/** @jest-environment node */
import { NodeSqliteExecutor } from '../../../test-support/node-sqlite-executor';
import { runMigrations } from './run-migrations';

describe('runMigrations', () => {
  it('creates the deadlines table and sets user_version on a fresh database', async () => {
    const db = new NodeSqliteExecutor(':memory:');
    await runMigrations(db);

    expect(await db.getUserVersion()).toBe(1);
    const table = await db.getFirst<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'deadlines'",
    );
    expect(table).toEqual({ name: 'deadlines' });
  });

  it('is idempotent when run again', async () => {
    const db = new NodeSqliteExecutor(':memory:');
    await runMigrations(db);
    await expect(runMigrations(db)).resolves.toBeUndefined();
    expect(await db.getUserVersion()).toBe(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/infrastructure/persistence/sqlite/run-migrations.test.ts`
Expected: FAIL — "Cannot find module './run-migrations'".

- [ ] **Step 3: Write the minimal implementation**

Create `src/infrastructure/persistence/sqlite/run-migrations.ts`:
```ts
import { MIGRATIONS } from './migrations';
import type { SqlExecutor } from './sql-executor';

/**
 * Applies all migrations newer than the database's user_version, in ascending order.
 * Each migration runs inside its own transaction together with its version bump, so a
 * failure rolls back fully. Idempotent: re-running applies nothing.
 */
export async function runMigrations(executor: SqlExecutor): Promise<void> {
  const current = await executor.getUserVersion();
  const pending = MIGRATIONS.filter((migration) => migration.version > current).sort(
    (a, b) => a.version - b.version,
  );

  for (const migration of pending) {
    await executor.withinTransaction(async () => {
      await executor.exec(migration.sql);
      await executor.setUserVersion(migration.version);
    });
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/infrastructure/persistence/sqlite/run-migrations.test.ts`
Expected: PASS — table created, user_version = 1, idempotent re-run.

- [ ] **Step 5: Commit**

```powershell
git add src/infrastructure/persistence/sqlite/run-migrations.ts src/infrastructure/persistence/sqlite/run-migrations.test.ts
git commit -m "feat(persistence): add transactional, idempotent migration runner"
```

---

## Task 7: Logger and SQLite repository

**Files:**
- Create: `src/infrastructure/logging/logger.ts`
- Create: `src/infrastructure/persistence/sqlite/sqlite-deadline-repository.ts`
- Test: `src/infrastructure/persistence/sqlite/sqlite-deadline-repository.test.ts`

- [ ] **Step 1: Create the Logger**

Create `src/infrastructure/logging/logger.ts`:
```ts
/** Minimal logging boundary so the repository can warn about corrupt rows without binding to console. */
export interface Logger {
  warn(message: string, meta?: unknown): void;
}

/** Default logger over the platform console. */
export const consoleLogger: Logger = {
  warn(message: string, meta?: unknown): void {
    if (meta === undefined) {
      console.warn(message);
    } else {
      console.warn(message, meta);
    }
  },
};
```

- [ ] **Step 2: Write the failing integration tests**

Create `src/infrastructure/persistence/sqlite/sqlite-deadline-repository.test.ts`:
```ts
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
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test -- src/infrastructure/persistence/sqlite/sqlite-deadline-repository.test.ts`
Expected: FAIL — "Cannot find module './sqlite-deadline-repository'".

- [ ] **Step 4: Write the minimal implementation**

Create `src/infrastructure/persistence/sqlite/sqlite-deadline-repository.ts`:
```ts
import type { Deadline } from '../../../domain/deadline/deadline.schema';
import type { DeadlineRepository } from '../../../ports/deadline-repository';
import { consoleLogger, type Logger } from '../../logging/logger';
import { fromRow, rowToParams, toRow } from './deadline-mapper';
import type { DeadlineRow } from './deadline-row';
import type { SqlExecutor } from './sql-executor';

const INSERT_SQL =
  'INSERT INTO deadlines ' +
  '(id, type, title, subtitle, due_date, amount, amount_label, reminder_days_before, recurrence_months, photo_uri, created_at, status) ' +
  'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

const UPDATE_SQL =
  'UPDATE deadlines SET ' +
  'type = ?, title = ?, subtitle = ?, due_date = ?, amount = ?, amount_label = ?, ' +
  'reminder_days_before = ?, recurrence_months = ?, photo_uri = ?, created_at = ?, status = ? ' +
  'WHERE id = ?';

const SELECT_COLUMNS =
  'id, type, title, subtitle, due_date, amount, amount_label, reminder_days_before, recurrence_months, photo_uri, created_at, status';
const SELECT_ALL_SQL = `SELECT ${SELECT_COLUMNS} FROM deadlines`;
const SELECT_BY_ID_SQL = `${SELECT_ALL_SQL} WHERE id = ?`;
const DELETE_SQL = 'DELETE FROM deadlines WHERE id = ?';

/** SQLite-backed DeadlineRepository. Resilient to corrupt rows: warns and skips/returns null. */
export class SqliteDeadlineRepository implements DeadlineRepository {
  constructor(
    private readonly executor: SqlExecutor,
    private readonly logger: Logger = consoleLogger,
  ) {}

  async save(deadline: Deadline): Promise<void> {
    await this.executor.run(INSERT_SQL, rowToParams(toRow(deadline)));
  }

  async update(deadline: Deadline): Promise<void> {
    const params = rowToParams(toRow(deadline)); // [id, ...rest]
    await this.executor.run(UPDATE_SQL, [...params.slice(1), params[0]]);
  }

  async delete(id: string): Promise<void> {
    await this.executor.run(DELETE_SQL, [id]);
  }

  async list(): Promise<Deadline[]> {
    const rows = await this.executor.all<DeadlineRow>(SELECT_ALL_SQL);
    const deadlines: Deadline[] = [];
    for (const row of rows) {
      try {
        deadlines.push(fromRow(row));
      } catch (error) {
        this.logger.warn(`Skipping corrupt deadline row (id=${row.id})`, error);
      }
    }
    return deadlines;
  }

  async findById(id: string): Promise<Deadline | null> {
    const row = await this.executor.getFirst<DeadlineRow>(SELECT_BY_ID_SQL, [id]);
    if (row === null) {
      return null;
    }
    try {
      return fromRow(row);
    } catch (error) {
      this.logger.warn(`Ignoring corrupt deadline row (id=${id})`, error);
      return null;
    }
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- src/infrastructure/persistence/sqlite/sqlite-deadline-repository.test.ts`
Expected: PASS — round-trips, INSERT-twice throws, corrupt-row resilience, update, delete all green.

- [ ] **Step 6: Commit**

```powershell
git add src/infrastructure/logging/logger.ts src/infrastructure/persistence/sqlite/sqlite-deadline-repository.ts src/infrastructure/persistence/sqlite/sqlite-deadline-repository.test.ts
git commit -m "feat(persistence): add SQLite DeadlineRepository with corrupt-row resilience"
```

---

## Task 8: Infrastructure wiring (id, clock, prod executor, composition root)

**Files:**
- Create: `src/infrastructure/clock/system-clock.ts`
- Test: `src/infrastructure/clock/system-clock.test.ts`
- Create: `src/infrastructure/id/expo-crypto-id-generator.ts`
- Create: `src/infrastructure/persistence/sqlite/expo-sqlite-executor.ts`
- Create: `src/infrastructure/persistence/sqlite/create-deadline-repository.ts`

- [ ] **Step 1: Write the failing test for the system clock**

Create `src/infrastructure/clock/system-clock.test.ts`:
```ts
import { systemClock } from './system-clock';

describe('systemClock', () => {
  it('returns the current time as a Date', () => {
    const before = Date.now();
    const now = systemClock.now();
    const after = Date.now();
    expect(now).toBeInstanceOf(Date);
    expect(now.getTime()).toBeGreaterThanOrEqual(before);
    expect(now.getTime()).toBeLessThanOrEqual(after);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/infrastructure/clock/system-clock.test.ts`
Expected: FAIL — "Cannot find module './system-clock'".

- [ ] **Step 3: Implement the system clock**

Create `src/infrastructure/clock/system-clock.ts`:
```ts
import type { Clock } from '../../domain/deadline/deadline.factory';

/** Production Clock backed by the system time. */
export const systemClock: Clock = {
  now(): Date {
    return new Date();
  },
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/infrastructure/clock/system-clock.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement the id generator (production wrapper, not Jest-tested)**

Create `src/infrastructure/id/expo-crypto-id-generator.ts`:
```ts
import * as Crypto from 'expo-crypto';
import type { IdGenerator } from '../../domain/deadline/deadline.factory';

/** Production IdGenerator backed by expo-crypto's RFC-4122 randomUUID. */
export const expoCryptoIdGenerator: IdGenerator = () => Crypto.randomUUID();
```

- [ ] **Step 6: Implement the production expo-sqlite executor (not Jest-tested)**

Create `src/infrastructure/persistence/sqlite/expo-sqlite-executor.ts`:
```ts
import type { SQLiteDatabase } from 'expo-sqlite';
import { assertSchemaVersion, type SqlExecutor, type SqlParam } from './sql-executor';

/** Production SqlExecutor over an expo-sqlite database. */
export class ExpoSqliteExecutor implements SqlExecutor {
  constructor(private readonly db: SQLiteDatabase) {}

  async run(sql: string, params: SqlParam[] = []): Promise<void> {
    await this.db.runAsync(sql, params);
  }

  async all<T>(sql: string, params: SqlParam[] = []): Promise<T[]> {
    return this.db.getAllAsync<T>(sql, params);
  }

  async getFirst<T>(sql: string, params: SqlParam[] = []): Promise<T | null> {
    return (await this.db.getFirstAsync<T>(sql, params)) ?? null;
  }

  async exec(sql: string): Promise<void> {
    await this.db.execAsync(sql);
  }

  async withinTransaction(fn: () => Promise<void>): Promise<void> {
    await this.db.withTransactionAsync(fn);
  }

  async getUserVersion(): Promise<number> {
    const row = await this.db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    return row?.user_version ?? 0;
  }

  async setUserVersion(version: number): Promise<void> {
    assertSchemaVersion(version);
    await this.db.execAsync(`PRAGMA user_version = ${version}`);
  }
}
```

- [ ] **Step 7: Implement the composition root (not Jest-tested)**

Create `src/infrastructure/persistence/sqlite/create-deadline-repository.ts`:
```ts
import { openDatabaseAsync } from 'expo-sqlite';
import type { DeadlineRepository } from '../../../ports/deadline-repository';
import { ExpoSqliteExecutor } from './expo-sqlite-executor';
import { runMigrations } from './run-migrations';
import { SqliteDeadlineRepository } from './sqlite-deadline-repository';

/** Opens the on-device database, runs migrations, and returns a ready DeadlineRepository. */
export async function createDeadlineRepository(
  databaseName = 'nopasa.db',
): Promise<DeadlineRepository> {
  const db = await openDatabaseAsync(databaseName);
  const executor = new ExpoSqliteExecutor(db);
  await runMigrations(executor);
  return new SqliteDeadlineRepository(executor);
}
```

- [ ] **Step 8: Typecheck the whole project (covers the untested prod files)**

Run: `npm run typecheck`
Expected: no output, exit code 0. (This is what verifies the expo-sqlite/expo-crypto prod wrappers compile against the installed types.)

- [ ] **Step 9: Commit**

```powershell
git add src/infrastructure/clock src/infrastructure/id src/infrastructure/persistence/sqlite/expo-sqlite-executor.ts src/infrastructure/persistence/sqlite/create-deadline-repository.ts
git commit -m "feat(infrastructure): wire system clock, expo-crypto id, expo-sqlite executor and composition root"
```

---

## Task 9: Full-suite verification

- [ ] **Step 1: Run the entire test suite**

Run: `npm test`
Expected: PASS — all suites green, including the new pure (deadline-row, deadline-mapper, migrations) and integration (node-sqlite-executor, run-migrations, sqlite-deadline-repository) tests, with no regressions to the existing 36 domain tests.

- [ ] **Step 2: Run the type checker**

Run: `npm run typecheck`
Expected: no output, exit code 0.

- [ ] **Step 3: Confirm there is nothing left to commit**

Run: `git status --short`
Expected: clean working tree (all work already committed in prior tasks).

---

## Self-Review notes

- **Spec coverage:** table+mapping & snake_case↔camelCase (Tasks 2–3, 7); ISO/calendar-date split for createdAt/dueDate (Task 3, §4.3); reminderDaysBefore JSON (Task 3); edge validation with `deadlineSchema.parse` + resilience (skip in `list`, null in `findById`) with the mandatory corrupt-row test (Task 7); versioned migrations via `user_version`, transactional + idempotent (Tasks 4, 6); test strategy maximizing the pure layer and using `node:sqlite` for integration (Tasks 3–7); infra wiring of IdGenerator/Clock + composition root (Task 8); repository implements the existing port unchanged (Task 7); round-trip, save-twice-throws, findById-missing→null, update, delete (Task 7).
- **Placeholders:** none — every code/test step is complete.
- **Type consistency:** `SqlExecutor`/`SqlParam` (Task 5) are referenced by the runner (Task 6), repository and prod executor (Tasks 7–8); `DeadlineRow`/`COLUMNS` (Task 2) used by mapper and repository; `Logger` (Task 7) injected into the repository; `IdGenerator`/`Clock` imported from the existing `deadline.factory` (Task 8). `fromRow`/`toRow`/`rowToParams` signatures are stable across tasks. `rowToParams` returns `(string|number|null)[]`, structurally assignable to `SqlParam[]`, so no task has a forward type dependency — each task typechecks cleanly once its predecessors land.

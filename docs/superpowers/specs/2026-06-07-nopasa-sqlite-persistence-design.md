# Nopasa — SQLite Persistence (Design Spec)

**Date:** 2026-06-07
**Status:** Approved (brainstorm), pending implementation plan
**Builds on:** `2026-06-07-nopasa-domain-design.md` (domain + ports already implemented).

**Scope of this session:** Implement local persistence with SQLite (`expo-sqlite`) behind the
existing `DeadlineRepository` port, with date mapping, edge validation, and versioned
migrations. Wire the concrete infrastructure the domain left as interfaces (`IdGenerator`,
`Clock`).

> **Out of scope:** UI, navigation, camera, OCR, notifications, recurrence *behavior*
> (`recurrenceMonths` field exists; its logic is not implemented), iOS.

**Language convention:** All code in **English** — names, comments, file names, migration SQL.

---

## 1. Context (decided — not under discussion)

"Nopasa" is a local-first Android app (Expo managed + React Native + TypeScript). The domain
layer is done and tested: the `Deadline` entity with its Zod schema
(`src/domain/deadline/deadline.schema.ts`), urgency/grouping logic, and the `DeadlineRepository`
port (`src/ports/deadline-repository.ts`: `save/list/findById/update/delete`, async, currently
unimplemented). Privacy and simplicity are priorities; all data lives on-device, no cloud.

The schema uses `.optional()` (NOT `.nullable()`) for optional fields, and `dueDate`/`createdAt`
are `z.date()`.

---

## 2. Architecture

Hexagonal. This session adds the **infrastructure** layer. The linchpin is an internal port
**`SqlExecutor`** that the repository and migrations depend on; two adapters implement it over the
**same SQL**:

```
Domain (Deadline, schema)  ──►  Port DeadlineRepository
                                      ▲ implements
        SqlExecutor (interface) ◄──── SqliteDeadlineRepository ──► deadline-mapper (pure)
            ▲              ▲                                    └─► migrations (pure SQL)
   ExpoSqliteExecutor   NodeSqliteExecutor
     (prod, native)      (test, node:sqlite)
```

`NodeSqliteExecutor` lives in `src/test-support/` so **no production code imports `node:sqlite`**
(it must never enter the React Native bundle). The repository depends only on the `SqlExecutor`
interface, so the identical SQL runs in both prod (`expo-sqlite`) and tests (`node:sqlite`).

---

## 3. `SqlExecutor` (minimal async interface)

```ts
export type SqlParam = string | number | null;

export interface SqlExecutor {
  run(sql: string, params?: SqlParam[]): Promise<void>;          // INSERT/UPDATE/DELETE
  all<T>(sql: string, params?: SqlParam[]): Promise<T[]>;        // SELECT many
  getFirst<T>(sql: string, params?: SqlParam[]): Promise<T | null>;
  exec(sql: string): Promise<void>;                              // DDL, no params
  withinTransaction(fn: () => Promise<void>): Promise<void>;     // rollback on throw
  getUserVersion(): Promise<number>;
  setUserVersion(version: number): Promise<void>;
}
```

- **`ExpoSqliteExecutor`** (prod, `src/infrastructure/persistence/sqlite/expo-sqlite-executor.ts`)
  wraps an `expo-sqlite` `SQLiteDatabase`: `run→runAsync`, `all→getAllAsync`,
  `getFirst→getFirstAsync` (coalescing `undefined`→`null`), `exec→execAsync`,
  `withinTransaction→withTransactionAsync`. `getUserVersion` via
  `getFirstAsync('PRAGMA user_version')` → `{ user_version }`; `setUserVersion(n)` via
  `execAsync('PRAGMA user_version = ' + n)` after validating `n` is a non-negative integer.
- **`NodeSqliteExecutor`** (test only, `src/test-support/node-sqlite-executor.ts`) wraps
  `node:sqlite` `DatabaseSync` (synchronous), returning resolved promises. `withinTransaction`
  uses `BEGIN`/`COMMIT`/`ROLLBACK`.

`setUserVersion` builds the PRAGMA by string concatenation (PRAGMA values cannot be bound
parameters); it validates the argument is a non-negative integer to keep that safe.

---

## 4. Row ↔ domain mapping (PURE — no DB; the bulk of the coverage)

### 4.1 Row shape — `deadline-row.ts`

```ts
export interface DeadlineRow {
  id: string;
  type: string;
  title: string;
  subtitle: string | null;
  due_date: string;            // calendar date "YYYY-MM-DD" (see 4.3)
  amount: number | null;
  amount_label: string | null;
  reminder_days_before: string; // JSON array, e.g. "[30,7]"
  recurrence_months: number | null;
  photo_uri: string | null;
  created_at: string;          // full ISO 8601 instant
  status: string;
}

// Canonical column order, single source of truth for INSERT/UPDATE param binding.
export const COLUMNS = [
  'id', 'type', 'title', 'subtitle', 'due_date', 'amount', 'amount_label',
  'reminder_days_before', 'recurrence_months', 'photo_uri', 'created_at', 'status',
] as const;
```

### 4.2 Mapper — `deadline-mapper.ts` (pure functions)

- `toRow(d: Deadline): DeadlineRow` — `reminderDaysBefore → JSON.stringify`; absent optionals
  (`subtitle/amount/amountLabel/recurrenceMonths/photoUri`) → `null`; `createdAt → toISOString()`;
  `dueDate → toDateString` (see 4.3).
- `rowToParams(row: DeadlineRow): SqlParam[]` — positional array in `COLUMNS` order (binds the
  `?` placeholders of INSERT/UPDATE).
- `fromRow(row: DeadlineRow): Deadline` — reconstruct a raw candidate (`due_date → local midnight
  Date`, `created_at → new Date(iso)`, `reminder_days_before → JSON.parse`, `null → undefined` for
  optionals) and **validate with `deadlineSchema.parse(...)`** before returning. Throws on invalid
  input (the repository catches this to implement resilience — §6).

**Critical:** because the schema uses `.optional()` (not `.nullable()`), `fromRow` must map SQL
`null → undefined` (omit the key) so optional validation passes.

### 4.3 `dueDate` is a CALENDAR DATE, not an instant

`dueDate` is serialized as a **date-only** string `"YYYY-MM-DD"` built from its **LOCAL** components
(`getFullYear()`, `getMonth() + 1`, `getDate()`, zero-padded), and reconstructed in `fromRow` as
**local midnight**: `new Date(year, month - 1, day)`. Do **NOT** use `toISOString()` for `dueDate` —
that embeds UTC and can shift the calendar day if the device timezone changes. `createdAt` keeps
the full ISO instant (`toISOString()`) because it is a real moment in time. The `due_date` column
stays `TEXT`; the Zod schema is unchanged (still `z.date()`); only the mapper's serialization
differs between the two fields.

---

## 5. Versioned migrations (`PRAGMA user_version`)

### 5.1 Migration list — `migrations.ts` (pure data)

```ts
export interface Migration { version: number; sql: string; }
export const MIGRATIONS: Migration[] = [ { version: 1, sql: CREATE_DEADLINES_TABLE_SQL } ];
```

**v1** creates the `deadlines` table exactly as specified:

```sql
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
```

### 5.2 Runner — `run-migrations.ts`

`runMigrations(executor: SqlExecutor): Promise<void>` reads `user_version`, then for each
migration with `version > current` (in ascending order) runs, **inside a single
`withinTransaction`**, the migration `sql` followed by `setUserVersion(version)`. Idempotent:
re-running applies nothing because the version guard skips already-applied migrations. Adding
future migrations is **additive** — push to `MIGRATIONS`; never edit an existing migration.

---

## 6. Repository — `SqliteDeadlineRepository implements DeadlineRepository`

Implements the existing port **without changing its signature**. Constructor:
`(executor: SqlExecutor, logger: Logger = consoleLogger)`.

- `save(d)` → `run(INSERT INTO deadlines (...COLUMNS...) VALUES (?,...), rowToParams(toRow(d)))`.
  **Plain INSERT, not upsert** — the entity is born with a fresh uuid in `createDeadline`, so a PK
  clash on `save` signals a bug and must surface (throw), not be hidden.
- `update(d)` → `run('UPDATE deadlines SET ... WHERE id = ?', [...nonIdParams, d.id])`.
- `delete(id)` → `run('DELETE FROM deadlines WHERE id = ?', [id])`.
- `list()` → `all<DeadlineRow>('SELECT ... FROM deadlines')`, map each via `fromRow` inside
  try/catch; **on validation failure, `logger.warn(...)` and SKIP that row** (the rest are
  returned). A corrupt row cannot break the whole list.
- `findById(id)` → `getFirst<DeadlineRow>('SELECT ... WHERE id = ?', [id])`; no row → `null`;
  **stored row invalid → `logger.warn(...)` and return `null`**.

`Logger` (`src/infrastructure/logging/logger.ts`): minimal `{ warn(message: string, meta?: unknown): void }`,
default `consoleLogger` wrapping `console.warn`. Injectable so tests can assert the warning.

---

## 7. Infrastructure wiring (small, secondary)

- `src/infrastructure/id/expo-crypto-id-generator.ts`:
  `export const expoCryptoIdGenerator: IdGenerator = () => Crypto.randomUUID();` (from `expo-crypto`).
- `src/infrastructure/clock/system-clock.ts`:
  `export const systemClock: Clock = { now: () => new Date() };`
- `src/infrastructure/persistence/sqlite/create-deadline-repository.ts` (composition root, **prod
  only**): `openDatabaseAsync(name)` → `new ExpoSqliteExecutor(db)` → `await runMigrations(exec)` →
  `new SqliteDeadlineRepository(exec)`.

---

## 8. Testing strategy (the delicate part — explicit)

`expo-sqlite` is a native module, hard to run in Jest. Therefore:

- **Pure layer (no DB), full coverage**, default test environment:
  - `deadline-mapper.test.ts`: round-trip `toRow`/`fromRow` preserves all fields; optionals present
    AND absent (`null ↔ undefined`); `reminderDaysBefore` JSON round-trip; **`dueDate` preserves the
    LOCAL calendar day**; **serialized `due_date` is date-only (no `"T"`, no time component) while
    `created_at` keeps the full ISO**; `fromRow` throws on garbage (bad JSON, invalid enum, empty
    title, etc.).
  - `migrations.test.ts`: `MIGRATIONS` shape — versions ascending and unique; v1 SQL creates the
    `deadlines` table.
- **Integration with `node:sqlite`** (files start with `/** @jest-environment node */`):
  - `run-migrations.test.ts`: migrating an empty DB creates the table and sets `user_version = 1`;
    running `runMigrations` again is a no-op (idempotent), table intact.
  - `sqlite-deadline-repository.test.ts` (uses `NodeSqliteExecutor` + `runMigrations`):
    - **round-trip**: `save` then `findById`/`list` returns an equivalent `Deadline` — with optional
      fields present, and with them absent.
    - **`save` is INSERT, not upsert**: calling `save` twice with the same id throws (PK violation).
    - **corrupt row skipped in `list()`**: insert a deliberately malformed row directly via SQL;
      `list()` warns, omits it, and returns the rest.
    - `findById` of a missing id → `null`.
    - `findById` of a corrupt stored row → warns and returns `null`.
    - `update` overwrites an existing record.
    - `delete` removes a record (subsequent `findById` → `null`).
- **NOT unit-tested**: `ExpoSqliteExecutor` and the composition root — thin wrappers over the
  native module that don't run in Jest. Kept minimal to shrink the untested surface.
- **`node:sqlite` flag contingency**: Node 24 is in use. If `import { DatabaseSync } from 'node:sqlite'`
  needs a flag in this Node build, the integration test script adds
  `NODE_OPTIONS=--experimental-sqlite` (verified in the first implementation step). The
  ExperimentalWarning it prints is harmless noise.

---

## 9. Folder structure

```
src/infrastructure/
  persistence/sqlite/
    sql-executor.ts                  expo-sqlite-executor.ts
    deadline-row.ts                  deadline-mapper.ts          (+ deadline-mapper.test.ts)
    migrations.ts (+ migrations.test.ts)
    run-migrations.ts (+ run-migrations.test.ts)
    sqlite-deadline-repository.ts (+ sqlite-deadline-repository.test.ts)
    create-deadline-repository.ts
  logging/logger.ts
  id/expo-crypto-id-generator.ts
  clock/system-clock.ts              (+ system-clock.test.ts)
src/test-support/node-sqlite-executor.ts
```

Tests co-located. Integration tests (`run-migrations`, `sqlite-deadline-repository`) use the
`node` Jest environment via the per-file docblock.

---

## 10. Out of scope (explicit)

UI, navigation, camera, OCR, notifications, recurrence behavior, iOS, the `ExpoSqliteExecutor`/
composition-root unit tests (native, not Jest-runnable). No change to the domain or to the
`DeadlineRepository` port signature.

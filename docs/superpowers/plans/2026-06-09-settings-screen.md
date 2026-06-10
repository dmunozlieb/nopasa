# Settings screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A complete Settings screen that persists the real preferences (reminder time, default reminders) on-device, wires them into the planner and add form, and shows privacy info, delete-all-data, version, and honest "Próximamente" rows.

**Architecture:** Hexagonal, mirroring the deadlines stack: a `Settings` Zod model, a `SettingsRepository` port with a SQLite adapter (new migration v2) and an in-memory fake, all over the existing `SqlExecutor`. A shared, memoized database bootstrap opens+migrates once for both repositories. `SettingsProvider`/`useSettings()` expose settings (loaded once, **gated** like `RepositoryProvider`) and a persist-first `save`.

**Tech Stack:** Expo SDK 56, React Native 0.85, Zod 4, expo-sqlite, expo-constants, `@react-native-community/datetimepicker`, Jest + @testing-library/react-native, Node's `node:sqlite` (tests).

---

## Refinement over the spec

The spec said the provider shows defaults "while loading (no gate)". This plan instead **gates** `SettingsProvider` with `<Loading />` until the first load resolves (exactly like `RepositoryProvider`). Reason: `AddDeadlineScreen` seeds its reminder chips from `settings.defaultReminderDaysBefore` in a `useState` initializer that runs once at mount; without a gate, a slow load would seed stale defaults (a real race, and untestable). Gating guarantees every consumer reads the real persisted settings. `DEFAULT_SETTINGS` is still what the repository's `load()` returns when no row exists.

## File structure

Created:
- `src/domain/settings/settings.schema.ts` — `Settings` Zod schema + `DEFAULT_SETTINGS`.
- `src/ports/settings-repository.ts` — `SettingsRepository` interface.
- `src/infrastructure/persistence/sqlite/settings-mapper.ts` — `SettingsRow` + pure `toRow`/`fromRow`.
- `src/infrastructure/persistence/sqlite/sqlite-settings-repository.ts` — SQLite adapter.
- `src/infrastructure/persistence/sqlite/database-opener.ts` — pure `createDatabaseOpener`.
- `src/infrastructure/persistence/sqlite/database.ts` — `openMigratedDatabase` (shared bootstrap).
- `src/infrastructure/persistence/sqlite/create-settings-repository.ts` — composition root.
- `src/test-support/in-memory-settings-repository.ts` — fake.
- `src/ui/settings/settings-context.tsx` — `SettingsProvider` + `useSettings`.
- `src/ui/components/TimePickerField.tsx` — native time picker field.
- `src/ui/components/ComingSoonRow.tsx` — inert "Próximamente" row.
- `src/ui/screens/SettingsScreen.tsx` — the screen.
- `app/settings.tsx` — the modal route.
- Test files alongside each unit.

Modified:
- `src/infrastructure/persistence/sqlite/migrations.ts` (+ `migrations.test.ts`) — add migration v2.
- `src/infrastructure/persistence/sqlite/create-deadline-repository.ts` — use the shared bootstrap.
- `src/ui/hooks/use-create-deadline.ts` (+ test) — read `settings.reminderTime`.
- `src/ui/screens/AddDeadlineScreen.tsx` (+ test) — seed chips from settings.
- `src/ui/components/ScreenHeader.tsx` (+ test) — optional gear.
- `src/ui/components/EmptyState.tsx` (+ test) — gear.
- `src/ui/components/DeadlineList.tsx` — pass `onOpenSettings` to the header.
- `src/ui/screens/HomeScreen.tsx` (+ test) — `onOpenSettings` prop.
- `app/index.tsx` — route to settings.
- `app/_layout.tsx` — mount `SettingsProvider`.

Notes for the implementer:
- Tests run only under `src/` (jest `roots`) with `TZ=Europe/Madrid`. Run all with `npm test`; one file with `npm test -- <path>`. Typecheck: `npm run typecheck`.
- **RNTL here is async/concurrent:** `await render(...)` / `await renderHook(...)`; make the first query after a render an awaited `findBy*`; await a `findBy*` after each state-changing `fireEvent` before the next interaction. With a gating provider, also `await waitFor(() => expect(result.current)...)` in hook tests before using `result.current`.
- Code/identifiers/comments in English; commit messages in English; no `Co-Authored-By` trailers.

---

### Task 1: `Settings` domain model

**Files:**
- Create: `src/domain/settings/settings.schema.ts`
- Test: `src/domain/settings/settings.schema.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { settingsSchema, DEFAULT_SETTINGS } from './settings.schema';

describe('settingsSchema', () => {
  it('accepts a valid settings object', () => {
    const value = { reminderTime: { hour: 8, minute: 30 }, defaultReminderDaysBefore: [30, 7] };
    expect(settingsSchema.parse(value)).toEqual(value);
  });

  it('rejects an out-of-range hour or minute', () => {
    expect(() => settingsSchema.parse({ reminderTime: { hour: 24, minute: 0 }, defaultReminderDaysBefore: [] })).toThrow();
    expect(() => settingsSchema.parse({ reminderTime: { hour: 9, minute: 60 }, defaultReminderDaysBefore: [] })).toThrow();
  });

  it('rejects non-integer / negative reminder days', () => {
    expect(() => settingsSchema.parse({ reminderTime: { hour: 9, minute: 0 }, defaultReminderDaysBefore: [-1] })).toThrow();
  });
});

describe('DEFAULT_SETTINGS', () => {
  it('is 09:00 with [30, 7] and is itself valid', () => {
    expect(DEFAULT_SETTINGS).toEqual({ reminderTime: { hour: 9, minute: 0 }, defaultReminderDaysBefore: [30, 7] });
    expect(settingsSchema.parse(DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/domain/settings/settings.schema.test.ts`
Expected: FAIL — cannot find module `./settings.schema`.

- [ ] **Step 3: Write minimal implementation**

```ts
import { z } from 'zod';

/** User preferences. Only fields that are actually wired live here. */
export const settingsSchema = z.object({
  reminderTime: z.object({
    hour: z.number().int().min(0).max(23),
    minute: z.number().int().min(0).max(59),
  }),
  defaultReminderDaysBefore: z.array(z.number().int().nonnegative()),
});

export type Settings = z.infer<typeof settingsSchema>;

/** Returned by the repository when nothing is stored. 09:00, [30, 7]. Mirrors the
 *  planner's DEFAULT_REMINDER_TIME (both 09:00); keep them in sync. */
export const DEFAULT_SETTINGS: Settings = {
  reminderTime: { hour: 9, minute: 0 },
  defaultReminderDaysBefore: [30, 7],
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/domain/settings/settings.schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/settings/settings.schema.ts src/domain/settings/settings.schema.test.ts
git commit -m "feat(settings): Settings Zod model and DEFAULT_SETTINGS"
```

---

### Task 2: `SettingsRepository` port

**Files:**
- Create: `src/ports/settings-repository.ts`

Interface only (like `deadline-repository.ts`); verified by typecheck.

- [ ] **Step 1: Write the port**

```ts
import type { Settings } from '../domain/settings/settings.schema';

/** Persistence boundary for user settings. Async by design (SQLite-backed). */
export interface SettingsRepository {
  /** Returns the stored settings, or DEFAULT_SETTINGS when nothing is saved yet. */
  load(): Promise<Settings>;
  save(settings: Settings): Promise<void>;
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/ports/settings-repository.ts
git commit -m "feat(settings): SettingsRepository port"
```

---

### Task 3: Migration v2 (settings table)

**Files:**
- Modify: `src/infrastructure/persistence/sqlite/migrations.ts`
- Test: `src/infrastructure/persistence/sqlite/migrations.test.ts`

- [ ] **Step 1: Add the failing test**

Append this `it` inside the existing `describe('MIGRATIONS', ...)` in `migrations.test.ts`:

```ts
  it('v2 creates the settings table with its columns', () => {
    const v2 = MIGRATIONS.find((m) => m.version === 2);
    expect(v2).toBeDefined();
    const sql = v2!.sql;
    expect(sql).toContain('CREATE TABLE settings');
    for (const column of ['id', 'reminder_hour', 'reminder_minute', 'default_reminder_days_before']) {
      expect(sql).toContain(column);
    }
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/infrastructure/persistence/sqlite/migrations.test.ts`
Expected: FAIL — no migration with version 2.

- [ ] **Step 3: Add the migration**

In `migrations.ts`, add the SQL constant after `CREATE_DEADLINES_TABLE_SQL` and append v2 to `MIGRATIONS`:

```ts
const CREATE_SETTINGS_TABLE_SQL = `
CREATE TABLE settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  reminder_hour INTEGER NOT NULL,
  reminder_minute INTEGER NOT NULL,
  default_reminder_days_before TEXT NOT NULL
);
`;

export const MIGRATIONS: Migration[] = [
  { version: 1, sql: CREATE_DEADLINES_TABLE_SQL },
  { version: 2, sql: CREATE_SETTINGS_TABLE_SQL },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/infrastructure/persistence/sqlite/migrations.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/persistence/sqlite/migrations.ts src/infrastructure/persistence/sqlite/migrations.test.ts
git commit -m "feat(settings): migration v2 creates the settings table"
```

---

### Task 4: `settings-mapper` (pure)

**Files:**
- Create: `src/infrastructure/persistence/sqlite/settings-mapper.ts`
- Test: `src/infrastructure/persistence/sqlite/settings-mapper.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { fromRow, toRow } from './settings-mapper';

const settings = { reminderTime: { hour: 8, minute: 30 }, defaultReminderDaysBefore: [30, 7] };
const row = { reminder_hour: 8, reminder_minute: 30, default_reminder_days_before: '[30,7]' };

describe('settings-mapper', () => {
  it('maps settings → row', () => {
    expect(toRow(settings)).toEqual(row);
  });

  it('round-trips row → settings → row', () => {
    expect(fromRow(row)).toEqual(settings);
    expect(toRow(fromRow(row))).toEqual(row);
  });

  it('throws on a row that violates the schema (out-of-range hour)', () => {
    expect(() => fromRow({ reminder_hour: 99, reminder_minute: 0, default_reminder_days_before: '[7]' })).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/infrastructure/persistence/sqlite/settings-mapper.test.ts`
Expected: FAIL — cannot find module `./settings-mapper`.

- [ ] **Step 3: Write minimal implementation**

```ts
import { settingsSchema, type Settings } from '../../../domain/settings/settings.schema';

export interface SettingsRow {
  reminder_hour: number;
  reminder_minute: number;
  default_reminder_days_before: string; // JSON array
}

/** Domain → row. The reminders array is JSON-encoded, like the deadline mapper. */
export function toRow(settings: Settings): SettingsRow {
  return {
    reminder_hour: settings.reminderTime.hour,
    reminder_minute: settings.reminderTime.minute,
    default_reminder_days_before: JSON.stringify(settings.defaultReminderDaysBefore),
  };
}

/** Row → domain, validated with the Zod schema at the edge. Throws on a corrupt row. */
export function fromRow(row: SettingsRow): Settings {
  return settingsSchema.parse({
    reminderTime: { hour: row.reminder_hour, minute: row.reminder_minute },
    defaultReminderDaysBefore: JSON.parse(row.default_reminder_days_before),
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/infrastructure/persistence/sqlite/settings-mapper.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/persistence/sqlite/settings-mapper.ts src/infrastructure/persistence/sqlite/settings-mapper.test.ts
git commit -m "feat(settings): pure settings row mapper"
```

---

### Task 5: `SqliteSettingsRepository`

**Files:**
- Create: `src/infrastructure/persistence/sqlite/sqlite-settings-repository.ts`
- Test: `src/infrastructure/persistence/sqlite/sqlite-settings-repository.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { DEFAULT_SETTINGS } from '../../../domain/settings/settings.schema';
import { NodeSqliteExecutor } from '../../../test-support/node-sqlite-executor';
import { runMigrations } from './run-migrations';
import { SqliteSettingsRepository } from './sqlite-settings-repository';

async function freshRepo() {
  const executor = new NodeSqliteExecutor();
  await runMigrations(executor);
  return { executor, repo: new SqliteSettingsRepository(executor) };
}

describe('SqliteSettingsRepository', () => {
  it('returns DEFAULT_SETTINGS when nothing is stored', async () => {
    const { repo } = await freshRepo();
    expect(await repo.load()).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips saved settings', async () => {
    const { repo } = await freshRepo();
    const settings = { reminderTime: { hour: 8, minute: 30 }, defaultReminderDaysBefore: [7, 1] };
    await repo.save(settings);
    expect(await repo.load()).toEqual(settings);
  });

  it('overwrites on a second save (single row)', async () => {
    const { repo } = await freshRepo();
    await repo.save({ reminderTime: { hour: 8, minute: 0 }, defaultReminderDaysBefore: [30] });
    await repo.save({ reminderTime: { hour: 20, minute: 15 }, defaultReminderDaysBefore: [7] });
    expect(await repo.load()).toEqual({ reminderTime: { hour: 20, minute: 15 }, defaultReminderDaysBefore: [7] });
  });

  it('falls back to defaults on a corrupt row', async () => {
    const { executor, repo } = await freshRepo();
    await executor.run(
      'INSERT OR REPLACE INTO settings (id, reminder_hour, reminder_minute, default_reminder_days_before) VALUES (1, ?, ?, ?)',
      [99, 0, '[7]'], // hour 99 is invalid
    );
    expect(await repo.load()).toEqual(DEFAULT_SETTINGS);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/infrastructure/persistence/sqlite/sqlite-settings-repository.test.ts`
Expected: FAIL — cannot find module `./sqlite-settings-repository`.

- [ ] **Step 3: Write minimal implementation**

```ts
import { DEFAULT_SETTINGS, type Settings } from '../../../domain/settings/settings.schema';
import type { SettingsRepository } from '../../../ports/settings-repository';
import { consoleLogger, type Logger } from '../../logging/logger';
import { fromRow, toRow, type SettingsRow } from './settings-mapper';
import type { SqlExecutor } from './sql-executor';

const SELECT_SQL =
  'SELECT reminder_hour, reminder_minute, default_reminder_days_before FROM settings WHERE id = 1';
const UPSERT_SQL =
  'INSERT OR REPLACE INTO settings (id, reminder_hour, reminder_minute, default_reminder_days_before) VALUES (1, ?, ?, ?)';

/** SQLite-backed SettingsRepository (single row, id = 1). Resilient: a corrupt row
 *  warns and yields DEFAULT_SETTINGS rather than crashing. */
export class SqliteSettingsRepository implements SettingsRepository {
  constructor(
    private readonly executor: SqlExecutor,
    private readonly logger: Logger = consoleLogger,
  ) {}

  async load(): Promise<Settings> {
    const row = await this.executor.getFirst<SettingsRow>(SELECT_SQL);
    if (row === null) return DEFAULT_SETTINGS;
    try {
      return fromRow(row);
    } catch (error) {
      this.logger.warn('Ignoring corrupt settings row; using defaults', error);
      return DEFAULT_SETTINGS;
    }
  }

  async save(settings: Settings): Promise<void> {
    const row = toRow(settings);
    await this.executor.run(UPSERT_SQL, [
      row.reminder_hour,
      row.reminder_minute,
      row.default_reminder_days_before,
    ]);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/infrastructure/persistence/sqlite/sqlite-settings-repository.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/persistence/sqlite/sqlite-settings-repository.ts src/infrastructure/persistence/sqlite/sqlite-settings-repository.test.ts
git commit -m "feat(settings): SQLite SettingsRepository over the shared executor"
```

---

### Task 6: `InMemorySettingsRepository` (fake)

**Files:**
- Create: `src/test-support/in-memory-settings-repository.ts`
- Test: `src/test-support/in-memory-settings-repository.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { DEFAULT_SETTINGS } from '../domain/settings/settings.schema';
import { InMemorySettingsRepository } from './in-memory-settings-repository';

describe('InMemorySettingsRepository', () => {
  it('defaults to DEFAULT_SETTINGS', async () => {
    expect(await new InMemorySettingsRepository().load()).toEqual(DEFAULT_SETTINGS);
  });

  it('returns the injected initial settings', async () => {
    const initial = { reminderTime: { hour: 7, minute: 15 }, defaultReminderDaysBefore: [1] };
    expect(await new InMemorySettingsRepository(initial).load()).toEqual(initial);
  });

  it('save then load returns the saved settings', async () => {
    const repo = new InMemorySettingsRepository();
    const next = { reminderTime: { hour: 20, minute: 0 }, defaultReminderDaysBefore: [7, 1] };
    await repo.save(next);
    expect(await repo.load()).toEqual(next);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/test-support/in-memory-settings-repository.test.ts`
Expected: FAIL — cannot find module `./in-memory-settings-repository`.

- [ ] **Step 3: Write minimal implementation**

```ts
import { DEFAULT_SETTINGS, type Settings } from '../domain/settings/settings.schema';
import type { SettingsRepository } from '../ports/settings-repository';

/** In-memory SettingsRepository for tests and previews. */
export class InMemorySettingsRepository implements SettingsRepository {
  private settings: Settings;

  constructor(initial: Settings = DEFAULT_SETTINGS) {
    this.settings = initial;
  }

  async load(): Promise<Settings> {
    return this.settings;
  }

  async save(settings: Settings): Promise<void> {
    this.settings = settings;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/test-support/in-memory-settings-repository.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/test-support/in-memory-settings-repository.ts src/test-support/in-memory-settings-repository.test.ts
git commit -m "test(settings): in-memory SettingsRepository fake"
```

---

### Task 7: `createDatabaseOpener` (pure)

**Files:**
- Create: `src/infrastructure/persistence/sqlite/database-opener.ts`
- Test: `src/infrastructure/persistence/sqlite/database-opener.test.ts`

This isolates the memoization logic (no `expo-sqlite` import) so it is unit-testable.

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/infrastructure/persistence/sqlite/database-opener.test.ts`
Expected: FAIL — cannot find module `./database-opener`.

- [ ] **Step 3: Write minimal implementation**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/infrastructure/persistence/sqlite/database-opener.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/persistence/sqlite/database-opener.ts src/infrastructure/persistence/sqlite/database-opener.test.ts
git commit -m "feat(settings): memoized database opener (no cached rejection)"
```

---

### Task 8: Shared bootstrap + repository composition roots

**Files:**
- Create: `src/infrastructure/persistence/sqlite/database.ts`
- Create: `src/infrastructure/persistence/sqlite/create-settings-repository.ts`
- Modify: `src/infrastructure/persistence/sqlite/create-deadline-repository.ts`

No new unit tests (these import `expo-sqlite`, which is never imported under jest; verified by typecheck + the existing suite staying green). The memoization logic is already tested via Task 7.

- [ ] **Step 1: Create the shared bootstrap**

`src/infrastructure/persistence/sqlite/database.ts`:

```ts
import { openDatabaseAsync } from 'expo-sqlite';
import { createDatabaseOpener } from './database-opener';
import { ExpoSqliteExecutor } from './expo-sqlite-executor';
import { runMigrations } from './run-migrations';

/** Opens the on-device database and runs migrations exactly once, shared by every
 *  repository (deadlines + settings) so the db is opened and migrated a single time. */
export const openMigratedDatabase = createDatabaseOpener(async () => {
  const db = await openDatabaseAsync('nopasa.db');
  const executor = new ExpoSqliteExecutor(db);
  await runMigrations(executor);
  return executor;
});
```

- [ ] **Step 2: Refactor `create-deadline-repository.ts` to use it**

Replace the entire file with:

```ts
import type { DeadlineRepository } from '../../../ports/deadline-repository';
import { openMigratedDatabase } from './database';
import { SqliteDeadlineRepository } from './sqlite-deadline-repository';

/** Returns a DeadlineRepository over the shared, migrated on-device database. */
export async function createDeadlineRepository(): Promise<DeadlineRepository> {
  const executor = await openMigratedDatabase();
  return new SqliteDeadlineRepository(executor);
}
```

- [ ] **Step 3: Create `create-settings-repository.ts`**

```ts
import type { SettingsRepository } from '../../../ports/settings-repository';
import { openMigratedDatabase } from './database';
import { SqliteSettingsRepository } from './sqlite-settings-repository';

/** Returns a SettingsRepository over the shared, migrated on-device database. */
export async function createSettingsRepository(): Promise<SettingsRepository> {
  const executor = await openMigratedDatabase();
  return new SqliteSettingsRepository(executor);
}
```

- [ ] **Step 4: Typecheck and run the full suite**

Run: `npm run typecheck`
Expected: no errors. (Confirm no test imported `createDeadlineRepository` with a `databaseName` argument; `RepositoryProvider` calls it with none.)

Run: `npm test`
Expected: PASS (no regressions).

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/persistence/sqlite/database.ts src/infrastructure/persistence/sqlite/create-settings-repository.ts src/infrastructure/persistence/sqlite/create-deadline-repository.ts
git commit -m "feat(settings): shared db bootstrap; deadline + settings repositories share it"
```

---

### Task 9: `SettingsProvider` + `useSettings`

**Files:**
- Create: `src/ui/settings/settings-context.tsx`
- Test: `src/ui/settings/settings-context.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { InMemorySettingsRepository } from '../../test-support/in-memory-settings-repository';
import { SettingsProvider, useSettings } from './settings-context';

function wrapper(repo: InMemorySettingsRepository) {
  return ({ children }: { children: ReactNode }) => (
    <SettingsProvider repository={repo}>{children}</SettingsProvider>
  );
}

describe('useSettings', () => {
  it('loads settings from the repository', async () => {
    const repo = new InMemorySettingsRepository({ reminderTime: { hour: 8, minute: 30 }, defaultReminderDaysBefore: [7, 1] });
    const { result } = await renderHook(() => useSettings(), { wrapper: wrapper(repo) });
    await waitFor(() => expect(result.current).toBeTruthy());
    expect(result.current.settings).toEqual({ reminderTime: { hour: 8, minute: 30 }, defaultReminderDaysBefore: [7, 1] });
  });

  it('save persists then updates the in-memory settings (persist-first)', async () => {
    const repo = new InMemorySettingsRepository();
    const { result } = await renderHook(() => useSettings(), { wrapper: wrapper(repo) });
    await waitFor(() => expect(result.current).toBeTruthy());
    const next = { reminderTime: { hour: 20, minute: 0 }, defaultReminderDaysBefore: [30] };
    await act(async () => { await result.current.save(next); });
    expect(await repo.load()).toEqual(next);
    expect(result.current.settings).toEqual(next);
  });

  it('leaves settings unchanged when persisting fails', async () => {
    const repo = new InMemorySettingsRepository();
    jest.spyOn(repo, 'save').mockRejectedValue(new Error('disk'));
    const { result } = await renderHook(() => useSettings(), { wrapper: wrapper(repo) });
    await waitFor(() => expect(result.current).toBeTruthy());
    const before = result.current.settings;
    await act(async () => {
      await expect(
        result.current.save({ reminderTime: { hour: 1, minute: 1 }, defaultReminderDaysBefore: [1] }),
      ).rejects.toThrow('disk');
    });
    expect(result.current.settings).toEqual(before);
  });

  it('throws when used outside the provider', async () => {
    await expect(renderHook(() => useSettings())).rejects.toThrow(
      'useSettings must be used within a SettingsProvider',
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/ui/settings/settings-context.test.tsx`
Expected: FAIL — cannot find module `./settings-context`.

- [ ] **Step 3: Write minimal implementation**

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { DEFAULT_SETTINGS, type Settings } from '../../domain/settings/settings.schema';
import type { SettingsRepository } from '../../ports/settings-repository';
import { createSettingsRepository } from '../../infrastructure/persistence/sqlite/create-settings-repository';
import { Loading } from '../components/Loading';

interface SettingsContextValue {
  settings: Settings;
  /** Persist-first: stores `next`, then updates in-memory state. Rejects on failure
   *  (state stays equal to what is persisted — no divergence to reconcile). */
  save: (next: Settings) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

interface SettingsProviderProps {
  /** Inject a ready repository (tests/previews). Omit to build the SQLite one. */
  repository?: SettingsRepository;
  children: ReactNode;
}

export function SettingsProvider({ repository, children }: SettingsProviderProps) {
  const [repo, setRepo] = useState<SettingsRepository | null>(repository ?? null);
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    if (repository) return;
    let cancelled = false;
    void (async () => {
      const built = await createSettingsRepository();
      if (!cancelled) setRepo(built);
    })();
    return () => {
      cancelled = true;
    };
  }, [repository]);

  useEffect(() => {
    if (!repo) return;
    let cancelled = false;
    void (async () => {
      let loaded: Settings;
      try {
        loaded = await repo.load();
      } catch {
        loaded = DEFAULT_SETTINGS;
      }
      if (!cancelled) setSettings(loaded);
    })();
    return () => {
      cancelled = true;
    };
  }, [repo]);

  // Gate like RepositoryProvider: consumers always read real, loaded settings.
  if (!repo || settings === null) return <Loading />;

  const save = async (next: Settings) => {
    await repo.save(next);
    setSettings(next);
  };

  return <SettingsContext.Provider value={{ settings, save }}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return ctx;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/ui/settings/settings-context.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/settings/settings-context.tsx src/ui/settings/settings-context.test.tsx
git commit -m "feat(settings): SettingsProvider + useSettings (gated, persist-first)"
```

---

### Task 10: `useCreateDeadline` reads the settings reminder time

**Files:**
- Modify: `src/ui/hooks/use-create-deadline.ts`
- Test: `src/ui/hooks/use-create-deadline.test.tsx`

- [ ] **Step 1: Update the test**

Replace the entire contents of `src/ui/hooks/use-create-deadline.test.tsx` with:

```tsx
import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { InMemoryDeadlineRepository } from '../../test-support/in-memory-deadline-repository';
import { FakeNotificationScheduler } from '../../test-support/fake-notification-scheduler';
import { InMemorySettingsRepository } from '../../test-support/in-memory-settings-repository';
import type { NotificationScheduler } from '../../ports/notification-scheduler';
import { RepositoryProvider } from '../repository/repository-context';
import { DeadlineDepsProvider } from '../deadline-deps/deadline-deps-context';
import { NotificationSchedulerProvider } from '../notification-scheduler/notification-scheduler-context';
import { SettingsProvider } from '../settings/settings-context';
import { useCreateDeadline } from './use-create-deadline';

function wrapperWith(
  repo: InMemoryDeadlineRepository,
  scheduler: NotificationScheduler,
  settingsRepo = new InMemorySettingsRepository(),
) {
  return ({ children }: { children: ReactNode }) => (
    <RepositoryProvider repository={repo}>
      <DeadlineDepsProvider generateId={() => 'fixed-id'} clock={{ now: () => new Date(2026, 5, 8) }}>
        <NotificationSchedulerProvider scheduler={scheduler}>
          <SettingsProvider repository={settingsRepo}>{children}</SettingsProvider>
        </NotificationSchedulerProvider>
      </DeadlineDepsProvider>
    </RepositoryProvider>
  );
}

const input = {
  type: 'ITV' as const,
  title: 'ITV del coche',
  dueDate: new Date(2026, 8, 1),
  reminderDaysBefore: [7, 30],
};

describe('useCreateDeadline', () => {
  it('builds a Deadline with injected id/clock and persists it', async () => {
    const repo = new InMemoryDeadlineRepository();
    const { result } = await renderHook(() => useCreateDeadline(), {
      wrapper: wrapperWith(repo, new FakeNotificationScheduler()),
    });
    await waitFor(() => expect(typeof result.current).toBe('function'));

    const created = await result.current(input);

    expect(created.id).toBe('fixed-id');
    expect(created.createdAt).toEqual(new Date(2026, 5, 8));
    expect(created.status).toBe('ACTIVE');
    expect(await repo.findById('fixed-id')).toMatchObject({ id: 'fixed-id', title: 'ITV del coche' });
  });

  it('schedules reminders at the time from settings', async () => {
    const repo = new InMemoryDeadlineRepository();
    const scheduler = new FakeNotificationScheduler();
    const settingsRepo = new InMemorySettingsRepository({ reminderTime: { hour: 8, minute: 30 }, defaultReminderDaysBefore: [30, 7] });
    const { result } = await renderHook(() => useCreateDeadline(), {
      wrapper: wrapperWith(repo, scheduler, settingsRepo),
    });
    await waitFor(() => expect(typeof result.current).toBe('function'));

    await result.current(input);

    const plan = scheduler.scheduled.get('fixed-id')!;
    expect(plan.map((p) => [p.fireAt.getHours(), p.fireAt.getMinutes()])).toEqual([
      [8, 30],
      [8, 30],
    ]);
  });

  it('persists even when scheduling throws (best-effort)', async () => {
    const repo = new InMemoryDeadlineRepository();
    const throwing: NotificationScheduler = {
      schedule: async () => {
        throw new Error('scheduler down');
      },
      cancel: async () => {},
    };
    const { result } = await renderHook(() => useCreateDeadline(), {
      wrapper: wrapperWith(repo, throwing),
    });
    await waitFor(() => expect(typeof result.current).toBe('function'));

    const created = await result.current(input);

    expect(created.id).toBe('fixed-id');
    expect(await repo.findById('fixed-id')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/ui/hooks/use-create-deadline.test.tsx`
Expected: FAIL — the "time from settings" test fails (still using the constant 09:00).

- [ ] **Step 3: Update the implementation**

Replace the entire contents of `src/ui/hooks/use-create-deadline.ts` with:

```ts
import { useCallback } from 'react';
import { createDeadline, type CreateDeadlineInput } from '../../domain/deadline/deadline.factory';
import type { Deadline } from '../../domain/deadline/deadline.schema';
import { useDeadlineRepository } from '../repository/repository-context';
import { useDeadlineDeps } from '../deadline-deps/deadline-deps-context';
import { useNotificationScheduler } from '../notification-scheduler/notification-scheduler-context';
import { useSettings } from '../settings/settings-context';
import { buildNotificationPlan } from '../notification/build-notification-plan';

/** Returns a function that builds a Deadline via the domain factory (id/clock from DI),
 *  persists it, then schedules its reminders at the user's configured reminder time.
 *  Scheduling is best-effort: a scheduler failure never fails the save. */
export function useCreateDeadline(): (input: CreateDeadlineInput) => Promise<Deadline> {
  const repository = useDeadlineRepository();
  const deps = useDeadlineDeps();
  const scheduler = useNotificationScheduler();
  const { settings } = useSettings();
  return useCallback(
    async (input: CreateDeadlineInput) => {
      const deadline = createDeadline(input, deps);
      await repository.save(deadline);
      try {
        const plan = buildNotificationPlan(deadline, {
          now: deps.clock.now(),
          reminderTime: settings.reminderTime,
        });
        await scheduler.schedule(deadline.id, plan);
      } catch {
        // Notifications are best-effort; never fail the save because of them.
      }
      return deadline;
    },
    [repository, deps, scheduler, settings],
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/ui/hooks/use-create-deadline.test.tsx`
Expected: PASS (all three cases).

- [ ] **Step 5: Commit**

```bash
git add src/ui/hooks/use-create-deadline.ts src/ui/hooks/use-create-deadline.test.tsx
git commit -m "feat(settings): schedule reminders at the configured reminder time"
```

---

### Task 11: `TimePickerField`

**Files:**
- Create: `src/ui/components/TimePickerField.tsx`
- Test: `src/ui/components/TimePickerField.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';
import { TimePickerField } from './TimePickerField';

describe('TimePickerField', () => {
  it('shows the zero-padded time and is closed initially', async () => {
    await render(<TimePickerField value={{ hour: 9, minute: 0 }} onChange={() => {}} />);
    expect(screen.getByText('09:00')).toBeTruthy();
    expect(screen.queryByTestId('datetimepicker')).toBeNull();
  });

  it('opens the picker on press and reports the chosen time', async () => {
    const onChange = jest.fn();
    await render(<TimePickerField value={{ hour: 9, minute: 0 }} onChange={onChange} />);
    fireEvent.press(screen.getByText('09:00'));
    const picker = await screen.findByTestId('datetimepicker');
    fireEvent(picker, 'change', { type: 'set' }, new Date(2026, 0, 1, 8, 30));
    expect(onChange).toHaveBeenCalledWith({ hour: 8, minute: 30 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/ui/components/TimePickerField.test.tsx`
Expected: FAIL — cannot find module `./TimePickerField`.

- [ ] **Step 3: Write minimal implementation**

```tsx
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { AppText } from './AppText';
import { colors, fontSizes, radii, spacing } from '../theme';

interface Time {
  hour: number;
  minute: number;
}

interface TimePickerFieldProps {
  value: Time;
  onChange: (time: Time) => void;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Tappable field that opens the native time picker (mode "time"). Reports only
 *  confirmed selections; dismissals leave the value unchanged. */
export function TimePickerField({ value, onChange }: TimePickerFieldProps) {
  const [open, setOpen] = useState(false);

  const handleChange = (event: DateTimePickerEvent, selected?: Date) => {
    setOpen(false);
    if (event.type === 'set' && selected) {
      onChange({ hour: selected.getHours(), minute: selected.getMinutes() });
    }
  };

  const pickerValue = new Date();
  pickerValue.setHours(value.hour, value.minute, 0, 0);

  return (
    <>
      <Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={styles.field}>
        <MaterialCommunityIcons name="clock-outline" size={18} color={colors.textSecondary} />
        <AppText weight="bold" size={fontSizes.body}>{`${pad(value.hour)}:${pad(value.minute)}`}</AppText>
      </Pressable>
      {open ? <DateTimePicker value={pickerValue} mode="time" onChange={handleChange} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.button,
    backgroundColor: colors.surfaceSoft,
  },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/ui/components/TimePickerField.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/TimePickerField.tsx src/ui/components/TimePickerField.test.tsx
git commit -m "feat(settings): TimePickerField wrapping the native time picker"
```

---

### Task 12: `ComingSoonRow` + `SettingsScreen`

**Files:**
- Create: `src/ui/components/ComingSoonRow.tsx`
- Create: `src/ui/screens/SettingsScreen.tsx`
- Test: `src/ui/screens/SettingsScreen.test.tsx`

- [ ] **Step 1: Create `ComingSoonRow` (presentational, no dedicated test — exercised by the screen test)**

```tsx
import { StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { colors, fontSizes, radii, spacing } from '../theme';

interface ComingSoonRowProps {
  label: string;
}

/** A visible but inert settings row: names a future feature without faking a control. */
export function ComingSoonRow({ label }: ComingSoonRowProps) {
  return (
    <View style={styles.root}>
      <AppText weight="bold" size={fontSizes.body} color={colors.textSecondary}>
        {label}
      </AppText>
      <View style={styles.badge}>
        <AppText weight="bold" size={fontSizes.small} color={colors.textFaint}>
          Próximamente
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md },
  badge: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: radii.pill, backgroundColor: colors.surfaceSoft },
});
```

- [ ] **Step 2: Write the failing screen test**

```tsx
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { buildDeadline } from '../../test-support/build-deadline';
import { InMemoryDeadlineRepository } from '../../test-support/in-memory-deadline-repository';
import { FakeNotificationScheduler } from '../../test-support/fake-notification-scheduler';
import { InMemorySettingsRepository } from '../../test-support/in-memory-settings-repository';
import { RepositoryProvider } from '../repository/repository-context';
import { NotificationSchedulerProvider } from '../notification-scheduler/notification-scheduler-context';
import { SettingsProvider } from '../settings/settings-context';
import { SettingsScreen } from './SettingsScreen';

function renderScreen({
  repo = new InMemoryDeadlineRepository(),
  scheduler = new FakeNotificationScheduler(),
  settingsRepo = new InMemorySettingsRepository(),
  onClose = () => {},
}: {
  repo?: InMemoryDeadlineRepository;
  scheduler?: FakeNotificationScheduler;
  settingsRepo?: InMemorySettingsRepository;
  onClose?: () => void;
} = {}) {
  return render(
    <RepositoryProvider repository={repo}>
      <NotificationSchedulerProvider scheduler={scheduler}>
        <SettingsProvider repository={settingsRepo}>
          <SettingsScreen onClose={onClose} />
        </SettingsProvider>
      </NotificationSchedulerProvider>
    </RepositoryProvider>,
  );
}

describe('SettingsScreen', () => {
  it('persists a new reminder time', async () => {
    const settingsRepo = new InMemorySettingsRepository();
    await renderScreen({ settingsRepo });

    fireEvent.press(await screen.findByText('09:00'));
    fireEvent(await screen.findByTestId('datetimepicker'), 'change', { type: 'set' }, new Date(2026, 0, 1, 8, 30));

    await waitFor(async () => expect((await settingsRepo.load()).reminderTime).toEqual({ hour: 8, minute: 30 }));
  });

  it('persists changed default reminders', async () => {
    const settingsRepo = new InMemorySettingsRepository(); // default [30, 7]
    await renderScreen({ settingsRepo });

    fireEvent.press(await screen.findByText('1 día')); // add 1 → [30, 7, 1]

    await waitFor(async () => expect((await settingsRepo.load()).defaultReminderDaysBefore).toEqual([30, 7, 1]));
  });

  it('deletes all deadlines (cancelling their reminders) after confirming', async () => {
    const repo = new InMemoryDeadlineRepository([buildDeadline({ id: '1' }), buildDeadline({ id: '2' })]);
    const scheduler = new FakeNotificationScheduler();
    const onClose = jest.fn();
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.style === 'destructive')?.onPress?.();
    });
    await renderScreen({ repo, scheduler, onClose });

    fireEvent.press(await screen.findByText('Borrar todos los datos'));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(await repo.list()).toHaveLength(0);
    expect([...scheduler.cancelled].sort()).toEqual(['1', '2']);
    alertSpy.mockRestore();
  });

  it('shows the app version and the inert "Próximamente" rows', async () => {
    await renderScreen({});
    expect(await screen.findByText(/Versión/)).toBeTruthy();
    expect(screen.getByText('Resumen semanal')).toBeTruthy();
    expect(screen.getAllByText('Próximamente').length).toBeGreaterThanOrEqual(3);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- src/ui/screens/SettingsScreen.test.tsx`
Expected: FAIL — cannot find module `./SettingsScreen`.

- [ ] **Step 4: Write minimal implementation**

```tsx
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ReminderTime } from '../notification/reminder-time';
import { useSettings } from '../settings/settings-context';
import { useDeadlineRepository } from '../repository/repository-context';
import { useNotificationScheduler } from '../notification-scheduler/notification-scheduler-context';
import { AppText } from '../components/AppText';
import { ComingSoonRow } from '../components/ComingSoonRow';
import { FormField } from '../components/FormField';
import { ReminderChips } from '../components/ReminderChips';
import { TimePickerField } from '../components/TimePickerField';
import { colors, fontSizes, radii, spacing } from '../theme';

interface SettingsScreenProps {
  onClose: () => void;
}

/** Settings screen. Real preferences are persisted; "Próximamente" rows are inert. */
export function SettingsScreen({ onClose }: SettingsScreenProps) {
  const { settings, save } = useSettings();
  const repository = useDeadlineRepository();
  const scheduler = useNotificationScheduler();
  const insets = useSafeAreaInsets();

  const persist = async (next: Parameters<typeof save>[0]) => {
    try {
      await save(next);
    } catch {
      Alert.alert('No se pudo guardar', 'Inténtalo de nuevo.');
    }
  };

  const onChangeTime = (reminderTime: ReminderTime) => persist({ ...settings, reminderTime });
  const onChangeReminders = (defaultReminderDaysBefore: number[]) =>
    persist({ ...settings, defaultReminderDaysBefore });

  const deleteAllData = async () => {
    const all = await repository.list();
    for (const deadline of all) {
      try {
        await scheduler.cancel(deadline.id);
      } catch {
        // best-effort
      }
      await repository.delete(deadline.id);
    }
    onClose();
  };

  const confirmDelete = () =>
    Alert.alert(
      'Borrar todos los datos',
      'Se borrarán todos tus vencimientos de este dispositivo. Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Borrar', style: 'destructive', onPress: () => { void deleteAllData(); } },
      ],
    );

  const version = Constants.expoConfig?.version ?? '—';

  return (
    <View style={styles.root}>
      <View style={[styles.handle, { marginTop: insets.top + spacing.sm }]} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: spacing.xxxl + insets.bottom }]}>
        <AppText weight="extrabold" size={fontSizes.title}>
          Ajustes
        </AppText>

        <FormField label="Hora del aviso">
          <TimePickerField value={settings.reminderTime} onChange={onChangeTime} />
        </FormField>

        <FormField label="Avisarme por defecto">
          <ReminderChips value={settings.defaultReminderDaysBefore} onChange={onChangeReminders} />
        </FormField>

        <FormField label="Privacidad">
          <AppText weight="semibold" size={fontSizes.label} color={colors.textMuted}>
            Tus datos se guardan solo en este dispositivo. No hay servidores ni copias en la nube.
          </AppText>
        </FormField>

        <Pressable accessibilityRole="button" onPress={confirmDelete} style={styles.delete}>
          <MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.urgency.urgent.base} />
          <AppText weight="bold" size={fontSizes.body} color={colors.urgency.urgent.base}>
            Borrar todos los datos
          </AppText>
        </Pressable>

        <View style={styles.comingSoon}>
          <ComingSoonRow label="Resumen semanal" />
          <ComingSoonRow label="Tema claro / oscuro" />
          <ComingSoonRow label="Premium" />
        </View>

        <AppText weight="semibold" size={fontSizes.small} color={colors.textFaint} style={styles.version}>
          Versión {version}
        </AppText>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.screenBg, borderTopLeftRadius: radii.card, borderTopRightRadius: radii.card },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: radii.pill, backgroundColor: colors.textFaint, opacity: 0.4 },
  content: { padding: spacing.xl, gap: spacing.lg },
  delete: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  comingSoon: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.textFaint, paddingTop: spacing.sm },
  version: { textAlign: 'center', marginTop: spacing.sm },
});
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/ui/screens/SettingsScreen.test.tsx`
Expected: PASS (all four cases).

- [ ] **Step 6: Commit**

```bash
git add src/ui/components/ComingSoonRow.tsx src/ui/screens/SettingsScreen.tsx src/ui/screens/SettingsScreen.test.tsx
git commit -m "feat(settings): SettingsScreen with wired prefs, delete-data, version, coming-soon rows"
```

---

### Task 13: Gear entry in the home header and empty state

**Files:**
- Modify: `src/ui/components/ScreenHeader.tsx`
- Test: `src/ui/components/ScreenHeader.test.tsx`
- Modify: `src/ui/components/EmptyState.tsx`
- Test: `src/ui/components/EmptyState.test.tsx`

- [ ] **Step 1: Write the failing `ScreenHeader` test**

Create `src/ui/components/ScreenHeader.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ScreenHeader } from './ScreenHeader';

describe('ScreenHeader', () => {
  it('renders the title and no gear when onSettings is absent', async () => {
    await render(<ScreenHeader title="Mis vencimientos" />);
    expect(screen.getByText('Mis vencimientos')).toBeTruthy();
    expect(screen.queryByLabelText('Ajustes')).toBeNull();
  });

  it('renders a gear that calls onSettings when provided', async () => {
    const onSettings = jest.fn();
    await render(<ScreenHeader title="Mis vencimientos" onSettings={onSettings} />);
    fireEvent.press(screen.getByLabelText('Ajustes'));
    expect(onSettings).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/ui/components/ScreenHeader.test.tsx`
Expected: FAIL — `onSettings` not supported / no element labelled "Ajustes".

- [ ] **Step 3: Update `ScreenHeader`**

Replace the entire contents of `src/ui/components/ScreenHeader.tsx` with:

```tsx
import { Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fontSizes, spacing } from '../theme';
import { AppText } from './AppText';

interface ScreenHeaderProps {
  title: string;
  summary?: string;
  summaryDotColor?: string;
  /** When provided, renders a gear button (top-right) that opens settings. */
  onSettings?: () => void;
}

/** Big screen title with an optional summary line and an optional settings gear. */
export function ScreenHeader({ title, summary, summaryDotColor, onSettings }: ScreenHeaderProps) {
  return (
    <View style={styles.root}>
      <View style={styles.titleRow}>
        <AppText weight="black" size={fontSizes.h1}>
          {title}
        </AppText>
        {onSettings ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Ajustes" onPress={onSettings} hitSlop={8}>
            <MaterialCommunityIcons name="cog" size={26} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>
      {summary ? (
        <View style={styles.summary}>
          {summaryDotColor ? <View style={[styles.dot, { backgroundColor: summaryDotColor }]} /> : null}
          <AppText weight="bold" size={fontSizes.body} color={colors.textSecondary}>
            {summary}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm, marginBottom: spacing.xl },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summary: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 9, height: 9, borderRadius: 999 },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/ui/components/ScreenHeader.test.tsx`
Expected: PASS.

- [ ] **Step 5: Update the `EmptyState` test**

In `src/ui/components/EmptyState.test.tsx`, pass `onOpenSettings={() => {}}` to every existing `render(<EmptyState ... />)` call, and add this test:

```tsx
  it('renders a settings gear that calls onOpenSettings', async () => {
    const onOpenSettings = jest.fn();
    await render(<EmptyState onAdd={() => {}} onOpenSettings={onOpenSettings} />);
    fireEvent.press(screen.getByLabelText('Ajustes'));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });
```

Make sure `fireEvent` and `screen` are imported in that test file (add them to the existing import from `@testing-library/react-native` if missing).

- [ ] **Step 6: Run test to verify it fails**

Run: `npm test -- src/ui/components/EmptyState.test.tsx`
Expected: FAIL — `onOpenSettings` not supported / no element labelled "Ajustes".

- [ ] **Step 7: Update `EmptyState`**

In `src/ui/components/EmptyState.tsx`: add `onOpenSettings` to the props and render a gear (top-right, respecting the top inset). Add `Pressable` to the `react-native` import.

Change the props interface:

```tsx
interface EmptyStateProps {
  onAdd: () => void;
  onOpenSettings: () => void;
}
```

Change the signature and add the gear as the first child of the root `View`:

```tsx
export function EmptyState({ onAdd, onOpenSettings }: EmptyStateProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: spacing.xl + insets.top, paddingBottom: spacing.xl + insets.bottom }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ajustes"
        onPress={onOpenSettings}
        hitSlop={8}
        style={[styles.settingsButton, { top: insets.top + spacing.sm }]}
      >
        <MaterialCommunityIcons name="cog" size={26} color={colors.textSecondary} />
      </Pressable>
      <AppText weight="extrabold" size={fontSizes.body} color={colors.brandBlue} style={styles.wordmark}>
        nopasa
      </AppText>
      {/* ...rest unchanged... */}
```

Add the style to the `StyleSheet.create({...})`:

```tsx
  settingsButton: { position: 'absolute', right: spacing.xl, zIndex: 1 },
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npm test -- src/ui/components/EmptyState.test.tsx`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/ui/components/ScreenHeader.tsx src/ui/components/ScreenHeader.test.tsx src/ui/components/EmptyState.tsx src/ui/components/EmptyState.test.tsx
git commit -m "feat(settings): settings gear in the home header and empty state"
```

---

### Task 14: Seed the add form's reminder chips from settings

**Files:**
- Modify: `src/ui/screens/AddDeadlineScreen.tsx`
- Test: `src/ui/screens/AddDeadlineScreen.test.tsx`

- [ ] **Step 1: Update the test**

In `src/ui/screens/AddDeadlineScreen.test.tsx`:

(a) Add imports:

```tsx
import { InMemorySettingsRepository } from '../../test-support/in-memory-settings-repository';
import { SettingsProvider } from '../settings/settings-context';
```

(b) Replace the `renderScreen` helper so it wraps with `SettingsProvider` (accepting an optional settings repo):

```tsx
function renderScreen(
  repo: InMemoryDeadlineRepository,
  onClose: () => void = () => {},
  settingsRepo: InMemorySettingsRepository = new InMemorySettingsRepository(),
) {
  return render(
    <RepositoryProvider repository={repo}>
      <DeadlineDepsProvider generateId={() => 'fixed-id'} clock={{ now: () => new Date(2026, 5, 8) }}>
        <NotificationSchedulerProvider scheduler={new FakeNotificationScheduler()}>
          <SettingsProvider repository={settingsRepo}>
            <AddDeadlineScreen onClose={onClose} />
          </SettingsProvider>
        </NotificationSchedulerProvider>
      </DeadlineDepsProvider>
    </RepositoryProvider>,
  );
}
```

(If the existing `renderScreen` already constructs a `FakeNotificationScheduler`, keep that behavior; the key change is wrapping with `SettingsProvider`. Ensure `FakeNotificationScheduler` and `NotificationSchedulerProvider` are imported.)

(c) Add a seeding test:

```tsx
  it('seeds the reminder chips from settings', async () => {
    const repo = new InMemoryDeadlineRepository();
    const settingsRepo = new InMemorySettingsRepository({ reminderTime: { hour: 9, minute: 0 }, defaultReminderDaysBefore: [7, 1] });
    await renderScreen(repo, () => {}, settingsRepo);

    fireEvent.changeText(await screen.findByPlaceholderText('Ej. ITV del coche'), 'Pasaporte de Ana');
    await screen.findByDisplayValue('Pasaporte de Ana');
    fireEvent.press(screen.getByText('Guardar'));

    await waitFor(async () => {
      const saved = await repo.findById('fixed-id');
      expect(saved?.reminderDaysBefore).toEqual([1, 7]); // seeded [7,1], sorted by toCreateInput
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/ui/screens/AddDeadlineScreen.test.tsx`
Expected: FAIL — the seeding test saves `[7, 30]` (still the literal default), not `[1, 7]`.

- [ ] **Step 3: Update the implementation**

In `src/ui/screens/AddDeadlineScreen.tsx`:

(a) Add the import:

```tsx
import { useSettings } from '../settings/settings-context';
```

(b) Read settings near the other hooks (after `const deps = useDeadlineDeps();`):

```tsx
  const { settings } = useSettings();
```

(c) In the `useState<AddFormState>` initializer, replace the literal reminders with the settings value:

```tsx
    reminderDaysBefore: settings.defaultReminderDaysBefore,
```

(The `SettingsProvider` gates until loaded, so `settings` holds the real persisted value when this initializer runs.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/ui/screens/AddDeadlineScreen.test.tsx`
Expected: PASS (the existing cases plus the seeding test; existing cases still see `[30, 7]` from default settings → saved `[7, 30]`).

- [ ] **Step 5: Commit**

```bash
git add src/ui/screens/AddDeadlineScreen.tsx src/ui/screens/AddDeadlineScreen.test.tsx
git commit -m "feat(settings): seed the add form reminder chips from settings"
```

---

### Task 15: Wire the route and mount the provider

**Files:**
- Modify: `src/ui/components/DeadlineList.tsx`
- Modify: `src/ui/screens/HomeScreen.tsx`
- Test: `src/ui/screens/HomeScreen.test.tsx`
- Create: `app/settings.tsx`
- Modify: `app/index.tsx`
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Update the HomeScreen test**

In `src/ui/screens/HomeScreen.test.tsx`, pass `onOpenSettings={() => {}}` to every existing `render(<HomeScreen ... />)` call, and add this test:

```tsx
  it('opens settings from the populated home header', async () => {
    const repo = new InMemoryDeadlineRepository([buildDeadline({ id: '1', title: 'ITV — Clio', dueDate: at(4) })]);
    const onOpenSettings = jest.fn();

    await render(
      <RepositoryProvider repository={repo}>
        <HomeScreen onOpenDeadline={() => {}} onAdd={() => {}} onOpenSettings={onOpenSettings} />
      </RepositoryProvider>,
    );

    fireEvent.press(await screen.findByLabelText('Ajustes'));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });
```

(Ensure `fireEvent` is imported in that file.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/ui/screens/HomeScreen.test.tsx`
Expected: FAIL — `onOpenSettings` not a prop / no "Ajustes" element.

- [ ] **Step 3: Thread `onOpenSettings` through `DeadlineList` and `HomeScreen`**

In `src/ui/components/DeadlineList.tsx`: add `onOpenSettings: () => void;` to `DeadlineListProps`, accept it in the function signature, and pass it to the header:

```tsx
        <ScreenHeader
          title="Mis vencimientos"
          summary={summaryText(attention)}
          summaryDotColor={colors.urgency.urgent.base}
          onSettings={onOpenSettings}
        />
```

In `src/ui/screens/HomeScreen.tsx`: add `onOpenSettings: () => void;` to `HomeScreenProps`, accept it, and pass it to both `EmptyState` and `DeadlineList`:

```tsx
export function HomeScreen({ onOpenDeadline, onAdd, onOpenSettings }: HomeScreenProps) {
  // ...
  if (total === 0) return <EmptyState onAdd={onAdd} onOpenSettings={onOpenSettings} />;

  return <DeadlineList groups={groups} today={today} onPressRow={onOpenDeadline} onAdd={onAdd} onOpenSettings={onOpenSettings} />;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/ui/screens/HomeScreen.test.tsx`
Expected: PASS.

- [ ] **Step 5: Add the route and mount the provider**

Create `app/settings.tsx`:

```tsx
import { useRouter } from 'expo-router';
import { SettingsScreen } from '../src/ui/screens/SettingsScreen';

export default function SettingsRoute() {
  const router = useRouter();
  return <SettingsScreen onClose={() => router.back()} />;
}
```

In `app/index.tsx`, pass `onOpenSettings`:

```tsx
    <HomeScreen
      onOpenDeadline={(id) => router.push(`/deadline/${id}`)}
      onAdd={() => router.push('/add')}
      onOpenSettings={() => router.push('/settings')}
    />
```

In `app/_layout.tsx`: import `SettingsProvider` and nest it inside `NotificationSchedulerProvider`, and register the route. Add the import next to the others:

```tsx
import { SettingsProvider } from '../src/ui/settings/settings-context';
```

Replace the provider/Stack block with:

```tsx
    <SafeAreaProvider>
      <RepositoryProvider>
        <DeadlineDepsProvider>
          <NotificationSchedulerProvider>
            <SettingsProvider>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="add" options={{ presentation: 'modal' }} />
                <Stack.Screen name="deadline/[id]" options={{ presentation: 'modal' }} />
                <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
              </Stack>
            </SettingsProvider>
          </NotificationSchedulerProvider>
        </DeadlineDepsProvider>
      </RepositoryProvider>
    </SafeAreaProvider>
```

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/ui/components/DeadlineList.tsx src/ui/screens/HomeScreen.tsx src/ui/screens/HomeScreen.test.tsx app/settings.tsx app/index.tsx app/_layout.tsx
git commit -m "feat(settings): mount SettingsProvider and wire the settings route"
```

---

### Task 16: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the whole test suite**

Run: `npm test`
Expected: PASS — all previous tests plus the new ones green, no `act()` warnings beyond the pre-existing ones in `use-deadlines`.

- [ ] **Step 2: Typecheck the project**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Confirm the bundle builds**

Run: `npx expo export --platform android`
Expected: exports `dist/` with no resolution errors. Then delete the artifact: `rm -rf dist`.

- [ ] **Step 4: Commit (only if anything was adjusted during verification)**

```bash
git add -A
git commit -m "chore(settings): finalize the settings screen"
```

---

## Self-review notes

- **Spec coverage:** domain model (Task 1), port (Task 2), migration v2 (Task 3), mapper (Task 4), SQLite adapter (Task 5), fake (Task 6), shared bootstrap with no-cached-rejection (Tasks 7–8), DI provider persist-first (Task 9), planner uses settings time (Task 10), TimePickerField (Task 11), screen with privacy/delete/version/coming-soon (Task 12), gear entry incl. empty state (Task 13), add-form seeding (Task 14), routing + provider mount (Task 15), verification (Task 16). All spec sections map to a task.
- **Refinement:** `SettingsProvider` gates (mirrors `RepositoryProvider`) rather than "defaults while loading" — documented above; required for correct chip seeding.
- **Type consistency:** `Settings { reminderTime: { hour, minute }, defaultReminderDaysBefore: number[] }` flows from the schema (Task 1) through the mapper/row (Task 4), repos (Tasks 5–6), provider (Task 9), and consumers (Tasks 10, 12, 14). `settings.reminderTime` is structurally a `ReminderTime` accepted by `buildNotificationPlan` (Task 10). `SettingsRepository.load/save` signatures match across port, fake, adapter, and provider. `onOpenSettings`/`onSettings` names: `ScreenHeader.onSettings`, `DeadlineList`/`HomeScreen`/`EmptyState`/route use `onOpenSettings` (Tasks 13, 15).
- **No schema regressions:** migration v1 untouched; v2 appended. Delete-data uses existing ports; settings (preferences) are not deleted.
- **Out of scope honored:** weekly digest, dark mode, Premium purchase are inert "Próximamente" rows; no edit flow, no iOS, no photo/OCR.

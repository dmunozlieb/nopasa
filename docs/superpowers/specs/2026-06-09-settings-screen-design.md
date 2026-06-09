# Settings screen — design

Date: 2026-06-09
Status: Approved

## Goal

Give the preferences that currently live in constants (`DEFAULT_REMINDER_TIME`, the
form's hard-coded `[30, 7]`) a real home, persisted on-device, plus privacy info,
delete-all-data, a Premium teaser, and the app version. Honesty rule: anything that
connects to what already exists is **real and wired**; anything that needs its own
future feature is a visible-but-inert **"Próximamente"** row — never a control that
pretends to work.

## Architecture

Hexagonal, mirroring the deadlines stack and sharing the same SQLite database.

- New domain model `Settings` (Zod) — the only domain addition.
- Port `SettingsRepository` (`load`/`save`); SQLite adapter over the existing
  `SqlExecutor`; in-memory fake for tests.
- A new schema migration (v2) adds the settings table to the existing `MIGRATIONS`.
- A single shared database bootstrap opens the db and runs migrations **once**, so the
  deadlines and settings repositories don't open/migrate twice (no fresh-install race).
- DI: `SettingsProvider` + `useSettings()`, mounted in `app/_layout.tsx`.
- The settings screen reuses existing components and ports; navigation by `onClose`.

## Persistence

### Domain model — `src/domain/settings/settings.schema.ts`

```
settingsSchema = z.object({
  reminderTime: z.object({
    hour: z.number().int().min(0).max(23),
    minute: z.number().int().min(0).max(59),
  }),
  defaultReminderDaysBefore: z.array(z.number().int().nonnegative()),
})
export type Settings = z.infer<typeof settingsSchema>
export const DEFAULT_SETTINGS: Settings = { reminderTime: { hour: 9, minute: 0 }, defaultReminderDaysBefore: [30, 7] }
```

`Settings['reminderTime']` is structurally identical to the planner's `ReminderTime`
(`{ hour, minute }`), so it can be passed to `buildNotificationPlan` without a shared
nominal type (no domain→ui import). `DEFAULT_SETTINGS.reminderTime` and the existing
`DEFAULT_REMINDER_TIME` are both 09:00 — the latter remains the "not loaded yet"
fallback the planner already imports; they must stay in sync (both 09:00).

### Port — `src/ports/settings-repository.ts`

```
interface SettingsRepository {
  load(): Promise<Settings>;   // DEFAULT_SETTINGS when nothing is stored
  save(settings: Settings): Promise<void>;
}
```

### Migration v2 (append to `MIGRATIONS`, never edit v1)

```sql
CREATE TABLE settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  reminder_hour INTEGER NOT NULL,
  reminder_minute INTEGER NOT NULL,
  default_reminder_days_before TEXT NOT NULL  -- JSON array
);
```

Single-row table (the `CHECK (id = 1)` enforces it). Chosen over a JSON blob for typed,
queryable columns consistent with the deadlines table.

### Mapper — `src/infrastructure/persistence/sqlite/settings-mapper.ts`

Pure `toRow(settings)` / `fromRow(row) → Settings` (the reminders array via
`JSON.stringify`/`JSON.parse`, validated with `settingsSchema` at the edge, like the
deadline mapper). The `SettingsRow` type lives in this file.

### Adapter — `src/infrastructure/persistence/sqlite/sqlite-settings-repository.ts`

- `save`: `INSERT OR REPLACE INTO settings (id, reminder_hour, reminder_minute, default_reminder_days_before) VALUES (1, ?, ?, ?)`.
- `load`: `getFirst` where `id = 1`; `null` → `DEFAULT_SETTINGS`. A corrupt row (mapper
  throws) → warn + `DEFAULT_SETTINGS` (resilient, like the deadlines repo).

### Fake — `src/test-support/in-memory-settings-repository.ts`

Holds a `Settings` (starts at `DEFAULT_SETTINGS`); `save` stores, `load` returns it.

### Shared bootstrap — `src/infrastructure/persistence/sqlite/database.ts`

```
let pending: Promise<SqlExecutor> | null = null;
export function openMigratedDatabase(databaseName = 'nopasa.db'): Promise<SqlExecutor> {
  if (!pending) {
    pending = (async () => {
      const db = await openDatabaseAsync(databaseName);
      const executor = new ExpoSqliteExecutor(db);
      await runMigrations(executor);
      return executor;
    })().catch((error) => {
      pending = null; // never cache a rejected promise — allow a later retry to reopen
      throw error;
    });
  }
  return pending;
}
```

`createDeadlineRepository` is refactored to use this (instead of opening directly); new
`createSettingsRepository` uses it too. Both share one executor; both tables migrate
together exactly once. The repositories' own unit tests use `NodeSqliteExecutor`
directly and are unaffected.

## DI — `src/ui/settings/settings-context.tsx`

`SettingsProvider` + `useSettings()`. Builds the repository via `createSettingsRepository`
(or accepts an injected `repository?` for tests). On mount, loads settings async; **shows
`DEFAULT_SETTINGS` while loading** (no loading gate — defaults are the likely value and
the screen is usable immediately). Exposes:

```
{ settings: Settings, save: (next: Settings) => Promise<void> }
```

**`save` is persist-first:** `await repository.save(next)` then `setSettings(next)`. On
failure it rejects (state untouched — stays equal to what's persisted). Local SQLite
writes are ~instant, so there's no latency to hide and no optimistic update / revert
logic; the in-memory state is always equal to the stored state.

Mounted in `app/_layout.tsx` inside the existing providers.

## Entry point & routing

- `ScreenHeader` gains an optional `onSettings?: () => void`; when present it renders a
  gear icon (top-right) with `accessibilityRole="button"`.
- `HomeScreen` gains `onOpenSettings: () => void`, passed to **both** `DeadlineList`
  (→ `ScreenHeader` gear) and `EmptyState` (a matching top-right gear). The empty state
  MUST expose it too: otherwise, after "Borrar datos" the home is empty and the user
  would be unable to reach settings again — a dead end. `EmptyState` gains
  `onOpenSettings: () => void` and renders the same gear affordance.
- `app/index.tsx`: `onOpenSettings={() => router.push('/settings')}`.
- New `app/settings.tsx` (modal, like add/detail): `<SettingsScreen onClose={() => router.back()} />`.

## Screen — `src/ui/screens/SettingsScreen.tsx`

Props `{ onClose }`. Modal-style header (drag handle + title "Ajustes"), reusing the
detail/add visual language. Sections, each a `FormField`-labelled block:

**Real and wired:**
- **Hora del aviso** — `TimePickerField` (new, `src/ui/components/TimePickerField.tsx`):
  parallel to `DatePickerField` but `mode="time"`, value/onChange in `{ hour, minute }`,
  display `HH:MM` (zero-padded). On change → `save({ ...settings, reminderTime })`.
  **`useCreateDeadline` reads `settings.reminderTime`** (via `useSettings`) instead of the
  constant.
- **Avisos por defecto** — `ReminderChips` (reused, 30/7/1). On change →
  `save({ ...settings, defaultReminderDaysBefore })`. **`AddDeadlineScreen` seeds its
  initial chips from `settings.defaultReminderDaysBefore`** instead of literal `[30, 7]`.
- **Privacidad** — informative text (true by architecture): data is stored only on this
  device, with no servers.
- **Borrar datos** — destructive action with a clear, irreversible `Alert` confirmation.
  On confirm: `const all = await repository.list();` then for each deadline
  `try { await scheduler.cancel(d.id); } catch {}` (best-effort) + `await repository.delete(d.id);`.
  Uses `useDeadlineRepository` + `useNotificationScheduler`. Deletes deadlines only, not
  preferences. After deleting, the home (refresh-on-focus when `onClose` returns) shows
  the empty state.
- **Versión** — `expo-constants`: `Constants.expoConfig?.version` (fallback `'—'`).

**"Próximamente" (visible, inert, honest — not persisted):** a simple `ComingSoonRow`
component (label + a "Próximamente" badge, no functional control) for: Resumen semanal,
Tema claro/oscuro, Premium.

## Data flow

```
SettingsProvider — load() → settings (DEFAULT_SETTINGS while loading)
  useSettings() → { settings, save }
    TimePickerField / ReminderChips onChange → save(next)  [persist-first]
    useCreateDeadline → reminderTime = settings.reminderTime
    AddDeadlineScreen → initial chips = settings.defaultReminderDaysBefore
Borrar datos → repository.list() → ∀ d: scheduler.cancel(d.id) (best-effort) + repository.delete(d.id)
```

## Error handling

- `load` fails → `DEFAULT_SETTINGS` (best-effort); app usable.
- `save` fails → handler catches, shows an `Alert`; control stays at the previous value
  (still equal to persisted). No divergence to reconcile (persist-first).
- Bootstrap fails → memo reset, retry possible.
- Borrar datos: `cancel` is best-effort (swallowed per deadline); `delete` is the real op.

## Testing

**Pure:**
- `settings-mapper`: round-trip (reminderTime + reminders); corrupt row → throws (caught
  by the adapter); Zod rejects out-of-range hour/minute.
- `DEFAULT_SETTINGS` shape.

**Persistence (`NodeSqliteExecutor`):**
- Migration v2 creates the table.
- `save` → `load` round-trip.
- `load` with no row → `DEFAULT_SETTINGS`.

**Integration / components (fakes + deterministic clock):**
- Changing the time persists (fake repo records it).
- Changing default reminders persists.
- The planner uses the settings time: inject a different `reminderTime` → the created
  deadline's plan fires at that time (`useCreateDeadline` + fakes).
- `AddDeadlineScreen` seeds its chips from settings.
- Borrar datos: confirm → cancels notifications + deletes deadlines (fake repo + fake
  scheduler); cancel rejection doesn't stop deletion.
- Version is shown.
- `TimePickerField` opens the picker and reports the chosen `{ hour, minute }`.

## Out of scope (future sessions)

Weekly-digest behavior (recurring weekly notification), real dark mode (needs a dark token
set + wiring), Premium purchase/IAP, editing deadlines, iOS, photo/OCR.

## Quality

Do not touch the domain except adding the `Settings` model. Reuse components
(`Button`, `Card`, `AppText`, `FormField`, `ReminderChips`, `DatePickerField` sibling),
ports (`DeadlineRepository`, `NotificationScheduler`), DI providers, and the migration
mechanism. The UI depends on abstractions. "Próximamente" rows never fake functionality.

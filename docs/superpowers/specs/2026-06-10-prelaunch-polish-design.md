# Pre-launch polish (block 1) — design

Date: 2026-06-10
Status: Approved

## Goal

Three small pre-launch polish items toward the closed test, on the existing
`feat/settings-screen` branch (built on the completed settings work; these touch
`EmptyState`/`HomeScreen`/the planner, already in their current state there):

1. **Remove the `__DEV__` seed** — the home must start empty and show the correct empty
   state (manual add + delete-data already exist, so the temporary seed is obsolete).
2. **Empty state: distinguish "first use" from "all caught up"** — one `EmptyState`
   today; split into two data-driven variants.
3. **Empty-plan hint in Add** — when the chosen date + selected reminders would produce
   no future notification, show a non-blocking hint, reusing the planner's DST-safe
   fire-time math (no duplication).

## Architecture

Hexagonal, reusing existing units. No new domain models or ports. The notification
planner's fire-time computation is extracted into a small pure helper shared by the
planner and the hint detector, so the DST-safe date math lives in exactly one place.

## 1) Remove the `__DEV__` seed

- Delete `src/infrastructure/dev/seed-deadlines.ts` (and its test file if one exists).
- In `src/ui/repository/repository-context.tsx`: remove the
  `import { seedDeadlinesIfEmpty } ...` line and the `await seedDeadlinesIfEmpty(repo)`
  call, leaving the no-prop branch as `const repo = await createDeadlineRepository(); setBuilt(repo);`.
- Result: a fresh install opens to the empty store → "first use" empty state.
- Regression: `RepositoryProvider`/home tests inject repositories and never depend on the
  seed, so they stay green. (`src/infrastructure/dev/` becomes empty; leave the folder or
  let it be removed — no code references it afterward.)

## 2) Empty state: two variants

### Discriminator (data-driven)

`groupAndSort` excludes RESOLVED/CANCELLED, so the home's `activeTotal` (sum of the three
groups) is 0 both when the store is empty AND when every deadline is resolved/cancelled.
To tell them apart, the home needs the raw stored count.

- **`useDeadlines`** gains one field: `storedCount: number` (= `list.length`, all
  statuses). Added to `UseDeadlinesResult`; it is `0` while loading/error (the list starts
  `[]`). Minimal and sufficient.
- **`HomeScreen`** computes the case. The existing `loading`/`error` guards MUST stay
  ABOVE this branch (they already do: `HomeScreen.tsx` returns `<Loading />` for
  `status === 'loading'` and the error block for `status === 'error'` before any
  empty/list decision). This — together with `RepositoryProvider` gating on `<Loading />`
  until the repo is built — means a cold start with saved data never evaluates the
  empty-state branch while `storedCount` is still `0`, so "first use" never flashes before
  the list appears. Only when `status === 'ready'`:
  - `activeTotal > 0` → `DeadlineList` (unchanged).
  - `activeTotal === 0 && storedCount === 0` → `EmptyState variant="first-use"`.
  - `activeTotal === 0 && storedCount > 0` → `EmptyState variant="all-caught-up"`.

### `EmptyState` component

Gains a prop `variant: 'first-use' | 'all-caught-up'`. A single component, same shell for
both: the `nopasa` wordmark, the Ajustes gear (kept in BOTH variants — without it a user
whose list is empty/all-resolved would have no way back to settings), and the footer add
button. The variant selects a small copy set; the privacy line shows only on first-use.

| field | first-use (current, matches `Primer uso.png`) | all-caught-up |
|---|---|---|
| central icon | `calendar-blank` + badges (current illustration) | `calendar-check` (single, calm) |
| headline | "Aquí no se te pasará nada" | "Todo en orden" |
| support | "Guarda tus documentos y fechas importantes —DNI, ITV, seguros, suscripciones— y te avisamos antes de que caduquen." | "No tienes vencimientos pendientes. Te avisaremos cuando se acerque alguno." |
| CTA label | "Añadir mi primer vencimiento" | "Añadir un vencimiento" |
| privacy line | shown | hidden |

Both call `onAdd` / `onOpenSettings` (unchanged props). Implementation: keep the existing
first-use markup; branch the icon/headline/support/CTA-label/privacy-line on `variant`
(e.g. a small `copy` object keyed by variant, or inline conditionals — whichever stays
readable). The full first-use illustration (badge cluster) renders only for first-use; the
all-caught-up variant uses the single calm icon.

## 3) Empty-plan hint in Add

### Extract the fire-time math (DRY)

Create `src/ui/notification/reminder-fire-times.ts`:

```
/** Pure: the local fire-time for each reminderDaysBefore, in the same order. DST-safe —
 *  built from the due date's LOCAL components + the wall-clock reminder time (no ms math). */
reminderFireTimes(dueDate: Date, reminderDaysBefore: number[], reminderTime: ReminderTime): Date[]
```

This is the exact `new Date(year, month, date - daysBefore, hour, minute)` construction
currently inline in `buildNotificationPlan`. Refactor `buildNotificationPlan` to call it
(zipping the returned times with `reminderDaysBefore` to keep the past-drop + content
build), with NO behavior change — its existing tests stay green.

### Detector (pure)

In the same file:

```
/** True iff at least one reminder is selected AND every one fires at/before `now`
 *  (i.e. for this date the user's reminders would all be in the past — no future alert). */
remindersAllInPast(dueDate: Date, reminderDaysBefore: number[], now: Date, reminderTime: ReminderTime): boolean
  = reminderDaysBefore.length > 0
    && reminderFireTimes(dueDate, reminderDaysBefore, reminderTime).every((t) => t.getTime() <= now.getTime())
```

When no reminder is selected, this is `false` (deliberate choice, not a "passed" case).

### `AddDeadlineScreen`

Compute `const showPastHint = remindersAllInPast(state.dueDate, state.reminderDaysBefore, deps.clock.now(), settings.reminderTime);` on each render (cheap, pure; reacts to date/reminder changes). When true, render a non-blocking informational hint directly under the "Avisarme" `FormField`:

- Distinct from `FormField`'s `hint` (which is the red error style). Use an informational
  tone — an icon (`information-outline` or `clock-alert-outline`) + text in the `upcoming`
  color (`colors.urgency.upcoming.base`), not the urgent red.
- Text: "Para esta fecha, tus avisos ya han pasado. Puedes guardarlo igualmente o acercar la fecha."
- **Non-blocking:** the Guardar button's `disabled` stays bound only to `!valid`; the hint
  never disables save.

A small inline element is fine (icon row + AppText); no new shared component is required
unless it reads cleaner as one. `clock.now()` is read at render for the hint and again in
the create flow — acceptable (both reflect "now"); the hint is advisory.

## Data flow

```
HomeScreen: useDeadlines() → { groups, storedCount }
  activeTotal = sum(groups);  pick list | first-use | all-caught-up
AddDeadlineScreen: remindersAllInPast(dueDate, reminders, clock.now(), settings.reminderTime) → showPastHint
buildNotificationPlan: reminderFireTimes(...) → drop past → content   (same output as before)
```

## Testing

**Empty state (HomeScreen, in-memory repo + clock):**
- empty repo → `first-use` variant rendered (assert a first-use-only marker, e.g. CTA
  "Añadir mi primer vencimiento" / privacy line).
- repo with only RESOLVED/CANCELLED deadlines → `all-caught-up` variant ("Todo en orden").
- repo with ≥1 ACTIVE → `DeadlineList` (not the empty state).
- `EmptyState` component: renders the correct copy/CTA per `variant`.

**Hint (pure — `reminder-fire-times`):**
- `reminderFireTimes` returns one date per `reminderDaysBefore`, in order, at the reminder
  wall-clock time.
- `remindersAllInPast`: far due date with future reminders → false; near due date where
  all reminders already passed → true; no reminders selected → false.
- planner regression: `buildNotificationPlan` output unchanged after the refactor (its
  existing tests cover this).

**Hint (component — AddDeadlineScreen):**
- the hint appears for a near date whose reminders are all past, and disappears when the
  date moves far out or reminders change; Guardar is NOT disabled while the hint shows.

**Regression:** removing the seed breaks neither the home nor its tests.

## Out of scope

App icon / `app.json`, EAS, Play listing (separate batches); photo/OCR; iOS; editing
deadlines.

## Quality

Reuse components and the planner's fire-time logic; do NOT duplicate the DST-safe date
math (single source in `reminder-fire-times.ts`). The empty-state discriminator is data
(`storedCount`), computed in the home; `EmptyState` stays presentational. The hint is
advisory and never blocks save. UI depends on abstractions.

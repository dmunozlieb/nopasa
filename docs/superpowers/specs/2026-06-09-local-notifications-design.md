# Local notifications — design

Date: 2026-06-09
Status: Approved

## Goal

Today a deadline stores `reminderDaysBefore` but nothing is ever notified. Schedule
local reminders when a deadline is created, and cancel them when it is marked
resolved/cancelled. This is the core of the product: the app should actually warn
the user before a deadline.

## Architecture

Hexagonal, mirroring how `expo-sqlite` is confined to infrastructure:

- A pure **planner** turns a deadline + scheduling options into a list of fully
  resolved notifications (when + copy). This is app/UI logic, maximally testable.
- A **port** `NotificationScheduler` is a thin effects executor: `schedule` /
  `cancel`. The UI depends on this abstraction, never on `expo-notifications`.
- An **adapter** wraps `expo-notifications`. A **fake** records calls for tests.
- The planner is called by the app (the create hook), which passes the resolved
  plan to the port. The adapter and the fake are "dumb" — they just execute the plan.

Decision (chosen over an adapter-internal-planning variant): the **caller computes
the plan**. This keeps the port a pure effects executor, makes the fake trivial and
honest (no shared planning logic), and gives integration tests a real plan to assert.

## File structure

Created:
- `src/ui/notification/reminder-time.ts` — `ReminderTime = { hour: number; minute: number }`
  and `DEFAULT_REMINDER_TIME = { hour: 9, minute: 0 }`. A constant for now; the
  future settings screen overrides it by passing a different `ReminderTime` to the
  planner — no rewrite needed.
- `src/ui/notification/build-notification-content.ts` — pure
  `buildNotificationContent(deadline, daysBefore) → { title, body }`.
- `src/ui/notification/build-notification-plan.ts` — pure
  `buildNotificationPlan(deadline, { now, reminderTime }) → PlannedNotification[]`.
- `src/ports/notification-scheduler.ts` — `PlannedNotification` type +
  `NotificationScheduler` interface (the contract owner of the type).
- `src/infrastructure/notifications/expo-notification-scheduler.ts` — the adapter.
- `src/test-support/fake-notification-scheduler.ts` — the fake.
- `src/ui/notification-scheduler/notification-scheduler-context.tsx` —
  `NotificationSchedulerProvider` + `useNotificationScheduler()`.
- Test files alongside each unit.

Modified:
- `src/ui/deadline/format-date.ts` — add `formatShortDate(date)` (no year), reusing
  the existing `MONTHS` array.
- `src/ui/hooks/use-create-deadline.ts` — schedule after `repository.save`.
- `src/ui/screens/DeadlineDetailScreen.tsx` — cancel in `markAs` after `repository.update`.
- `app/_layout.tsx` — mount `NotificationSchedulerProvider`.
- `package.json` / `app.json` — `expo install expo-notifications`.

## Pure logic

### `buildNotificationPlan(deadline, { now, reminderTime })`

For each `N` in `deadline.reminderDaysBefore`:

```
fireAt = new Date(
  deadline.dueDate.getFullYear(),
  deadline.dueDate.getMonth(),
  deadline.dueDate.getDate() - N,
  reminderTime.hour,
  reminderTime.minute,
)
```

Built from **local date components + the wall-clock time**, never from millisecond
arithmetic — DST-safe in the same spirit as the domain's `daysBetween`. The `Date`
constructor normalizes day underflow across month/year boundaries.

- Omit any item whose `fireAt <= now` (nothing in the past).
- Each kept item is `{ fireAt, ...buildNotificationContent(deadline, N) }`.
- No reminders, or all `fireAt` already past (e.g. due date too near) → `[]`.
- Status is not consulted here: the planner is only invoked on create (always ACTIVE).

### `buildNotificationContent(deadline, N) → { title, body }`

- `title = deadline.title`.
- `body = "{verb} {countdown} · {shortDate}"` where:
  - `verb = detailPresentation(deadline.type).verb` ("Caduca" / "Vence" / "Se cobra" / "Termina").
  - `countdown = N === 0 ? 'hoy' : "en N día"/"en N días"` (singular for N === 1).
  - `shortDate = formatShortDate(deadline.dueDate)` → e.g. `11 jun` (no year).
- Examples: `Caduca en 7 días · 11 jun` · `Se cobra en 1 día · 12 jun` · `Vence hoy · 4 jul`.

## Port & adapter

```ts
export interface PlannedNotification {
  fireAt: Date;
  title: string;
  body: string;
}

export interface NotificationScheduler {
  schedule(deadlineId: string, plan: PlannedNotification[]): Promise<void>;
  cancel(deadlineId: string): Promise<void>;
}
```

**Adapter (`expo-notification-scheduler.ts`):**

- `schedule(deadlineId, plan)`:
  - If `plan` is empty → no-op (and crucially **no permission prompt** — nothing to schedule).
  - Otherwise: request notification permission in context (best-effort; on denial,
    schedule nothing and do not throw); ensure the Android notification channel
    exists *before* scheduling (without a channel Android silently drops scheduled
    notifications); then for each item call `scheduleNotificationAsync` with
    `content.data.deadlineId = deadlineId` and an inexact date trigger (no
    `SCHEDULE_EXACT_ALARM`).
- `cancel(deadlineId)`: `getAllScheduledNotificationsAsync()` → filter where
  `content.data.deadlineId === deadlineId` → `cancelScheduledNotificationAsync` each.
  Cancellation is by tag/query, so the **DB schema is untouched** (no stored IDs).

> The exact shape of the date trigger and the permissions API differs between
> `expo-notifications` versions. Verify against the SDK 56 docs before implementing
> the adapter (per AGENTS.md). The adapter is a thin wrapper; it is mocked in tests,
> not covered natively.

## Dependency injection

`NotificationSchedulerProvider` + `useNotificationScheduler()`, sibling to
`RepositoryProvider` / `DeadlineDepsProvider`. Production default =
`expoNotificationScheduler`; injectable via a `scheduler?` prop for tests. Mounted in
`app/_layout.tsx` inside the existing providers.

## Integration points

- **Create** (`useCreateDeadline`, after `repository.save`):
  ```
  const plan = buildNotificationPlan(deadline, { now: clock.now(), reminderTime: DEFAULT_REMINDER_TIME });
  try { await scheduler.schedule(deadline.id, plan); } catch { /* best-effort */ }
  ```
  Scheduling is best-effort: a scheduler failure must never fail the save. The hook
  already returns the created `Deadline`. The `__DEV__` seed calls `repository.save`
  directly (not this hook), so it never schedules notifications.
- **Mark resolved/cancelled** (`DeadlineDetailScreen.markAs`, after `repository.update`):
  `try { await scheduler.cancel(deadline.id); } catch { /* best-effort */ }`.

## Error handling

- Permission denial: the adapter schedules nothing; the save/mark still succeed.
- Any scheduler error: swallowed at the integration point; the user flow is unaffected.

## Permissions

Requested **in context** — when the user saves their first deadline that has
something to schedule (Android 13+ runtime permission), not cold on app open. Denial
is handled gracefully (best-effort, never blocks saving).

## Reminder time

The settings screen does not exist yet, so the fire time is the constant
`DEFAULT_REMINDER_TIME` (09:00 local), passed as a parameter to the planner. Settings
can later override it without rewriting the planner. 09:00 also sidesteps the DST
transition window (02:00–03:00 in Madrid), so the chosen time always exists and is
unambiguous; the DST-safety work is in the date arithmetic, not the time-of-day.

## Testing (TDD)

**Pure:**
- `buildNotificationPlan`: one item per reminder; `fireAt` at the correct 09:00 local;
  a **DST case** crossing Madrid's change (assert `fireAt.getHours() === 9` on the
  right calendar day — naive ms subtraction over a 23h/25h day would drift to 08:00/10:00);
  omits past fire times; already-due / no-reminders → `[]`.
- `buildNotificationContent`: body per type (correct verb, singular/plural, `hoy` for
  N=0, short date without year).

**Integration** (fake scheduler + in-memory repo + deterministic clock):
- Creating a deadline schedules the expected plan (`fake.scheduled.get(id)` deep-equals).
- Marking resolved/cancelled calls `cancel(id)`.
- A scheduler that throws does **not** prevent saving.

**Adapter** (`expo-notifications` mocked — thin wrapper):
- With permission granted, schedules N notifications each tagged with `deadlineId`.
- With permission denied, schedules nothing (and does not throw).
- `cancel` filters scheduled notifications by `deadlineId`.

## Out of scope (future sessions)

Settings screen (the time stays a constant), editing deadlines (no edit flow → no
reschedule-on-edit), weekly digest, "posponer" (still a placeholder),
reschedule-on-launch / timezone-change handling, iOS, photo/OCR.

### Known gap (not for this session)

**Silent empty plan for a near due date.** If a user adds, e.g., an ITV due in 3 days
with reminders `[30, 7]`, both fire points are already in the past → empty plan →
nothing scheduled and no permission prompt. This is consistent with the design
("nothing to schedule"), but from the user's point of view it is silent: "I added it
and it won't warn me," without realizing. Best-effort silence is acceptable for this
session. Resolve later where it fits naturally: a hint in the add form ("para esta
fecha, tus avisos ya pasaron"), a minimal fallback reminder, and/or the settings screen.

## Quality

Do not touch the DB schema (cancellation is by tag/query, not by persisting IDs). The
UI depends on `NotificationScheduler`, never on `expo-notifications` directly. Reuse
the existing foundations: theme/components, DI providers, `detailPresentation` verbs,
the domain's DST-safe date logic.

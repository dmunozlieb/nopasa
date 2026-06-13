# Recurrence — Design Spec

Date: 2026-06-13
Status: Approved (design, incl. review refinements); pending implementation plan

## Goal

Let recurring deadlines (ITV, insurance, subscriptions, gas inspection…) roll
forward to their next cycle on their own instead of being re-added by hand.
Marking a recurring deadline as **renewed** reprograms it: new due date + the
reminders rescheduled. This is the brand's "tú tranquilo, yo me encargo".

Domain + JS only. No native modules → no EAS build needed; implemented and
verified without depending on Google verification.

## Context (current state)

- `Deadline.recurrenceMonths?: number` already exists in `deadline.schema.ts`,
  and `CreateDeadlineInput` already declares it (the factory passes it via
  spread). SQLite mapper/row already persist it. **What's missing**: a form
  input, the pure recurrence logic, and the renew action in the detail screen.
- The add form (`AddFormState` / `toCreateInput` in `src/ui/deadline/add-form.ts`)
  does **not** carry `recurrenceMonths` today.
- `ReminderChips.tsx` is the existing preset-chip pattern to mirror.
- Date math uses local components for DST-safety (`src/domain/shared/date.ts`
  `startOfDay`; `src/domain/date/local-date.ts`).
- `useCreateDeadline` already does `buildNotificationPlan` + `scheduler.schedule`;
  reusable for renew (cancel + reschedule).
- Detail screen (`DeadlineDetailScreen.tsx`) `markAs` does
  `repo.update({...status})` + `scheduler.cancel`. Manage row holds
  `ManageAction` "Marcar como [X]" + "Posponer el aviso".

## Locked decisions

1. **Roll-forward** (not resolve+create-next): the same `Deadline` advances to
   the next cycle (updates `dueDate`, stays `ACTIVE`, reschedules reminders).
   No accumulation of past "resolved" cycles. No cycle history is kept — accepted
   on purpose (calm brand, minimalist local store).
2. **Confirm date** (not silent auto-advance): renewing opens an inline confirm
   step prefilled with the estimate, adjustable via `DatePickerField`. The real
   new expiry can differ from the estimate, and there is no later edit flow, so
   renewal is the only chance to set the date right.
3. **Anchor to original `dueDate`, no drift**: compute the next date as
   `addMonths(dueDate, recurrenceMonths × k)` for `k = 1, 2, 3…`, advancing while
   the result is still strictly in the past relative to today. Anchoring to the
   original date (rather than iterating on the previous result) prevents the
   end-of-month clamp from compounding (a yearly on 31-Jan always lands 31-Jan).
4. **Recurrence input shown for all types**, default "No se repite". No per-type
   rules; recurrence is explicit user opt-in. Smart per-type defaults / OCR
   suggestion are possible future additions above the always-present field.
5. **Inline confirm in the detail** (no nested sheet, no new route): "Marcar como
   renovada" expands an inline section; the detail is already a bottom-sheet.
6. **Recurrent manage row = "Marcar como renovada" (primary) + "Dejar de repetir"
   (secondary, dimmer)**. "Posponer el aviso" (a placeholder) is dropped for
   recurrent deadlines, kept for non-recurrent. Revisit the row when "posponer"
   becomes functional.
7. **Recurrence indicator only in the detail**: a subtle "Se repite cada
   [año/mes/N meses]" line next to the date. Home unchanged; a 🔁 badge on Home
   is a possible future addition.
8. **No `nextOccurrence` wrapper** — `nextDueDate` (prefill) + the user-confirmed
   date cover the flow; the wrapper would be dead code (YAGNI).
9. **Robust "Personalizado" parsing** — positive integer only, reject
   `0`/negative/non-numeric, sane upper cap; invalid → `undefined`.
10. **"Dejar de repetir" requires a confirmation dialog** — semi-destructive and
    irreversible (no history/edit flow); reuse the `SettingsScreen` destructive
    pattern.

## Out of scope (v1)

- Editing the recurrence of an already-created deadline (no edit flow exists yet).
- OCR setting recurrence (manual in v1).
- iOS.

## Components

### 1. Pure domain logic — `src/domain/deadline/recurrence.ts`

DST-safe via local components, no dependencies:

- **`addMonths(date: Date, months: number): Date`** — month addition on local
  components with **end-of-month clamp** (31-Jan + 1 month → 28/29-Feb, not
  March). Result at local midnight. Clamp computed via
  `new Date(year, month + 1, 0).getDate()` (last day of target month) and
  `Math.min(day, lastDay)`.
- **`nextDueDate(dueDate: Date, recurrenceMonths: number, now: Date): Date`** —
  anchored to `dueDate`: for `k = 1, 2, 3…`, candidate = `addMonths(dueDate,
  recurrenceMonths × k)`; advance `k` while the candidate is **strictly before**
  `startOfDay(now)` (a candidate equal to today is kept). `k` starts at 1, so the
  result is always at least one period after `dueDate`.

No `nextOccurrence` wrapper: the renew flow uses `nextDueDate(...)` to prefill the
picker, and `useRenewDeadline(deadline, confirmedDate)` builds the renewed
deadline from the user-confirmed date — a `{ ...deadline, dueDate: nextDueDate }`
wrapper would have no consumer (YAGNI).

Exported from `src/domain/deadline/index.ts`.

Friendly Spanish copy ("Cada año", "Cada 2 años", "Cada N meses") lives in UI,
not the domain — see component 4.

**Tests** (`recurrence.test.ts`):
- month sum (e.g. +1, +12, +24);
- end-of-month clamp (31-Jan +1 → Feb; 31-Mar +1 → 30-Apr);
- DST-safe across a Spanish clock change (result stays local midnight, correct
  calendar day);
- advance-until-future on a late renewal (due far in the past → first future
  multiple);
- anchor-no-drift (yearly on 31-Jan over multiple years always lands 31-Jan).

### 2. Recurrence input in the add form

- `AddFormState` gains `recurrenceMonths?: number`.
- New `RecurrenceSelect.tsx` (chips like `ReminderChips`): **No se repite**
  (default, `undefined`) / **Cada mes** (1) / **Cada año** (12) / **Cada 2 años**
  (24) / **Personalizado** → reveals a numeric `TextInput` (N months). The active
  chip is derived from the value: a preset if it matches, "Personalizado" if
  defined outside presets, "No se repite" if `undefined`.
- **Custom input validation**: parse to a **positive integer**; reject `0`,
  negatives, and non-numeric (e.g. "abc", "-3") instead of letting them through
  silently — an invalid/empty custom value resolves to `undefined` (no
  recurrence), so it never reaches the form state as a bad number. Apply a sane
  upper cap (e.g. 999 months) so absurd values can't be entered. A small pure
  helper `parseRecurrenceMonths(raw): number | undefined` (mirrors `parseAmount`)
  holds this logic and is unit-tested. The `> 0` gate in `toCreateInput` remains
  as the persistence backstop.
- `toCreateInput` includes `recurrenceMonths` when defined and `> 0` (same shape
  as the `photoUri` wiring).
- `DeadlineForm` adds a `FormField "¿Se repite?"` hosting `RecurrenceSelect`.

**Tests**:
- add-form: a preset sets `recurrenceMonths`; `toCreateInput` emits it;
  persistence round-trips via `findById`; "No se repite" omits the field
  (regression);
- `RecurrenceSelect` component: selecting a preset reports the right months;
  "Personalizado" reveals the field and reports the typed N.
- `parseRecurrenceMonths`: integers > 0 pass; `0`, negatives, non-numeric, and
  empty → `undefined`; values above the cap are rejected/clamped.

### 3. Renew + reschedule — hook `useRenewDeadline`

Mirrors `useCreateDeadline`. Returns `(deadline, confirmedDate) => Promise<void>`:

1. `renewed = { ...deadline, dueDate: startOfDay(confirmedDate), status: 'ACTIVE' }`
2. `repo.update(renewed)`
3. best-effort: `scheduler.cancel(deadline.id)` →
   `buildNotificationPlan(renewed, { now: clock.now(), reminderTime })` →
   `scheduler.schedule(deadline.id, plan)`. A scheduler failure never fails the
   update.

Reuses the existing scheduler and planner; the `NotificationScheduler` port is
untouched.

**Tests** (fakes + clock): update persists new `dueDate` + `ACTIVE`; `cancel`
then `schedule` called with a plan built from the new date; scheduler failure
does not throw.

### 4. Detail screen

`isRecurrent = deadline.recurrenceMonths != null`.

- **Non-recurrent**: unchanged (regression guaranteed).
- **Recurrent**:
  - Manage row = **"Marcar como renovada"** (primary) + **"Dejar de repetir"**
    (secondary, dimmer). No "Posponer el aviso".
  - "Marcar como renovada" expands an **inline** section: `DatePickerField`
    prefilled with `nextDueDate(...)` + **"Confirmar renovación"** /
    **"Cancelar"** (collapses). Confirm → `useRenewDeadline(deadline, chosenDate)`
    → close the detail (Home refreshes on-focus with the new date).
  - "Dejar de repetir" → **confirmation dialog first** (semi-destructive and
    effectively irreversible: it leaves the active list and, with no history or
    edit flow, the only way back is re-adding by hand; a mis-tap when the user
    meant "renovada" loses the recurring deadline). Mirror the existing
    destructive-confirm pattern (`SettingsScreen` "Borrar todos los datos":
    `Alert.alert` with a `cancel` button + a `destructive` confirm `onPress`).
    On confirm → the existing `markAs` logic
    (`presentation.manage.targetStatus`: RESOLVED/CANCELLED + cancel
    notifications), i.e. stop forever (sold the car). (Semantic aside: "dejar de
    repetir" is closer to "cancelar" than "resolver", but since both leave the
    active list and there is no history, reusing `targetStatus` is functionally
    equivalent.)
  - Subtle indicator **"Se repite cada [X]"** next to the date, via a UI label
    helper `src/ui/deadline/recurrence-label.ts` (`recurrenceLabel(months)` →
    "Cada mes" / "Cada año" / "Cada 2 años" / "Cada N meses"). Pure, tested.

**Tests** (fakes + clock):
- renew flow: confirm → `dueDate` advanced + still `ACTIVE` + `cancel` and
  `schedule` invoked with the new plan;
- "dejar de repetir" → confirmation dialog shown; on confirm, status
  resolved/cancelled per type + notifications cancelled; on cancel, nothing
  changes (no `update`, no `cancel`);
- non-recurrent → manage row unchanged (still "Marcar como [X]" + "Posponer el
  aviso"), no renew affordance;
- `recurrence-label`: month → Spanish copy.

## Quality bar

Pure domain logic, DST-safe + end-of-month clamp, reuses the scheduler/planner,
no native modules. Friendly presets; recurrence is an editable convenience, not
rigid truth.

# Nopasa — Domain Model & Urgency Logic (Design Spec)

**Date:** 2026-06-07
**Status:** Approved (brainstorm), pending implementation plan
**Scope of this session:** Initialize the Expo + TypeScript project with a clean folder
structure, and implement the domain data model plus urgency logic as **pure TypeScript
functions** (independent of React/UI), with tests. Define the persistence port as a
**contract only** (no SQLite implementation yet).

> **Out of scope this session:** UI, navigation, camera, OCR, notifications, SQLite
> implementation and migrations, recurrence *behavior*. Those come in later sessions.

**Language convention:** Everything in code is in **English** — field names, enum values,
comments, file names, and any future migration definitions. The Spanish-only proper nouns
`ITV` and `DNI` are kept verbatim (no sensible translation).

---

## 1. Product context (decided — not under discussion)

"Nopasa" is a **local-first** Android mobile app (Expo managed + React Native +
TypeScript, built with EAS) that helps users in Spain not forget administrative deadlines:
ITV, DNI, passport, driving license, car insurance, subscriptions, warranties, gas
inspection, etc. The user adds each item (ideally by photographing the document; the date
is read on-device via OCR), and the app warns before it expires or is charged. **No cloud
server or database** — all data lives on the device. Priorities: **privacy and
simplicity**.

---

## 2. Stack decisions (confirmed)

- **Test runner:** Jest with the `jest-expo` preset — a single runner for the whole project
  (domain now, UI later).
- **Modeling & validation:** **Zod is the source of truth.** Define Zod schemas and derive
  the TypeScript types via `z.infer`. Runtime validation happens at the persistence boundary
  (untrusted data read from disk: SQLite rows, ISO date strings → `Date`).
- **Date semantics:** `dueDate` is treated as a **calendar date**, normalized to **local
  midnight**. Day counting ignores the time-of-day so thresholds are deterministic.

---

## 3. Domain model — `Deadline`

The central entity is `Deadline` (chosen over `Reminder` — that's the *alert*, not the
thing — and `Expiry` — too narrow; a subscription doesn't "expire", it's charged/renewed).

### 3.1 Enums

`DeadlineType` — **all nine values, none omitted** (`SUBSCRIPTION` and `WARRANTY` are core):

```
ITV | DNI | PASSPORT | DRIVING_LICENSE | INSURANCE | SUBSCRIPTION | WARRANTY | GAS_INSPECTION | OTHER
```

`DeadlineStatus` (default `ACTIVE`):

```
ACTIVE | RESOLVED | CANCELLED
```

### 3.2 Fields

| Spec (ES)         | Code (EN)                    | Type                      | Notes |
|-------------------|------------------------------|---------------------------|-------|
| `id`              | `id`                         | `string` (uuid)           | required |
| `tipo`            | `type`                       | `DeadlineType`            | required |
| `titulo`          | `title`                      | `string`                  | required, non-empty |
| `subtitulo`       | `subtitle`                   | `string`                  | required (may be empty string) |
| `fechaClave`      | `dueDate`                    | `Date`                    | the key date: expiry / renewal / charge |
| `importe?`        | `amount?`                    | `number`                  | optional |
| `etiquetaImporte?`| `amountLabel?`               | `string`                  | optional (e.g. "fine", "monthly fee", "annual") |
| `avisosDias`      | `reminderDaysBefore`         | `number[]`                | days of advance notice, e.g. `[30, 7]` |
| —                 | `recurrenceMonths?`          | `number`                  | **optional, no default** — field only, see §3.3 |
| `fotoUri?`        | `photoUri?`                  | `string`                  | optional |
| `creadoEn`        | `createdAt`                  | `Date`                    | required |
| `estadoManual`    | `status`                     | `DeadlineStatus`          | default `ACTIVE` |

### 3.3 `recurrenceMonths` — field only, no behavior this session

Add `recurrenceMonths?: number` to the model and the Zod schema: **optional, validated, no
default value.** Do **not** implement any recurrence logic now.

> **Future intent (context only, not this session):** when a deadline is later marked as
> renewed, if it has `recurrenceMonths`, the app will suggest the next date
> (`dueDate + recurrenceMonths`). That is UI/later-session work, not part of these
> foundations.

Validation: when present, `recurrenceMonths` must be a positive integer (`> 0`).

### 3.4 Zod schema notes

- `deadline.schema.ts` defines the Zod schema(s) and enums; TS types are derived with
  `z.infer`. The schema is the single source of truth.
- `dueDate` and `createdAt` are `z.date()` in the domain schema. Mapping ISO strings ↔
  `Date` at the SQLite boundary is the repository's responsibility (later session).
- Constraints: `title` non-empty; `amount`, `recurrenceMonths` positive when present;
  `reminderDaysBefore` an array of non-negative integers.

---

## 4. Urgency logic — pure functions (`today` always a parameter)

All functions are pure and take `today: Date` explicitly — **never** read the system clock
implicitly — so they are fully testable.

### 4.1 Date helpers (`domain/shared/date.ts`, pure)

- `startOfDay(date: Date): Date` — returns the same calendar day at local midnight.
- `daysBetween(from: Date, to: Date): number` — **DST-safe** count of calendar days.

**DST safety:** normalizing to local midnight and subtracting milliseconds is unsafe — a
calendar day can be 23 h or 25 h around Spain's DST changes (last Sunday of March: 23 h;
last Sunday of October: 25 h), so dividing by 86,400,000 can yield e.g. 3.96 or 4.04.
Implementation maps each date's **local** year/month/day onto **UTC** (where every day is
exactly 24 h) and rounds:

```ts
export function daysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / 86_400_000); // Math.round as belt-and-suspenders
}
```

### 4.2 `daysRemaining(deadline, today): number`

Calendar days from `today` to `deadline.dueDate` (`daysBetween(today, dueDate)`). Negative
when overdue, `0` when due today. Time-of-day is ignored.

### 4.3 `urgencyLevel(deadline, today): UrgencyLevel`

`UrgencyLevel = 'urgent' | 'upcoming' | 'calm'`. Named, easily-changeable thresholds in a
single place:

```ts
export const URGENT_MAX_DAYS = 10;   // urgent if daysRemaining <= 10
export const UPCOMING_MAX_DAYS = 60; // upcoming if daysRemaining <= 60
                                     // calm if daysRemaining > 60
```

- `urgent`  when `daysRemaining <= URGENT_MAX_DAYS` (includes overdue / negative).
- `upcoming` when `daysRemaining <= UPCOMING_MAX_DAYS`.
- `calm` otherwise.

### 4.4 `groupAndSort(list, today)`

Groups deadlines into three named buckets, each sorted by `daysRemaining` ascending (most
urgent first), excluding `RESOLVED` and `CANCELLED`.

```ts
export const GROUPS = {
  NEEDS_ATTENTION: 'Needs attention', // urgencyLevel === 'urgent'
  UPCOMING: 'Upcoming',               // urgencyLevel === 'upcoming'
  CALM: 'Calm',                       // urgencyLevel === 'calm'
} as const;
```

Returns a structure with the three groups (each an ordered array). Items with status
`RESOLVED` or `CANCELLED` are excluded entirely before grouping.

---

## 5. Architecture & folder structure

Expo managed project, TypeScript. Lightweight hexagonal layering: the **domain** has no
dependency on storage, React, or Expo.

```
src/
  domain/
    deadline/
      deadline.schema.ts     # Zod schemas, enums, inferred types
      deadline.factory.ts    # createDeadline(input, deps) — id/clock injected (pure)
      urgency.ts             # daysRemaining, urgencyLevel, thresholds
      grouping.ts            # groupAndSort + group constants
      index.ts               # public barrel for the domain
    shared/
      date.ts                # startOfDay, daysBetween (pure)
  ports/
    deadline-repository.ts   # DeadlineRepository interface (contract, NOT implemented)
```

- Tests are **co-located** (`*.test.ts` next to each module).
- `app/` (UI/navigation) is intentionally left for future sessions.

### 5.1 Domain purity — `createDeadline`

`createDeadline` receives `id` and `createdAt` via injected dependencies (an `IdGenerator`
and a `Clock`) so the domain depends on neither `expo-crypto` nor the system clock and stays
100% testable:

```ts
export interface IdGenerator { (): string; }
export interface Clock { now(): Date; }

// createDeadline(input, { generateId, clock }) -> Deadline
// - applies default status = ACTIVE
// - sets id = generateId(), createdAt = clock.now()
// - validates the result with the Zod schema (throws on invalid input)
```

Real wiring (uuid from `expo-crypto`, system clock) lives in an infrastructure layer in a
later session.

---

## 6. Persistence port — contract only

Async (designed for SQLite). **No implementation this session** — just the interface so the
domain does not depend on storage.

```ts
export interface DeadlineRepository {
  save(deadline: Deadline): Promise<void>;
  list(): Promise<Deadline[]>;
  update(deadline: Deadline): Promise<void>;
  delete(id: string): Promise<void>;
}
```

(Spec's `guardar / listar / borrar / actualizar` → `save / list / delete / update`.)

---

## 7. Test coverage (edge cases)

- **`daysBetween` / `daysRemaining`:**
  - overdue (negative days), due today (`0`), normalizes time-of-day (same result regardless
    of hours/minutes on either date).
  - **DST crossing test:** a range spanning a Spain DST change (e.g. across last Sunday of
    March and across last Sunday of October) still counts exact calendar days.
- **`urgencyLevel`:** exactly on threshold (`10`, `60`), boundaries `±1` (e.g. 10→urgent,
  11→upcoming, 60→upcoming, 61→calm), overdue → urgent.
- **`groupAndSort`:** empty list, correct ascending order within each group, `RESOLVED` /
  `CANCELLED` excluded, correct distribution across the three groups.
- **`createDeadline`:** applies defaults (`status = ACTIVE`), uses injected id/clock,
  validates with Zod (rejects invalid input — empty title, negative amount, non-positive
  `recurrenceMonths`).

---

## 8. Out of scope (explicit)

UI, navigation, camera, OCR, on-device notifications, SQLite implementation & migrations,
recurrence behavior, iOS. Field `recurrenceMonths` is added to the model now, but its
behavior is not.

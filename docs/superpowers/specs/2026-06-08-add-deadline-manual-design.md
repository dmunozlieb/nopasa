# Add a deadline (manual) — design

Date: 2026-06-08
Status: Approved (pending user review of this spec)

## Goal

Build the manual "add a deadline" flow: a single form that creates a `Deadline`
via the domain factory and persists it through the repository. The modal route
`app/add.tsx` graduates from placeholder to this form. The "+ Añadir" affordances
(home list and empty state) already route to `/add`, so they open this form
directly. This closes the real-use loop: add → see it in the list → open detail →
mark it, removing the dependency on the seed.

## Out of scope (future sessions)

Camera/OCR, the intermediate "foto / escribir a mano" screen, the "confirm photo"
screen (the whole photo path), settings, notifications, `recurrenceMonths` input
(the field exists but is not collected yet), iOS.

Note: `docs/design/` has no "confirm" mockup. The closest image,
`añadir-vencimiento.png`, is the intermediate photo/manual chooser (out of scope).
The manual form is therefore designed from the field list below plus the existing
visual language (theme, Detail screen patterns).

## Constraints

- Do not touch the domain or the port.
- The screen depends on abstractions (`DeadlineRepository`, the `createDeadline`
  deps `IdGenerator`/`Clock`), never on SQLite or `expo-crypto` directly.
- Reuse existing foundations: theme tokens, `Button`, `Card`, `AppText`,
  `typeIcon`, `formatDate`, `startOfDay`, `RepositoryProvider`/`useDeadlineRepository`.
- Navigation by callback (`onClose`) as in `HomeScreen`/`DeadlineDetailScreen`,
  so the screen is testable without the router.

## Architecture & dependency injection

A new provider for the factory deps, sibling to `RepositoryProvider`. The clock is
deliberately shaped to graduate later into an app-wide cross-cutting dependency
(same domain `Clock` that "today"/urgency could consume).

- `src/ui/deadline-deps/deadline-deps-context.tsx`
  - `DeadlineDepsProvider` + `useDeadlineDeps()`.
  - Exposes `{ generateId, clock }` (the `IdGenerator` and `Clock` from the domain).
  - Production defaults: `expoCryptoIdGenerator` / `systemClock`.
  - Injectable via props (`generateId?`, `clock?`) for deterministic tests.
- `src/ui/hooks/use-create-deadline.ts`
  - `useCreateDeadline()` returns `async (input: CreateDeadlineInput) => Deadline`.
  - Internals: `useDeadlineRepository()` + `useDeadlineDeps()` →
    `createDeadline(input, deps)` → `repository.save(deadline)` → returns the deadline.
- `app/_layout.tsx`
  - Wrap the tree in `<DeadlineDepsProvider>` (inside `RepositoryProvider`).
  - `RepositoryProvider` stays single-purpose (untouched).

## Pure logic (maximize testability)

- `src/ui/deadline/type-labels.ts` — `typeLabel(type)`: short ES chip label, kept
  short for the 3-per-row grid. Terminology unified with the Detail screen.
  - ITV → `ITV`
  - DNI → `DNI`
  - PASSPORT → `Pasaporte`
  - DRIVING_LICENSE → `Permiso`
  - INSURANCE → `Seguro`
  - SUBSCRIPTION → `Suscripción`
  - WARRANTY → `Garantía`
  - GAS_INSPECTION → `Gas`
  - OTHER → `Otro`
- `src/ui/deadline/default-subtitle.ts` — `defaultSubtitle(type)`: pure
  type→description map (vocabulary aligned with the Detail copy). Covers all nine.
  - ITV → `Inspección técnica del coche`
  - DNI → `Documento nacional de identidad`
  - PASSPORT → `Documento para viajar fuera de la UE`
  - DRIVING_LICENSE → `Permiso de conducir`
  - INSURANCE → `Seguro`
  - SUBSCRIPTION → `Suscripción`
  - WARRANTY → `Garantía`
  - GAS_INSPECTION → `Revisión del gas`
  - OTHER → `` (empty: no default description)
- `src/ui/deadline/subtitle-sync.ts` — pure sync function. Given
  `(type, currentSubtitle, touched)` decide the subtitle to display: autofill from
  `defaultSubtitle(type)` while `!touched`; respect `currentSubtitle` once `touched`.
  Any user edit (including clearing the field) sets `touched = true` and stops
  overwriting; this touched transition is part of the pure logic and is tested.
- `src/ui/deadline/add-form.ts` — form model + helpers:
  - `validateAddForm(state)` → `{ valid: boolean; errors: { title?: string } }`.
    Title must be non-empty after trim; date is always present (defaults to today),
    so the only real invalid state is an empty title.
  - `toCreateInput(state)` → `CreateDeadlineInput`. Parses the amount string
    (`"12,99"` → `12.99`); sets `amount` only when > 0, leaving `amountLabel`
    undefined (formatting comes from `formatAmountLine`). `dueDate` is normalized to
    local midnight via `startOfDay`. `reminderDaysBefore` is sorted.

## UI components (small, testable)

- `TypeSelector` — wrapping grid, 3 per row; each chip = `typeIcon(type)` +
  `typeLabel(type)`; active chip highlighted in `brandBlue`. Props: `value`,
  `onChange`. No external deps.
- `FormField` — label + control row, reused by title, subtitle, amount.
- `ReminderChips` — chips 30 / 7 / 1, multi-select toggle; 30 and 7 preselected.
- `DatePickerField` — opens `@react-native-community/datetimepicker` (mode `date`,
  bundled in Expo Go). Displays the date via `formatDate`. Default: today; past
  dates allowed (some documents are already expired).

## Screen & wiring

- `src/ui/screens/AddDeadlineScreen.tsx` — props `{ onClose: () => void }`.
  - Holds form state, composes the components above.
  - Modal-style header (drag handle + title "Añadir un vencimiento") matching the
    Detail screen's visual language.
  - **Guardar** button disabled while `!valid`. When the title is empty after the
    user has interacted, show an inline hint next to the title ("Ponle un nombre")
    so non-technical users understand why the button is grey.
  - Save flow (with failure handling):
    ```
    try {
      await createDeadline(toCreateInput(state)); // factory + repository.save
      onClose();
    } catch {
      // Domain Zod validation should not fail (form pre-validates), but
      // repository.save can (e.g. disk error). On failure: do NOT call onClose,
      // show an Alert, keep the form open so the user does not believe it saved.
      Alert.alert(...);
    }
    ```
- `app/add.tsx` — replace placeholder with
  `<AddDeadlineScreen onClose={() => router.back()} />`.
  - `app/index.tsx` already does `onAdd → router.push('/add')` (untouched).
  - On return, the home refreshes on focus and the new item appears.

## Data flow

```
AddDeadlineScreen (form state)
  → toCreateInput(state): CreateDeadlineInput
  → useCreateDeadline()(input)
      → createDeadline(input, { generateId, clock })  // domain factory, status=ACTIVE
      → repository.save(deadline)
  → onClose()  // only on success
```

## Error handling

- Pre-validation (`validateAddForm`) gates the Guardar button (empty title).
- Domain Zod parse in `createDeadline` is the last guarantee.
- `repository.save` failure is caught: form stays open, Alert shown, `onClose` not
  called.

## Testing (TDD)

Pure:
- `defaultSubtitle` — all nine types.
- `typeLabel` — all nine types.
- `subtitle-sync` — autofill while `!touched`; edit/clear flips `touched` and stops
  overwriting.
- `validateAddForm` — rejects empty / whitespace-only title; rejects absent date
  (defensive); accepts valid input.
- `toCreateInput` — amount comma→number, only when > 0; `dueDate` at local midnight;
  reminders sorted.

Components (RNTL):
- Fill form + tap Guardar with valid input → saves and closes.
- Empty title → Guardar disabled / does not save; hint shown.
- `repository.save` rejects → `onClose` NOT called, Alert/error shown, form open.
- `TypeSelector` / `ReminderChips` toggle behavior.

Integration:
- `InMemoryDeadlineRepository` + deterministic `generateId`/`clock` via providers →
  fill and save persists a `Deadline` with the expected fields (verified via
  `list()`/`findById`) and calls `onClose`.

## Quality

Do not touch domain or port. Reuse tokens/components/hooks. The screen depends on
abstractions, not on SQLite or expo-crypto directly.

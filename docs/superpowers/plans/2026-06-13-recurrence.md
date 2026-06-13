# Recurrence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let recurring deadlines roll forward to their next cycle: marking one as renewed advances its due date (staying ACTIVE) and reschedules its reminders, with a friendly recurrence input on the add form.

**Architecture:** Pure DST-safe month math in the domain (`recurrence.ts`), a preset chip input wired through the existing `toCreateInput`/`CreateDeadlineInput` path, a `useRenewDeadline` hook mirroring `useCreateDeadline` (update + cancel + reschedule), and an inline renew/stop-repeat affordance in the detail screen. No native modules.

**Tech Stack:** TypeScript, React Native (Expo SDK 56), Zod (existing schema), Jest + @testing-library/react-native. Tests run under `TZ=Europe/Madrid` via `npm test`.

**Spec:** `docs/superpowers/specs/2026-06-13-recurrence-design.md`

---

## File Structure

- `src/domain/deadline/recurrence.ts` (create) — pure `addMonths` + `nextDueDate`.
- `src/domain/deadline/recurrence.test.ts` (create) — pure tests.
- `src/domain/deadline/index.ts` (modify) — export the new functions.
- `src/ui/deadline/add-form.ts` (modify) — `parseRecurrenceMonths`, `recurrenceMonths` in state + `toCreateInput`.
- `src/ui/deadline/add-form.test.ts` (modify) — parsing + mapping tests.
- `src/ui/components/RecurrenceSelect.tsx` (create) — preset chips + custom input.
- `src/ui/components/RecurrenceSelect.test.tsx` (create) — component tests.
- `src/ui/components/DeadlineForm.tsx` (modify) — host `RecurrenceSelect`.
- `src/ui/screens/AddDeadlineScreen.test.tsx` (modify) — persistence round-trip.
- `src/ui/deadline/recurrence-label.ts` (create) — Spanish label helper.
- `src/ui/deadline/recurrence-label.test.ts` (create) — label tests.
- `src/ui/hooks/use-renew-deadline.ts` (create) — renew + reschedule hook.
- `src/ui/hooks/use-renew-deadline.test.tsx` (create) — hook tests.
- `src/ui/screens/DeadlineDetailScreen.tsx` (modify) — recurrent branch.
- `src/ui/screens/DeadlineDetailScreen.test.tsx` (modify) — renew/stop/regression tests.

---

## Task 1: Pure recurrence math

**Files:**
- Create: `src/domain/deadline/recurrence.ts`
- Test: `src/domain/deadline/recurrence.test.ts`
- Modify: `src/domain/deadline/index.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/domain/deadline/recurrence.test.ts`:

```ts
import { addMonths, nextDueDate } from './recurrence';

describe('addMonths', () => {
  it('adds whole months keeping the local calendar day', () => {
    expect(addMonths(new Date(2026, 0, 15), 1)).toEqual(new Date(2026, 1, 15));
  });

  it('adds a full year', () => {
    expect(addMonths(new Date(2026, 5, 8), 12)).toEqual(new Date(2027, 5, 8));
  });

  it('rolls the year over when months overflow December', () => {
    expect(addMonths(new Date(2026, 11, 10), 2)).toEqual(new Date(2027, 1, 10));
  });

  it('clamps to the last day of a shorter target month (31 Jan + 1 → 28 Feb)', () => {
    expect(addMonths(new Date(2026, 0, 31), 1)).toEqual(new Date(2026, 1, 28));
  });

  it('clamps to 29 Feb in a leap year', () => {
    expect(addMonths(new Date(2028, 0, 31), 1)).toEqual(new Date(2028, 1, 29));
  });

  it('clamps 31 Mar + 1 month to 30 Apr', () => {
    expect(addMonths(new Date(2026, 2, 31), 1)).toEqual(new Date(2026, 3, 30));
  });

  // DST guard: Spain springs forward on Sun 29 Mar 2026. Component math keeps the
  // result at local midnight on the right calendar day regardless of the clock shift.
  it('stays at local midnight on the right day across a DST month', () => {
    const result = addMonths(new Date(2026, 1, 28), 1);
    expect(result).toEqual(new Date(2026, 2, 28));
    expect(result.getHours()).toBe(0);
  });
});

describe('nextDueDate', () => {
  it('returns the first cycle after the due date when not yet past', () => {
    // Renewed near the due date: one year forward.
    expect(nextDueDate(new Date(2026, 5, 8), 12, new Date(2026, 5, 13))).toEqual(new Date(2027, 5, 8));
  });

  it('keeps advancing past stale cycles on a late renewal', () => {
    // Due far in the past; first multiple not strictly before today wins.
    expect(nextDueDate(new Date(2026, 0, 10), 1, new Date(2026, 5, 13))).toEqual(new Date(2026, 6, 10));
  });

  it('anchors to the original date with no end-of-month drift (yearly on 31 Jan)', () => {
    // 31-Jan yearly must always land 31-Jan, never drifting to Feb via repeated clamps.
    expect(nextDueDate(new Date(2020, 0, 31), 12, new Date(2026, 5, 13))).toEqual(new Date(2027, 0, 31));
  });

  it('keeps a candidate that equals today (today is not strictly past)', () => {
    expect(nextDueDate(new Date(2026, 4, 13), 1, new Date(2026, 5, 13))).toEqual(new Date(2026, 5, 13));
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/domain/deadline/recurrence.test.ts`
Expected: FAIL — `Cannot find module './recurrence'`.

- [ ] **Step 3: Write the implementation**

Create `src/domain/deadline/recurrence.ts`:

```ts
import { startOfDay } from '../shared/date';

/**
 * Adds whole months on LOCAL calendar components, clamping the day to the last
 * day of the target month (31 Jan + 1 month → 28/29 Feb, never March). The result
 * is built at local midnight, so Spain's 23h/25h DST days never skew it.
 */
export function addMonths(date: Date, months: number): Date {
  const total = date.getMonth() + months;
  const targetYear = date.getFullYear() + Math.floor(total / 12);
  const targetMonth = ((total % 12) + 12) % 12;
  const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
  const day = Math.min(date.getDate(), lastDay);
  return new Date(targetYear, targetMonth, day);
}

/**
 * Next due date for a recurring deadline, anchored to the ORIGINAL dueDate so the
 * end-of-month clamp never compounds: each candidate is `addMonths(dueDate,
 * recurrenceMonths × k)` for k = 1, 2, 3…, advancing while the candidate is
 * strictly before today (a candidate equal to today is kept). k starts at 1, so
 * the result is always at least one full period after dueDate.
 */
export function nextDueDate(dueDate: Date, recurrenceMonths: number, now: Date): Date {
  const floor = startOfDay(now).getTime();
  let k = 1;
  let next = addMonths(dueDate, recurrenceMonths * k);
  while (next.getTime() < floor) {
    k += 1;
    next = addMonths(dueDate, recurrenceMonths * k);
  }
  return next;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/domain/deadline/recurrence.test.ts`
Expected: PASS (all 11 cases).

- [ ] **Step 5: Export from the domain barrel**

In `src/domain/deadline/index.ts`, add after the `grouping` export block:

```ts
export { addMonths, nextDueDate } from './recurrence';
```

- [ ] **Step 6: Commit**

```bash
git add src/domain/deadline/recurrence.ts src/domain/deadline/recurrence.test.ts src/domain/deadline/index.ts
git commit -m "feat(recurrence): pure DST-safe addMonths + nextDueDate"
```

---

## Task 2: Recurrence in the add-form (parse + state + mapping)

**Files:**
- Modify: `src/ui/deadline/add-form.ts`
- Test: `src/ui/deadline/add-form.test.ts`

- [ ] **Step 1: Write the failing tests**

In `src/ui/deadline/add-form.test.ts`, add a new describe block (after the `parseAmount` block) and import `parseRecurrenceMonths`. Update the import line at the top to:

```ts
import { parseAmount, parseRecurrenceMonths, toCreateInput, validateAddForm, type AddFormState } from './add-form';
```

Add this block:

```ts
describe('parseRecurrenceMonths', () => {
  it('parses a positive integer', () => {
    expect(parseRecurrenceMonths('3')).toBe(3);
  });
  it('returns undefined for empty, non-numeric, zero, negative, fractional or over-cap', () => {
    expect(parseRecurrenceMonths('')).toBeUndefined();
    expect(parseRecurrenceMonths('  ')).toBeUndefined();
    expect(parseRecurrenceMonths('abc')).toBeUndefined();
    expect(parseRecurrenceMonths('0')).toBeUndefined();
    expect(parseRecurrenceMonths('-3')).toBeUndefined();
    expect(parseRecurrenceMonths('1.5')).toBeUndefined();
    expect(parseRecurrenceMonths('1000')).toBeUndefined();
  });
});
```

Add these two cases inside the existing `describe('toCreateInput', ...)` block:

```ts
  it('includes recurrenceMonths when set', () => {
    const input = toCreateInput(baseState({ recurrenceMonths: 12 }));
    expect(input.recurrenceMonths).toBe(12);
  });

  it('omits recurrenceMonths when undefined', () => {
    const input = toCreateInput(baseState());
    expect('recurrenceMonths' in input).toBe(false);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/ui/deadline/add-form.test.ts`
Expected: FAIL — `parseRecurrenceMonths` is not exported / `recurrenceMonths` missing from output.

- [ ] **Step 3: Write the implementation**

In `src/ui/deadline/add-form.ts`:

Add `recurrenceMonths` to the state interface (after `reminderDaysBefore`):

```ts
export interface AddFormState {
  type: DeadlineType;
  title: string;
  subtitle: string;
  subtitleTouched: boolean;
  dueDate: Date;
  amount: string;
  reminderDaysBefore: number[];
  recurrenceMonths?: number;
}
```

Add the parser (after `parseAmount`):

```ts
/** Largest recurrence we accept; guards against absurd custom input. */
export const MAX_RECURRENCE_MONTHS = 999;

/** Parses the raw custom-recurrence text. Accepts a positive integer up to the cap;
 *  returns undefined for empty, non-numeric, zero, negative, fractional or over-cap. */
export function parseRecurrenceMonths(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (trimmed === '') return undefined;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n <= 0 || n > MAX_RECURRENCE_MONTHS) return undefined;
  return n;
}
```

In `toCreateInput`, add the recurrence spread before the `photoUri` spread:

```ts
export function toCreateInput(state: AddFormState, photoUri?: string): CreateDeadlineInput {
  const subtitle = state.subtitle.trim();
  return {
    type: state.type,
    title: state.title.trim(),
    subtitle: subtitle.length > 0 ? subtitle : undefined,
    dueDate: startOfDay(state.dueDate),
    amount: parseAmount(state.amount),
    reminderDaysBefore: [...state.reminderDaysBefore].sort((a, b) => a - b),
    ...(state.recurrenceMonths !== undefined && state.recurrenceMonths > 0
      ? { recurrenceMonths: state.recurrenceMonths }
      : {}),
    ...(photoUri !== undefined ? { photoUri } : {}),
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/ui/deadline/add-form.test.ts`
Expected: PASS (existing cases + the new ones).

- [ ] **Step 5: Commit**

```bash
git add src/ui/deadline/add-form.ts src/ui/deadline/add-form.test.ts
git commit -m "feat(recurrence): parse custom months and wire recurrenceMonths through toCreateInput"
```

---

## Task 3: RecurrenceSelect component

**Files:**
- Create: `src/ui/components/RecurrenceSelect.tsx`
- Test: `src/ui/components/RecurrenceSelect.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/ui/components/RecurrenceSelect.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';
import { RecurrenceSelect } from './RecurrenceSelect';

describe('RecurrenceSelect', () => {
  it('renders the presets and the custom chip', async () => {
    await render(<RecurrenceSelect value={undefined} onChange={() => {}} />);
    expect(screen.getByText('No se repite')).toBeTruthy();
    expect(screen.getByText('Cada mes')).toBeTruthy();
    expect(screen.getByText('Cada año')).toBeTruthy();
    expect(screen.getByText('Cada 2 años')).toBeTruthy();
    expect(screen.getByText('Personalizado')).toBeTruthy();
  });

  it('reports the months for a preset', async () => {
    const onChange = jest.fn();
    await render(<RecurrenceSelect value={undefined} onChange={onChange} />);
    fireEvent.press(screen.getByText('Cada año'));
    expect(onChange).toHaveBeenCalledWith(12);
  });

  it('reports undefined for "No se repite"', async () => {
    const onChange = jest.fn();
    await render(<RecurrenceSelect value={12} onChange={onChange} />);
    fireEvent.press(screen.getByText('No se repite'));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('reveals the custom field and reports the typed integer', async () => {
    const onChange = jest.fn();
    await render(<RecurrenceSelect value={undefined} onChange={onChange} />);
    fireEvent.press(screen.getByText('Personalizado'));
    const input = await screen.findByTestId('recurrence-custom-input');
    fireEvent.changeText(input, '3');
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('reports undefined for invalid custom input', async () => {
    const onChange = jest.fn();
    await render(<RecurrenceSelect value={undefined} onChange={onChange} />);
    fireEvent.press(screen.getByText('Personalizado'));
    const input = await screen.findByTestId('recurrence-custom-input');
    fireEvent.changeText(input, 'abc');
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });

  it('shows the custom field when value is a non-preset number', async () => {
    await render(<RecurrenceSelect value={3} onChange={() => {}} />);
    expect(screen.getByTestId('recurrence-custom-input')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/ui/components/RecurrenceSelect.test.tsx`
Expected: FAIL — `Cannot find module './RecurrenceSelect'`.

- [ ] **Step 3: Write the implementation**

Create `src/ui/components/RecurrenceSelect.tsx`:

```tsx
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { parseRecurrenceMonths } from '../deadline/add-form';
import { AppText } from './AppText';
import { colors, fontSizes, radii, spacing } from '../theme';

interface RecurrenceSelectProps {
  value: number | undefined;
  onChange: (months: number | undefined) => void;
}

interface Preset {
  label: string;
  months: number | undefined;
}

const PRESETS: Preset[] = [
  { label: 'No se repite', months: undefined },
  { label: 'Cada mes', months: 1 },
  { label: 'Cada año', months: 12 },
  { label: 'Cada 2 años', months: 24 },
];

const PRESET_MONTHS = [1, 12, 24];

/** Friendly recurrence presets plus a custom "N months" escape hatch. The active
 *  chip is derived from `value`; a local `custom` flag distinguishes "Personalizado
 *  with empty/invalid input" (months undefined, custom on) from "No se repite". */
export function RecurrenceSelect({ value, onChange }: RecurrenceSelectProps) {
  const valueIsCustom = value !== undefined && !PRESET_MONTHS.includes(value);
  const [custom, setCustom] = useState(valueIsCustom);
  const [customText, setCustomText] = useState(valueIsCustom ? String(value) : '');

  const customSelected = custom || valueIsCustom;

  const selectPreset = (preset: Preset) => {
    setCustom(false);
    onChange(preset.months);
  };

  const selectCustom = () => {
    setCustom(true);
    onChange(parseRecurrenceMonths(customText));
  };

  const onChangeCustom = (text: string) => {
    setCustomText(text);
    onChange(parseRecurrenceMonths(text));
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        {PRESETS.map((preset) => {
          const selected = !customSelected && value === preset.months;
          return (
            <Pressable
              key={preset.label}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => selectPreset(preset)}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <AppText weight="bold" size={fontSizes.label} color={selected ? colors.white : colors.textSecondary}>
                {preset.label}
              </AppText>
            </Pressable>
          );
        })}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: customSelected }}
          onPress={selectCustom}
          style={[styles.chip, customSelected && styles.chipSelected]}
        >
          <AppText weight="bold" size={fontSizes.label} color={customSelected ? colors.white : colors.textSecondary}>
            Personalizado
          </AppText>
        </Pressable>
      </View>
      {customSelected ? (
        <TextInput
          testID="recurrence-custom-input"
          placeholder="Cada cuántos meses"
          placeholderTextColor={colors.textFaint}
          value={customText}
          onChangeText={onChangeCustom}
          keyboardType="number-pad"
          style={styles.input}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceSoft,
  },
  chipSelected: { backgroundColor: colors.brandBlue },
  input: {
    fontFamily: 'Nunito_700Bold',
    fontSize: fontSizes.body,
    color: colors.text,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.button,
    backgroundColor: colors.surfaceSoft,
  },
});
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/ui/components/RecurrenceSelect.test.tsx`
Expected: PASS (6 cases).

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/RecurrenceSelect.tsx src/ui/components/RecurrenceSelect.test.tsx
git commit -m "feat(recurrence): RecurrenceSelect preset chips with custom months"
```

---

## Task 4: Wire RecurrenceSelect into the form + persistence round-trip

**Files:**
- Modify: `src/ui/components/DeadlineForm.tsx`
- Test: `src/ui/screens/AddDeadlineScreen.test.tsx`

- [ ] **Step 1: Write the failing test**

In `src/ui/screens/AddDeadlineScreen.test.tsx`, add this case inside the `describe('AddDeadlineScreen', ...)` block:

```ts
  it('persists the chosen recurrence preset (integration)', async () => {
    const repo = new InMemoryDeadlineRepository();
    const onClose = jest.fn();
    await renderScreen(repo, onClose);

    const titleInput = await screen.findByPlaceholderText('Ej. ITV del coche');
    fireEvent.changeText(titleInput, 'ITV del coche');
    await screen.findByDisplayValue('ITV del coche');
    fireEvent.press(screen.getByText('Cada año'));
    await screen.findByText('Cada año');
    fireEvent.press(screen.getByText('Guardar'));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect((await repo.findById('fixed-id'))?.recurrenceMonths).toBe(12);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/ui/screens/AddDeadlineScreen.test.tsx`
Expected: FAIL — no "Cada año" text found (the form has no recurrence input yet).

- [ ] **Step 3: Wire the component into the form**

In `src/ui/components/DeadlineForm.tsx`:

Add the import (next to the other component imports, after `ReminderChips`):

```tsx
import { RecurrenceSelect } from './RecurrenceSelect';
```

Add a `FormField` immediately after the "Fecha clave" field (after its closing `</FormField>`, before "Importe"):

```tsx
        <FormField label="¿Se repite?">
          <RecurrenceSelect
            value={state.recurrenceMonths}
            onChange={(recurrenceMonths) => setState((s) => ({ ...s, recurrenceMonths }))}
          />
        </FormField>
```

(No change to the `useState` initializer is needed: `recurrenceMonths` is optional and defaults to `undefined`; any `initialValues.recurrenceMonths` still flows through the existing `...initialValues` spread.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/ui/screens/AddDeadlineScreen.test.tsx`
Expected: PASS (existing cases + the new recurrence case).

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/DeadlineForm.tsx src/ui/screens/AddDeadlineScreen.test.tsx
git commit -m "feat(recurrence): add recurrence field to the deadline form"
```

---

## Task 5: Recurrence label helper (Spanish copy)

**Files:**
- Create: `src/ui/deadline/recurrence-label.ts`
- Test: `src/ui/deadline/recurrence-label.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/ui/deadline/recurrence-label.test.ts`:

```ts
import { recurrenceLabel } from './recurrence-label';

describe('recurrenceLabel', () => {
  it('labels a monthly recurrence', () => {
    expect(recurrenceLabel(1)).toBe('Cada mes');
  });
  it('labels a yearly recurrence', () => {
    expect(recurrenceLabel(12)).toBe('Cada año');
  });
  it('labels whole-year multiples in years', () => {
    expect(recurrenceLabel(24)).toBe('Cada 2 años');
    expect(recurrenceLabel(36)).toBe('Cada 3 años');
  });
  it('labels other periods in months', () => {
    expect(recurrenceLabel(3)).toBe('Cada 3 meses');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/ui/deadline/recurrence-label.test.ts`
Expected: FAIL — `Cannot find module './recurrence-label'`.

- [ ] **Step 3: Write the implementation**

Create `src/ui/deadline/recurrence-label.ts`:

```ts
/** Friendly Spanish label for a recurrence period given in months. */
export function recurrenceLabel(months: number): string {
  if (months === 1) return 'Cada mes';
  if (months === 12) return 'Cada año';
  if (months % 12 === 0) return `Cada ${months / 12} años`;
  return `Cada ${months} meses`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/ui/deadline/recurrence-label.test.ts`
Expected: PASS (4 cases).

- [ ] **Step 5: Commit**

```bash
git add src/ui/deadline/recurrence-label.ts src/ui/deadline/recurrence-label.test.ts
git commit -m "feat(recurrence): Spanish recurrence label helper"
```

---

## Task 6: useRenewDeadline hook

**Files:**
- Create: `src/ui/hooks/use-renew-deadline.ts`
- Test: `src/ui/hooks/use-renew-deadline.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/ui/hooks/use-renew-deadline.test.tsx`:

```tsx
import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { buildDeadline } from '../../test-support/build-deadline';
import { InMemoryDeadlineRepository } from '../../test-support/in-memory-deadline-repository';
import { FakeNotificationScheduler } from '../../test-support/fake-notification-scheduler';
import { InMemorySettingsRepository } from '../../test-support/in-memory-settings-repository';
import type { NotificationScheduler } from '../../ports/notification-scheduler';
import { RepositoryProvider } from '../repository/repository-context';
import { DeadlineDepsProvider } from '../deadline-deps/deadline-deps-context';
import { NotificationSchedulerProvider } from '../notification-scheduler/notification-scheduler-context';
import { SettingsProvider } from '../settings/settings-context';
import { useRenewDeadline } from './use-renew-deadline';

function wrapperWith(
  repo: InMemoryDeadlineRepository,
  scheduler: NotificationScheduler,
  settingsRepo = new InMemorySettingsRepository(),
) {
  return ({ children }: { children: ReactNode }) => (
    <RepositoryProvider repository={repo}>
      <DeadlineDepsProvider generateId={() => 'x'} clock={{ now: () => new Date(2026, 5, 13) }}>
        <NotificationSchedulerProvider scheduler={scheduler}>
          <SettingsProvider repository={settingsRepo}>{children}</SettingsProvider>
        </NotificationSchedulerProvider>
      </DeadlineDepsProvider>
    </RepositoryProvider>
  );
}

describe('useRenewDeadline', () => {
  it('advances the due date (normalized to midnight), keeps ACTIVE and persists', async () => {
    const repo = new InMemoryDeadlineRepository([
      buildDeadline({ id: '1', dueDate: new Date(2026, 5, 8), recurrenceMonths: 12, status: 'ACTIVE' }),
    ]);
    const { result } = await renderHook(() => useRenewDeadline(), {
      wrapper: wrapperWith(repo, new FakeNotificationScheduler()),
    });
    await waitFor(() => expect(typeof result.current).toBe('function'));

    await result.current((await repo.findById('1'))!, new Date(2027, 5, 8, 14, 0));

    const saved = await repo.findById('1');
    expect(saved?.dueDate).toEqual(new Date(2027, 5, 8));
    expect(saved?.status).toBe('ACTIVE');
  });

  it('cancels then reschedules reminders from the new date', async () => {
    const scheduler = new FakeNotificationScheduler();
    const repo = new InMemoryDeadlineRepository([
      buildDeadline({ id: '1', dueDate: new Date(2026, 5, 8), recurrenceMonths: 12, reminderDaysBefore: [7], status: 'ACTIVE' }),
    ]);
    const { result } = await renderHook(() => useRenewDeadline(), {
      wrapper: wrapperWith(repo, scheduler),
    });
    await waitFor(() => expect(typeof result.current).toBe('function'));

    await result.current((await repo.findById('1'))!, new Date(2027, 5, 8));

    expect(scheduler.cancelled).toEqual(['1']);
    const plan = scheduler.scheduled.get('1')!;
    expect(plan).toHaveLength(1);
    expect(plan[0].fireAt).toEqual(new Date(2027, 5, 1, 9, 0)); // 7 days before, default 09:00
  });

  it('persists the update even when rescheduling throws (best-effort)', async () => {
    const throwing: NotificationScheduler = {
      schedule: async () => {},
      cancel: async () => {
        throw new Error('scheduler down');
      },
    };
    const repo = new InMemoryDeadlineRepository([
      buildDeadline({ id: '1', dueDate: new Date(2026, 5, 8), recurrenceMonths: 12, status: 'ACTIVE' }),
    ]);
    const { result } = await renderHook(() => useRenewDeadline(), {
      wrapper: wrapperWith(repo, throwing),
    });
    await waitFor(() => expect(typeof result.current).toBe('function'));

    await result.current((await repo.findById('1'))!, new Date(2027, 5, 8));

    expect((await repo.findById('1'))?.dueDate).toEqual(new Date(2027, 5, 8));
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/ui/hooks/use-renew-deadline.test.tsx`
Expected: FAIL — `Cannot find module './use-renew-deadline'`.

- [ ] **Step 3: Write the implementation**

Create `src/ui/hooks/use-renew-deadline.ts`:

```ts
import { useCallback } from 'react';
import type { Deadline } from '../../domain/deadline/deadline.schema';
import { startOfDay } from '../../domain/shared/date';
import { useDeadlineRepository } from '../repository/repository-context';
import { useDeadlineDeps } from '../deadline-deps/deadline-deps-context';
import { useNotificationScheduler } from '../notification-scheduler/notification-scheduler-context';
import { useSettings } from '../settings/settings-context';
import { buildNotificationPlan } from '../notification/build-notification-plan';

/** Returns a function that rolls a recurring deadline forward to a confirmed date:
 *  updates dueDate (normalized to local midnight, status stays ACTIVE), then cancels
 *  and reschedules its reminders. Rescheduling is best-effort: a scheduler failure
 *  never fails the update. Mirrors useCreateDeadline's effect shape. */
export function useRenewDeadline(): (deadline: Deadline, confirmedDate: Date) => Promise<void> {
  const repository = useDeadlineRepository();
  const deps = useDeadlineDeps();
  const scheduler = useNotificationScheduler();
  const { settings } = useSettings();
  return useCallback(
    async (deadline: Deadline, confirmedDate: Date) => {
      const renewed: Deadline = { ...deadline, dueDate: startOfDay(confirmedDate), status: 'ACTIVE' };
      await repository.update(renewed);
      try {
        await scheduler.cancel(renewed.id);
        const plan = buildNotificationPlan(renewed, {
          now: deps.clock.now(),
          reminderTime: settings.reminderTime,
        });
        await scheduler.schedule(renewed.id, plan);
      } catch {
        // Reminders are best-effort; never fail the update because of them.
      }
    },
    [repository, deps, scheduler, settings],
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/ui/hooks/use-renew-deadline.test.tsx`
Expected: PASS (3 cases).

- [ ] **Step 5: Commit**

```bash
git add src/ui/hooks/use-renew-deadline.ts src/ui/hooks/use-renew-deadline.test.tsx
git commit -m "feat(recurrence): useRenewDeadline hook (update + reschedule)"
```

---

## Task 7: Detail screen — renew, stop-repeating, indicator

**Files:**
- Modify: `src/ui/screens/DeadlineDetailScreen.tsx`
- Test: `src/ui/screens/DeadlineDetailScreen.test.tsx`

- [ ] **Step 1: Write the failing tests**

In `src/ui/screens/DeadlineDetailScreen.test.tsx`:

Replace the import block and `renderWith` helper at the top (lines 1-22) with this — it adds `Alert`, the deps/settings providers (needed by the renew hook) and a fixed clock for a deterministic prefill:

```tsx
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { buildDeadline } from '../../test-support/build-deadline';
import { InMemoryDeadlineRepository } from '../../test-support/in-memory-deadline-repository';
import { FakeNotificationScheduler } from '../../test-support/fake-notification-scheduler';
import { InMemorySettingsRepository } from '../../test-support/in-memory-settings-repository';
import { RepositoryProvider } from '../repository/repository-context';
import { DeadlineDepsProvider } from '../deadline-deps/deadline-deps-context';
import { NotificationSchedulerProvider } from '../notification-scheduler/notification-scheduler-context';
import { SettingsProvider } from '../settings/settings-context';
import { DeadlineDetailScreen } from './DeadlineDetailScreen';

function renderWith(
  repo: InMemoryDeadlineRepository,
  id: string,
  onClose: () => void = () => {},
  scheduler: FakeNotificationScheduler = new FakeNotificationScheduler(),
  now: Date = new Date(2026, 5, 13),
) {
  return render(
    <RepositoryProvider repository={repo}>
      <DeadlineDepsProvider generateId={() => 'x'} clock={{ now: () => now }}>
        <NotificationSchedulerProvider scheduler={scheduler}>
          <SettingsProvider repository={new InMemorySettingsRepository()}>
            <DeadlineDetailScreen id={id} onClose={onClose} />
          </SettingsProvider>
        </NotificationSchedulerProvider>
      </DeadlineDepsProvider>
    </RepositoryProvider>,
  );
}
```

Then add these cases inside the `describe('DeadlineDetailScreen', ...)` block:

```tsx
  it('a non-recurrent deadline keeps the standard manage row', async () => {
    const repo = new InMemoryDeadlineRepository([
      buildDeadline({ id: '1', type: 'ITV', title: 'ITV — Clio' }),
    ]);
    await renderWith(repo, '1');
    expect(await screen.findByText('Marcar como renovado')).toBeTruthy();
    expect(screen.getByText('Posponer el aviso')).toBeTruthy();
    expect(screen.queryByText('Marcar como renovada')).toBeNull();
  });

  it('a recurrent deadline shows renew + stop-repeating + the recurrence indicator', async () => {
    const repo = new InMemoryDeadlineRepository([
      buildDeadline({ id: '1', type: 'ITV', title: 'ITV — Clio', recurrenceMonths: 12 }),
    ]);
    await renderWith(repo, '1');
    expect(await screen.findByText('Marcar como renovada')).toBeTruthy();
    expect(screen.getByText('Dejar de repetir')).toBeTruthy();
    expect(screen.getByText('Se repite cada año')).toBeTruthy();
    expect(screen.queryByText('Posponer el aviso')).toBeNull();
  });

  it('renews a recurrent deadline: advances the date, stays ACTIVE, reschedules and closes', async () => {
    const repo = new InMemoryDeadlineRepository([
      buildDeadline({ id: '1', type: 'ITV', title: 'ITV — Clio', dueDate: new Date(2026, 5, 8), recurrenceMonths: 12, reminderDaysBefore: [7], status: 'ACTIVE' }),
    ]);
    const onClose = jest.fn();
    const scheduler = new FakeNotificationScheduler();
    await renderWith(repo, '1', onClose, scheduler);

    fireEvent.press(await screen.findByText('Marcar como renovada'));
    fireEvent.press(await screen.findByText('Confirmar renovación'));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    const saved = await repo.findById('1');
    expect(saved?.dueDate).toEqual(new Date(2027, 5, 8)); // nextDueDate(2026-06-08, 12, 2026-06-13)
    expect(saved?.status).toBe('ACTIVE');
    expect(scheduler.cancelled).toEqual(['1']);
    expect(scheduler.scheduled.has('1')).toBe(true);
  });

  it('stops repeating after confirming the destructive dialog', async () => {
    const repo = new InMemoryDeadlineRepository([
      buildDeadline({ id: '1', type: 'ITV', title: 'ITV — Clio', recurrenceMonths: 12, status: 'ACTIVE' }),
    ]);
    const onClose = jest.fn();
    const scheduler = new FakeNotificationScheduler();
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.style === 'destructive')?.onPress?.();
    });
    await renderWith(repo, '1', onClose, scheduler);

    fireEvent.press(await screen.findByText('Dejar de repetir'));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect((await repo.findById('1'))?.status).toBe('RESOLVED');
    expect(scheduler.cancelled).toEqual(['1']);
    alertSpy.mockRestore();
  });

  it('does nothing when the stop-repeating dialog is cancelled', async () => {
    const repo = new InMemoryDeadlineRepository([
      buildDeadline({ id: '1', type: 'ITV', title: 'ITV — Clio', recurrenceMonths: 12, status: 'ACTIVE' }),
    ]);
    const onClose = jest.fn();
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.style === 'cancel')?.onPress?.();
    });
    await renderWith(repo, '1', onClose);

    fireEvent.press(await screen.findByText('Dejar de repetir'));

    expect(onClose).not.toHaveBeenCalled();
    expect((await repo.findById('1'))?.status).toBe('ACTIVE');
    alertSpy.mockRestore();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/ui/screens/DeadlineDetailScreen.test.tsx`
Expected: FAIL — "Marcar como renovada" not found (recurrent branch not implemented).

- [ ] **Step 3: Implement the recurrent branch**

In `src/ui/screens/DeadlineDetailScreen.tsx`:

Add a `react` import for `useState` (the file has no `react` import yet) above the existing `react-native` import on line 1. `Alert` is already imported from `react-native`; leave that line as-is:

```tsx
import { useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, View } from 'react-native';
```

Add these imports alongside the existing ones (after the `useDeadline` import block):

```tsx
import { nextDueDate } from '../../domain/deadline/recurrence';
import { recurrenceLabel } from '../deadline/recurrence-label';
import { useRenewDeadline } from '../hooks/use-renew-deadline';
import { DatePickerField } from '../components/DatePickerField';
```

Add the hook + local state right after `const insets = useSafeAreaInsets();` (BEFORE the early `return`s, so hook order stays stable):

```tsx
  const renew = useRenewDeadline();
  const [renewing, setRenewing] = useState(false);
  const [renewDate, setRenewDate] = useState<Date>(() => new Date());
```

After `const amountLine = formatAmountLine(deadline);` and the existing `notYet`/`markAs`, add the recurrence handlers:

```tsx
  const isRecurrent = deadline.recurrenceMonths != null;

  const startRenew = () => {
    setRenewDate(nextDueDate(deadline.dueDate, deadline.recurrenceMonths!, new Date()));
    setRenewing(true);
  };

  const confirmRenew = async () => {
    await renew(deadline, renewDate);
    onClose();
  };

  const confirmStopRepeating = () =>
    Alert.alert(
      'Dejar de repetir',
      'Este vencimiento dejará de renovarse y saldrá de tu lista. No se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Dejar de repetir', style: 'destructive', onPress: () => { void markAs(); } },
      ],
    );
```

Add the recurrence indicator right after the `<DetailStatusBlock ... />` element:

```tsx
        {deadline.recurrenceMonths != null ? (
          <View style={styles.recurrenceRow}>
            <MaterialCommunityIcons name="calendar-refresh" size={16} color={colors.textFaint} />
            <AppText weight="semibold" size={fontSizes.small} color={colors.textFaint}>
              {recurrenceLabel(deadline.recurrenceMonths)}
            </AppText>
          </View>
        ) : null}
```

Replace the existing manage row block:

```tsx
        <View style={styles.manageDivider} />
        <View style={styles.manageRow}>
          <ManageAction label={presentation.manage.label} icon="check" onPress={markAs} />
          <ManageAction label="Posponer el aviso" icon="clock-outline" onPress={notYet} />
        </View>
```

with the recurrence-aware version (including the inline renew section):

```tsx
        <View style={styles.manageDivider} />
        <View style={styles.manageRow}>
          {isRecurrent ? (
            <>
              <ManageAction label="Marcar como renovada" icon="calendar-refresh" onPress={startRenew} />
              <ManageAction label="Dejar de repetir" icon="close-circle-outline" onPress={confirmStopRepeating} />
            </>
          ) : (
            <>
              <ManageAction label={presentation.manage.label} icon="check" onPress={markAs} />
              <ManageAction label="Posponer el aviso" icon="clock-outline" onPress={notYet} />
            </>
          )}
        </View>

        {renewing ? (
          <View style={styles.renewBox}>
            <AppText weight="bold" size={fontSizes.label} color={colors.textSecondary}>
              ¿Cuál es la nueva fecha?
            </AppText>
            <DatePickerField value={renewDate} onChange={setRenewDate} />
            <View style={styles.renewActions}>
              <ActionButton label="Confirmar renovación" icon="check" onPress={confirmRenew} variant="primary" />
              <ManageAction label="Cancelar" icon="close" onPress={() => setRenewing(false)} />
            </View>
          </View>
        ) : null}
```

Add the new styles to the `StyleSheet.create({ ... })` object:

```tsx
  recurrenceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  renewBox: { gap: spacing.md, padding: spacing.lg, borderRadius: radii.card, backgroundColor: colors.surfaceSoft },
  renewActions: { gap: spacing.sm },
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/ui/screens/DeadlineDetailScreen.test.tsx`
Expected: PASS (existing cases + 5 new ones).

- [ ] **Step 5: Commit**

```bash
git add src/ui/screens/DeadlineDetailScreen.tsx src/ui/screens/DeadlineDetailScreen.test.tsx
git commit -m "feat(recurrence): renew/stop-repeating actions and indicator in the detail"
```

---

## Task 8: Full verification

- [ ] **Step 1: Run the whole suite**

Run: `npm test`
Expected: PASS — all suites green (recurrence is purely additive; existing behavior unchanged).

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Final review**

Confirm against the spec: roll-forward (no resolve+create), confirm-date inline step, anchor-no-drift `nextDueDate`, recurrence input on all types defaulting to "No se repite", `nextOccurrence` absent (YAGNI), custom parsing robust, "dejar de repetir" gated by a confirmation dialog, indicator only in the detail.

---

## Notes for the implementer

- **TDD discipline:** write the test, watch it fail for the stated reason, implement minimally, watch it pass, commit. Do not batch.
- **Concurrent test renderer:** after a state-changing `fireEvent`, await a `findBy*`/`waitFor` before the next interaction (see the comment in `AddDeadlineScreen.test.tsx`). The detail renew test relies on this between the two presses.
- **DST:** never build dates from epoch arithmetic. Use local components (`new Date(y, m, d)`) like `addMonths`/`startOfDay`. Tests run under `TZ=Europe/Madrid`.
- **Hook order:** in the detail screen, the `useState`/`useRenewDeadline` calls must stay above the early `return`s. Do not move them below a conditional return.

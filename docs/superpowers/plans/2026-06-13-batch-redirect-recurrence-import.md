# Batch (Home-after-save · longer recurrence · import) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land on Home after a successful save; add longer recurrence cycles + a years/months custom unit; and add a non-destructive "import my data" feature mirroring export.

**Architecture:** Item 1 splits the save-success nav (`onSaved` → dismiss the add modal stack → Home) from cancel (native swipe → back). Item 2 extends `RecurrenceSelect`/`parseRecurrenceMonths` (custom unit, longer presets, higher cap). Item 3 mirrors the export stack: a pure `parseDeadlineImport` (domain) + a `DataImporter` port/adapter/fake + a `useMergeImportedDeadlines` hook (skip-by-id, reschedule ACTIVE) + Settings UX.

**Tech Stack:** TypeScript, React Native (Expo SDK 56), expo-router, Zod, Jest + @testing-library/react-native (`render`/`renderHook` are async; tests run under `TZ=Europe/Madrid` via `npm test`). New native dep: `expo-document-picker` → **EAS rebuild needed to test on device.**

**Spec:** `docs/superpowers/specs/2026-06-13-batch-redirect-recurrence-import-design.md`

---

## File Structure

**Item 1:** `DeadlineForm.tsx`, `AddDeadlineScreen.tsx`, `ConfirmDeadlineScreen.tsx` (prop `onClose`→`onSaved`); `app/add/manual.tsx`, `app/add/confirm.tsx` (wire `onSaved` → `router.dismissAll()`); their two screen tests.

**Item 2:** `src/ui/deadline/add-form.ts` (`parseRecurrenceMonths(raw, unit)`, cap 600); `src/ui/components/RecurrenceSelect.tsx` (presets 60/120, unit toggle); `recurrence-label` test only.

**Item 3 (mirror of export):**
- `src/domain/import/parse-deadline-import.ts` (pure parser) + test
- `src/ui/import/import-messages.ts` (pure copy helpers) + test
- `src/ports/data-importer.ts` (port)
- `src/test-support/fake-data-importer.ts` + test
- `src/infrastructure/import/expo-data-importer.ts` (adapter)
- `src/ui/import/data-importer-context.tsx` (DI) + `app/_layout.tsx` wiring
- `jest.setup.js` (mock `expo-document-picker`)
- `src/ui/hooks/use-merge-imported-deadlines.ts` (merge use-case) + test
- `src/ui/screens/SettingsScreen.tsx` + test (import row + flow)

---

## Task 1: Return to Home after saving

**Files:**
- Modify: `src/ui/components/DeadlineForm.tsx`, `src/ui/screens/AddDeadlineScreen.tsx`, `src/ui/screens/ConfirmDeadlineScreen.tsx`
- Modify: `app/add/manual.tsx`, `app/add/confirm.tsx`
- Test: `src/ui/screens/AddDeadlineScreen.test.tsx`, `src/ui/screens/ConfirmDeadlineScreen.test.tsx`

- [ ] **Step 1: Update the screen tests to expect `onSaved` (failing)**

In `src/ui/screens/AddDeadlineScreen.test.tsx`, rename the `renderScreen` helper's second positional param and every assertion from `onClose` to `onSaved`. The helper currently is:
```tsx
function renderScreen(
  repo: InMemoryDeadlineRepository,
  onClose: () => void = () => {},
  settingsRepo: InMemorySettingsRepository = new InMemorySettingsRepository(),
) {
  return render(
    ...
              <AddDeadlineScreen onClose={onClose} />
    ...
  );
}
```
Change it to:
```tsx
function renderScreen(
  repo: InMemoryDeadlineRepository,
  onSaved: () => void = () => {},
  settingsRepo: InMemorySettingsRepository = new InMemorySettingsRepository(),
) {
  return render(
    ...
              <AddDeadlineScreen onSaved={onSaved} />
    ...
  );
}
```
Then in the test bodies, rename every `const onClose = jest.fn()` → `const onSaved = jest.fn()`, every `renderScreen(repo, onClose)` → `renderScreen(repo, onSaved)`, and every `expect(onClose)...` → `expect(onSaved)...` (the "persists and closes", "does not save", "save fails", "empty-plan hint" cases). Leave all non-callback assertions unchanged.

In `src/ui/screens/ConfirmDeadlineScreen.test.tsx`, the helper option is `onClose?: () => void` and passes `onClose={onClose}` to `ConfirmDeadlineScreen`. Rename the option and prop to `onSaved`, and rename `const onClose = opts.onClose ?? (() => {})` → `const onSaved = opts.onSaved ?? (() => {})`, `<ConfirmDeadlineScreen ... onSaved={onSaved} ... />`, and in the two tests that use it (`const onClose = jest.fn()` + `expect(onClose).toHaveBeenCalledTimes(1)`) rename to `onSaved`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/ui/screens/AddDeadlineScreen.test.tsx src/ui/screens/ConfirmDeadlineScreen.test.tsx`
Expected: FAIL — `AddDeadlineScreen`/`ConfirmDeadlineScreen` have no `onSaved` prop (type/`onSaved` undefined → never called).

- [ ] **Step 3: Rename the prop in `DeadlineForm` and the two screens**

In `src/ui/components/DeadlineForm.tsx`, rename the `onClose` prop to `onSaved` and call it in the save path:
```tsx
interface DeadlineFormProps {
  heading: string;
  photoUri?: string;
  initialValues?: Partial<AddFormState>;
  onSaved: () => void;
}

export function DeadlineForm({ heading, photoUri, initialValues, onSaved }: DeadlineFormProps) {
```
and in `onSave`, change `onClose();` to `onSaved();` (it is the only call site).

In `src/ui/screens/AddDeadlineScreen.tsx`:
```tsx
interface AddDeadlineScreenProps {
  onSaved: () => void;
}

export function AddDeadlineScreen({ onSaved }: AddDeadlineScreenProps) {
  return <DeadlineForm heading="Añadir un vencimiento" onSaved={onSaved} />;
}
```

In `src/ui/screens/ConfirmDeadlineScreen.tsx`, rename the `onClose` prop to `onSaved` in the interface and the function params, and pass `onSaved={onSaved}` to `DeadlineForm` (line ~75). The loading branch does not use it.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/ui/screens/AddDeadlineScreen.test.tsx src/ui/screens/ConfirmDeadlineScreen.test.tsx`
Expected: PASS.

- [ ] **Step 5: Wire the routes to dismiss the whole add stack**

In `app/add/manual.tsx`:
```tsx
import { useRouter } from 'expo-router';
import { AddDeadlineScreen } from '../../src/ui/screens/AddDeadlineScreen';

export default function AddManualRoute() {
  const router = useRouter();
  return <AddDeadlineScreen onSaved={() => router.dismissAll()} />;
}
```

In `app/add/confirm.tsx`:
```tsx
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ConfirmDeadlineScreen } from '../../src/ui/screens/ConfirmDeadlineScreen';

export default function AddConfirmRoute() {
  const router = useRouter();
  const { photoUri } = useLocalSearchParams<{ photoUri: string }>();
  return <ConfirmDeadlineScreen photoUri={decodeURIComponent(photoUri ?? '')} onSaved={() => router.dismissAll()} />;
}
```
Before committing, verify `router.dismissAll()` is the correct expo-router v56 API for dismissing all modals to the stack root (Home) at https://docs.expo.dev/versions/v56.0.0/ — if it is named differently (e.g. `dismissTo('/')`), use that instead. (Cancel stays the native swipe-down = back one step; no code. These route files are outside the `src` test roots — verified on device after the EAS rebuild.)

- [ ] **Step 6: Typecheck + commit**

Run: `npm run typecheck`
Expected: no errors.
```bash
git add src/ui/components/DeadlineForm.tsx src/ui/screens/AddDeadlineScreen.tsx src/ui/screens/ConfirmDeadlineScreen.tsx src/ui/screens/AddDeadlineScreen.test.tsx src/ui/screens/ConfirmDeadlineScreen.test.tsx app/add/manual.tsx app/add/confirm.tsx
git commit -m "feat(add): return to Home after a successful save (onSaved → dismissAll)"
```

---

## Task 2: parseRecurrenceMonths — unit + higher cap

**Files:**
- Modify: `src/ui/deadline/add-form.ts`
- Test: `src/ui/deadline/add-form.test.ts`

- [ ] **Step 1: Add the failing tests**

In `src/ui/deadline/add-form.test.ts`, replace the `describe('parseRecurrenceMonths', ...)` block with:
```ts
describe('parseRecurrenceMonths', () => {
  it('parses a positive integer as months by default', () => {
    expect(parseRecurrenceMonths('3')).toBe(3);
    expect(parseRecurrenceMonths('600')).toBe(600);
  });
  it('parses a value in years to months', () => {
    expect(parseRecurrenceMonths('5', 'years')).toBe(60);
    expect(parseRecurrenceMonths('10', 'years')).toBe(120);
    expect(parseRecurrenceMonths('50', 'years')).toBe(600);
  });
  it('returns undefined for empty, non-numeric, zero, negative or fractional', () => {
    expect(parseRecurrenceMonths('')).toBeUndefined();
    expect(parseRecurrenceMonths('  ')).toBeUndefined();
    expect(parseRecurrenceMonths('abc')).toBeUndefined();
    expect(parseRecurrenceMonths('0')).toBeUndefined();
    expect(parseRecurrenceMonths('-3')).toBeUndefined();
    expect(parseRecurrenceMonths('1.5')).toBeUndefined();
    expect(parseRecurrenceMonths('2.5', 'years')).toBeUndefined();
    expect(parseRecurrenceMonths('0', 'years')).toBeUndefined();
  });
  it('returns undefined when the resulting months exceed the cap', () => {
    expect(parseRecurrenceMonths('601')).toBeUndefined();
    expect(parseRecurrenceMonths('1000')).toBeUndefined();
    expect(parseRecurrenceMonths('51', 'years')).toBeUndefined(); // 612 > 600
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/ui/deadline/add-form.test.ts`
Expected: FAIL — `parseRecurrenceMonths` ignores the `unit` arg (years cases return the raw number, not ×12).

- [ ] **Step 3: Implement the unit + cap**

In `src/ui/deadline/add-form.ts`, replace the `MAX_RECURRENCE_MONTHS` constant and `parseRecurrenceMonths` with:
```ts
/** Largest recurrence we accept (≈50 years); guards against absurd custom input. */
export const MAX_RECURRENCE_MONTHS = 600;

/** Parses raw custom-recurrence text in the given unit (default months). Accepts a
 *  positive integer; returns the value in MONTHS (years × 12), or undefined for empty,
 *  non-numeric, zero, negative, fractional, or over-cap input. */
export function parseRecurrenceMonths(raw: string, unit: 'months' | 'years' = 'months'): number | undefined {
  const trimmed = raw.trim();
  if (trimmed === '') return undefined;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n <= 0) return undefined;
  const months = unit === 'years' ? n * 12 : n;
  if (months > MAX_RECURRENCE_MONTHS) return undefined;
  return months;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/ui/deadline/add-form.test.ts`
Expected: PASS (all parse cases + the existing `toCreateInput`/`validateAddForm` cases).

- [ ] **Step 5: Commit**

```bash
git add src/ui/deadline/add-form.ts src/ui/deadline/add-form.test.ts
git commit -m "feat(recurrence): parseRecurrenceMonths supports a years unit; cap 600"
```

---

## Task 3: RecurrenceSelect — long presets + unit toggle + label cases

**Files:**
- Modify: `src/ui/components/RecurrenceSelect.tsx`
- Test: `src/ui/components/RecurrenceSelect.test.tsx`
- Test: `src/ui/deadline/recurrence-label.test.ts`

- [ ] **Step 1: Replace the component test (failing)**

Replace the whole body of `src/ui/components/RecurrenceSelect.test.tsx` with:
```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { RecurrenceSelect } from './RecurrenceSelect';

describe('RecurrenceSelect', () => {
  it('renders all presets including the long cycles and the custom chip', async () => {
    await render(<RecurrenceSelect value={undefined} onChange={() => {}} />);
    expect(screen.getByText('No se repite')).toBeTruthy();
    expect(screen.getByText('Cada mes')).toBeTruthy();
    expect(screen.getByText('Cada año')).toBeTruthy();
    expect(screen.getByText('Cada 2 años')).toBeTruthy();
    expect(screen.getByText('Cada 5 años')).toBeTruthy();
    expect(screen.getByText('Cada 10 años')).toBeTruthy();
    expect(screen.getByText('Personalizado')).toBeTruthy();
  });

  it('reports the months for the long-cycle presets', async () => {
    const onChange = jest.fn();
    await render(<RecurrenceSelect value={undefined} onChange={onChange} />);
    fireEvent.press(screen.getByText('Cada 5 años'));
    expect(onChange).toHaveBeenLastCalledWith(60);
    fireEvent.press(screen.getByText('Cada 10 años'));
    expect(onChange).toHaveBeenLastCalledWith(120);
  });

  it('reports the months for a short preset', async () => {
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

  it('custom input defaults to years: typing 5 reports 60 months', async () => {
    const onChange = jest.fn();
    await render(<RecurrenceSelect value={undefined} onChange={onChange} />);
    fireEvent.press(screen.getByText('Personalizado'));
    const input = await screen.findByTestId('recurrence-custom-input');
    fireEvent.changeText(input, '5');
    expect(onChange).toHaveBeenLastCalledWith(60);
  });

  it('switching the custom unit to months reparses the typed value', async () => {
    const onChange = jest.fn();
    await render(<RecurrenceSelect value={undefined} onChange={onChange} />);
    fireEvent.press(screen.getByText('Personalizado'));
    const input = await screen.findByTestId('recurrence-custom-input');
    fireEvent.changeText(input, '3'); // years → 36
    expect(onChange).toHaveBeenLastCalledWith(36);
    fireEvent.press(screen.getByText('meses'));
    expect(onChange).toHaveBeenLastCalledWith(3); // months → 3
  });

  it('reports undefined for invalid custom input', async () => {
    const onChange = jest.fn();
    await render(<RecurrenceSelect value={undefined} onChange={onChange} />);
    fireEvent.press(screen.getByText('Personalizado'));
    const input = await screen.findByTestId('recurrence-custom-input');
    fireEvent.changeText(input, 'abc');
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });

  it('shows the custom field and infers years for a whole-year non-preset value', async () => {
    await render(<RecurrenceSelect value={36} onChange={() => {}} />);
    const input = await screen.findByTestId('recurrence-custom-input');
    expect(input.props.value).toBe('3'); // 36 months → 3 years
    expect(screen.getByText('años')).toBeTruthy();
  });

  it('collapses the custom field when a preset is selected after custom mode', async () => {
    await render(<RecurrenceSelect value={undefined} onChange={() => {}} />);
    fireEvent.press(screen.getByText('Personalizado'));
    expect(await screen.findByTestId('recurrence-custom-input')).toBeTruthy();
    fireEvent.press(screen.getByText('Cada mes'));
    await waitFor(() => expect(screen.queryByTestId('recurrence-custom-input')).toBeNull());
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/ui/components/RecurrenceSelect.test.tsx`
Expected: FAIL — no "Cada 5 años" / unit toggle ("meses"/"años") / years-default behavior yet.

- [ ] **Step 3: Replace the component**

Replace the whole body of `src/ui/components/RecurrenceSelect.tsx` with:
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
  { label: 'Cada 5 años', months: 60 },
  { label: 'Cada 10 años', months: 120 },
];

/** Derived from PRESETS so a new preset can't silently drift from this list. */
const PRESET_MONTHS = PRESETS.map((p) => p.months).filter((m): m is number => m !== undefined);

type Unit = 'months' | 'years';

/** Friendly recurrence presets plus a custom "N" escape hatch with a months/years unit
 *  toggle (default years — the reason to go custom). The active chip is derived from
 *  `value`; a local `custom` flag distinguishes "Personalizado with empty/invalid input"
 *  (months undefined, custom on) from "No se repite". Custom always stores months. */
export function RecurrenceSelect({ value, onChange }: RecurrenceSelectProps) {
  const valueIsCustom = value !== undefined && !PRESET_MONTHS.includes(value);
  const inferredUnit: Unit = valueIsCustom && value! % 12 === 0 ? 'years' : 'months';
  const [custom, setCustom] = useState(valueIsCustom);
  const [unit, setUnit] = useState<Unit>(valueIsCustom ? inferredUnit : 'years');
  const [customText, setCustomText] = useState(
    valueIsCustom ? String(inferredUnit === 'years' ? value! / 12 : value) : '',
  );

  const customSelected = custom || valueIsCustom;

  const selectPreset = (preset: Preset) => {
    setCustom(false);
    onChange(preset.months);
  };

  const selectCustom = () => {
    setCustom(true);
    onChange(parseRecurrenceMonths(customText, unit));
  };

  const onChangeCustom = (text: string) => {
    setCustomText(text);
    onChange(parseRecurrenceMonths(text, unit));
  };

  const selectUnit = (next: Unit) => {
    setUnit(next);
    onChange(parseRecurrenceMonths(customText, next));
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
        <View style={styles.customRow}>
          <TextInput
            testID="recurrence-custom-input"
            placeholder="Cada cuántos"
            placeholderTextColor={colors.textFaint}
            value={customText}
            onChangeText={onChangeCustom}
            keyboardType="number-pad"
            style={styles.input}
          />
          <View style={styles.unitRow}>
            {(['months', 'years'] as Unit[]).map((u) => {
              const selected = unit === u;
              return (
                <Pressable
                  key={u}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => selectUnit(u)}
                  style={[styles.unitChip, selected && styles.chipSelected]}
                >
                  <AppText weight="bold" size={fontSizes.label} color={selected ? colors.white : colors.textSecondary}>
                    {u === 'months' ? 'meses' : 'años'}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radii.pill, backgroundColor: colors.surfaceSoft },
  chipSelected: { backgroundColor: colors.brandBlue },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  input: {
    flex: 1,
    fontFamily: 'Nunito_700Bold',
    fontSize: fontSizes.body,
    color: colors.text,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.button,
    backgroundColor: colors.surfaceSoft,
  },
  unitRow: { flexDirection: 'row', gap: spacing.sm },
  unitChip: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radii.pill, backgroundColor: colors.surfaceSoft },
});
```

- [ ] **Step 4: Run the component test to verify it passes**

Run: `npm test -- src/ui/components/RecurrenceSelect.test.tsx`
Expected: PASS (9 cases).

- [ ] **Step 5: Add recurrence-label cases for the long cycles (no impl change)**

In `src/ui/deadline/recurrence-label.test.ts`, add inside the `describe('recurrenceLabel', ...)` block:
```ts
  it('labels the long-cycle presets in whole years', () => {
    expect(recurrenceLabel(60)).toBe('Cada 5 años');
    expect(recurrenceLabel(120)).toBe('Cada 10 años');
  });
```

- [ ] **Step 6: Run the label test (passes with no impl change)**

Run: `npm test -- src/ui/deadline/recurrence-label.test.ts`
Expected: PASS — `recurrenceLabel` already returns "Cada N años" for `months % 12 === 0`; this characterization test confirms 60/120 need no code change.

- [ ] **Step 7: Commit**

```bash
git add src/ui/components/RecurrenceSelect.tsx src/ui/components/RecurrenceSelect.test.tsx src/ui/deadline/recurrence-label.test.ts
git commit -m "feat(recurrence): 5/10-year presets and a years/months custom unit"
```

---

## Task 4: parseDeadlineImport (pure domain)

**Files:**
- Create: `src/domain/import/parse-deadline-import.ts`
- Test: `src/domain/import/parse-deadline-import.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/domain/import/parse-deadline-import.test.ts`:
```ts
import { buildDeadlineExport } from '../export/build-deadline-export';
import { buildDeadline } from '../../test-support/build-deadline';
import { parseDeadlineImport } from './parse-deadline-import';

describe('parseDeadlineImport', () => {
  it('round-trips a valid export, reconstructing dates as the exact instants', () => {
    const original = [
      buildDeadline({ id: 'a', dueDate: new Date(2027, 5, 19), createdAt: new Date(2026, 0, 2, 9, 30) }),
      buildDeadline({ id: 'b', status: 'RESOLVED' }),
    ];
    const json = buildDeadlineExport(original, { exportedAt: new Date(2026, 5, 10) });

    const { deadlines, invalidCount, schemaError } = parseDeadlineImport(json);

    expect(schemaError).toBeUndefined();
    expect(invalidCount).toBe(0);
    expect(deadlines).toHaveLength(2);
    expect(deadlines[0].id).toBe('a');
    expect(deadlines[0].dueDate).toBeInstanceOf(Date);
    expect(deadlines[0].dueDate).toEqual(new Date(2027, 5, 19)); // exact instant = local midnight in Madrid
    expect(deadlines[0].createdAt).toEqual(new Date(2026, 0, 2, 9, 30));
    expect(deadlines[1].status).toBe('RESOLVED');
  });

  it('rejects a non-JSON file as unreadable', () => {
    expect(parseDeadlineImport('not json {')).toEqual({ deadlines: [], invalidCount: 0, schemaError: 'unreadable' });
  });

  it('rejects a file that is not a Nopasa export as unreadable', () => {
    const json = JSON.stringify({ app: 'otra-app', schema: 1, deadlines: [] });
    expect(parseDeadlineImport(json).schemaError).toBe('unreadable');
  });

  it('rejects an unknown Nopasa schema version as unsupported-version', () => {
    const json = JSON.stringify({ app: 'nopasa', schema: 2, deadlines: [] });
    expect(parseDeadlineImport(json).schemaError).toBe('unsupported-version');
  });

  it('skips corrupt entries and counts them, keeping the valid ones', () => {
    const valid = buildDeadline({ id: 'ok' });
    const json = JSON.stringify({
      app: 'nopasa',
      schema: 1,
      deadlines: [
        JSON.parse(JSON.stringify(valid)),
        { id: 'bad', type: 'NOT_A_TYPE', title: '', dueDate: 'x', reminderDaysBefore: [], createdAt: 'x', status: 'ACTIVE' },
        { nonsense: true },
      ],
    });

    const { deadlines, invalidCount, schemaError } = parseDeadlineImport(json);

    expect(schemaError).toBeUndefined();
    expect(deadlines.map((d) => d.id)).toEqual(['ok']);
    expect(invalidCount).toBe(2);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/domain/import/parse-deadline-import.test.ts`
Expected: FAIL — `Cannot find module './parse-deadline-import'`.

- [ ] **Step 3: Write the implementation**

Create `src/domain/import/parse-deadline-import.ts`:
```ts
import { z } from 'zod';
import { deadlineSchema, type Deadline } from '../deadline/deadline.schema';

export type ImportSchemaError = 'unreadable' | 'unsupported-version';

export interface DeadlineImportResult {
  deadlines: Deadline[];
  invalidCount: number;
  schemaError?: ImportSchemaError;
}

/** The canonical Deadline schema with the two date fields coerced from ISO strings: the
 *  export serializes Dates via JSON.stringify → full ISO, which z.coerce.date() reads
 *  back to the exact instant (local midnight in the same timezone, for dueDate). */
const importDeadlineSchema = deadlineSchema.extend({
  dueDate: z.coerce.date(),
  createdAt: z.coerce.date(),
});

/**
 * Pure parser for an exported Nopasa file. Resilient: a corrupt entry is skipped and
 * counted (invalidCount), never aborting the rest — mirrors the SQLite repo's edge
 * validation. A whole file that can't be read or isn't a Nopasa file → 'unreadable';
 * a genuine Nopasa file of another schema → 'unsupported-version'.
 */
export function parseDeadlineImport(jsonText: string): DeadlineImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { deadlines: [], invalidCount: 0, schemaError: 'unreadable' };
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { deadlines: [], invalidCount: 0, schemaError: 'unreadable' };
  }
  const envelope = parsed as { app?: unknown; schema?: unknown; deadlines?: unknown };
  if (envelope.app !== 'nopasa') {
    return { deadlines: [], invalidCount: 0, schemaError: 'unreadable' };
  }
  if (envelope.schema !== 1) {
    return { deadlines: [], invalidCount: 0, schemaError: 'unsupported-version' };
  }

  const rawList = Array.isArray(envelope.deadlines) ? envelope.deadlines : [];
  const deadlines: Deadline[] = [];
  let invalidCount = 0;
  for (const entry of rawList) {
    const result = importDeadlineSchema.safeParse(entry);
    if (result.success) deadlines.push(result.data);
    else invalidCount += 1;
  }
  return { deadlines, invalidCount };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/domain/import/parse-deadline-import.test.ts`
Expected: PASS (5 cases).

- [ ] **Step 5: Commit**

```bash
git add src/domain/import/parse-deadline-import.ts src/domain/import/parse-deadline-import.test.ts
git commit -m "feat(import): pure parseDeadlineImport (schema check, resilient, date coercion)"
```

---

## Task 5: Import copy helpers (pure)

**Files:**
- Create: `src/ui/import/import-messages.ts`
- Test: `src/ui/import/import-messages.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/ui/import/import-messages.test.ts`:
```ts
import { importErrorMessage, importResultMessage } from './import-messages';

describe('importErrorMessage', () => {
  it('messages the unreadable / not-Nopasa case', () => {
    expect(importErrorMessage('unreadable')).toMatch(/copia de Nopasa/);
  });
  it('messages the unsupported version case', () => {
    expect(importErrorMessage('unsupported-version')).toMatch(/versión no compatible/);
  });
});

describe('importResultMessage', () => {
  it('shows only imported when nothing else applies', () => {
    expect(importResultMessage({ imported: 3, alreadyExisted: 0, invalidCount: 0 })).toBe('Importados 3');
  });
  it('appends already-existed when > 0', () => {
    expect(importResultMessage({ imported: 2, alreadyExisted: 5, invalidCount: 0 })).toBe('Importados 2 · 5 ya existían');
  });
  it('appends invalid when > 0', () => {
    expect(importResultMessage({ imported: 2, alreadyExisted: 0, invalidCount: 1 })).toBe('Importados 2 · 1 no válidos');
  });
  it('appends both in order', () => {
    expect(importResultMessage({ imported: 1, alreadyExisted: 2, invalidCount: 3 })).toBe('Importados 1 · 2 ya existían · 3 no válidos');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/ui/import/import-messages.test.ts`
Expected: FAIL — `Cannot find module './import-messages'`.

- [ ] **Step 3: Write the implementation**

Create `src/ui/import/import-messages.ts`:
```ts
import type { ImportSchemaError } from '../../domain/import/parse-deadline-import';

/** Spanish message for a whole-file import rejection. */
export function importErrorMessage(code: ImportSchemaError): string {
  switch (code) {
    case 'unreadable':
      return 'No pudimos leer el archivo. ¿Seguro que es una copia de Nopasa?';
    case 'unsupported-version':
      return 'Este archivo es de una versión no compatible de Nopasa.';
  }
}

interface ImportCounts {
  imported: number;
  alreadyExisted: number;
  invalidCount: number;
}

/** Itemized result line, hiding the zero parts:
 *  "Importados N" [· M ya existían] [· K no válidos]. */
export function importResultMessage({ imported, alreadyExisted, invalidCount }: ImportCounts): string {
  let message = `Importados ${imported}`;
  if (alreadyExisted > 0) message += ` · ${alreadyExisted} ya existían`;
  if (invalidCount > 0) message += ` · ${invalidCount} no válidos`;
  return message;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/ui/import/import-messages.test.ts`
Expected: PASS (6 cases).

- [ ] **Step 5: Commit**

```bash
git add src/ui/import/import-messages.ts src/ui/import/import-messages.test.ts
git commit -m "feat(import): pure Spanish copy helpers (error + itemized result)"
```

---

## Task 6: Import infrastructure (port, fake, adapter, DI) — mirror of export

**Files:**
- Create: `src/ports/data-importer.ts`
- Create: `src/test-support/fake-data-importer.ts`
- Test: `src/test-support/fake-data-importer.test.ts`
- Create: `src/infrastructure/import/expo-data-importer.ts`
- Create: `src/ui/import/data-importer-context.tsx`
- Modify: `jest.setup.js`, `app/_layout.tsx`, `package.json` (via expo install)

- [ ] **Step 1: Write the failing fake test**

Create `src/test-support/fake-data-importer.test.ts`:
```ts
import { FakeDataImporter } from './fake-data-importer';

describe('FakeDataImporter', () => {
  it('returns the preset content', async () => {
    expect(await new FakeDataImporter('{"app":"nopasa"}').pickAndRead()).toBe('{"app":"nopasa"}');
  });
  it('returns null when configured as cancelled', async () => {
    expect(await new FakeDataImporter().pickAndRead()).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- src/test-support/fake-data-importer.test.ts`
Expected: FAIL — `Cannot find module './fake-data-importer'`.

- [ ] **Step 3: Write the port and the fake**

Create `src/ports/data-importer.ts`:
```ts
/** Effects port for importing data into the app. The UI depends on this, never on
 *  expo-document-picker / expo-file-system directly. */
export interface DataImporter {
  /** Let the user pick a file and return its text content, or null if they cancelled. */
  pickAndRead(): Promise<string | null>;
}
```

Create `src/test-support/fake-data-importer.ts`:
```ts
import type { DataImporter } from '../ports/data-importer';

/** In-memory DataImporter for tests: returns a preset content string (or null = cancelled). */
export class FakeDataImporter implements DataImporter {
  constructor(private readonly content: string | null = null) {}

  async pickAndRead(): Promise<string | null> {
    return this.content;
  }
}
```

- [ ] **Step 4: Run the fake test to verify it passes**

Run: `npm test -- src/test-support/fake-data-importer.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the native dep + jest mock**

Run: `npx expo install expo-document-picker`
Expected: adds `expo-document-picker` (SDK-56-aligned version) to `package.json`.

In `jest.setup.js`, append after the `expo-text-extractor` mock:
```js
// Mock expo-document-picker: the native module can't load under jsdom. Inert default
// (cancelled) keeps the adapter/context importable; tests inject FakeDataImporter.
jest.mock('expo-document-picker', () => ({
  __esModule: true,
  getDocumentAsync: jest.fn(async () => ({ canceled: true, assets: null })),
}));
```

- [ ] **Step 6: Write the adapter + context, wire the provider**

Create `src/infrastructure/import/expo-data-importer.ts`:
```ts
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import type { DataImporter } from '../../ports/data-importer';

/**
 * Lets the user pick a file via the system document picker, then reads its text.
 * Returns null if the user cancels. Thin wrapper over expo-document-picker +
 * expo-file-system — mocked in tests (real path verified on a dev build).
 */
export const expoDataImporter: DataImporter = {
  async pickAndRead(): Promise<string | null> {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/json',
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return null;
    return new File(result.assets[0].uri).text();
  },
};
```
Verify against https://docs.expo.dev/versions/v56.0.0/ that `getDocumentAsync` returns `{ canceled, assets: [{ uri }] }` and that `new File(uri).text(): Promise<string>` is the v56 read API; adjust if the exact names differ.

Create `src/ui/import/data-importer-context.tsx`:
```tsx
import { createContext, useContext, type ReactNode } from 'react';
import type { DataImporter } from '../../ports/data-importer';
import { expoDataImporter } from '../../infrastructure/import/expo-data-importer';

const DataImporterContext = createContext<DataImporter | null>(null);

interface DataImporterProviderProps {
  /** Inject a fake (tests). Omit for the production expo adapter. */
  importer?: DataImporter;
  children: ReactNode;
}

export function DataImporterProvider({ importer, children }: DataImporterProviderProps) {
  return (
    <DataImporterContext.Provider value={importer ?? expoDataImporter}>
      {children}
    </DataImporterContext.Provider>
  );
}

export function useDataImporter(): DataImporter {
  const importer = useContext(DataImporterContext);
  if (!importer) {
    throw new Error('useDataImporter must be used within a DataImporterProvider');
  }
  return importer;
}
```

In `app/_layout.tsx`, add the import next to the other providers:
```tsx
import { DataImporterProvider } from '../src/ui/import/data-importer-context';
```
and wrap it immediately inside `<DataExporterProvider>` (around `<SettingsProvider>`):
```tsx
                <DataExporterProvider>
                  <DataImporterProvider>
                    <SettingsProvider>
                      <Stack screenOptions={{ headerShown: false }}>
                        ...
                      </Stack>
                    </SettingsProvider>
                  </DataImporterProvider>
                </DataExporterProvider>
```

- [ ] **Step 7: Typecheck + run the touched test**

Run: `npm run typecheck`
Expected: no errors.
Run: `npm test -- src/test-support/fake-data-importer.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/ports/data-importer.ts src/test-support/fake-data-importer.ts src/test-support/fake-data-importer.test.ts src/infrastructure/import/expo-data-importer.ts src/ui/import/data-importer-context.tsx jest.setup.js app/_layout.tsx package.json package-lock.json
git commit -m "feat(import): DataImporter port, fake, expo-document-picker adapter and DI"
```
(If the lockfile is named differently or unchanged, adjust the `git add` accordingly.)

---

## Task 7: useMergeImportedDeadlines (non-destructive merge + reschedule)

**Files:**
- Create: `src/ui/hooks/use-merge-imported-deadlines.ts`
- Test: `src/ui/hooks/use-merge-imported-deadlines.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/ui/hooks/use-merge-imported-deadlines.test.tsx`:
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
import { useMergeImportedDeadlines } from './use-merge-imported-deadlines';

function wrapperWith(repo: InMemoryDeadlineRepository, scheduler: NotificationScheduler) {
  return ({ children }: { children: ReactNode }) => (
    <RepositoryProvider repository={repo}>
      <DeadlineDepsProvider generateId={() => 'x'} clock={{ now: () => new Date(2026, 5, 13) }}>
        <NotificationSchedulerProvider scheduler={scheduler}>
          <SettingsProvider repository={new InMemorySettingsRepository()}>{children}</SettingsProvider>
        </NotificationSchedulerProvider>
      </DeadlineDepsProvider>
    </RepositoryProvider>
  );
}

describe('useMergeImportedDeadlines', () => {
  it('skips existing ids (never overwrites) and saves new ones', async () => {
    const repo = new InMemoryDeadlineRepository([buildDeadline({ id: 'existing', title: 'ITV — Clio' })]);
    const { result } = await renderHook(() => useMergeImportedDeadlines(), {
      wrapper: wrapperWith(repo, new FakeNotificationScheduler()),
    });
    await waitFor(() => expect(typeof result.current).toBe('function'));

    const outcome = await result.current([
      buildDeadline({ id: 'existing', title: 'SHOULD NOT OVERWRITE' }),
      buildDeadline({ id: 'new', title: 'New one' }),
    ]);

    expect(outcome).toEqual({ imported: 1, alreadyExisted: 1 });
    expect((await repo.findById('existing'))?.title).toBe('ITV — Clio');
    expect((await repo.findById('new'))?.title).toBe('New one');
  });

  it('reschedules reminders only for new ACTIVE deadlines', async () => {
    const scheduler = new FakeNotificationScheduler();
    const repo = new InMemoryDeadlineRepository();
    const { result } = await renderHook(() => useMergeImportedDeadlines(), {
      wrapper: wrapperWith(repo, scheduler),
    });
    await waitFor(() => expect(typeof result.current).toBe('function'));

    await result.current([
      buildDeadline({ id: 'active', status: 'ACTIVE', dueDate: new Date(2027, 0, 1), reminderDaysBefore: [7] }),
      buildDeadline({ id: 'resolved', status: 'RESOLVED', dueDate: new Date(2027, 0, 1), reminderDaysBefore: [7] }),
    ]);

    expect(scheduler.scheduled.has('active')).toBe(true);
    expect(scheduler.scheduled.has('resolved')).toBe(false);
  });

  it('saves even if rescheduling throws (best-effort)', async () => {
    const throwing: NotificationScheduler = {
      schedule: async () => { throw new Error('down'); },
      cancel: async () => {},
    };
    const repo = new InMemoryDeadlineRepository();
    const { result } = await renderHook(() => useMergeImportedDeadlines(), {
      wrapper: wrapperWith(repo, throwing),
    });
    await waitFor(() => expect(typeof result.current).toBe('function'));

    const outcome = await result.current([
      buildDeadline({ id: 'a', status: 'ACTIVE', dueDate: new Date(2027, 0, 1), reminderDaysBefore: [7] }),
    ]);

    expect(outcome.imported).toBe(1);
    expect(await repo.findById('a')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/ui/hooks/use-merge-imported-deadlines.test.tsx`
Expected: FAIL — `Cannot find module './use-merge-imported-deadlines'`.

- [ ] **Step 3: Write the implementation**

Create `src/ui/hooks/use-merge-imported-deadlines.ts`:
```ts
import { useCallback } from 'react';
import type { Deadline } from '../../domain/deadline/deadline.schema';
import { useDeadlineRepository } from '../repository/repository-context';
import { useDeadlineDeps } from '../deadline-deps/deadline-deps-context';
import { useNotificationScheduler } from '../notification-scheduler/notification-scheduler-context';
import { useSettings } from '../settings/settings-context';
import { buildNotificationPlan } from '../notification/build-notification-plan';

export interface MergeResult {
  imported: number;
  alreadyExisted: number;
}

/** Returns a function that merges imported deadlines into the store non-destructively:
 *  skips any whose id already exists (never overwrites), saves the rest, and best-effort
 *  reschedules reminders for newly-imported ACTIVE ones. Mirrors useCreateDeadline's effects. */
export function useMergeImportedDeadlines(): (deadlines: Deadline[]) => Promise<MergeResult> {
  const repository = useDeadlineRepository();
  const deps = useDeadlineDeps();
  const scheduler = useNotificationScheduler();
  const { settings } = useSettings();
  return useCallback(
    async (deadlines: Deadline[]) => {
      const existing = new Set((await repository.list()).map((d) => d.id));
      let imported = 0;
      let alreadyExisted = 0;
      for (const deadline of deadlines) {
        if (existing.has(deadline.id)) {
          alreadyExisted += 1;
          continue;
        }
        await repository.save(deadline);
        imported += 1;
        if (deadline.status === 'ACTIVE') {
          try {
            const plan = buildNotificationPlan(deadline, {
              now: deps.clock.now(),
              reminderTime: settings.reminderTime,
            });
            await scheduler.schedule(deadline.id, plan);
          } catch {
            // Reminders are best-effort; never fail the import.
          }
        }
      }
      return { imported, alreadyExisted };
    },
    [repository, deps, scheduler, settings],
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/ui/hooks/use-merge-imported-deadlines.test.tsx`
Expected: PASS (3 cases).

- [ ] **Step 5: Commit**

```bash
git add src/ui/hooks/use-merge-imported-deadlines.ts src/ui/hooks/use-merge-imported-deadlines.test.tsx
git commit -m "feat(import): useMergeImportedDeadlines (skip-by-id, reschedule ACTIVE)"
```

---

## Task 8: Settings — "Importar mis datos" row + flow

**Files:**
- Modify: `src/ui/screens/SettingsScreen.tsx`
- Test: `src/ui/screens/SettingsScreen.test.tsx`

- [ ] **Step 1: Write the failing integration tests**

In `src/ui/screens/SettingsScreen.test.tsx`, add these imports at the top:
```tsx
import { FakeDataImporter } from '../../test-support/fake-data-importer';
import type { DataImporter } from '../../ports/data-importer';
import { DataImporterProvider } from '../import/data-importer-context';
import { buildDeadlineExport } from '../../domain/export/build-deadline-export';
```
Update the `renderScreen` helper: add `importer = new FakeDataImporter()` to the destructured params and its type `importer?: DataImporter;`, and wrap the tree with `<DataImporterProvider importer={importer}>` immediately inside `<DataExporterProvider>`:
```tsx
          <DataExporterProvider exporter={exporter}>
            <DataImporterProvider importer={importer}>
              <SettingsProvider repository={settingsRepo}>
                <SettingsScreen onClose={onClose} onOpenPrivacy={onOpenPrivacy} />
              </SettingsProvider>
            </DataImporterProvider>
          </DataExporterProvider>
```
Then add these cases inside `describe('SettingsScreen', ...)`:
```tsx
  it('imports a valid file after confirming and reports the result', async () => {
    const repo = new InMemoryDeadlineRepository();
    const exportJson = buildDeadlineExport(
      [buildDeadline({ id: 'a' }), buildDeadline({ id: 'b' })],
      { exportedAt: new Date(2026, 5, 10) },
    );
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.text === 'Importar')?.onPress?.();
    });
    await renderScreen({ repo, importer: new FakeDataImporter(exportJson) });

    fireEvent.press(await screen.findByText('Importar mis datos'));

    await waitFor(async () => expect(await repo.findById('a')).not.toBeNull());
    expect(await repo.findById('b')).not.toBeNull();
    expect(alertSpy).toHaveBeenCalledWith('Importación completada', 'Importados 2');
    alertSpy.mockRestore();
  });

  it('does nothing when the picker is cancelled', async () => {
    const repo = new InMemoryDeadlineRepository();
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderScreen({ repo, importer: new FakeDataImporter(null) });

    fireEvent.press(await screen.findByText('Importar mis datos'));

    await waitFor(() => expect(alertSpy).not.toHaveBeenCalled());
    expect(await repo.list()).toHaveLength(0);
    alertSpy.mockRestore();
  });

  it('shows a clear error for a file that is not a Nopasa copy', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderScreen({ importer: new FakeDataImporter('not json') });

    fireEvent.press(await screen.findByText('Importar mis datos'));

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith('No se pudo importar', expect.stringContaining('copia de Nopasa')),
    );
    alertSpy.mockRestore();
  });

  it('reports when no valid deadline could be read', async () => {
    const json = JSON.stringify({ app: 'nopasa', schema: 1, deadlines: [{ nope: true }] });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderScreen({ importer: new FakeDataImporter(json) });

    fireEvent.press(await screen.findByText('Importar mis datos'));

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith('No se pudo importar', 'No se pudo leer ningún vencimiento válido.'),
    );
    alertSpy.mockRestore();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/ui/screens/SettingsScreen.test.tsx`
Expected: FAIL — no "Importar mis datos" row / import flow yet.

- [ ] **Step 3: Implement the import flow in SettingsScreen**

In `src/ui/screens/SettingsScreen.tsx`, add imports:
```tsx
import { useDataImporter } from '../import/data-importer-context';
import { useMergeImportedDeadlines } from '../hooks/use-merge-imported-deadlines';
import { parseDeadlineImport } from '../../domain/import/parse-deadline-import';
import { importErrorMessage, importResultMessage } from '../import/import-messages';
```
Inside the component, after `const exporter = useDataExporter();`, add:
```tsx
  const importer = useDataImporter();
  const mergeImported = useMergeImportedDeadlines();
```
After the `exportData` function, add:
```tsx
  const importData = async () => {
    let text: string | null;
    try {
      text = await importer.pickAndRead();
    } catch {
      Alert.alert('No se pudo importar', 'Inténtalo de nuevo.');
      return;
    }
    if (text === null) return; // cancelled, no-op
    const { deadlines, invalidCount, schemaError } = parseDeadlineImport(text);
    if (schemaError) {
      Alert.alert('No se pudo importar', importErrorMessage(schemaError));
      return;
    }
    if (deadlines.length === 0) {
      Alert.alert(
        'No se pudo importar',
        invalidCount > 0 ? 'No se pudo leer ningún vencimiento válido.' : 'El archivo no contiene vencimientos.',
      );
      return;
    }
    Alert.alert('Importar', `¿Importar ${deadlines.length} vencimientos?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Importar',
        onPress: () => {
          void (async () => {
            try {
              const { imported, alreadyExisted } = await mergeImported(deadlines);
              Alert.alert('Importación completada', importResultMessage({ imported, alreadyExisted, invalidCount }));
            } catch {
              Alert.alert('No se pudo importar', 'Inténtalo de nuevo.');
            }
          })();
        },
      },
    ]);
  };
```
In the "Privacidad y datos" `Card`, insert the import row + a divider right after the "Exportar mis datos" `NavRow` and before the divider that precedes "Borrar todos los datos":
```tsx
          <NavRow
            icon="tray-arrow-down"
            label="Exportar mis datos"
            subtitle="Guarda una copia en tu móvil."
            onPress={() => { void exportData(); }}
          />
          <View style={styles.divider} />
          <NavRow
            icon="tray-arrow-up"
            label="Importar mis datos"
            subtitle="Restaura una copia."
            onPress={() => { void importData(); }}
          />
          <View style={styles.divider} />
          <NavRow
            icon="trash-can-outline"
            label="Borrar todos los datos"
            subtitle="No se puede deshacer."
            destructive
            onPress={confirmDelete}
          />
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/ui/screens/SettingsScreen.test.tsx`
Expected: PASS (existing cases + the 4 new ones).

- [ ] **Step 5: Commit**

```bash
git add src/ui/screens/SettingsScreen.tsx src/ui/screens/SettingsScreen.test.tsx
git commit -m "feat(import): Settings import flow (pick, confirm, merge, itemized result)"
```

---

## Task 9: Full verification

- [ ] **Step 1: Run the whole suite**

Run: `npm test`
Expected: PASS — all suites green. (Recurrence/add/export are additively extended; non-recurrent and export behavior unchanged.)

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Final review against the spec**

Confirm: Item 1 — `onSaved` → `dismissAll`, cancel native, no orphaned `onClose`. Item 2 — presets 60/120, years/months toggle (default years), cap 600, label unchanged. Item 3 — pure parser (unreadable vs unsupported-version routing), z.coerce for both dates, non-destructive merge skipping by id, reschedule only ACTIVE best-effort, N = valid-in-file confirm, itemized result, "ningún vencimiento válido" vs empty. Note for the human: this batch added `expo-document-picker` → an **EAS rebuild is required** to test import on device.

---

## Notes for the implementer
- **TDD:** write the test, watch it fail for the stated reason, implement minimally, watch it pass, commit. Do not batch.
- **Concurrent test renderer:** after a state-changing `fireEvent`, await a `findBy*`/`waitFor` before the next interaction or a `queryBy*().toBeNull()` assertion.
- **DST/dates:** never build dates from epoch arithmetic; the import parser relies on `z.coerce.date()` round-tripping the export's full-ISO instants under `TZ=Europe/Madrid`.
- **expo-router / expo-file-system / expo-document-picker:** verify exact v56 APIs (`router.dismissAll`, `new File(uri).text()`, `getDocumentAsync` result shape) against https://docs.expo.dev/versions/v56.0.0/ — these live in untested route/adapter files and are exercised on the dev build.

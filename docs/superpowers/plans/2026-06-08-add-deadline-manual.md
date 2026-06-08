# Add a deadline (manual) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the placeholder `app/add.tsx` into a working manual form that builds a `Deadline` via the domain factory and persists it through the repository, so the add → list → detail → mark loop works without the seed.

**Architecture:** A new `DeadlineDepsProvider` (sibling to `RepositoryProvider`) exposes the factory deps `{ generateId, clock }` with production defaults, injectable for tests. A `useCreateDeadline()` hook wires repository + deps. The screen composes small components (TypeSelector, ReminderChips, DatePickerField, FormField) over pure logic (type labels, default subtitles, subtitle sync, form validation + mapping). Navigation is by `onClose` callback.

**Tech Stack:** Expo SDK 56, React Native 0.85, expo-router, Zod 4, Jest + @testing-library/react-native, `@react-native-community/datetimepicker`.

---

## File structure

Created:
- `src/ui/deadline/type-labels.ts` — `typeLabel(type)`: short ES chip label.
- `src/ui/deadline/default-subtitle.ts` — `defaultSubtitle(type)`: type→description.
- `src/ui/deadline/subtitle-sync.ts` — `syncSubtitle(...)`: pure autofill-while-untouched rule.
- `src/ui/deadline/add-form.ts` — `AddFormState`, `validateAddForm`, `parseAmount`, `toCreateInput`.
- `src/ui/deadline-deps/deadline-deps-context.tsx` — `DeadlineDepsProvider`, `useDeadlineDeps`.
- `src/ui/hooks/use-create-deadline.ts` — `useCreateDeadline()`.
- `src/ui/components/TypeSelector.tsx` — 3-per-row icon+label grid.
- `src/ui/components/ReminderChips.tsx` — 30/7/1 multi-select chips.
- `src/ui/components/FormField.tsx` — label + control + optional hint row.
- `src/ui/components/DatePickerField.tsx` — date trigger + native picker.
- `src/ui/screens/AddDeadlineScreen.tsx` — the form screen.
- Test files alongside each unit (`*.test.ts` / `*.test.tsx`).

Modified:
- `jest.setup.js` — mock `@react-native-community/datetimepicker`.
- `package.json` — add the datetimepicker dependency (via `expo install`).
- `src/ui/components/Button.tsx` — add `disabled?` prop.
- `app/_layout.tsx` — wrap tree in `<DeadlineDepsProvider>`.
- `app/add.tsx` — render `<AddDeadlineScreen onClose={() => router.back()} />`.

Notes for the implementer:
- Tests run only under `src/` (jest `roots`), and with `TZ=Europe/Madrid`. Run all tests with `npm test`; a single file with `npm test -- <path>`.
- RNTL `render(...)` is async in this project — `await` it. Query inputs by placeholder text.
- Code/identifiers/comments in English; commit messages in English; no `Co-Authored-By` trailers.

---

### Task 1: Install datetimepicker + jest mock

**Files:**
- Modify: `package.json` (via `expo install`)
- Modify: `jest.setup.js`

- [ ] **Step 1: Install the package (Expo-managed version)**

Run: `npx expo install @react-native-community/datetimepicker`
Expected: adds `@react-native-community/datetimepicker` to `package.json` dependencies (an SDK-56-compatible version).

- [ ] **Step 2: Add a jest mock so the native picker renders in tests**

Append to `jest.setup.js`:

```js
// Mock the native date picker: render a host View we can find and whose onChange
// we can fire from tests, without pulling in the native module under jsdom.
jest.mock('@react-native-community/datetimepicker', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props) =>
      React.createElement(View, { testID: 'datetimepicker', onChange: props.onChange }),
  };
});
```

- [ ] **Step 3: Verify the suite still loads**

Run: `npm test`
Expected: PASS (existing 111 tests still green; the new mock is inert until used).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json jest.setup.js
git commit -m "build(add): install datetimepicker and mock it in jest"
```

---

### Task 2: `typeLabel` (pure)

**Files:**
- Create: `src/ui/deadline/type-labels.ts`
- Test: `src/ui/deadline/type-labels.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { DeadlineType } from '../../domain/deadline/deadline.schema';
import { typeLabel } from './type-labels';

describe('typeLabel', () => {
  it('returns a short Spanish label for every type', () => {
    expect(typeLabel('ITV')).toBe('ITV');
    expect(typeLabel('DNI')).toBe('DNI');
    expect(typeLabel('PASSPORT')).toBe('Pasaporte');
    expect(typeLabel('DRIVING_LICENSE')).toBe('Permiso');
    expect(typeLabel('INSURANCE')).toBe('Seguro');
    expect(typeLabel('SUBSCRIPTION')).toBe('Suscripción');
    expect(typeLabel('WARRANTY')).toBe('Garantía');
    expect(typeLabel('GAS_INSPECTION')).toBe('Gas');
    expect(typeLabel('OTHER')).toBe('Otro');
  });

  it('covers all nine enum values', () => {
    for (const type of DeadlineType.options) {
      expect(typeLabel(type).length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/ui/deadline/type-labels.test.ts`
Expected: FAIL — cannot find module `./type-labels`.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { DeadlineType } from '../../domain/deadline/deadline.schema';

/** Short ES label for the type chips. Terminology unified with the Detail screen
 *  ("Permiso", "Gas"); kept short so the 3-per-row grid does not wrap awkwardly. */
const LABELS: Record<DeadlineType, string> = {
  ITV: 'ITV',
  DNI: 'DNI',
  PASSPORT: 'Pasaporte',
  DRIVING_LICENSE: 'Permiso',
  INSURANCE: 'Seguro',
  SUBSCRIPTION: 'Suscripción',
  WARRANTY: 'Garantía',
  GAS_INSPECTION: 'Gas',
  OTHER: 'Otro',
};

export function typeLabel(type: DeadlineType): string {
  return LABELS[type];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/ui/deadline/type-labels.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/deadline/type-labels.ts src/ui/deadline/type-labels.test.ts
git commit -m "feat(add): type-to-short-label map for the type selector"
```

---

### Task 3: `defaultSubtitle` (pure)

**Files:**
- Create: `src/ui/deadline/default-subtitle.ts`
- Test: `src/ui/deadline/default-subtitle.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { DeadlineType } from '../../domain/deadline/deadline.schema';
import { defaultSubtitle } from './default-subtitle';

describe('defaultSubtitle', () => {
  it('returns an informative, period-agnostic default per type', () => {
    expect(defaultSubtitle('ITV')).toBe('Inspección técnica del coche');
    expect(defaultSubtitle('DNI')).toBe('Documento nacional de identidad');
    expect(defaultSubtitle('PASSPORT')).toBe('Documento para viajar fuera de la UE');
    expect(defaultSubtitle('DRIVING_LICENSE')).toBe('Permiso de conducir');
    expect(defaultSubtitle('INSURANCE')).toBe('Póliza de seguro');
    expect(defaultSubtitle('SUBSCRIPTION')).toBe('Suscripción');
    expect(defaultSubtitle('WARRANTY')).toBe('Garantía del producto');
    expect(defaultSubtitle('GAS_INSPECTION')).toBe('Revisión del gas');
    expect(defaultSubtitle('OTHER')).toBe('');
  });

  it('defines an entry for all nine types', () => {
    for (const type of DeadlineType.options) {
      expect(typeof defaultSubtitle(type)).toBe('string');
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/ui/deadline/default-subtitle.test.ts`
Expected: FAIL — cannot find module `./default-subtitle`.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { DeadlineType } from '../../domain/deadline/deadline.schema';

/** Pure type→description used to prefill the subtitle. Period-agnostic on purpose
 *  (no "anual") and informative beyond the type name. OTHER has no default. */
const SUBTITLES: Record<DeadlineType, string> = {
  ITV: 'Inspección técnica del coche',
  DNI: 'Documento nacional de identidad',
  PASSPORT: 'Documento para viajar fuera de la UE',
  DRIVING_LICENSE: 'Permiso de conducir',
  INSURANCE: 'Póliza de seguro',
  SUBSCRIPTION: 'Suscripción',
  WARRANTY: 'Garantía del producto',
  GAS_INSPECTION: 'Revisión del gas',
  OTHER: '',
};

export function defaultSubtitle(type: DeadlineType): string {
  return SUBTITLES[type];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/ui/deadline/default-subtitle.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/deadline/default-subtitle.ts src/ui/deadline/default-subtitle.test.ts
git commit -m "feat(add): default subtitle map per deadline type"
```

---

### Task 4: `syncSubtitle` (pure)

**Files:**
- Create: `src/ui/deadline/subtitle-sync.ts`
- Test: `src/ui/deadline/subtitle-sync.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { syncSubtitle } from './subtitle-sync';

describe('syncSubtitle', () => {
  it('mirrors the type default while untouched, ignoring the current value', () => {
    expect(syncSubtitle({ type: 'ITV', current: 'anything', touched: false })).toBe(
      'Inspección técnica del coche',
    );
  });

  it('preserves the user value once touched', () => {
    expect(syncSubtitle({ type: 'ITV', current: 'Mi texto', touched: true })).toBe('Mi texto');
  });

  it('preserves an empty value once touched (user cleared it on purpose)', () => {
    expect(syncSubtitle({ type: 'ITV', current: '', touched: true })).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/ui/deadline/subtitle-sync.test.ts`
Expected: FAIL — cannot find module `./subtitle-sync`.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { DeadlineType } from '../../domain/deadline/deadline.schema';
import { defaultSubtitle } from './default-subtitle';

/** Decides the subtitle to display. While untouched it mirrors the type default;
 *  once the user has touched the field (any edit, including clearing) the current
 *  value is preserved and no longer overwritten. */
export function syncSubtitle(params: {
  type: DeadlineType;
  current: string;
  touched: boolean;
}): string {
  return params.touched ? params.current : defaultSubtitle(params.type);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/ui/deadline/subtitle-sync.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/deadline/subtitle-sync.ts src/ui/deadline/subtitle-sync.test.ts
git commit -m "feat(add): pure subtitle autofill-while-untouched rule"
```

---

### Task 5: `add-form` (pure: state, validation, mapping)

**Files:**
- Create: `src/ui/deadline/add-form.ts`
- Test: `src/ui/deadline/add-form.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { parseAmount, toCreateInput, validateAddForm, type AddFormState } from './add-form';

function baseState(overrides: Partial<AddFormState> = {}): AddFormState {
  return {
    type: 'ITV',
    title: 'ITV del coche',
    subtitle: 'Inspección técnica del coche',
    subtitleTouched: false,
    dueDate: new Date(2026, 5, 8),
    amount: '',
    reminderDaysBefore: [30, 7],
    ...overrides,
  };
}

describe('validateAddForm', () => {
  it('accepts a valid state', () => {
    expect(validateAddForm(baseState())).toEqual({ valid: true, errors: {} });
  });

  it('rejects an empty or whitespace-only title with a hint', () => {
    expect(validateAddForm(baseState({ title: '' })).valid).toBe(false);
    expect(validateAddForm(baseState({ title: '   ' })).errors.title).toBe('Ponle un nombre');
  });

  it('rejects an invalid date (defensive)', () => {
    expect(validateAddForm(baseState({ dueDate: new Date(NaN) })).valid).toBe(false);
  });
});

describe('parseAmount', () => {
  it('parses comma decimals to a number', () => {
    expect(parseAmount('12,99')).toBe(12.99);
  });
  it('returns undefined for empty, non-numeric or non-positive input', () => {
    expect(parseAmount('')).toBeUndefined();
    expect(parseAmount('   ')).toBeUndefined();
    expect(parseAmount('abc')).toBeUndefined();
    expect(parseAmount('0')).toBeUndefined();
    expect(parseAmount('-5')).toBeUndefined();
  });
});

describe('toCreateInput', () => {
  it('maps a valid state to a CreateDeadlineInput', () => {
    const input = toCreateInput(
      baseState({ title: '  ITV del coche  ', amount: '12,99', reminderDaysBefore: [7, 30, 1] }),
    );
    expect(input).toEqual({
      type: 'ITV',
      title: 'ITV del coche',
      subtitle: 'Inspección técnica del coche',
      dueDate: new Date(2026, 5, 8),
      amount: 12.99,
      reminderDaysBefore: [1, 7, 30],
    });
  });

  it('omits amount when blank and subtitle when empty; normalizes dueDate to midnight', () => {
    const input = toCreateInput(
      baseState({ subtitle: '   ', amount: '', dueDate: new Date(2026, 5, 8, 15, 30) }),
    );
    expect(input.amount).toBeUndefined();
    expect(input.subtitle).toBeUndefined();
    expect(input.dueDate).toEqual(new Date(2026, 5, 8));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/ui/deadline/add-form.test.ts`
Expected: FAIL — cannot find module `./add-form`.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { CreateDeadlineInput } from '../../domain/deadline/deadline.factory';
import type { DeadlineType } from '../../domain/deadline/deadline.schema';
import { startOfDay } from '../../domain/shared/date';

/** Mutable UI state of the add form. `amount` is the raw text the user typed. */
export interface AddFormState {
  type: DeadlineType;
  title: string;
  subtitle: string;
  subtitleTouched: boolean;
  dueDate: Date;
  amount: string;
  reminderDaysBefore: number[];
}

export interface AddFormErrors {
  title?: string;
}

export interface AddFormValidation {
  valid: boolean;
  errors: AddFormErrors;
}

/** Title must be non-empty (trimmed). Date is defensively checked for validity. */
export function validateAddForm(state: AddFormState): AddFormValidation {
  const errors: AddFormErrors = {};
  if (state.title.trim().length === 0) errors.title = 'Ponle un nombre';
  const dateOk = state.dueDate instanceof Date && !Number.isNaN(state.dueDate.getTime());
  const valid = Object.keys(errors).length === 0 && dateOk;
  return { valid, errors };
}

/** Parses the raw amount text. Accepts comma decimals; returns undefined unless > 0. */
export function parseAmount(raw: string): number | undefined {
  const normalized = raw.replace(',', '.').trim();
  if (normalized === '') return undefined;
  const n = Number(normalized);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}

/** Maps validated form state to the domain factory input. Omits empty optionals;
 *  normalizes dueDate to local midnight; sorts reminders ascending. */
export function toCreateInput(state: AddFormState): CreateDeadlineInput {
  const subtitle = state.subtitle.trim();
  return {
    type: state.type,
    title: state.title.trim(),
    subtitle: subtitle.length > 0 ? subtitle : undefined,
    dueDate: startOfDay(state.dueDate),
    amount: parseAmount(state.amount),
    reminderDaysBefore: [...state.reminderDaysBefore].sort((a, b) => a - b),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/ui/deadline/add-form.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/deadline/add-form.ts src/ui/deadline/add-form.test.ts
git commit -m "feat(add): form state model, validation and CreateDeadlineInput mapping"
```

---

### Task 6: `DeadlineDepsProvider` (DI)

**Files:**
- Create: `src/ui/deadline-deps/deadline-deps-context.tsx`
- Test: `src/ui/deadline-deps/deadline-deps-context.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import type { ReactNode } from 'react';
import { renderHook } from '@testing-library/react-native';
import { DeadlineDepsProvider, useDeadlineDeps } from './deadline-deps-context';

describe('useDeadlineDeps', () => {
  it('returns the injected generateId and clock', () => {
    const clock = { now: () => new Date(2026, 5, 8) };
    const generateId = () => 'fixed-id';
    const wrapper = ({ children }: { children: ReactNode }) => (
      <DeadlineDepsProvider generateId={generateId} clock={clock}>{children}</DeadlineDepsProvider>
    );
    const { result } = renderHook(() => useDeadlineDeps(), { wrapper });
    expect(result.current.generateId()).toBe('fixed-id');
    expect(result.current.clock.now()).toEqual(new Date(2026, 5, 8));
  });

  it('falls back to production defaults when no overrides are given', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <DeadlineDepsProvider>{children}</DeadlineDepsProvider>
    );
    const { result } = renderHook(() => useDeadlineDeps(), { wrapper });
    expect(typeof result.current.generateId()).toBe('string');
    expect(result.current.clock.now()).toBeInstanceOf(Date);
  });

  it('throws when used outside the provider', () => {
    expect(() => renderHook(() => useDeadlineDeps())).toThrow(
      'useDeadlineDeps must be used within a DeadlineDepsProvider',
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/ui/deadline-deps/deadline-deps-context.test.tsx`
Expected: FAIL — cannot find module `./deadline-deps-context`.

- [ ] **Step 3: Write minimal implementation**

```tsx
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Clock, IdGenerator } from '../../domain/deadline/deadline.factory';
import { expoCryptoIdGenerator } from '../../infrastructure/id/expo-crypto-id-generator';
import { systemClock } from '../../infrastructure/clock/system-clock';

/** Dependencies the domain factory needs. The clock is deliberately exposed here
 *  so it can later graduate into an app-wide cross-cutting dependency. */
export interface DeadlineDeps {
  generateId: IdGenerator;
  clock: Clock;
}

const DeadlineDepsContext = createContext<DeadlineDeps | null>(null);

interface DeadlineDepsProviderProps {
  /** Inject a deterministic id generator (tests). Omit for production. */
  generateId?: IdGenerator;
  /** Inject a fixed clock (tests). Omit for production. */
  clock?: Clock;
  children: ReactNode;
}

export function DeadlineDepsProvider({ generateId, clock, children }: DeadlineDepsProviderProps) {
  const value = useMemo<DeadlineDeps>(
    () => ({ generateId: generateId ?? expoCryptoIdGenerator, clock: clock ?? systemClock }),
    [generateId, clock],
  );
  return <DeadlineDepsContext.Provider value={value}>{children}</DeadlineDepsContext.Provider>;
}

export function useDeadlineDeps(): DeadlineDeps {
  const deps = useContext(DeadlineDepsContext);
  if (!deps) {
    throw new Error('useDeadlineDeps must be used within a DeadlineDepsProvider');
  }
  return deps;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/ui/deadline-deps/deadline-deps-context.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/deadline-deps/deadline-deps-context.tsx src/ui/deadline-deps/deadline-deps-context.test.tsx
git commit -m "feat(add): DeadlineDepsProvider for factory id/clock injection"
```

---

### Task 7: `useCreateDeadline` (hook)

**Files:**
- Create: `src/ui/hooks/use-create-deadline.ts`
- Test: `src/ui/hooks/use-create-deadline.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import type { ReactNode } from 'react';
import { renderHook } from '@testing-library/react-native';
import { InMemoryDeadlineRepository } from '../../test-support/in-memory-deadline-repository';
import { RepositoryProvider } from '../repository/repository-context';
import { DeadlineDepsProvider } from '../deadline-deps/deadline-deps-context';
import { useCreateDeadline } from './use-create-deadline';

describe('useCreateDeadline', () => {
  it('builds a Deadline with injected id/clock and persists it', async () => {
    const repo = new InMemoryDeadlineRepository();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <RepositoryProvider repository={repo}>
        <DeadlineDepsProvider generateId={() => 'fixed-id'} clock={{ now: () => new Date(2026, 5, 8) }}>
          {children}
        </DeadlineDepsProvider>
      </RepositoryProvider>
    );
    const { result } = renderHook(() => useCreateDeadline(), { wrapper });

    const created = await result.current({
      type: 'ITV',
      title: 'ITV del coche',
      dueDate: new Date(2026, 8, 1),
      reminderDaysBefore: [30, 7],
    });

    expect(created.id).toBe('fixed-id');
    expect(created.createdAt).toEqual(new Date(2026, 5, 8));
    expect(created.status).toBe('ACTIVE');
    expect(await repo.findById('fixed-id')).toMatchObject({ id: 'fixed-id', title: 'ITV del coche' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/ui/hooks/use-create-deadline.test.tsx`
Expected: FAIL — cannot find module `./use-create-deadline`.

- [ ] **Step 3: Write minimal implementation**

```ts
import { useCallback } from 'react';
import { createDeadline, type CreateDeadlineInput } from '../../domain/deadline/deadline.factory';
import type { Deadline } from '../../domain/deadline/deadline.schema';
import { useDeadlineRepository } from '../repository/repository-context';
import { useDeadlineDeps } from '../deadline-deps/deadline-deps-context';

/** Returns a function that builds a Deadline via the domain factory (id/clock from
 *  DI) and persists it through the repository, returning the created entity. */
export function useCreateDeadline(): (input: CreateDeadlineInput) => Promise<Deadline> {
  const repository = useDeadlineRepository();
  const deps = useDeadlineDeps();
  return useCallback(
    async (input: CreateDeadlineInput) => {
      const deadline = createDeadline(input, deps);
      await repository.save(deadline);
      return deadline;
    },
    [repository, deps],
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/ui/hooks/use-create-deadline.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/hooks/use-create-deadline.ts src/ui/hooks/use-create-deadline.test.tsx
git commit -m "feat(add): useCreateDeadline hook (factory + save wiring)"
```

---

### Task 8: Add `disabled` to `Button`

**Files:**
- Modify: `src/ui/components/Button.tsx`
- Test: `src/ui/components/Button.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Button } from './Button';

describe('Button', () => {
  it('calls onPress when enabled', async () => {
    const onPress = jest.fn();
    await render(<Button label="Guardar" onPress={onPress} />);
    fireEvent.press(screen.getByText('Guardar'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', async () => {
    const onPress = jest.fn();
    await render(<Button label="Guardar" onPress={onPress} disabled />);
    fireEvent.press(screen.getByText('Guardar'));
    expect(onPress).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/ui/components/Button.test.tsx`
Expected: FAIL — the disabled case calls `onPress` (prop not yet supported).

- [ ] **Step 3: Modify the implementation**

Replace the contents of `src/ui/components/Button.tsx` with:

```tsx
import { Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fontSizes, radii, spacing } from '../theme';
import { AppText } from './AppText';

interface ButtonProps {
  label: string;
  onPress: () => void;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  disabled?: boolean;
}

/** Primary full-width blue CTA. Dimmed and inert when disabled. */
export function Button({ label, onPress, icon, disabled = false }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.root, disabled && styles.disabled, pressed && styles.pressed]}
    >
      <View style={styles.content}>
        {icon ? <MaterialCommunityIcons name={icon} size={20} color={colors.white} /> : null}
        <AppText weight="extrabold" size={fontSizes.body} color={colors.white}>
          {label}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.brandBlue,
    borderRadius: radii.button,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.85 },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/ui/components/Button.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/Button.tsx src/ui/components/Button.test.tsx
git commit -m "feat(add): support disabled state on Button"
```

---

### Task 9: `TypeSelector`

**Files:**
- Create: `src/ui/components/TypeSelector.tsx`
- Test: `src/ui/components/TypeSelector.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';
import { TypeSelector } from './TypeSelector';

describe('TypeSelector', () => {
  it('renders all nine type labels', async () => {
    await render(<TypeSelector value="OTHER" onChange={() => {}} />);
    for (const label of ['ITV', 'DNI', 'Pasaporte', 'Permiso', 'Seguro', 'Suscripción', 'Garantía', 'Gas', 'Otro']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it('calls onChange with the pressed type', async () => {
    const onChange = jest.fn();
    await render(<TypeSelector value="OTHER" onChange={onChange} />);
    fireEvent.press(screen.getByText('Seguro'));
    expect(onChange).toHaveBeenCalledWith('INSURANCE');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/ui/components/TypeSelector.test.tsx`
Expected: FAIL — cannot find module `./TypeSelector`.

- [ ] **Step 3: Write minimal implementation**

```tsx
import { Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DeadlineType, type DeadlineType as DeadlineTypeValue } from '../../domain/deadline/deadline.schema';
import { typeIcon } from '../deadline/type-icons';
import { typeLabel } from '../deadline/type-labels';
import { AppText } from './AppText';
import { colors, fontSizes, radii, spacing } from '../theme';

interface TypeSelectorProps {
  value: DeadlineTypeValue;
  onChange: (type: DeadlineTypeValue) => void;
}

/** Wrapping grid (3 per row) of icon+label chips; the active chip is brandBlue. */
export function TypeSelector({ value, onChange }: TypeSelectorProps) {
  return (
    <View style={styles.grid}>
      {DeadlineType.options.map((type) => {
        const selected = type === value;
        const tint = selected ? colors.white : colors.textSecondary;
        return (
          <Pressable
            key={type}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(type)}
            style={[styles.chip, selected && styles.chipSelected]}
          >
            <MaterialCommunityIcons name={typeIcon(type)} size={20} color={tint} />
            <AppText weight="bold" size={fontSizes.small} color={tint}>
              {typeLabel(type)}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    width: '31%',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radii.button,
    backgroundColor: colors.surfaceSoft,
  },
  chipSelected: { backgroundColor: colors.brandBlue },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/ui/components/TypeSelector.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/TypeSelector.tsx src/ui/components/TypeSelector.test.tsx
git commit -m "feat(add): TypeSelector grid component"
```

---

### Task 10: `ReminderChips`

**Files:**
- Create: `src/ui/components/ReminderChips.tsx`
- Test: `src/ui/components/ReminderChips.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ReminderChips } from './ReminderChips';

describe('ReminderChips', () => {
  it('renders 30/7/1 with day pluralization', async () => {
    await render(<ReminderChips value={[30, 7]} onChange={() => {}} />);
    expect(screen.getByText('30 días')).toBeTruthy();
    expect(screen.getByText('7 días')).toBeTruthy();
    expect(screen.getByText('1 día')).toBeTruthy();
  });

  it('adds a day when an unselected chip is pressed', async () => {
    const onChange = jest.fn();
    await render(<ReminderChips value={[30, 7]} onChange={onChange} />);
    fireEvent.press(screen.getByText('1 día'));
    expect(onChange).toHaveBeenCalledWith([30, 7, 1]);
  });

  it('removes a day when a selected chip is pressed', async () => {
    const onChange = jest.fn();
    await render(<ReminderChips value={[30, 7]} onChange={onChange} />);
    fireEvent.press(screen.getByText('30 días'));
    expect(onChange).toHaveBeenCalledWith([7]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/ui/components/ReminderChips.test.tsx`
Expected: FAIL — cannot find module `./ReminderChips`.

- [ ] **Step 3: Write minimal implementation**

```tsx
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { colors, fontSizes, radii, spacing } from '../theme';

const OPTIONS = [30, 7, 1] as const;

interface ReminderChipsProps {
  value: number[];
  onChange: (days: number[]) => void;
}

/** Multi-select chips for reminder lead days. Preserves the incoming order; the
 *  domain input is sorted later by toCreateInput. */
export function ReminderChips({ value, onChange }: ReminderChipsProps) {
  const toggle = (day: number) =>
    onChange(value.includes(day) ? value.filter((d) => d !== day) : [...value, day]);

  return (
    <View style={styles.row}>
      {OPTIONS.map((day) => {
        const selected = value.includes(day);
        return (
          <Pressable
            key={day}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => toggle(day)}
            style={[styles.chip, selected && styles.chipSelected]}
          >
            <AppText weight="bold" size={fontSizes.label} color={selected ? colors.white : colors.textSecondary}>
              {day} {day === 1 ? 'día' : 'días'}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceSoft,
  },
  chipSelected: { backgroundColor: colors.brandBlue },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/ui/components/ReminderChips.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/ReminderChips.tsx src/ui/components/ReminderChips.test.tsx
git commit -m "feat(add): ReminderChips multi-select component"
```

---

### Task 11: `FormField` (presentational, no dedicated test)

**Files:**
- Create: `src/ui/components/FormField.tsx`

FormField is a trivial presentational wrapper (label + control + optional hint),
following the repo convention of not unit-testing pure presentational components
(e.g. `Card`, `AppText`, `Loading`). It is exercised by the screen tests in Task 13.

- [ ] **Step 1: Write the implementation**

```tsx
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { colors, fontSizes, spacing } from '../theme';

interface FormFieldProps {
  label: string;
  /** Optional error/help line shown under the control, in the urgent color. */
  hint?: string;
  children: ReactNode;
}

/** Label + control + optional hint row. Layout only; holds no state. */
export function FormField({ label, hint, children }: FormFieldProps) {
  return (
    <View style={styles.root}>
      <AppText weight="bold" size={fontSizes.label} color={colors.textSecondary}>
        {label}
      </AppText>
      {children}
      {hint ? (
        <AppText weight="semibold" size={fontSizes.small} color={colors.urgency.urgent.base}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
});
```

- [ ] **Step 2: Verify it typechecks**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui/components/FormField.tsx
git commit -m "feat(add): FormField layout component"
```

---

### Task 12: `DatePickerField`

**Files:**
- Create: `src/ui/components/DatePickerField.tsx`
- Test: `src/ui/components/DatePickerField.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';
import { DatePickerField } from './DatePickerField';

describe('DatePickerField', () => {
  it('shows the formatted date and is closed initially', async () => {
    await render(<DatePickerField value={new Date(2026, 0, 1)} onChange={() => {}} />);
    expect(screen.getByText('1 ene 2026')).toBeTruthy();
    expect(screen.queryByTestId('datetimepicker')).toBeNull();
  });

  it('opens the picker on press and reports the chosen date', async () => {
    const onChange = jest.fn();
    await render(<DatePickerField value={new Date(2026, 0, 1)} onChange={onChange} />);
    fireEvent.press(screen.getByText('1 ene 2026'));
    const picker = screen.getByTestId('datetimepicker');
    fireEvent(picker, 'change', { type: 'set' }, new Date(2026, 1, 2));
    expect(onChange).toHaveBeenCalledWith(new Date(2026, 1, 2));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/ui/components/DatePickerField.test.tsx`
Expected: FAIL — cannot find module `./DatePickerField`.

- [ ] **Step 3: Write minimal implementation**

```tsx
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { formatDate } from '../deadline/format-date';
import { AppText } from './AppText';
import { colors, fontSizes, radii, spacing } from '../theme';

interface DatePickerFieldProps {
  value: Date;
  onChange: (date: Date) => void;
}

/** Tappable field that opens the native date picker (mode "date"). Reports only
 *  confirmed selections; dismissals leave the value unchanged. */
export function DatePickerField({ value, onChange }: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);

  const handleChange = (event: DateTimePickerEvent, selected?: Date) => {
    setOpen(false);
    if (event.type === 'set' && selected) onChange(selected);
  };

  return (
    <>
      <Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={styles.field}>
        <MaterialCommunityIcons name="calendar" size={18} color={colors.textSecondary} />
        <AppText weight="bold" size={fontSizes.body}>
          {formatDate(value)}
        </AppText>
      </Pressable>
      {open ? <DateTimePicker value={value} mode="date" onChange={handleChange} /> : null}
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

Run: `npm test -- src/ui/components/DatePickerField.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/DatePickerField.tsx src/ui/components/DatePickerField.test.tsx
git commit -m "feat(add): DatePickerField wrapping the native date picker"
```

---

### Task 13: `AddDeadlineScreen`

**Files:**
- Create: `src/ui/screens/AddDeadlineScreen.tsx`
- Test: `src/ui/screens/AddDeadlineScreen.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { InMemoryDeadlineRepository } from '../../test-support/in-memory-deadline-repository';
import { RepositoryProvider } from '../repository/repository-context';
import { DeadlineDepsProvider } from '../deadline-deps/deadline-deps-context';
import { AddDeadlineScreen } from './AddDeadlineScreen';

function renderScreen(repo: InMemoryDeadlineRepository, onClose: () => void = () => {}) {
  return render(
    <RepositoryProvider repository={repo}>
      <DeadlineDepsProvider generateId={() => 'fixed-id'} clock={{ now: () => new Date(2026, 5, 8) }}>
        <AddDeadlineScreen onClose={onClose} />
      </DeadlineDepsProvider>
    </RepositoryProvider>,
  );
}

describe('AddDeadlineScreen', () => {
  it('fills the form and saves: persists the deadline and closes (integration)', async () => {
    const repo = new InMemoryDeadlineRepository();
    const onClose = jest.fn();
    await renderScreen(repo, onClose);

    fireEvent.changeText(screen.getByPlaceholderText('Ej. ITV del coche'), 'Pasaporte de Ana');
    fireEvent.press(screen.getByText('Pasaporte'));
    fireEvent.press(screen.getByText('Guardar'));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    const saved = await repo.findById('fixed-id');
    expect(saved).toMatchObject({
      id: 'fixed-id',
      type: 'PASSPORT',
      title: 'Pasaporte de Ana',
      subtitle: 'Documento para viajar fuera de la UE',
      status: 'ACTIVE',
    });
    expect(saved?.dueDate).toEqual(new Date(2026, 5, 8));
    expect(saved?.createdAt).toEqual(new Date(2026, 5, 8));
    expect(saved?.reminderDaysBefore).toEqual([7, 30]);
  });

  it('does not save and shows a hint when the title is empty', async () => {
    const repo = new InMemoryDeadlineRepository();
    const onClose = jest.fn();
    await renderScreen(repo, onClose);

    // Touch the title field and leave it empty to reveal the hint.
    const title = screen.getByPlaceholderText('Ej. ITV del coche');
    fireEvent.changeText(title, 'algo');
    fireEvent.changeText(title, '');

    expect(screen.getByText('Ponle un nombre')).toBeTruthy();
    fireEvent.press(screen.getByText('Guardar')); // disabled → no-op
    expect(onClose).not.toHaveBeenCalled();
    expect(await repo.list()).toHaveLength(0);
  });

  it('keeps the form open and alerts when saving fails', async () => {
    const repo = new InMemoryDeadlineRepository();
    jest.spyOn(repo, 'save').mockRejectedValue(new Error('disk'));
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const onClose = jest.fn();
    await renderScreen(repo, onClose);

    fireEvent.changeText(screen.getByPlaceholderText('Ej. ITV del coche'), 'ITV del coche');
    fireEvent.press(screen.getByText('Guardar'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/ui/screens/AddDeadlineScreen.test.tsx`
Expected: FAIL — cannot find module `./AddDeadlineScreen`.

- [ ] **Step 3: Write minimal implementation**

```tsx
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { DeadlineType } from '../../domain/deadline/deadline.schema';
import { startOfDay } from '../../domain/shared/date';
import { defaultSubtitle } from '../deadline/default-subtitle';
import { syncSubtitle } from '../deadline/subtitle-sync';
import { toCreateInput, validateAddForm, type AddFormState } from '../deadline/add-form';
import { useCreateDeadline } from '../hooks/use-create-deadline';
import { useDeadlineDeps } from '../deadline-deps/deadline-deps-context';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { DatePickerField } from '../components/DatePickerField';
import { FormField } from '../components/FormField';
import { ReminderChips } from '../components/ReminderChips';
import { TypeSelector } from '../components/TypeSelector';
import { colors, fontSizes, radii, spacing } from '../theme';

interface AddDeadlineScreenProps {
  onClose: () => void;
}

/** Manual add-a-deadline form. Builds a Deadline via the factory and persists it. */
export function AddDeadlineScreen({ onClose }: AddDeadlineScreenProps) {
  const deps = useDeadlineDeps();
  const createDeadline = useCreateDeadline();
  const insets = useSafeAreaInsets();

  const [state, setState] = useState<AddFormState>(() => ({
    type: 'OTHER',
    title: '',
    subtitle: defaultSubtitle('OTHER'),
    subtitleTouched: false,
    dueDate: startOfDay(deps.clock.now()),
    amount: '',
    reminderDaysBefore: [30, 7],
  }));
  const [titleTouched, setTitleTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  const { valid, errors } = validateAddForm(state);
  const titleHint = titleTouched ? errors.title : undefined;

  const onChangeType = (type: DeadlineType) =>
    setState((s) => ({ ...s, type, subtitle: syncSubtitle({ type, current: s.subtitle, touched: s.subtitleTouched }) }));

  const onChangeTitle = (title: string) => {
    setTitleTouched(true);
    setState((s) => ({ ...s, title }));
  };

  const onChangeSubtitle = (subtitle: string) =>
    setState((s) => ({ ...s, subtitle, subtitleTouched: true }));

  const onSave = async () => {
    if (!valid || saving) return;
    setSaving(true);
    try {
      await createDeadline(toCreateInput(state));
      onClose();
    } catch {
      Alert.alert('No se pudo guardar', 'Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.handle, { marginTop: insets.top + spacing.sm }]} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: spacing.xxxl + insets.bottom }]}>
        <AppText weight="extrabold" size={fontSizes.title}>
          Añadir un vencimiento
        </AppText>

        <FormField label="Tipo">
          <TypeSelector value={state.type} onChange={onChangeType} />
        </FormField>

        <FormField label="Título" hint={titleHint}>
          <TextInput
            placeholder="Ej. ITV del coche"
            placeholderTextColor={colors.textFaint}
            value={state.title}
            onChangeText={onChangeTitle}
            style={styles.input}
          />
        </FormField>

        <FormField label="Subtítulo">
          <TextInput
            placeholder={defaultSubtitle(state.type)}
            placeholderTextColor={colors.textFaint}
            value={state.subtitle}
            onChangeText={onChangeSubtitle}
            style={styles.input}
          />
        </FormField>

        <FormField label="Fecha clave">
          <DatePickerField value={state.dueDate} onChange={(dueDate) => setState((s) => ({ ...s, dueDate }))} />
        </FormField>

        <FormField label="Importe (€)">
          <TextInput
            placeholder="0,00"
            placeholderTextColor={colors.textFaint}
            value={state.amount}
            onChangeText={(amount) => setState((s) => ({ ...s, amount }))}
            keyboardType="decimal-pad"
            style={styles.input}
          />
        </FormField>

        <FormField label="Avisarme">
          <ReminderChips
            value={state.reminderDaysBefore}
            onChange={(reminderDaysBefore) => setState((s) => ({ ...s, reminderDaysBefore }))}
          />
        </FormField>

        <Button label="Guardar" onPress={onSave} disabled={!valid || saving} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.screenBg, borderTopLeftRadius: radii.card, borderTopRightRadius: radii.card },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: radii.pill, backgroundColor: colors.textFaint, opacity: 0.4 },
  content: { padding: spacing.xl, gap: spacing.lg },
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/ui/screens/AddDeadlineScreen.test.tsx`
Expected: PASS (all three cases).

- [ ] **Step 5: Commit**

```bash
git add src/ui/screens/AddDeadlineScreen.tsx src/ui/screens/AddDeadlineScreen.test.tsx
git commit -m "feat(add): AddDeadlineScreen manual form with validation and save"
```

---

### Task 14: Wire the route and provider

**Files:**
- Modify: `app/_layout.tsx`
- Modify: `app/add.tsx`

- [ ] **Step 1: Wrap the tree in `DeadlineDepsProvider`**

In `app/_layout.tsx`, add the import and nest the provider inside `RepositoryProvider`:

```tsx
import { RepositoryProvider } from '../src/ui/repository/repository-context';
import { DeadlineDepsProvider } from '../src/ui/deadline-deps/deadline-deps-context';
```

Replace the provider/Stack block in the returned JSX with:

```tsx
    <SafeAreaProvider>
      <RepositoryProvider>
        <DeadlineDepsProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="add" options={{ presentation: 'modal' }} />
            <Stack.Screen name="deadline/[id]" options={{ presentation: 'modal' }} />
          </Stack>
        </DeadlineDepsProvider>
      </RepositoryProvider>
    </SafeAreaProvider>
```

- [ ] **Step 2: Replace the `app/add.tsx` placeholder**

Replace the entire file with:

```tsx
import { useRouter } from 'expo-router';
import { AddDeadlineScreen } from '../src/ui/screens/AddDeadlineScreen';

export default function AddDeadlineRoute() {
  const router = useRouter();
  return <AddDeadlineScreen onClose={() => router.back()} />;
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/_layout.tsx app/add.tsx
git commit -m "feat(add): mount DeadlineDepsProvider and wire the add route"
```

---

### Task 15: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the whole test suite**

Run: `npm test`
Expected: PASS — all previous 111 tests plus the new ones green.

- [ ] **Step 2: Typecheck the project**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit (only if anything was adjusted during verification)**

```bash
git add -A
git commit -m "chore(add): finalize manual add-deadline flow"
```

---

## Self-review notes

- **Spec coverage:** DI provider (Task 6), useCreateDeadline (Task 7), pure type labels (Task 2), default subtitles (Task 3), subtitle sync (Task 4), validation + mapping (Task 5), TypeSelector/ReminderChips/FormField/DatePickerField (Tasks 9–12), screen with disabled+hint and save-failure handling (Task 13), route + provider wiring (Task 14), datetimepicker install + mock (Task 1). All spec sections map to a task.
- **Type consistency:** `AddFormState` (Task 5) is consumed unchanged by the screen (Task 13). `useCreateDeadline()` signature `(input: CreateDeadlineInput) => Promise<Deadline>` matches between Task 7 and Task 13. `DeadlineDeps { generateId, clock }` matches between Task 6 and Task 7. `Button` gains `disabled?` in Task 8 before the screen uses it in Task 13.
- **Determinism:** the form's default `dueDate` comes from the injected `clock`, so the integration test asserts `dueDate`/`createdAt` without driving the native picker.
- **Out of scope honored:** no camera/OCR, no chooser screen, no `recurrenceMonths` input, no settings/notifications, no iOS-specific work.

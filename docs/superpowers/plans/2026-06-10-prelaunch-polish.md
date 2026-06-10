# Pre-launch polish (block 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three pre-launch polish items — remove the dev seed, split the empty state into "first use" vs "all caught up", and add a non-blocking empty-plan hint in the add form.

**Architecture:** Hexagonal, reusing existing units. No new domain models or ports. The planner's DST-safe fire-time math is extracted into one pure helper (`reminderFireTimes`) shared by `buildNotificationPlan` and the add-form hint detector. The empty-state variant is data-driven: `useDeadlines` exposes a raw `storedCount`, the home picks the variant, `EmptyState` stays presentational.

**Tech Stack:** Expo SDK 56, React Native 0.85, Jest + @testing-library/react-native (async/concurrent RNTL), TZ=Europe/Madrid.

---

## Notes for the implementer

- Tests run only under `src/` (jest `roots`) with `TZ=Europe/Madrid` (the `npm test` script sets TZ). Run one file with `npm test -- <path>`. Typecheck: `npm run typecheck`.
- **RNTL is async/concurrent:** `await render(...)` / `await renderHook(...)`; make the first query after a render an awaited `findBy*`; await a `findBy*` after each state-changing `fireEvent` before the next interaction.
- Code/identifiers/comments/commits in English (user-facing strings in Spanish — keep them). NEVER add `Co-Authored-By` trailers.
- Theme tokens from `'../theme'`: `colors.urgency.upcoming.base`, `colors.urgency.calm.base`, `colors.textMuted`, `colors.brandBlue`, `colors.white`; `fontSizes.small`/`body`/`h1`; `spacing.*`.

## File structure

Modified:
- `src/ui/repository/repository-context.tsx` — drop the dev seed import + call.
- `src/ui/hooks/use-deadlines.ts` (+ test) — expose `storedCount`.
- `src/ui/notification/build-notification-plan.ts` — consume the extracted fire-time helper.
- `src/ui/components/EmptyState.tsx` (+ test) — `variant` prop.
- `src/ui/screens/HomeScreen.tsx` (+ test) — pick the variant from data.
- `src/ui/screens/AddDeadlineScreen.tsx` (+ test) — empty-plan hint.

Created:
- `src/ui/notification/reminder-fire-times.ts` (+ test) — `reminderFireTimes` + `remindersAllInPast`.

Deleted:
- `src/infrastructure/dev/seed-deadlines.ts`.

---

### Task 1: Remove the `__DEV__` seed

**Files:**
- Modify: `src/ui/repository/repository-context.tsx`
- Delete: `src/infrastructure/dev/seed-deadlines.ts`

No new test (a removal). The existing suite — which injects repositories and never relies on the seed — must stay green.

- [ ] **Step 1: Edit `repository-context.tsx`**

Remove the import line:

```tsx
import { seedDeadlinesIfEmpty } from '../../infrastructure/dev/seed-deadlines';
```

And change the no-prop build branch from:

```tsx
    void (async () => {
      const repo = await createDeadlineRepository();
      await seedDeadlinesIfEmpty(repo);
      if (!cancelled) setBuilt(repo);
    })();
```

to:

```tsx
    void (async () => {
      const repo = await createDeadlineRepository();
      if (!cancelled) setBuilt(repo);
    })();
```

- [ ] **Step 2: Delete the seed file**

```bash
git rm src/infrastructure/dev/seed-deadlines.ts
```

- [ ] **Step 3: Typecheck and run the full suite**

Run: `npm run typecheck`
Expected: no errors (nothing else imports `seed-deadlines`).

Run: `npm test`
Expected: PASS — no regressions.

- [ ] **Step 4: Commit**

```bash
git add src/ui/repository/repository-context.tsx
git commit -m "chore: remove the temporary __DEV__ deadline seed"
```

---

### Task 2: `useDeadlines` exposes `storedCount`

**Files:**
- Modify: `src/ui/hooks/use-deadlines.ts`
- Test: `src/ui/hooks/use-deadlines.test.tsx`

- [ ] **Step 1: Add the failing test**

Append this `it` inside the existing `describe('useDeadlines', ...)` in `use-deadlines.test.tsx`:

```tsx
  it('exposes storedCount including resolved/cancelled deadlines', async () => {
    const repo = new InMemoryDeadlineRepository([
      buildDeadline({ id: 'a', status: 'RESOLVED' }),
      buildDeadline({ id: 'b', status: 'CANCELLED' }),
    ]);
    const { result } = await renderHook(() => useDeadlines(), { wrapper: wrapper(repo) });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.storedCount).toBe(2);
    expect(result.current.groups.NEEDS_ATTENTION).toHaveLength(0); // both excluded from groups
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/ui/hooks/use-deadlines.test.tsx`
Expected: FAIL — `result.current.storedCount` is `undefined` (TS would also flag it).

- [ ] **Step 3: Update the hook**

In `src/ui/hooks/use-deadlines.ts`, add `storedCount` to the result interface:

```ts
export interface UseDeadlinesResult {
  status: DeadlinesStatus;
  groups: GroupedDeadlines;
  today: Date;
  /** Number of deadlines stored, all statuses (0 while loading). Lets the home tell
   *  "first use" (empty store) apart from "all caught up" (stored but none active). */
  storedCount: number;
  error: unknown;
  refresh: () => Promise<void>;
}
```

And include it in the returned object (the list already holds every status):

```ts
  return { status, groups, today, storedCount: list.length, error, refresh };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/ui/hooks/use-deadlines.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/hooks/use-deadlines.ts src/ui/hooks/use-deadlines.test.tsx
git commit -m "feat(home): expose storedCount from useDeadlines"
```

---

### Task 3: Extract `reminderFireTimes` and refactor the planner

**Files:**
- Create: `src/ui/notification/reminder-fire-times.ts`
- Test: `src/ui/notification/reminder-fire-times.test.ts`
- Modify: `src/ui/notification/build-notification-plan.ts`

- [ ] **Step 1: Write the failing test**

`src/ui/notification/reminder-fire-times.test.ts`:

```ts
import { reminderFireTimes } from './reminder-fire-times';
import { DEFAULT_REMINDER_TIME } from './reminder-time';

describe('reminderFireTimes', () => {
  it('returns one local fire-time per reminder, in order, at the reminder time', () => {
    const times = reminderFireTimes(new Date(2026, 8, 1), [7, 30], DEFAULT_REMINDER_TIME);
    expect(times).toEqual([new Date(2026, 7, 25, 9, 0), new Date(2026, 7, 2, 9, 0)]);
  });

  it('builds from local components (DST-safe across the Madrid autumn change)', () => {
    // Madrid falls back on 25 Oct 2026. Due 26 Oct, 7 days before = 19 Oct, still 09:00.
    const [t] = reminderFireTimes(new Date(2026, 9, 26), [7], DEFAULT_REMINDER_TIME);
    expect([t.getFullYear(), t.getMonth(), t.getDate(), t.getHours(), t.getMinutes()]).toEqual([2026, 9, 19, 9, 0]);
  });

  it('returns an empty array when there are no reminders', () => {
    expect(reminderFireTimes(new Date(2026, 8, 1), [], DEFAULT_REMINDER_TIME)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/ui/notification/reminder-fire-times.test.ts`
Expected: FAIL — cannot find module `./reminder-fire-times`.

- [ ] **Step 3: Write the helper**

`src/ui/notification/reminder-fire-times.ts`:

```ts
import type { ReminderTime } from './reminder-time';

/** Pure: the local fire-time for each reminderDaysBefore, in the same order. DST-safe —
 *  built from the due date's LOCAL components + the wall-clock reminder time (no ms
 *  arithmetic), so DST shifts between now and the due date never skew it. Single source
 *  of this math: shared by the notification planner and the add-form empty-plan hint. */
export function reminderFireTimes(
  dueDate: Date,
  reminderDaysBefore: number[],
  reminderTime: ReminderTime,
): Date[] {
  return reminderDaysBefore.map(
    (daysBefore) =>
      new Date(
        dueDate.getFullYear(),
        dueDate.getMonth(),
        dueDate.getDate() - daysBefore,
        reminderTime.hour,
        reminderTime.minute,
      ),
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/ui/notification/reminder-fire-times.test.ts`
Expected: PASS.

- [ ] **Step 5: Refactor `build-notification-plan.ts` to use it**

Replace the entire contents of `src/ui/notification/build-notification-plan.ts` with:

```ts
import type { Deadline } from '../../domain/deadline/deadline.schema';
import type { PlannedNotification } from '../../ports/notification-scheduler';
import { buildNotificationContent } from './build-notification-content';
import { reminderFireTimes } from './reminder-fire-times';
import type { ReminderTime } from './reminder-time';

export interface BuildPlanOptions {
  now: Date;
  reminderTime: ReminderTime;
}

/** Pure: resolves each reminderDaysBefore into a fully-formed notification, dropping any
 *  whose fire time is already at/before `now`. Fire times come from reminderFireTimes
 *  (DST-safe local-component math), shared with the add-form empty-plan hint. */
export function buildNotificationPlan(
  deadline: Deadline,
  options: BuildPlanOptions,
): PlannedNotification[] {
  const fireTimes = reminderFireTimes(deadline.dueDate, deadline.reminderDaysBefore, options.reminderTime);
  const plan: PlannedNotification[] = [];
  deadline.reminderDaysBefore.forEach((daysBefore, index) => {
    const fireAt = fireTimes[index];
    if (fireAt.getTime() <= options.now.getTime()) return;
    plan.push({ fireAt, ...buildNotificationContent(deadline, daysBefore) });
  });
  return plan;
}
```

- [ ] **Step 6: Run the planner tests to confirm no behavior change**

Run: `npm test -- src/ui/notification/build-notification-plan.test.ts src/ui/notification/reminder-fire-times.test.ts`
Expected: PASS (planner output unchanged; new helper green).

- [ ] **Step 7: Commit**

```bash
git add src/ui/notification/reminder-fire-times.ts src/ui/notification/reminder-fire-times.test.ts src/ui/notification/build-notification-plan.ts
git commit -m "refactor(notifications): extract reminderFireTimes shared by the planner"
```

---

### Task 4: `remindersAllInPast` detector

**Files:**
- Modify: `src/ui/notification/reminder-fire-times.ts`
- Test: `src/ui/notification/reminder-fire-times.test.ts`

- [ ] **Step 1: Add the failing test**

Append to `src/ui/notification/reminder-fire-times.test.ts` (extend the existing import to also pull in `remindersAllInPast`: `import { reminderFireTimes, remindersAllInPast } from './reminder-fire-times';`):

```ts
describe('remindersAllInPast', () => {
  const reminderTime = DEFAULT_REMINDER_TIME;

  it('is false when at least one reminder still fires in the future', () => {
    expect(remindersAllInPast(new Date(2026, 8, 1), [7, 30], new Date(2026, 5, 8), reminderTime)).toBe(false);
  });

  it('is true when every selected reminder already fired', () => {
    // Due 9 Jun; 30- and 7-day reminders fire 10 May / 2 Jun 09:00 — both before now (8 Jun).
    expect(remindersAllInPast(new Date(2026, 5, 9), [30, 7], new Date(2026, 5, 8), reminderTime)).toBe(true);
  });

  it('is false when no reminders are selected (deliberate choice, not "passed")', () => {
    expect(remindersAllInPast(new Date(2026, 5, 9), [], new Date(2026, 5, 8), reminderTime)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/ui/notification/reminder-fire-times.test.ts`
Expected: FAIL — `remindersAllInPast` is not exported.

- [ ] **Step 3: Add the detector**

Append to `src/ui/notification/reminder-fire-times.ts`:

```ts
/** True iff at least one reminder is selected AND every one fires at/before `now` — i.e.
 *  for this date the user's reminders would all be in the past, producing no future alert.
 *  No reminders selected → false (a deliberate choice, not a "passed" case). */
export function remindersAllInPast(
  dueDate: Date,
  reminderDaysBefore: number[],
  now: Date,
  reminderTime: ReminderTime,
): boolean {
  if (reminderDaysBefore.length === 0) return false;
  return reminderFireTimes(dueDate, reminderDaysBefore, reminderTime).every(
    (fireAt) => fireAt.getTime() <= now.getTime(),
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/ui/notification/reminder-fire-times.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/notification/reminder-fire-times.ts src/ui/notification/reminder-fire-times.test.ts
git commit -m "feat(notifications): remindersAllInPast detector for the empty-plan hint"
```

---

### Task 5: `EmptyState` variant prop

**Files:**
- Modify: `src/ui/components/EmptyState.tsx`
- Test: `src/ui/components/EmptyState.test.tsx`

- [ ] **Step 1: Replace the test file**

Replace the entire contents of `src/ui/components/EmptyState.test.tsx` with:

```tsx
import { render, screen, fireEvent } from '@testing-library/react-native';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  describe('first-use variant', () => {
    it('shows the welcome headline, first-time CTA and privacy line', async () => {
      await render(<EmptyState variant="first-use" onAdd={() => {}} onOpenSettings={() => {}} />);
      expect(screen.getByText('Aquí no se te pasará nada')).toBeTruthy();
      expect(screen.getByText('Añadir mi primer vencimiento')).toBeTruthy();
      expect(screen.getByText('Se lee en tu móvil. Nada se sube a internet.')).toBeTruthy();
    });

    it('calls onAdd when the button is pressed', async () => {
      const onAdd = jest.fn();
      await render(<EmptyState variant="first-use" onAdd={onAdd} onOpenSettings={() => {}} />);
      fireEvent.press(screen.getByText('Añadir mi primer vencimiento'));
      expect(onAdd).toHaveBeenCalledTimes(1);
    });

    it('renders a settings gear that calls onOpenSettings', async () => {
      const onOpenSettings = jest.fn();
      await render(<EmptyState variant="first-use" onAdd={() => {}} onOpenSettings={onOpenSettings} />);
      fireEvent.press(screen.getByLabelText('Ajustes'));
      expect(onOpenSettings).toHaveBeenCalledTimes(1);
    });
  });

  describe('all-caught-up variant', () => {
    it('shows the reassuring copy and the generic CTA, without the privacy line', async () => {
      await render(<EmptyState variant="all-caught-up" onAdd={() => {}} onOpenSettings={() => {}} />);
      expect(screen.getByText('Todo en orden')).toBeTruthy();
      expect(
        screen.getByText('No tienes vencimientos pendientes. Te avisaremos cuando se acerque alguno.'),
      ).toBeTruthy();
      expect(screen.getByText('Añadir un vencimiento')).toBeTruthy();
      expect(screen.queryByText('Se lee en tu móvil. Nada se sube a internet.')).toBeNull();
    });

    it('keeps the settings gear', async () => {
      const onOpenSettings = jest.fn();
      await render(<EmptyState variant="all-caught-up" onAdd={() => {}} onOpenSettings={onOpenSettings} />);
      fireEvent.press(screen.getByLabelText('Ajustes'));
      expect(onOpenSettings).toHaveBeenCalledTimes(1);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/ui/components/EmptyState.test.tsx`
Expected: FAIL — `variant` not a prop / "Todo en orden" not found.

- [ ] **Step 3: Update `EmptyState.tsx`**

Replace the entire contents of `src/ui/components/EmptyState.tsx` with:

```tsx
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fontSizes, radii, spacing } from '../theme';
import { AppText } from './AppText';
import { Button } from './Button';

type EmptyStateVariant = 'first-use' | 'all-caught-up';

interface EmptyStateProps {
  variant: EmptyStateVariant;
  onAdd: () => void;
  onOpenSettings: () => void;
}

const COPY: Record<EmptyStateVariant, { headline: string; support: string; cta: string }> = {
  'first-use': {
    headline: 'Aquí no se te pasará nada',
    support:
      'Guarda tus documentos y fechas importantes —DNI, ITV, seguros, suscripciones— y te avisamos antes de que caduquen.',
    cta: 'Añadir mi primer vencimiento',
  },
  'all-caught-up': {
    headline: 'Todo en orden',
    support: 'No tienes vencimientos pendientes. Te avisaremos cuando se acerque alguno.',
    cta: 'Añadir un vencimiento',
  },
};

/**
 * Empty state with two data-driven variants:
 * - 'first-use': nothing stored yet (matches docs/design/Primer uso.png).
 * - 'all-caught-up': deadlines exist but none are active (all resolved/cancelled).
 * The home picks the variant from data; this component is presentational. Both keep the
 * settings gear so the user is never stranded with no way back to settings.
 */
export function EmptyState({ variant, onAdd, onOpenSettings }: EmptyStateProps) {
  const insets = useSafeAreaInsets();
  const copy = COPY[variant];
  const isFirstUse = variant === 'first-use';
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

      <View style={styles.center}>
        {isFirstUse ? (
          <View style={styles.illustration}>
            <View style={styles.iconCircle}>
              <MaterialCommunityIcons name="calendar-blank" size={48} color={colors.brandBlue} />
            </View>
            <View style={[styles.badge, styles.badgeCheck]}>
              <MaterialCommunityIcons name="check" size={16} color={colors.white} />
            </View>
            <View style={[styles.badge, styles.badgeDoc]}>
              <MaterialCommunityIcons name="file-document-outline" size={18} color={colors.urgency.upcoming.base} />
            </View>
            <View style={[styles.badge, styles.badgeShield]}>
              <MaterialCommunityIcons name="shield-check" size={18} color={colors.urgency.urgent.base} />
            </View>
          </View>
        ) : (
          <View style={styles.illustration}>
            <View style={styles.iconCircle}>
              <MaterialCommunityIcons name="calendar-check" size={48} color={colors.urgency.calm.base} />
            </View>
          </View>
        )}

        <AppText weight="black" size={fontSizes.h1} style={styles.headline}>
          {copy.headline}
        </AppText>
        <AppText weight="semibold" size={fontSizes.body} color={colors.textMuted} style={styles.support}>
          {copy.support}
        </AppText>
      </View>

      <View style={styles.footer}>
        <Button label={copy.cta} icon="plus" onPress={onAdd} />
        {isFirstUse ? (
          <View style={styles.privacy}>
            <MaterialCommunityIcons name="lock-outline" size={14} color={colors.urgency.calm.base} />
            <AppText weight="semibold" size={fontSizes.small} color={colors.urgency.calm.base}>
              Se lee en tu móvil. Nada se sube a internet.
            </AppText>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.screenBg, padding: spacing.xl },
  wordmark: { textAlign: 'center', letterSpacing: 0.5, marginTop: spacing.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  illustration: { width: 160, height: 160, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  iconCircle: {
    width: 120, height: 120, borderRadius: radii.pill,
    backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center',
  },
  badge: { position: 'absolute', alignItems: 'center', justifyContent: 'center', borderRadius: radii.icon },
  badgeCheck: { width: 28, height: 28, borderRadius: radii.pill, backgroundColor: colors.urgency.calm.base, top: 22, right: 28 },
  badgeDoc: { width: 40, height: 40, backgroundColor: colors.urgency.upcoming.tintBg, top: 14, left: 16 },
  badgeShield: { width: 40, height: 40, backgroundColor: colors.urgency.urgent.tintBg, bottom: 22, right: 12 },
  headline: { textAlign: 'center' },
  support: { textAlign: 'center', lineHeight: 24, paddingHorizontal: spacing.lg },
  footer: { gap: spacing.md },
  privacy: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  settingsButton: { position: 'absolute', right: spacing.xl, zIndex: 1 },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/ui/components/EmptyState.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/EmptyState.tsx src/ui/components/EmptyState.test.tsx
git commit -m "feat(home): EmptyState first-use vs all-caught-up variants"
```

---

### Task 6: `HomeScreen` picks the variant

**Files:**
- Modify: `src/ui/screens/HomeScreen.tsx`
- Test: `src/ui/screens/HomeScreen.test.tsx`

- [ ] **Step 1: Add the failing test**

Append this `it` inside the existing `describe('HomeScreen (integration)', ...)` in `HomeScreen.test.tsx`:

```tsx
  it('shows the "all caught up" state when every deadline is resolved or cancelled', async () => {
    const repo = new InMemoryDeadlineRepository([
      buildDeadline({ id: '1', status: 'RESOLVED' }),
      buildDeadline({ id: '2', status: 'CANCELLED' }),
    ]);

    await render(
      <RepositoryProvider repository={repo}>
        <HomeScreen onOpenDeadline={() => {}} onAdd={() => {}} onOpenSettings={() => {}} />
      </RepositoryProvider>,
    );

    await waitFor(() => expect(screen.getByText('Todo en orden')).toBeTruthy());
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/ui/screens/HomeScreen.test.tsx`
Expected: FAIL — with resolved/cancelled deadlines the current code renders the single
EmptyState ("Aquí no se te pasará nada"), so "Todo en orden" is not found.

- [ ] **Step 3: Update `HomeScreen.tsx`**

In `src/ui/screens/HomeScreen.tsx`, destructure `storedCount` and replace the empty/list
decision. The `loading`/`error` guards stay ABOVE this branch (unchanged), so a cold start
with saved data never evaluates the empty branch while `storedCount` is still 0.

Change the destructure:

```tsx
  const { status, groups, today, storedCount, refresh } = useDeadlines();
```

Replace the final empty/list block (the `const total = ...; if (total === 0) ...; return <DeadlineList .../>;`) with:

```tsx
  const activeTotal = groups.NEEDS_ATTENTION.length + groups.UPCOMING.length + groups.CALM.length;
  if (activeTotal === 0) {
    const variant = storedCount === 0 ? 'first-use' : 'all-caught-up';
    return <EmptyState variant={variant} onAdd={onAdd} onOpenSettings={onOpenSettings} />;
  }

  return <DeadlineList groups={groups} today={today} onPressRow={onOpenDeadline} onAdd={onAdd} onOpenSettings={onOpenSettings} />;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/ui/screens/HomeScreen.test.tsx`
Expected: PASS — the new all-caught-up case plus the existing cases (empty repo still shows
first-use "Aquí no se te pasará nada"; the error-recovery test retries to an empty list →
first-use; the populated cases render the list).

- [ ] **Step 5: Commit**

```bash
git add src/ui/screens/HomeScreen.tsx src/ui/screens/HomeScreen.test.tsx
git commit -m "feat(home): pick first-use vs all-caught-up empty state from data"
```

---

### Task 7: Empty-plan hint in the add form

**Files:**
- Modify: `src/ui/screens/AddDeadlineScreen.tsx`
- Test: `src/ui/screens/AddDeadlineScreen.test.tsx`

- [ ] **Step 1: Add the failing tests**

Append these two `it`s inside the existing `describe('AddDeadlineScreen', ...)` in
`AddDeadlineScreen.test.tsx`. (The harness clock is `new Date(2026, 5, 8)` and the form's
default date is that day with the default reminders `[30, 7]`, so every fire time is already
in the past — the hint shows by default.)

```tsx
  it('shows the empty-plan hint for an unreachable date and still allows saving', async () => {
    const repo = new InMemoryDeadlineRepository();
    const onClose = jest.fn();
    await renderScreen(repo, onClose);

    const titleInput = await screen.findByPlaceholderText('Ej. ITV del coche');
    fireEvent.changeText(titleInput, 'ITV del coche');
    await screen.findByDisplayValue('ITV del coche');

    expect(screen.getByText(/tus avisos ya han pasado/)).toBeTruthy();

    // Non-blocking: saving still works despite the hint.
    fireEvent.press(screen.getByText('Guardar'));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(await repo.findById('fixed-id')).not.toBeNull();
  });

  it('hides the empty-plan hint when no reminders are selected', async () => {
    const repo = new InMemoryDeadlineRepository();
    await renderScreen(repo);
    await screen.findByPlaceholderText('Ej. ITV del coche');

    expect(screen.getByText(/tus avisos ya han pasado/)).toBeTruthy(); // default today + [30, 7]

    fireEvent.press(screen.getByText('30 días')); // deselect 30 → [7] (still all past)
    await screen.findByText(/tus avisos ya han pasado/);
    fireEvent.press(screen.getByText('7 días')); // deselect 7 → [] (no reminders)

    await waitFor(() => expect(screen.queryByText(/tus avisos ya han pasado/)).toBeNull());
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/ui/screens/AddDeadlineScreen.test.tsx`
Expected: FAIL — the hint text `/tus avisos ya han pasado/` is not rendered yet.

- [ ] **Step 3: Update `AddDeadlineScreen.tsx`**

Add two imports (after the existing imports):

```tsx
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { remindersAllInPast } from '../notification/reminder-fire-times';
```

Compute the hint flag after the `validateAddForm` line (near `const titleHint = ...`):

```tsx
  const showPastHint = remindersAllInPast(
    state.dueDate,
    state.reminderDaysBefore,
    deps.clock.now(),
    settings.reminderTime,
  );
```

Render the hint immediately AFTER the `FormField label="Avisarme"` block (between it and
the `<Button label="Guardar" ... />`):

```tsx
        {showPastHint ? (
          <View style={styles.pastHint}>
            <MaterialCommunityIcons name="clock-alert-outline" size={16} color={colors.urgency.upcoming.base} />
            <AppText weight="semibold" size={fontSizes.small} color={colors.urgency.upcoming.base} style={styles.pastHintText}>
              Para esta fecha, tus avisos ya han pasado. Puedes guardarlo igualmente o acercar la fecha.
            </AppText>
          </View>
        ) : null}
```

Add the two styles to the `StyleSheet.create({...})`:

```tsx
  pastHint: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  pastHintText: { flex: 1 },
```

(Do NOT change the Guardar button — its `disabled={!valid}` stays as-is, so the hint never
blocks saving.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/ui/screens/AddDeadlineScreen.test.tsx`
Expected: PASS (the two new cases plus all existing cases).

- [ ] **Step 5: Commit**

```bash
git add src/ui/screens/AddDeadlineScreen.tsx src/ui/screens/AddDeadlineScreen.test.tsx
git commit -m "feat(add): non-blocking hint when reminders would all be in the past"
```

---

### Task 8: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the whole test suite**

Run: `npm test`
Expected: PASS — all previous tests plus the new ones green.

- [ ] **Step 2: Typecheck the project**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Confirm the bundle builds**

Run: `npx expo export --platform android`
Expected: exports `dist/` with no resolution errors (note: nothing should reference the
deleted `seed-deadlines`). Then delete the artifact: `rm -rf dist`.

- [ ] **Step 4: Commit (only if anything was adjusted during verification)**

```bash
git add -A
git commit -m "chore(polish): finalize pre-launch polish block 1"
```

---

## Self-review notes

- **Spec coverage:** remove seed (Task 1); `storedCount` discriminator (Task 2); shared `reminderFireTimes` with planner refactor, no duplicated DST math (Task 3); `remindersAllInPast` detector incl. the no-reminders=false rule (Task 4); EmptyState two variants sharing the shell, gear in both, privacy line first-use-only (Task 5); HomeScreen picks variant with loading/error guards kept above the branch (Task 6); non-blocking add-form hint reusing the detector (Task 7); verification (Task 8). All spec sections map to a task.
- **Type consistency:** `storedCount: number` is added to `UseDeadlinesResult` and consumed in HomeScreen. `reminderFireTimes(dueDate, reminderDaysBefore, reminderTime)` and `remindersAllInPast(dueDate, reminderDaysBefore, now, reminderTime)` signatures match their call sites (planner and add screen). `EmptyState`'s `variant: 'first-use' | 'all-caught-up'` matches the literal the home passes.
- **No behavior regressions:** the planner refactor preserves output (existing planner tests cover it). Removing the seed only affects the no-prop production path; tests inject repositories. Adding the hint adds UI text and never touches `disabled`, so existing add-form tests still pass.
- **Out of scope honored:** app icon/`app.json`, EAS, Play, photo/OCR, iOS, editing.
```

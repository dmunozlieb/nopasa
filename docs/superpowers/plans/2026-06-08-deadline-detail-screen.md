# Deadline Detail Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the deadline detail screen (route `deadline/[id]`), loading the deadline by id, with type-adapted content and an action layer; the "mark as" management action updates status via the repository.

**Architecture:** A pure per-type presentation config drives the copy. A `useDeadline(id)` hook loads via the existing `DeadlineRepository` port. The screen composes existing UI foundations plus three new presentational components, takes navigation via an `onClose` callback (testable without a router), and is shown as an Expo Router modal. Domain and the port are NOT modified.

**Tech Stack:** Expo SDK 56, React Native 0.85, React 19, TypeScript, expo-router, @expo/vector-icons (MaterialCommunityIcons), Jest (jest-expo) + @testing-library/react-native v14 (async `render`).

> **Test-stack note:** `render()` is async — always `await render(...)`. `renderHook` is also async — `await renderHook(...)`. A global safe-area mock exists in `jest.setup.js`, so `useSafeAreaInsets` returns zero insets in tests. Do NOT change jest config. Verify Expo-specific APIs against https://docs.expo.dev/versions/v56.0.0/ if unsure.

---

## File map

```
app/deadline/[id].tsx                 # MODIFY: thin route (useLocalSearchParams + useRouter)
src/ui/deadline/detail-presentation.ts   # CREATE: pure per-type config (+ test)
src/ui/deadline/status-headline.ts        # CREATE: verb + countdown (+ test)
src/ui/deadline/format-date.ts            # CREATE: "11 jun 2026" (+ test)
src/ui/deadline/format-amount.ts          # CREATE: formatAmountLine (+ test)
src/ui/components/DeadlineRow.tsx          # MODIFY: use formatAmountLine
src/ui/hooks/use-deadline.ts              # CREATE: findById -> states (+ test)
src/ui/components/ActionButton.tsx        # CREATE
src/ui/components/DetailStatusBlock.tsx   # CREATE
src/ui/components/ManageAction.tsx        # CREATE
src/ui/screens/DeadlineDetailScreen.tsx   # CREATE (+ test, + integration test)
```

Reused unchanged: `AppText`, `Card`, `Loading`, theme tokens, `urgencyColors`, `typeIcon`, `formatTimeRemaining`, `daysRemaining`, `urgencyLevel`, `RepositoryProvider`/`useDeadlineRepository`, `InMemoryDeadlineRepository`, `buildDeadline`.

---

## Task 1: detail-presentation (pure, full coverage)

**Files:**
- Create: `src/ui/deadline/detail-presentation.ts`
- Test: `src/ui/deadline/detail-presentation.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/ui/deadline/detail-presentation.test.ts`:

```ts
import { DeadlineType } from '../../domain/deadline/deadline.schema';
import { detailPresentation } from './detail-presentation';

describe('detailPresentation', () => {
  it('returns complete, non-empty fields for every deadline type', () => {
    for (const type of DeadlineType.options) {
      const p = detailPresentation(type);
      expect(p.verb.length).toBeGreaterThan(0);
      expect(p.consequence.length).toBeGreaterThan(0);
      expect(p.primaryAction.length).toBeGreaterThan(0);
      expect(p.secondaryAction.length).toBeGreaterThan(0);
      expect(p.manage.label.length).toBeGreaterThan(0);
      expect(['RESOLVED', 'CANCELLED']).toContain(p.manage.targetStatus);
    }
  });

  it('maps verbs per type', () => {
    expect(detailPresentation('ITV').verb).toBe('Caduca');
    expect(detailPresentation('INSURANCE').verb).toBe('Vence');
    expect(detailPresentation('SUBSCRIPTION').verb).toBe('Se cobra');
    expect(detailPresentation('WARRANTY').verb).toBe('Termina');
  });

  it('only subscription cancels; the rest resolve', () => {
    expect(detailPresentation('SUBSCRIPTION').manage).toEqual({
      label: 'Marcar como cancelada',
      targetStatus: 'CANCELLED',
    });
    expect(detailPresentation('ITV').manage.targetStatus).toBe('RESOLVED');
    expect(detailPresentation('GAS_INSPECTION').manage.label).toBe('Marcar como hecha');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/ui/deadline/detail-presentation.test.ts`
Expected: FAIL — cannot find module './detail-presentation'.

- [ ] **Step 3: Write minimal implementation**

Create `src/ui/deadline/detail-presentation.ts`:

```ts
import type { DeadlineType } from '../../domain/deadline/deadline.schema';

export interface DetailPresentation {
  verb: string;
  consequence: string;
  primaryAction: string;
  secondaryAction: string;
  manage: { label: string; targetStatus: 'RESOLVED' | 'CANCELLED' };
}

/** Per-type copy for the detail screen. Consequences are calm and factual (no figures,
 *  no alarm) so they read well whether the status block is red, amber or green. */
const PRESENTATIONS: Record<DeadlineType, DetailPresentation> = {
  ITV: {
    verb: 'Caduca',
    consequence: 'La ITV en vigor es necesaria para circular con el coche.',
    primaryAction: 'Reservar cita de ITV cerca',
    secondaryAction: 'Ver estaciones cercanas',
    manage: { label: 'Marcar como renovado', targetStatus: 'RESOLVED' },
  },
  DNI: {
    verb: 'Caduca',
    consequence: 'El DNI en vigor te permite identificarte y viajar por la UE.',
    primaryAction: 'Pedir cita para renovar el DNI',
    secondaryAction: 'Ver oficinas cercanas',
    manage: { label: 'Marcar como renovado', targetStatus: 'RESOLVED' },
  },
  PASSPORT: {
    verb: 'Caduca',
    consequence: 'El pasaporte en vigor es necesario para viajar fuera de la UE.',
    primaryAction: 'Pedir cita para el pasaporte',
    secondaryAction: 'Ver oficinas cercanas',
    manage: { label: 'Marcar como renovado', targetStatus: 'RESOLVED' },
  },
  DRIVING_LICENSE: {
    verb: 'Caduca',
    consequence: 'El permiso en vigor es necesario para poder conducir.',
    primaryAction: 'Renovar el permiso de conducir',
    secondaryAction: 'Ver centros cercanos',
    manage: { label: 'Marcar como renovado', targetStatus: 'RESOLVED' },
  },
  INSURANCE: {
    verb: 'Vence',
    consequence: 'El seguro en vigor mantiene tu cobertura; al renovar puedes revisar el precio.',
    primaryAction: 'Renovar o comparar el seguro',
    secondaryAction: 'Ver mi póliza',
    manage: { label: 'Marcar como renovado', targetStatus: 'RESOLVED' },
  },
  SUBSCRIPTION: {
    verb: 'Se cobra',
    consequence: 'Se renueva sola en esta fecha; puedes gestionarla o cancelarla cuando quieras.',
    primaryAction: 'Gestionar o cancelar',
    secondaryAction: 'Ver todas mis suscripciones',
    manage: { label: 'Marcar como cancelada', targetStatus: 'CANCELLED' },
  },
  WARRANTY: {
    verb: 'Termina',
    consequence: 'Mientras la garantía siga activa, las reparaciones cubiertas no te cuestan.',
    primaryAction: 'Ver mi garantía',
    secondaryAction: 'Contactar con el servicio técnico',
    manage: { label: 'Marcar como resuelta', targetStatus: 'RESOLVED' },
  },
  GAS_INSPECTION: {
    verb: 'Vence',
    consequence: 'La revisión periódica del gas es obligatoria y ayuda a mantener la instalación segura.',
    primaryAction: 'Reservar revisión de gas',
    secondaryAction: 'Ver técnicos cercanos',
    manage: { label: 'Marcar como hecha', targetStatus: 'RESOLVED' },
  },
  OTHER: {
    verb: 'Vence',
    consequence: 'Te avisaremos con tiempo para que puedas ocuparte de ello.',
    primaryAction: 'Gestionar este vencimiento',
    secondaryAction: 'Ver detalles',
    manage: { label: 'Marcar como resuelto', targetStatus: 'RESOLVED' },
  },
};

export function detailPresentation(type: DeadlineType): DetailPresentation {
  return PRESENTATIONS[type];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/ui/deadline/detail-presentation.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/deadline/detail-presentation.ts src/ui/deadline/detail-presentation.test.ts
git commit -m "feat(detail): add per-type presentation config"
```

---

## Task 2: statusHeadline (pure)

**Files:**
- Create: `src/ui/deadline/status-headline.ts`
- Test: `src/ui/deadline/status-headline.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/ui/deadline/status-headline.test.ts`:

```ts
import { statusHeadline } from './status-headline';

describe('statusHeadline', () => {
  it('composes verb + countdown for future days', () => {
    expect(statusHeadline('Caduca', 4)).toBe('Caduca en 4 días');
    expect(statusHeadline('Vence', 75)).toBe('Vence en 3 meses');
  });

  it('says "{verb} hoy" for today', () => {
    expect(statusHeadline('Se cobra', 0)).toBe('Se cobra hoy');
  });

  it('says "Vencido" for overdue', () => {
    expect(statusHeadline('Caduca', -3)).toBe('Vencido');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/ui/deadline/status-headline.test.ts`
Expected: FAIL — cannot find module './status-headline'.

- [ ] **Step 3: Write minimal implementation**

Create `src/ui/deadline/status-headline.ts`:

```ts
import { formatTimeRemaining } from './format-time-remaining';

/** Status block headline: "{verb} en {countdown}" for future, "{verb} hoy" today,
 *  "Vencido" when overdue (handles the grammar cases the plain template breaks). */
export function statusHeadline(verb: string, days: number): string {
  if (days < 0) return 'Vencido';
  if (days === 0) return `${verb} hoy`;
  return `${verb} en ${formatTimeRemaining(days)}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/ui/deadline/status-headline.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/deadline/status-headline.ts src/ui/deadline/status-headline.test.ts
git commit -m "feat(detail): add statusHeadline helper"
```

---

## Task 3: formatDate (pure)

**Files:**
- Create: `src/ui/deadline/format-date.ts`
- Test: `src/ui/deadline/format-date.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/ui/deadline/format-date.test.ts`:

```ts
import { formatDate } from './format-date';

describe('formatDate', () => {
  it('formats as "D mmm YYYY" with Spanish month abbreviations', () => {
    expect(formatDate(new Date(2026, 5, 11))).toBe('11 jun 2026');
    expect(formatDate(new Date(2026, 0, 5))).toBe('5 ene 2026');
    expect(formatDate(new Date(2026, 11, 31))).toBe('31 dic 2026');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/ui/deadline/format-date.test.ts`
Expected: FAIL — cannot find module './format-date'.

- [ ] **Step 3: Write minimal implementation**

Create `src/ui/deadline/format-date.ts`:

```ts
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Spanish short date, e.g. "11 jun 2026". Deterministic, no Intl/locale dependency. */
export function formatDate(date: Date): string {
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/ui/deadline/format-date.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/deadline/format-date.ts src/ui/deadline/format-date.test.ts
git commit -m "feat(detail): add Spanish short date formatter"
```

---

## Task 4: formatAmountLine (pure) + DeadlineRow refactor

**Files:**
- Create: `src/ui/deadline/format-amount.ts`
- Test: `src/ui/deadline/format-amount.test.ts`
- Modify: `src/ui/components/DeadlineRow.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/ui/deadline/format-amount.test.ts`:

```ts
import { buildDeadline } from '../../test-support/build-deadline';
import { formatAmountLine } from './format-amount';

describe('formatAmountLine', () => {
  it('returns the amountLabel when present (it already includes the figure)', () => {
    expect(formatAmountLine(buildDeadline({ amountLabel: 'multa 200 €', amount: 200 }))).toBe('multa 200 €');
    expect(formatAmountLine(buildDeadline({ amountLabel: '12,99 €/mes' }))).toBe('12,99 €/mes');
  });

  it('formats the amount in euros when there is no label', () => {
    expect(formatAmountLine(buildDeadline({ amount: 200 }))).toBe('200 €');
    expect(formatAmountLine(buildDeadline({ amount: 12.99 }))).toBe('12,99 €');
  });

  it('returns null when there is neither label nor amount', () => {
    expect(formatAmountLine(buildDeadline())).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/ui/deadline/format-amount.test.ts`
Expected: FAIL — cannot find module './format-amount'.

- [ ] **Step 3: Write minimal implementation**

Create `src/ui/deadline/format-amount.ts`:

```ts
import type { Deadline } from '../../domain/deadline/deadline.schema';

/** Spanish euro amount with comma decimals, e.g. 12.99 -> "12,99 €". */
function formatEuros(amount: number): string {
  return `${String(amount).replace('.', ',')} €`;
}

/**
 * Single source of truth for the amount line shown on the home row and the detail.
 * Prefers `amountLabel` (current data already embeds the figure, e.g. "multa 200 €");
 * falls back to the numeric `amount`; hidden (null) when there is neither.
 */
export function formatAmountLine(deadline: Deadline): string | null {
  if (deadline.amountLabel) return deadline.amountLabel;
  if (deadline.amount != null) return formatEuros(deadline.amount);
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/ui/deadline/format-amount.test.ts`
Expected: PASS.

- [ ] **Step 5: Refactor DeadlineRow to use the shared helper**

In `src/ui/components/DeadlineRow.tsx`, add the import:

```tsx
import { formatAmountLine } from '../deadline/format-amount';
```

Inside the component, compute the line once (place it next to the other derived consts like `level`/`days`):

```tsx
  const amountLine = formatAmountLine(deadline);
```

Replace the amount block:

```tsx
          {deadline.amountLabel ? (
            <AppText weight="bold" size={fontSizes.small} color={colors.textFaint} style={styles.amount}>
              {deadline.amountLabel}
            </AppText>
          ) : null}
```

with:

```tsx
          {amountLine ? (
            <AppText weight="bold" size={fontSizes.small} color={colors.textFaint} style={styles.amount}>
              {amountLine}
            </AppText>
          ) : null}
```

- [ ] **Step 6: Run the home tests to confirm no behavior change**

Run: `npx jest src/ui/components/DeadlineList.test.tsx`
Expected: PASS (the row still shows "multa 200 €" — that test's data has `amountLabel` without `amount`, which the helper handles).

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/ui/deadline/format-amount.ts src/ui/deadline/format-amount.test.ts src/ui/components/DeadlineRow.tsx
git commit -m "feat(detail): add formatAmountLine and use it in DeadlineRow"
```

---

## Task 5: useDeadline hook

**Files:**
- Create: `src/ui/hooks/use-deadline.ts`
- Test: `src/ui/hooks/use-deadline.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/ui/hooks/use-deadline.test.tsx`:

```tsx
import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { buildDeadline } from '../../test-support/build-deadline';
import { InMemoryDeadlineRepository } from '../../test-support/in-memory-deadline-repository';
import { RepositoryProvider } from '../repository/repository-context';
import { useDeadline } from './use-deadline';

const wrapper =
  (repo: InMemoryDeadlineRepository) =>
  ({ children }: { children: ReactNode }) =>
    <RepositoryProvider repository={repo}>{children}</RepositoryProvider>;

describe('useDeadline', () => {
  it('loads an existing deadline into ready state', async () => {
    const repo = new InMemoryDeadlineRepository([buildDeadline({ id: 'a', title: 'ITV — Clio' })]);
    const { result } = await renderHook(() => useDeadline('a'), { wrapper: wrapper(repo) });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.deadline?.title).toBe('ITV — Clio');
  });

  it('reports not-found when the id is absent', async () => {
    const repo = new InMemoryDeadlineRepository();
    const { result } = await renderHook(() => useDeadline('missing'), { wrapper: wrapper(repo) });
    await waitFor(() => expect(result.current.status).toBe('not-found'));
    expect(result.current.deadline).toBeNull();
  });

  it('reports error when the repository throws', async () => {
    const repo = { findById: async () => { throw new Error('boom'); } } as unknown as InMemoryDeadlineRepository;
    const { result } = await renderHook(() => useDeadline('a'), { wrapper: wrapper(repo) });
    await waitFor(() => expect(result.current.status).toBe('error'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/ui/hooks/use-deadline.test.tsx`
Expected: FAIL — cannot find module './use-deadline'.

- [ ] **Step 3: Write minimal implementation**

Create `src/ui/hooks/use-deadline.ts`:

```ts
import { useEffect, useState } from 'react';
import type { Deadline } from '../../domain/deadline/deadline.schema';
import { useDeadlineRepository } from '../repository/repository-context';

export type DeadlineLoadStatus = 'loading' | 'error' | 'not-found' | 'ready';

export interface UseDeadlineResult {
  status: DeadlineLoadStatus;
  deadline: Deadline | null;
}

/** Loads one deadline by id from the repository. Distinguishes not-found (null) from error. */
export function useDeadline(id: string): UseDeadlineResult {
  const repo = useDeadlineRepository();
  const [state, setState] = useState<UseDeadlineResult>({ status: 'loading', deadline: null });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const found = await repo.findById(id);
        if (cancelled) return;
        setState(
          found ? { status: 'ready', deadline: found } : { status: 'not-found', deadline: null },
        );
      } catch {
        if (!cancelled) setState({ status: 'error', deadline: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [repo, id]);

  return state;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/ui/hooks/use-deadline.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ui/hooks/use-deadline.ts src/ui/hooks/use-deadline.test.tsx
git commit -m "feat(detail): add useDeadline hook"
```

---

## Task 6: Detail presentational components

**Files:**
- Create: `src/ui/components/ActionButton.tsx`, `DetailStatusBlock.tsx`, `ManageAction.tsx`

Presentational; exercised by the screen tests. No standalone tests. Verify with tsc.

- [ ] **Step 1: ActionButton**

Create `src/ui/components/ActionButton.tsx`:

```tsx
import { Pressable, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fontSizes, radii, spacing } from '../theme';
import { AppText } from './AppText';

interface ActionButtonProps {
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
}

/** "Qué puedes hacer" row: leading icon + label + trailing chevron. */
export function ActionButton({ label, icon, onPress, variant = 'primary' }: ActionButtonProps) {
  const isPrimary = variant === 'primary';
  const fg = isPrimary ? colors.white : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.root, isPrimary ? styles.primary : styles.secondary, pressed && styles.pressed]}
    >
      <MaterialCommunityIcons name={icon} size={20} color={fg} />
      <AppText weight="extrabold" size={fontSizes.body} color={fg} style={styles.label}>
        {label}
      </AppText>
      <MaterialCommunityIcons name="chevron-right" size={22} color={fg} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radii.button,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  primary: { backgroundColor: colors.brandBlue },
  secondary: {
    backgroundColor: colors.cardBg,
    shadowColor: '#2C2A26',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  pressed: { opacity: 0.9 },
  label: { flex: 1 },
});
```

- [ ] **Step 2: DetailStatusBlock**

Create `src/ui/components/DetailStatusBlock.tsx`:

```tsx
import { StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { UrgencyColorSet } from '../deadline/urgency-colors';
import { fontSizes, radii, spacing } from '../theme';
import { AppText } from './AppText';

interface DetailStatusBlockProps {
  urgency: UrgencyColorSet;
  headline: string;
  date: string;
  consequence: string;
}

/** Urgency-tinted status block: big headline + date + divider + calm consequence. */
export function DetailStatusBlock({ urgency, headline, date, consequence }: DetailStatusBlockProps) {
  return (
    <View style={[styles.root, { backgroundColor: urgency.tintBg }]}>
      <AppText weight="black" size={28} color={urgency.base}>
        {headline}
      </AppText>
      <AppText weight="bold" size={fontSizes.label} color={urgency.base} style={styles.date}>
        {date}
      </AppText>
      <View style={[styles.divider, { backgroundColor: urgency.base }]} />
      <View style={styles.consequenceRow}>
        <MaterialCommunityIcons name="information-outline" size={18} color={urgency.base} />
        <AppText weight="semibold" size={fontSizes.label} color={urgency.base} style={styles.consequence}>
          {consequence}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { borderRadius: radii.card, padding: spacing.lg },
  date: { opacity: 0.9, marginTop: 2 },
  divider: { height: StyleSheet.hairlineWidth, opacity: 0.3, marginVertical: spacing.md },
  consequenceRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  consequence: { flex: 1, lineHeight: 20 },
});
```

- [ ] **Step 3: ManageAction**

Create `src/ui/components/ManageAction.tsx`:

```tsx
import { Pressable, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fontSizes, spacing } from '../theme';
import { AppText } from './AppText';

interface ManageActionProps {
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  onPress: () => void;
}

/** Low-emphasis management action (icon + muted label). */
export function ManageAction({ label, icon, onPress }: ManageActionProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.root, pressed && styles.pressed]}
    >
      <MaterialCommunityIcons name={icon} size={18} color={colors.textMuted} />
      <AppText weight="bold" size={fontSizes.label} color={colors.textMuted} style={styles.label}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  pressed: { opacity: 0.6 },
  label: { flexShrink: 1 },
});
```

- [ ] **Step 4: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. If any MaterialCommunityIcons glyph name used here or in Task 7 (`chevron-right`, `information-outline`, `calendar-check`, `magnify`, `cash`, `check`, `clock-outline`, `close`) is rejected, replace it with a valid MaterialCommunityIcons name of similar meaning and keep going.

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/ActionButton.tsx src/ui/components/DetailStatusBlock.tsx src/ui/components/ManageAction.tsx
git commit -m "feat(detail): add ActionButton, DetailStatusBlock and ManageAction"
```

---

## Task 7: DeadlineDetailScreen + component tests

**Files:**
- Create: `src/ui/screens/DeadlineDetailScreen.tsx`
- Test: `src/ui/screens/DeadlineDetailScreen.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/ui/screens/DeadlineDetailScreen.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native';
import { buildDeadline } from '../../test-support/build-deadline';
import { InMemoryDeadlineRepository } from '../../test-support/in-memory-deadline-repository';
import { RepositoryProvider } from '../repository/repository-context';
import { DeadlineDetailScreen } from './DeadlineDetailScreen';

function renderWith(repo: InMemoryDeadlineRepository, id: string) {
  return render(
    <RepositoryProvider repository={repo}>
      <DeadlineDetailScreen id={id} onClose={() => {}} />
    </RepositoryProvider>,
  );
}

describe('DeadlineDetailScreen', () => {
  it('renders an ITV deadline: verb, consequence, actions, amount and manage label', async () => {
    const repo = new InMemoryDeadlineRepository([
      buildDeadline({
        id: '1',
        type: 'ITV',
        title: 'ITV — Clio',
        subtitle: 'Inspección técnica del coche',
        dueDate: new Date(2026, 5, 11),
        amount: 200,
        amountLabel: 'multa 200 €',
      }),
    ]);
    await renderWith(repo, '1');

    expect(await screen.findByText('ITV — Clio')).toBeTruthy();
    expect(screen.getByText(/^Caduca/)).toBeTruthy();
    expect(screen.getByText('La ITV en vigor es necesaria para circular con el coche.')).toBeTruthy();
    expect(screen.getByText('Reservar cita de ITV cerca')).toBeTruthy();
    expect(screen.getByText('Ver estaciones cercanas')).toBeTruthy();
    expect(screen.getByText('multa 200 €')).toBeTruthy();
    expect(screen.getByText('Marcar como renovado')).toBeTruthy();
  });

  it('renders a subscription: "Se cobra" and "Marcar como cancelada"', async () => {
    const repo = new InMemoryDeadlineRepository([
      buildDeadline({ id: '2', type: 'SUBSCRIPTION', title: 'Netflix', dueDate: new Date(2026, 5, 20) }),
    ]);
    await renderWith(repo, '2');

    expect(await screen.findByText('Netflix')).toBeTruthy();
    expect(screen.getByText(/^Se cobra/)).toBeTruthy();
    expect(screen.getByText('Marcar como cancelada')).toBeTruthy();
  });

  it('shows a not-found message when the id is absent', async () => {
    await renderWith(new InMemoryDeadlineRepository(), 'missing');
    expect(await screen.findByText('No encontramos este vencimiento.')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/ui/screens/DeadlineDetailScreen.test.tsx`
Expected: FAIL — cannot find module './DeadlineDetailScreen'.

- [ ] **Step 3: Write minimal implementation**

Create `src/ui/screens/DeadlineDetailScreen.tsx`:

```tsx
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { daysRemaining, urgencyLevel } from '../../domain/deadline/urgency';
import { detailPresentation } from '../deadline/detail-presentation';
import { formatAmountLine } from '../deadline/format-amount';
import { formatDate } from '../deadline/format-date';
import { statusHeadline } from '../deadline/status-headline';
import { typeIcon } from '../deadline/type-icons';
import { urgencyColors } from '../deadline/urgency-colors';
import { useDeadline } from '../hooks/use-deadline';
import { useDeadlineRepository } from '../repository/repository-context';
import { colors, fontSizes, radii, spacing } from '../theme';
import { ActionButton } from '../components/ActionButton';
import { AppText } from '../components/AppText';
import { DetailStatusBlock } from '../components/DetailStatusBlock';
import { Loading } from '../components/Loading';
import { ManageAction } from '../components/ManageAction';

interface DeadlineDetailScreenProps {
  id: string;
  onClose: () => void;
}

/** Detail of one deadline: type-adapted copy + action layer; "mark as" updates status. */
export function DeadlineDetailScreen({ id, onClose }: DeadlineDetailScreenProps) {
  const { status, deadline } = useDeadline(id);
  const repo = useDeadlineRepository();
  const insets = useSafeAreaInsets();

  if (status === 'loading') return <Loading />;

  if (status !== 'ready' || !deadline) {
    const message =
      status === 'error'
        ? 'No se pudo cargar este vencimiento.'
        : 'No encontramos este vencimiento.';
    return (
      <View style={[styles.centered, { paddingTop: spacing.xxxl + insets.top }]}>
        <AppText weight="bold" size={fontSizes.body} color={colors.textSecondary} style={styles.centeredText}>
          {message}
        </AppText>
        <ManageAction label="Cerrar" icon="close" onPress={onClose} />
      </View>
    );
  }

  const today = new Date();
  const level = urgencyLevel(deadline, today);
  const urgency = urgencyColors(level);
  const presentation = detailPresentation(deadline.type);
  const headline = statusHeadline(presentation.verb, daysRemaining(deadline, today));
  const amountLine = formatAmountLine(deadline);

  const notYet = () => Alert.alert('Próximamente', 'Esta acción estará disponible más adelante.');

  const markAs = async () => {
    await repo.update({ ...deadline, status: presentation.manage.targetStatus });
    onClose();
  };

  return (
    <View style={styles.root}>
      <View style={[styles.handle, { marginTop: insets.top + spacing.sm }]} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: spacing.xxxl + insets.bottom }]}>
        <View style={styles.header}>
          <View style={[styles.icon, { backgroundColor: urgency.tintBg }]}>
            <MaterialCommunityIcons name={typeIcon(deadline.type)} size={24} color={urgency.base} />
          </View>
          <View style={styles.headerText}>
            <AppText weight="extrabold" size={fontSizes.title}>
              {deadline.title}
            </AppText>
            {deadline.subtitle ? (
              <AppText weight="semibold" size={fontSizes.label} color={colors.textMuted}>
                {deadline.subtitle}
              </AppText>
            ) : null}
          </View>
        </View>

        <DetailStatusBlock
          urgency={urgency}
          headline={headline}
          date={formatDate(deadline.dueDate)}
          consequence={presentation.consequence}
        />

        {amountLine ? (
          <View style={styles.amountRow}>
            <MaterialCommunityIcons name="cash" size={18} color={colors.textFaint} />
            <AppText weight="bold" size={fontSizes.label} color={colors.textFaint}>
              {amountLine}
            </AppText>
          </View>
        ) : null}

        <AppText weight="extrabold" size={fontSizes.title} style={styles.sectionTitle}>
          Qué puedes hacer
        </AppText>
        <View style={styles.actions}>
          <ActionButton label={presentation.primaryAction} icon="calendar-check" onPress={notYet} variant="primary" />
          <ActionButton label={presentation.secondaryAction} icon="magnify" onPress={notYet} variant="secondary" />
        </View>

        <View style={styles.manageDivider} />
        <View style={styles.manageRow}>
          <ManageAction label={presentation.manage.label} icon="check" onPress={markAs} />
          <ManageAction label="Posponer el aviso" icon="clock-outline" onPress={notYet} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.screenBg, borderTopLeftRadius: radii.card, borderTopRightRadius: radii.card },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: radii.pill, backgroundColor: colors.textFaint, opacity: 0.4 },
  content: { padding: spacing.xl, gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: { width: 48, height: 48, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, gap: 2 },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionTitle: { marginTop: spacing.sm },
  actions: { gap: spacing.md },
  manageDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.textFaint, opacity: 0.25, marginTop: spacing.sm },
  manageRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl, backgroundColor: colors.screenBg },
  centeredText: { textAlign: 'center' },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/ui/screens/DeadlineDetailScreen.test.tsx`
Expected: PASS (3 tests).

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/ui/screens/DeadlineDetailScreen.tsx src/ui/screens/DeadlineDetailScreen.test.tsx
git commit -m "feat(detail): add DeadlineDetailScreen with type-adapted content"
```

---

## Task 8: Management integration test + route wiring + full verification

**Files:**
- Modify: `src/ui/screens/DeadlineDetailScreen.test.tsx` (add integration test)
- Modify: `app/deadline/[id].tsx`

- [ ] **Step 1: Add the integration test**

Append this test inside the `describe('DeadlineDetailScreen', ...)` block in `src/ui/screens/DeadlineDetailScreen.test.tsx`. Add `fireEvent` and `waitFor` to the existing import from `@testing-library/react-native`:

```tsx
  it('marks as resolved: updates the repository status and closes', async () => {
    const repo = new InMemoryDeadlineRepository([
      buildDeadline({ id: '1', type: 'ITV', title: 'ITV — Clio', status: 'ACTIVE' }),
    ]);
    const onClose = jest.fn();
    render(
      <RepositoryProvider repository={repo}>
        <DeadlineDetailScreen id="1" onClose={onClose} />
      </RepositoryProvider>,
    );

    fireEvent.press(await screen.findByText('Marcar como renovado'));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect((await repo.findById('1'))?.status).toBe('RESOLVED');
  });

  it('marks a subscription as cancelled', async () => {
    const repo = new InMemoryDeadlineRepository([
      buildDeadline({ id: '2', type: 'SUBSCRIPTION', title: 'Netflix', status: 'ACTIVE' }),
    ]);
    const onClose = jest.fn();
    render(
      <RepositoryProvider repository={repo}>
        <DeadlineDetailScreen id="2" onClose={onClose} />
      </RepositoryProvider>,
    );

    fireEvent.press(await screen.findByText('Marcar como cancelada'));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect((await repo.findById('2'))?.status).toBe('CANCELLED');
  });
```

The import line at the top of the file becomes:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
```

- [ ] **Step 2: Run the screen tests**

Run: `npx jest src/ui/screens/DeadlineDetailScreen.test.tsx`
Expected: PASS (5 tests total).

- [ ] **Step 3: Wire the route**

Replace `app/deadline/[id].tsx` with:

```tsx
import { useLocalSearchParams, useRouter } from 'expo-router';
import { DeadlineDetailScreen } from '../../src/ui/screens/DeadlineDetailScreen';

export default function DeadlineDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  return <DeadlineDetailScreen id={id} onClose={() => router.back()} />;
}
```

- [ ] **Step 4: Full verification**

Run: `npx tsc --noEmit`
Expected: clean.

Run: `npm test`
Expected: all suites PASS (the previous 93 plus the new detail tests).

- [ ] **Step 5: Bundle sanity check (best-effort, non-interactive)**

Run: `npx expo export --platform android --output-dir .expo-export-check`
Expected: bundles with no import/resolution errors. Then delete the output dir (`rm -rf .expo-export-check`) and do NOT commit it. If the command is unavailable or fails for environment-only reasons, skip it and say so; only act on real code/import errors.

- [ ] **Step 6: Commit**

```bash
git add src/ui/screens/DeadlineDetailScreen.test.tsx app/deadline/[id].tsx
git commit -m "feat(detail): wire deadline detail route and cover the mark-as flow"
```

---

## Self-review notes (already reconciled)

- **Spec coverage:** presentation config (T1, full 9-type table), statusHeadline (T2), formatDate (T3), formatAmountLine + DeadlineRow coherence (T4), useDeadline states (T5), ActionButton/DetailStatusBlock/ManageAction (T6), screen with header/status block/amount line/actions/manage + component & not-found tests (T7), mandatory mark-as integration test + modal route wiring (T8). Modal presentation already set on the `deadline/[id]` Stack.Screen in `app/_layout.tsx`.
- **Type consistency:** `DetailPresentation` shape (verb/consequence/primaryAction/secondaryAction/manage{label,targetStatus}) is produced in T1 and consumed in T7. `UseDeadlineResult` (status/deadline) from T5 consumed in T7. `formatAmountLine` from T4 consumed in T7 and DeadlineRow. `UrgencyColorSet` from the existing `urgency-colors` consumed by `DetailStatusBlock`.
- **No domain/port changes:** the screen uses `findById`/`update` through `useDeadlineRepository`; status update spreads the existing deadline and overrides `status`.
- **Icons to verify at implementation:** `chevron-right`, `information-outline`, `calendar-check`, `magnify`, `cash`, `check`, `clock-outline`, `close` (swap to a valid MaterialCommunityIcons name if tsc rejects any).
```

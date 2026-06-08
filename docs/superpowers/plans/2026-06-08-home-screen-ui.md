# Home Screen + UI Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the home screen (deadline list) in React Native, wired to the existing `DeadlineRepository`, plus the reusable UI foundations (theme tokens, mappings, components) and Expo Router navigation.

**Architecture:** Expo Router (`app/`) for routes. All reusable UI under `src/ui/`. The repository reaches React via a `RepositoryProvider` context (accepts an injected repo for tests; otherwise builds the real one async with a loading gate). A `useDeadlines` hook lists deadlines and computes groups with the existing `groupAndSort`. The container `HomeScreen` recomputes "today" and reloads on focus. Domain and the `DeadlineRepository` port are NOT modified.

**Tech Stack:** Expo SDK 56, React Native 0.85, React 19, TypeScript, expo-router, @expo/vector-icons (MaterialCommunityIcons), expo-font + @expo-google-fonts/nunito, Jest (jest-expo) + @testing-library/react-native.

> **AGENTS.md reminder:** before writing any Expo-specific code (expo-router, expo-font, @expo-google-fonts), verify exact APIs against https://docs.expo.dev/versions/v56.0.0/ . Use `npx expo install` (not raw npm) for runtime deps so SDK-56-compatible versions are picked.

---

## File map

```
package.json                    # main -> expo-router/entry; jest testMatch += tsx; deps
app.json                        # scheme + expo-router plugin
app/_layout.tsx                 # RepositoryProvider + font gate + <Stack>
app/index.tsx                   # route "/" -> wires router callbacks into <HomeScreen>
app/deadline/[id].tsx           # placeholder detail
app/add.tsx                     # placeholder add
src/ui/theme/{colors,typography,spacing,radii,index}.ts
src/ui/repository/repository-context.tsx
src/ui/deadline/{group-labels,urgency-colors,type-icons,format-time-remaining}.ts
src/ui/hooks/use-deadlines.ts
src/ui/components/{AppText,Loading,Button,Pill,Card,SectionHeader,ScreenHeader,DeadlineRow,DeadlineList,EmptyState}.tsx
src/ui/screens/HomeScreen.tsx
src/test-support/in-memory-deadline-repository.ts
src/infrastructure/dev/seed-deadlines.ts
```

Deleted: `App.tsx`, root `index.ts` (replaced by expo-router entry).

---

## Task 1: Dependencies, Expo Router bootstrap & jest config

**Files:**
- Modify: `package.json` (main, jest.testMatch, deps)
- Modify: `app.json` (scheme, plugins)
- Create: `app/_layout.tsx`, `app/index.tsx`, `app/deadline/[id].tsx`, `app/add.tsx`
- Delete: `App.tsx`, `index.ts`

- [ ] **Step 1: Install runtime deps (SDK-compatible)**

Run:
```bash
npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-font @expo-google-fonts/nunito @expo/vector-icons
```

- [ ] **Step 2: Install dev dep for component testing**

Run:
```bash
npm install -D @testing-library/react-native
```

- [ ] **Step 3: Point the entry at expo-router and widen jest testMatch**

In `package.json`: set `"main": "expo-router/entry"` and update the jest block's `testMatch`:

```json
"testMatch": [
  "**/*.test.ts",
  "**/*.test.tsx"
]
```

- [ ] **Step 4: Add scheme + expo-router plugin to app.json**

In `app.json` under `expo`, add `"scheme": "nopasa"` and add `"expo-router"` to the `plugins` array (keep `"expo-sqlite"`):

```json
"scheme": "nopasa",
"plugins": [
  "expo-router",
  "expo-sqlite"
]
```

- [ ] **Step 5: Delete the old entry files**

Run:
```bash
git rm App.tsx index.ts
```

- [ ] **Step 6: Create a minimal root layout (fonts added in Task 10)**

Create `app/_layout.tsx`:

```tsx
import { Stack } from 'expo-router';

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 7: Create temporary home + placeholder routes**

Create `app/index.tsx`:

```tsx
import { Text, View } from 'react-native';

export default function Home() {
  return (
    <View>
      <Text>Nopasa</Text>
    </View>
  );
}
```

Create `app/add.tsx`:

```tsx
import { Text, View } from 'react-native';

/** Placeholder. The add flow (camera/OCR/manual) is built in a later session. */
export default function AddDeadline() {
  return (
    <View>
      <Text>Añadir vencimiento (próximamente)</Text>
    </View>
  );
}
```

Create `app/deadline/[id].tsx`:

```tsx
import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

/** Placeholder. The detail screen is built in a later session. */
export default function DeadlineDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <View>
      <Text>Detalle del vencimiento {id} (próximamente)</Text>
    </View>
  );
}
```

- [ ] **Step 8: Verify typecheck and tests still pass**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm test`
Expected: existing domain/persistence tests still PASS.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore(ui): bootstrap expo-router, deps and jest tsx config"
```

---

## Task 2: Theme tokens

**Files:**
- Create: `src/ui/theme/colors.ts`, `typography.ts`, `spacing.ts`, `radii.ts`, `index.ts`

Plain constant tables — single source of style truth. No tests (constants). Hex values from `docs/design/*.html` CSS and PNG sampling; refine against the PNGs when wiring screens.

- [ ] **Step 1: Create colors**

Create `src/ui/theme/colors.ts`:

```ts
/** Color tokens. Brand/urgency hex come from docs/design CSS; surfaces sampled from PNG. */
export const colors = {
  text: '#2C2A26',
  textSecondary: '#5C574F',
  textMuted: '#6E6960',
  textFaint: '#8A8378',
  brandBlue: '#3E6BC8',
  screenBg: '#F7F4EF',
  cardBg: '#FFFFFF',
  surfaceSoft: '#F4F1EB',
  white: '#FFFFFF',
  urgency: {
    urgent: { base: '#C25A45', tintBg: '#F3DED9' },
    upcoming: { base: '#C2883B', tintBg: '#F2E4CC' },
    calm: { base: '#5F8A67', tintBg: '#DCE7DD' },
  },
} as const;
```

- [ ] **Step 2: Create typography**

Create `src/ui/theme/typography.ts`:

```ts
/** Nunito family names match @expo-google-fonts/nunito exports loaded in app/_layout. */
export const fonts = {
  regular: 'Nunito_400Regular',
  semibold: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
  extrabold: 'Nunito_800ExtraBold',
  black: 'Nunito_900Black',
} as const;

export const fontSizes = {
  h1: 34,
  title: 19,
  body: 16,
  label: 13,
  caption: 13.5,
  pill: 12,
  small: 12,
} as const;
```

- [ ] **Step 3: Create spacing**

Create `src/ui/theme/spacing.ts`:

```ts
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
} as const;
```

- [ ] **Step 4: Create radii**

Create `src/ui/theme/radii.ts`:

```ts
export const radii = {
  pill: 999,
  card: 18,
  button: 16,
  icon: 14,
} as const;
```

- [ ] **Step 5: Create barrel**

Create `src/ui/theme/index.ts`:

```ts
export { colors } from './colors';
export { fonts, fontSizes } from './typography';
export { spacing } from './spacing';
export { radii } from './radii';
```

- [ ] **Step 6: Verify and commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add src/ui/theme
git commit -m "feat(ui): add theme tokens (colors, typography, spacing, radii)"
```

---

## Task 3: formatTimeRemaining (pure, full coverage)

**Files:**
- Create: `src/ui/deadline/format-time-remaining.ts`
- Test: `src/ui/deadline/format-time-remaining.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/ui/deadline/format-time-remaining.test.ts`:

```ts
import { formatTimeRemaining } from './format-time-remaining';

describe('formatTimeRemaining', () => {
  it('returns "hoy" for 0', () => {
    expect(formatTimeRemaining(0)).toBe('hoy');
  });

  it('returns "vencido" for any negative value', () => {
    expect(formatTimeRemaining(-1)).toBe('vencido');
    expect(formatTimeRemaining(-30)).toBe('vencido');
  });

  it('returns days up to and including 60', () => {
    expect(formatTimeRemaining(1)).toBe('1 día');
    expect(formatTimeRemaining(4)).toBe('4 días');
    expect(formatTimeRemaining(60)).toBe('60 días');
  });

  it('returns rounded months from 61 to under a year', () => {
    expect(formatTimeRemaining(61)).toBe('2 meses');
    expect(formatTimeRemaining(31)).toBe('31 días'); // still days (<=60)
    expect(formatTimeRemaining(45)).toBe('45 días'); // still days
    expect(formatTimeRemaining(364)).toBe('12 meses');
  });

  it('uses singular "1 mes" when rounding gives one month', () => {
    expect(formatTimeRemaining(75)).toBe('3 meses');
  });

  it('returns years from 365 up, with singular/plural', () => {
    expect(formatTimeRemaining(365)).toBe('1 año');
    expect(formatTimeRemaining(366)).toBe('1 año');
    expect(formatTimeRemaining(730)).toBe('2 años');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/ui/deadline/format-time-remaining.test.ts`
Expected: FAIL — cannot find module './format-time-remaining'.

- [ ] **Step 3: Write minimal implementation**

Create `src/ui/deadline/format-time-remaining.ts`:

```ts
/** Days in a month/year used to roll days up to coarser units. Tweak to retune. */
export const DAYS_PER_MONTH = 30;
export const DAYS_PER_YEAR = 365;
/** At or below this many days we still count in days; above it we switch to months. */
export const DAYS_UNIT_MAX = 60;

const plural = (n: number, singular: string, plural: string) =>
  `${n} ${n === 1 ? singular : plural}`;

/** Human countdown for a remaining-days value. Presentation only (UI layer). */
export function formatTimeRemaining(daysRemaining: number): string {
  if (daysRemaining < 0) return 'vencido';
  if (daysRemaining === 0) return 'hoy';
  if (daysRemaining <= DAYS_UNIT_MAX) return plural(daysRemaining, 'día', 'días');
  if (daysRemaining < DAYS_PER_YEAR) {
    return plural(Math.round(daysRemaining / DAYS_PER_MONTH), 'mes', 'meses');
  }
  return plural(Math.round(daysRemaining / DAYS_PER_YEAR), 'año', 'años');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/ui/deadline/format-time-remaining.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/ui/deadline/format-time-remaining.ts src/ui/deadline/format-time-remaining.test.ts
git commit -m "feat(ui): add formatTimeRemaining with tunable thresholds"
```

---

## Task 4: group → label mapping (pure)

**Files:**
- Create: `src/ui/deadline/group-labels.ts`
- Test: `src/ui/deadline/group-labels.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/ui/deadline/group-labels.test.ts`:

```ts
import { groupLabel } from './group-labels';

describe('groupLabel', () => {
  it('maps each group key to its Spanish label', () => {
    expect(groupLabel('NEEDS_ATTENTION')).toBe('Requieren atención');
    expect(groupLabel('UPCOMING')).toBe('Próximas');
    expect(groupLabel('CALM')).toBe('Tranquilas');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/ui/deadline/group-labels.test.ts`
Expected: FAIL — cannot find module './group-labels'.

- [ ] **Step 3: Write minimal implementation**

Create `src/ui/deadline/group-labels.ts`:

```ts
import type { DeadlineGroup } from '../../domain/deadline/grouping';

/** UI layer maps language-agnostic domain group keys to Spanish section labels. */
const LABELS: Record<DeadlineGroup, string> = {
  NEEDS_ATTENTION: 'Requieren atención',
  UPCOMING: 'Próximas',
  CALM: 'Tranquilas',
};

export function groupLabel(group: DeadlineGroup): string {
  return LABELS[group];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/ui/deadline/group-labels.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/deadline/group-labels.ts src/ui/deadline/group-labels.test.ts
git commit -m "feat(ui): add group key to Spanish label mapping"
```

---

## Task 5: urgency → color mapping (pure)

**Files:**
- Create: `src/ui/deadline/urgency-colors.ts`
- Test: `src/ui/deadline/urgency-colors.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/ui/deadline/urgency-colors.test.ts`:

```ts
import { urgencyColors } from './urgency-colors';
import { colors } from '../theme/colors';

describe('urgencyColors', () => {
  it('maps each urgency level to its color set', () => {
    expect(urgencyColors('urgent')).toEqual(colors.urgency.urgent);
    expect(urgencyColors('upcoming')).toEqual(colors.urgency.upcoming);
    expect(urgencyColors('calm')).toEqual(colors.urgency.calm);
  });

  it('exposes the exact base hex from the design', () => {
    expect(urgencyColors('urgent').base).toBe('#C25A45');
    expect(urgencyColors('upcoming').base).toBe('#C2883B');
    expect(urgencyColors('calm').base).toBe('#5F8A67');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/ui/deadline/urgency-colors.test.ts`
Expected: FAIL — cannot find module './urgency-colors'.

- [ ] **Step 3: Write minimal implementation**

Create `src/ui/deadline/urgency-colors.ts`:

```ts
import type { UrgencyLevel } from '../../domain/deadline/urgency';
import { colors } from '../theme/colors';

export interface UrgencyColorSet {
  base: string;
  tintBg: string;
}

/** Maps a domain urgency level to its color set (pill text/border + tinted background). */
export function urgencyColors(level: UrgencyLevel): UrgencyColorSet {
  return colors.urgency[level];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/ui/deadline/urgency-colors.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/deadline/urgency-colors.ts src/ui/deadline/urgency-colors.test.ts
git commit -m "feat(ui): add urgency level to color mapping"
```

---

## Task 6: deadline type → icon mapping

**Files:**
- Create: `src/ui/deadline/type-icons.ts`
- Test: `src/ui/deadline/type-icons.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/ui/deadline/type-icons.test.ts`:

```ts
import { DeadlineType } from '../../domain/deadline/deadline.schema';
import { typeIcon } from './type-icons';

describe('typeIcon', () => {
  it('returns a non-empty icon name for every deadline type', () => {
    for (const type of DeadlineType.options) {
      expect(typeof typeIcon(type)).toBe('string');
      expect(typeIcon(type).length).toBeGreaterThan(0);
    }
  });

  it('maps known types to their MaterialCommunityIcons name', () => {
    expect(typeIcon('ITV')).toBe('car');
    expect(typeIcon('INSURANCE')).toBe('shield-check');
    expect(typeIcon('OTHER')).toBe('dots-horizontal');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/ui/deadline/type-icons.test.ts`
Expected: FAIL — cannot find module './type-icons'.

- [ ] **Step 3: Write minimal implementation**

Create `src/ui/deadline/type-icons.ts`:

```ts
import type { ComponentProps } from 'react';
import type { MaterialCommunityIcons } from '@expo/vector-icons';
import type { DeadlineType } from '../../domain/deadline/deadline.schema';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Maps each deadline type to a MaterialCommunityIcons glyph name. */
const ICONS: Record<DeadlineType, IconName> = {
  ITV: 'car',
  DNI: 'card-account-details',
  PASSPORT: 'passport',
  DRIVING_LICENSE: 'card-account-details-outline',
  INSURANCE: 'shield-check',
  SUBSCRIPTION: 'television-classic',
  WARRANTY: 'package-variant-closed',
  GAS_INSPECTION: 'fire',
  OTHER: 'dots-horizontal',
};

export function typeIcon(type: DeadlineType): IconName {
  return ICONS[type];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/ui/deadline/type-icons.test.ts`
Expected: PASS. If TypeScript rejects any glyph name, replace it with a valid MaterialCommunityIcons name (verify at the @expo/vector-icons directory) and keep the test green.

- [ ] **Step 5: Commit**

```bash
git add src/ui/deadline/type-icons.ts src/ui/deadline/type-icons.test.ts
git commit -m "feat(ui): add deadline type to icon mapping"
```

---

## Task 7: InMemoryDeadlineRepository (test fake of the port)

**Files:**
- Create: `src/test-support/in-memory-deadline-repository.ts`
- Test: `src/test-support/in-memory-deadline-repository.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/test-support/in-memory-deadline-repository.test.ts`:

```ts
import { buildDeadline } from './build-deadline';
import { InMemoryDeadlineRepository } from './in-memory-deadline-repository';

describe('InMemoryDeadlineRepository', () => {
  it('saves and lists deadlines', async () => {
    const repo = new InMemoryDeadlineRepository();
    const d = buildDeadline({ id: 'a' });
    await repo.save(d);
    expect(await repo.list()).toEqual([d]);
  });

  it('can be seeded via the constructor', async () => {
    const d = buildDeadline({ id: 'a' });
    const repo = new InMemoryDeadlineRepository([d]);
    expect(await repo.list()).toEqual([d]);
  });

  it('finds by id and returns null when absent', async () => {
    const repo = new InMemoryDeadlineRepository([buildDeadline({ id: 'a' })]);
    expect(await repo.findById('a')).not.toBeNull();
    expect(await repo.findById('missing')).toBeNull();
  });

  it('updates an existing deadline in place', async () => {
    const repo = new InMemoryDeadlineRepository([buildDeadline({ id: 'a', title: 'old' })]);
    await repo.update(buildDeadline({ id: 'a', title: 'new' }));
    expect((await repo.findById('a'))?.title).toBe('new');
  });

  it('deletes by id', async () => {
    const repo = new InMemoryDeadlineRepository([buildDeadline({ id: 'a' })]);
    await repo.delete('a');
    expect(await repo.list()).toEqual([]);
  });

  it('returns copies so the internal store is not mutated by callers', async () => {
    const repo = new InMemoryDeadlineRepository([buildDeadline({ id: 'a' })]);
    const list = await repo.list();
    list.pop();
    expect(await repo.list()).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/test-support/in-memory-deadline-repository.test.ts`
Expected: FAIL — cannot find module './in-memory-deadline-repository'.

- [ ] **Step 3: Write minimal implementation**

Create `src/test-support/in-memory-deadline-repository.ts`:

```ts
import type { Deadline } from '../domain/deadline/deadline.schema';
import type { DeadlineRepository } from '../ports/deadline-repository';

/** In-memory DeadlineRepository for tests and previews. Implements the full port. */
export class InMemoryDeadlineRepository implements DeadlineRepository {
  private readonly store: Map<string, Deadline>;

  constructor(initial: Deadline[] = []) {
    this.store = new Map(initial.map((d) => [d.id, d]));
  }

  async save(deadline: Deadline): Promise<void> {
    this.store.set(deadline.id, deadline);
  }

  async list(): Promise<Deadline[]> {
    return [...this.store.values()];
  }

  async findById(id: string): Promise<Deadline | null> {
    return this.store.get(id) ?? null;
  }

  async update(deadline: Deadline): Promise<void> {
    this.store.set(deadline.id, deadline);
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/test-support/in-memory-deadline-repository.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/test-support/in-memory-deadline-repository.ts src/test-support/in-memory-deadline-repository.test.ts
git commit -m "test(ui): add in-memory DeadlineRepository fake"
```

---

## Task 8: RepositoryProvider + useDeadlineRepository

**Files:**
- Create: `src/ui/repository/repository-context.tsx`
- Test: `src/ui/repository/repository-context.test.tsx`

The provider exposes an injected repo immediately; without one it builds the real repo async (loading gate) and seeds in `__DEV__`. The seed import is added in Task 16 — for now the no-prop branch just builds the repo.

- [ ] **Step 1: Write the failing test**

Create `src/ui/repository/repository-context.test.tsx`:

```tsx
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { InMemoryDeadlineRepository } from '../../test-support/in-memory-deadline-repository';
import { RepositoryProvider, useDeadlineRepository } from './repository-context';

function Probe() {
  const repo = useDeadlineRepository();
  return <Text>{repo ? 'has-repo' : 'no-repo'}</Text>;
}

describe('RepositoryProvider', () => {
  it('exposes an injected repository immediately', () => {
    render(
      <RepositoryProvider repository={new InMemoryDeadlineRepository()}>
        <Probe />
      </RepositoryProvider>,
    );
    expect(screen.getByText('has-repo')).toBeTruthy();
  });

  it('throws if the hook is used outside the provider', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/RepositoryProvider/);
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/ui/repository/repository-context.test.tsx`
Expected: FAIL — cannot find module './repository-context'.

- [ ] **Step 3: Write minimal implementation**

Create `src/ui/repository/repository-context.tsx`:

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { DeadlineRepository } from '../../ports/deadline-repository';
import { createDeadlineRepository } from '../../infrastructure/persistence/sqlite/create-deadline-repository';
import { Loading } from '../components/Loading';

const RepositoryContext = createContext<DeadlineRepository | null>(null);

interface RepositoryProviderProps {
  /** Inject a ready repository (tests/previews). Omit to build the real SQLite one. */
  repository?: DeadlineRepository;
  children: ReactNode;
}

export function RepositoryProvider({ repository, children }: RepositoryProviderProps) {
  const [built, setBuilt] = useState<DeadlineRepository | null>(repository ?? null);

  useEffect(() => {
    if (repository) return;
    let cancelled = false;
    void (async () => {
      const repo = await createDeadlineRepository();
      if (!cancelled) setBuilt(repo);
    })();
    return () => {
      cancelled = true;
    };
  }, [repository]);

  if (!built) return <Loading />;

  return <RepositoryContext.Provider value={built}>{children}</RepositoryContext.Provider>;
}

export function useDeadlineRepository(): DeadlineRepository {
  const repo = useContext(RepositoryContext);
  if (!repo) {
    throw new Error('useDeadlineRepository must be used within a RepositoryProvider');
  }
  return repo;
}
```

> NOTE: this imports `Loading` (Task 11). If implementing strictly in order, temporarily inline `import { ActivityIndicator } from 'react-native'` and render `<ActivityIndicator />`, then switch to `<Loading />` after Task 11. The `__DEV__` seed call is added in Task 16.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/ui/repository/repository-context.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/repository
git commit -m "feat(ui): add RepositoryProvider and useDeadlineRepository hook"
```

---

## Task 9: useDeadlines hook

**Files:**
- Create: `src/ui/hooks/use-deadlines.ts`
- Test: `src/ui/hooks/use-deadlines.test.tsx`

Loads the list on mount, computes groups with the existing `groupAndSort(list, today)`, exposes `status`, `groups`, `error`, and `refresh()` (recomputes `today` and re-lists).

- [ ] **Step 1: Write the failing test**

Create `src/ui/hooks/use-deadlines.test.tsx`:

```tsx
import type { ReactNode } from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { buildDeadline } from '../../test-support/build-deadline';
import { InMemoryDeadlineRepository } from '../../test-support/in-memory-deadline-repository';
import { RepositoryProvider } from '../repository/repository-context';
import { useDeadlines } from './use-deadlines';

const wrapper =
  (repo: InMemoryDeadlineRepository) =>
  ({ children }: { children: ReactNode }) =>
    <RepositoryProvider repository={repo}>{children}</RepositoryProvider>;

describe('useDeadlines', () => {
  it('loads and groups deadlines into ready state', async () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 5); // urgent (<=10 days)
    const repo = new InMemoryDeadlineRepository([buildDeadline({ id: 'a', dueDate: soon })]);

    const { result } = renderHook(() => useDeadlines(), { wrapper: wrapper(repo) });

    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.groups.NEEDS_ATTENTION).toHaveLength(1);
    expect(result.current.groups.UPCOMING).toHaveLength(0);
  });

  it('refresh re-reads the repository', async () => {
    const repo = new InMemoryDeadlineRepository();
    const { result } = renderHook(() => useDeadlines(), { wrapper: wrapper(repo) });
    await waitFor(() => expect(result.current.status).toBe('ready'));

    const soon = new Date();
    soon.setDate(soon.getDate() + 3);
    await repo.save(buildDeadline({ id: 'b', dueDate: soon }));
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.groups.NEEDS_ATTENTION).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/ui/hooks/use-deadlines.test.tsx`
Expected: FAIL — cannot find module './use-deadlines'.

- [ ] **Step 3: Write minimal implementation**

Create `src/ui/hooks/use-deadlines.ts`:

```ts
import { useCallback, useEffect, useMemo, useState } from 'react';
import { groupAndSort, type GroupedDeadlines } from '../../domain/deadline/grouping';
import type { Deadline } from '../../domain/deadline/deadline.schema';
import { useDeadlineRepository } from '../repository/repository-context';

export type DeadlinesStatus = 'loading' | 'ready' | 'error';

export interface UseDeadlinesResult {
  status: DeadlinesStatus;
  groups: GroupedDeadlines;
  error: unknown;
  refresh: () => Promise<void>;
}

const EMPTY: GroupedDeadlines = { NEEDS_ATTENTION: [], UPCOMING: [], CALM: [] };

/** Lists deadlines from the repository and groups them with the domain's groupAndSort. */
export function useDeadlines(): UseDeadlinesResult {
  const repo = useDeadlineRepository();
  const [status, setStatus] = useState<DeadlinesStatus>('loading');
  const [list, setList] = useState<Deadline[]>([]);
  const [today, setToday] = useState(() => new Date());
  const [error, setError] = useState<unknown>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await repo.list();
      setList(next);
      setToday(new Date());
      setStatus('ready');
    } catch (e) {
      setError(e);
      setStatus('error');
    }
  }, [repo]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const groups = useMemo(
    () => (status === 'ready' ? groupAndSort(list, today) : EMPTY),
    [status, list, today],
  );

  return { status, groups, error, refresh };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/ui/hooks/use-deadlines.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/hooks
git commit -m "feat(ui): add useDeadlines hook with refresh"
```

---

## Task 10: Font loading in root layout + AppText

**Files:**
- Modify: `app/_layout.tsx`
- Create: `src/ui/components/AppText.tsx`

- [ ] **Step 1: Create AppText**

Create `src/ui/components/AppText.tsx`:

```tsx
import { Text, type TextProps, type TextStyle } from 'react-native';
import { colors, fonts } from '../theme';

type Weight = keyof typeof fonts;

interface AppTextProps extends TextProps {
  weight?: Weight;
  size?: number;
  color?: string;
}

/** Text wrapper that applies the right Nunito font file per weight (RN can't synthesize it). */
export function AppText({ weight = 'regular', size, color, style, ...rest }: AppTextProps) {
  const base: TextStyle = {
    fontFamily: fonts[weight],
    color: color ?? colors.text,
    ...(size != null ? { fontSize: size } : null),
  };
  return <Text style={[base, style]} {...rest} />;
}
```

- [ ] **Step 2: Load fonts in the root layout**

Replace `app/_layout.tsx` with:

```tsx
import {
  useFonts,
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
} from '@expo-google-fonts/nunito';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RepositoryProvider } from '../src/ui/repository/repository-context';
import { Loading } from '../src/ui/components/Loading';

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Nunito_900Black,
  });

  if (!fontsLoaded && !fontError) return <Loading />;

  return (
    <SafeAreaProvider>
      <RepositoryProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="add" options={{ presentation: 'modal' }} />
          <Stack.Screen name="deadline/[id]" options={{ presentation: 'modal' }} />
        </Stack>
      </RepositoryProvider>
    </SafeAreaProvider>
  );
}
```

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (Loading exists after Task 11 — if doing strictly in order, run this check at the end of Task 11).

- [ ] **Step 4: Commit**

```bash
git add app/_layout.tsx src/ui/components/AppText.tsx
git commit -m "feat(ui): load Nunito fonts and add AppText"
```

---

## Task 11: Leaf presentational components

**Files:**
- Create: `src/ui/components/Loading.tsx`, `Button.tsx`, `Pill.tsx`, `Card.tsx`, `SectionHeader.tsx`, `ScreenHeader.tsx`

Presentational primitives, exercised by the DeadlineList/EmptyState/HomeScreen tests. No standalone tests.

- [ ] **Step 1: Loading**

Create `src/ui/components/Loading.tsx`:

```tsx
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors } from '../theme';

/** Full-screen centered spinner on the app background. */
export function Loading() {
  return (
    <View style={styles.root}>
      <ActivityIndicator color={colors.brandBlue} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.screenBg },
});
```

- [ ] **Step 2: Button**

Create `src/ui/components/Button.tsx`:

```tsx
import { Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fontSizes, radii, spacing } from '../theme';
import { AppText } from './AppText';

interface ButtonProps {
  label: string;
  onPress: () => void;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
}

/** Primary full-width blue CTA. */
export function Button({ label, onPress, icon }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.root, pressed && styles.pressed]}
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
  pressed: { opacity: 0.85 },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
});
```

- [ ] **Step 3: Pill**

Create `src/ui/components/Pill.tsx`:

```tsx
import { StyleSheet, View } from 'react-native';
import { fontSizes, radii, spacing } from '../theme';
import type { UrgencyColorSet } from '../deadline/urgency-colors';
import { AppText } from './AppText';

interface PillProps {
  label: string;
  urgency: UrgencyColorSet;
}

/** Rounded urgency chip: tinted background, colored dot + text. */
export function Pill({ label, urgency }: PillProps) {
  return (
    <View style={[styles.root, { backgroundColor: urgency.tintBg }]}>
      <View style={[styles.dot, { backgroundColor: urgency.base }]} />
      <AppText weight="bold" size={fontSizes.pill} color={urgency.base}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  dot: { width: 7, height: 7, borderRadius: radii.pill },
});
```

- [ ] **Step 4: Card**

Create `src/ui/components/Card.tsx`:

```tsx
import { Pressable, StyleSheet, View, type ViewProps } from 'react-native';
import { colors, radii, spacing } from '../theme';

interface CardProps extends ViewProps {
  onPress?: () => void;
}

/** White rounded surface with a soft shadow. Pressable when onPress is given. */
export function Card({ onPress, style, children, ...rest }: CardProps) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.root, pressed && styles.pressed, style]}>
        {children}
      </Pressable>
    );
  }
  return (
    <View style={[styles.root, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.card,
    padding: spacing.lg,
    shadowColor: '#2C2A26',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  pressed: { opacity: 0.96 },
});
```

- [ ] **Step 5: SectionHeader**

Create `src/ui/components/SectionHeader.tsx`:

```tsx
import { StyleSheet, View } from 'react-native';
import { colors, fontSizes, radii, spacing } from '../theme';
import { AppText } from './AppText';

interface SectionHeaderProps {
  label: string;
  count: number;
  dotColor: string;
}

/** Uppercase section label with a colored dot and a count badge. */
export function SectionHeader({ label, count, dotColor }: SectionHeaderProps) {
  return (
    <View style={styles.root}>
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <AppText weight="extrabold" size={fontSizes.label} color={colors.textSecondary} style={styles.label}>
        {label.toUpperCase()}
      </AppText>
      <View style={styles.badge}>
        <AppText weight="bold" size={fontSizes.small} color={colors.textSecondary}>
          {count}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  dot: { width: 8, height: 8, borderRadius: radii.pill },
  label: { letterSpacing: 1.5 },
  badge: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
});
```

- [ ] **Step 6: ScreenHeader**

Create `src/ui/components/ScreenHeader.tsx`:

```tsx
import { StyleSheet, View } from 'react-native';
import { colors, fontSizes, spacing } from '../theme';
import { AppText } from './AppText';

interface ScreenHeaderProps {
  title: string;
  summary?: string;
  summaryDotColor?: string;
}

/** Big screen title with an optional summary line (colored dot + text). */
export function ScreenHeader({ title, summary, summaryDotColor }: ScreenHeaderProps) {
  return (
    <View style={styles.root}>
      <AppText weight="black" size={fontSizes.h1}>
        {title}
      </AppText>
      {summary ? (
        <View style={styles.summary}>
          {summaryDotColor ? <View style={[styles.dot, { backgroundColor: summaryDotColor }]} /> : null}
          <AppText weight="bold" size={fontSizes.body} color={colors.textSecondary}>
            {summary}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm, marginBottom: spacing.xl },
  summary: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 9, height: 9, borderRadius: 999 },
});
```

- [ ] **Step 7: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/ui/components
git commit -m "feat(ui): add leaf components (Loading, Button, Pill, Card, headers)"
```

---

## Task 12: DeadlineRow

**Files:**
- Create: `src/ui/components/DeadlineRow.tsx`

- [ ] **Step 1: Implement DeadlineRow**

Create `src/ui/components/DeadlineRow.tsx`:

```tsx
import { StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Deadline } from '../../domain/deadline/deadline.schema';
import { daysRemaining, urgencyLevel } from '../../domain/deadline/urgency';
import { formatTimeRemaining } from '../deadline/format-time-remaining';
import { typeIcon } from '../deadline/type-icons';
import { urgencyColors } from '../deadline/urgency-colors';
import { colors, fontSizes, radii, spacing } from '../theme';
import { AppText } from './AppText';
import { Card } from './Card';
import { Pill } from './Pill';

interface DeadlineRowProps {
  deadline: Deadline;
  today: Date;
  onPress: () => void;
}

/** One deadline as a tappable card: tinted icon, title/subtitle, urgency pill, optional amount. */
export function DeadlineRow({ deadline, today, onPress }: DeadlineRowProps) {
  const level = urgencyLevel(deadline, today);
  const urgency = urgencyColors(level);
  const days = daysRemaining(deadline, today);

  return (
    <Card onPress={onPress} style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: urgency.tintBg }]}>
          <MaterialCommunityIcons name={typeIcon(deadline.type)} size={22} color={urgency.base} />
        </View>
        <View style={styles.body}>
          <AppText weight="extrabold" size={fontSizes.title}>
            {deadline.title}
          </AppText>
          {deadline.subtitle ? (
            <AppText weight="semibold" size={fontSizes.label} color={colors.textMuted}>
              {deadline.subtitle}
            </AppText>
          ) : null}
        </View>
        <View style={styles.right}>
          <Pill label={formatTimeRemaining(days)} urgency={urgency} />
          {deadline.amountLabel ? (
            <AppText weight="bold" size={fontSizes.small} color={colors.textFaint} style={styles.amount}>
              {deadline.amountLabel}
            </AppText>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: { width: 48, height: 48, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 2 },
  right: { alignItems: 'flex-end', gap: spacing.xs },
  amount: { marginTop: 2 },
});
```

> NOTE: per the spec, `amountLabel` carries the full display string ("multa 200 €", "12,99 €/mes"); `amount` stays the numeric value for future logic. The row shows `amountLabel` when present.

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui/components/DeadlineRow.tsx
git commit -m "feat(ui): add DeadlineRow card"
```

---

## Task 13: DeadlineList

**Files:**
- Create: `src/ui/components/DeadlineList.tsx`
- Test: `src/ui/components/DeadlineList.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/ui/components/DeadlineList.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native';
import { buildDeadline } from '../../test-support/build-deadline';
import { groupAndSort } from '../../domain/deadline/grouping';
import { DeadlineList } from './DeadlineList';

function makeGroups(today: Date) {
  const at = (days: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + days);
    return d;
  };
  const list = [
    buildDeadline({ id: '1', title: 'ITV — Clio', dueDate: at(4), amountLabel: 'multa 200 €' }),
    buildDeadline({ id: '2', title: 'Seguro del coche', dueDate: at(6) }),
    buildDeadline({ id: '3', title: 'DNI — Marta', dueDate: at(9) }),
    buildDeadline({ id: '4', title: 'Netflix', dueDate: at(14), amountLabel: '12,99 €/mes' }),
  ];
  return groupAndSort(list, today);
}

describe('DeadlineList', () => {
  const today = new Date();

  it('renders title, summary and sections with counts and pills', () => {
    render(<DeadlineList groups={makeGroups(today)} today={today} onPressRow={() => {}} onAdd={() => {}} />);

    expect(screen.getByText('Mis vencimientos')).toBeTruthy();
    expect(screen.getByText('3 cosas requieren tu atención')).toBeTruthy();
    expect(screen.getByText('REQUIEREN ATENCIÓN')).toBeTruthy();
    expect(screen.getByText('PRÓXIMAS')).toBeTruthy();
    expect(screen.getByText('4 días')).toBeTruthy();
    expect(screen.getByText('multa 200 €')).toBeTruthy();
    expect(screen.getByText('12,99 €/mes')).toBeTruthy();
  });

  it('hides empty sections', () => {
    render(<DeadlineList groups={makeGroups(today)} today={today} onPressRow={() => {}} onAdd={() => {}} />);
    // No CALM items were added.
    expect(screen.queryByText('TRANQUILAS')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/ui/components/DeadlineList.test.tsx`
Expected: FAIL — cannot find module './DeadlineList'.

- [ ] **Step 3: Write minimal implementation**

Create `src/ui/components/DeadlineList.tsx`:

```tsx
import { ScrollView, StyleSheet, View } from 'react-native';
import type { DeadlineGroup, GroupedDeadlines } from '../../domain/deadline/grouping';
import type { UrgencyLevel } from '../../domain/deadline/urgency';
import { groupLabel } from '../deadline/group-labels';
import { urgencyColors } from '../deadline/urgency-colors';
import { colors, spacing } from '../theme';
import { Button } from './Button';
import { DeadlineRow } from './DeadlineRow';
import { ScreenHeader } from './ScreenHeader';
import { SectionHeader } from './SectionHeader';

interface DeadlineListProps {
  groups: GroupedDeadlines;
  today: Date;
  onPressRow: (id: string) => void;
  onAdd: () => void;
}

const ORDER: { key: DeadlineGroup; level: UrgencyLevel }[] = [
  { key: 'NEEDS_ATTENTION', level: 'urgent' },
  { key: 'UPCOMING', level: 'upcoming' },
  { key: 'CALM', level: 'calm' },
];

function summaryText(n: number): string {
  return n === 1 ? '1 cosa requiere tu atención' : `${n} cosas requieren tu atención`;
}

export function DeadlineList({ groups, today, onPressRow, onAdd }: DeadlineListProps) {
  const attention = groups.NEEDS_ATTENTION.length;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          title="Mis vencimientos"
          summary={summaryText(attention)}
          summaryDotColor={colors.urgency.urgent.base}
        />
        {ORDER.map(({ key, level }) => {
          const items = groups[key];
          if (items.length === 0) return null;
          return (
            <View key={key} style={styles.section}>
              <SectionHeader label={groupLabel(key)} count={items.length} dotColor={urgencyColors(level).base} />
              {items.map((d) => (
                <DeadlineRow key={d.id} deadline={d} today={today} onPress={() => onPressRow(d.id)} />
              ))}
            </View>
          );
        })}
      </ScrollView>
      <View style={styles.footer}>
        <Button label="Añadir" icon="plus" onPress={onAdd} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.screenBg },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  section: { marginBottom: spacing.lg },
  footer: { padding: spacing.xl, backgroundColor: colors.screenBg },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/ui/components/DeadlineList.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/DeadlineList.tsx src/ui/components/DeadlineList.test.tsx
git commit -m "feat(ui): add DeadlineList with sections, counts and pills"
```

---

## Task 14: EmptyState

**Files:**
- Create: `src/ui/components/EmptyState.tsx`
- Test: `src/ui/components/EmptyState.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/ui/components/EmptyState.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react-native';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('shows the headline, button and privacy line', () => {
    render(<EmptyState onAdd={() => {}} />);
    expect(screen.getByText('Aquí no se te pasará nada')).toBeTruthy();
    expect(screen.getByText('Añadir mi primer vencimiento')).toBeTruthy();
    expect(screen.getByText('Se lee en tu móvil. Nada se sube a internet.')).toBeTruthy();
  });

  it('calls onAdd when the button is pressed', () => {
    const onAdd = jest.fn();
    render(<EmptyState onAdd={onAdd} />);
    fireEvent.press(screen.getByText('Añadir mi primer vencimiento'));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/ui/components/EmptyState.test.tsx`
Expected: FAIL — cannot find module './EmptyState'.

- [ ] **Step 3: Write minimal implementation**

Create `src/ui/components/EmptyState.tsx`:

```tsx
import { StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fontSizes, radii, spacing } from '../theme';
import { AppText } from './AppText';
import { Button } from './Button';

interface EmptyStateProps {
  onAdd: () => void;
}

/**
 * First-use empty state (docs/design/Primer uso.png).
 * NOTE (future session): copy assumes first use; it also shows when all deadlines
 * are resolved. Distinguishing "first use" from "all caught up" is out of scope now.
 */
export function EmptyState({ onAdd }: EmptyStateProps) {
  return (
    <View style={styles.root}>
      <AppText weight="extrabold" size={fontSizes.body} color={colors.brandBlue} style={styles.wordmark}>
        nopasa
      </AppText>

      <View style={styles.center}>
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

        <AppText weight="black" size={fontSizes.h1} style={styles.headline}>
          Aquí no se te pasará nada
        </AppText>
        <AppText weight="semibold" size={fontSizes.body} color={colors.textMuted} style={styles.support}>
          Guarda tus documentos y fechas importantes —DNI, ITV, seguros, suscripciones— y te avisamos antes de que caduquen.
        </AppText>
      </View>

      <View style={styles.footer}>
        <Button label="Añadir mi primer vencimiento" icon="plus" onPress={onAdd} />
        <View style={styles.privacy}>
          <MaterialCommunityIcons name="lock-outline" size={14} color={colors.urgency.calm.base} />
          <AppText weight="semibold" size={fontSizes.small} color={colors.urgency.calm.base}>
            Se lee en tu móvil. Nada se sube a internet.
          </AppText>
        </View>
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
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/ui/components/EmptyState.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/EmptyState.tsx src/ui/components/EmptyState.test.tsx
git commit -m "feat(ui): add first-use EmptyState"
```

---

## Task 15: HomeScreen container + integration test (MANDATORY)

**Files:**
- Create: `src/ui/screens/HomeScreen.tsx`
- Test: `src/ui/screens/HomeScreen.test.tsx`

HomeScreen owns data (`useDeadlines`) and the focus-refresh wiring; navigation arrives via callback props (no `useRouter` here, so it renders under just the provider). The integration test exercises provider → useDeadlineRepository → useDeadlines → groupAndSort → list end-to-end.

- [ ] **Step 1: Write the failing integration test**

Create `src/ui/screens/HomeScreen.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react-native';

// HomeScreen uses expo-router's useFocusEffect; stub it to run once on mount so the
// test needs only the RepositoryProvider, not a navigation container.
jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void | (() => void)) => {
    const { useEffect } = require('react');
    useEffect(() => cb(), []);
  },
}));

import { buildDeadline } from '../../test-support/build-deadline';
import { InMemoryDeadlineRepository } from '../../test-support/in-memory-deadline-repository';
import { RepositoryProvider } from '../repository/repository-context';
import { HomeScreen } from './HomeScreen';

function at(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

describe('HomeScreen (integration)', () => {
  it('loads from the injected repository and renders the populated list', async () => {
    const repo = new InMemoryDeadlineRepository([
      buildDeadline({ id: '1', title: 'ITV — Clio', dueDate: at(4), amountLabel: 'multa 200 €' }),
      buildDeadline({ id: '2', title: 'Netflix', dueDate: at(14), amountLabel: '12,99 €/mes' }),
      buildDeadline({ id: '3', title: 'Pasaporte', dueDate: at(200) }),
    ]);

    render(
      <RepositoryProvider repository={repo}>
        <HomeScreen onOpenDeadline={() => {}} onAdd={() => {}} />
      </RepositoryProvider>,
    );

    await waitFor(() => expect(screen.getByText('Mis vencimientos')).toBeTruthy());
    expect(screen.getByText('1 cosa requiere tu atención')).toBeTruthy();
    expect(screen.getByText('REQUIEREN ATENCIÓN')).toBeTruthy();
    expect(screen.getByText('PRÓXIMAS')).toBeTruthy();
    expect(screen.getByText('TRANQUILAS')).toBeTruthy();
    expect(screen.getByText('ITV — Clio')).toBeTruthy();
  });

  it('shows the empty state when the repository is empty', async () => {
    render(
      <RepositoryProvider repository={new InMemoryDeadlineRepository()}>
        <HomeScreen onOpenDeadline={() => {}} onAdd={() => {}} />
      </RepositoryProvider>,
    );
    await waitFor(() => expect(screen.getByText('Aquí no se te pasará nada')).toBeTruthy());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/ui/screens/HomeScreen.test.tsx`
Expected: FAIL — cannot find module './HomeScreen'.

- [ ] **Step 3: Write minimal implementation**

Create `src/ui/screens/HomeScreen.tsx`:

```tsx
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { colors, fontSizes, spacing } from '../theme';
import { AppText } from '../components/AppText';
import { DeadlineList } from '../components/DeadlineList';
import { EmptyState } from '../components/EmptyState';
import { Loading } from '../components/Loading';
import { useDeadlines } from '../hooks/use-deadlines';

interface HomeScreenProps {
  onOpenDeadline: (id: string) => void;
  onAdd: () => void;
}

/** Home container: loads deadlines, refreshes on focus, picks loading/error/empty/list. */
export function HomeScreen({ onOpenDeadline, onAdd }: HomeScreenProps) {
  const { status, groups, refresh } = useDeadlines();

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  if (status === 'loading') return <Loading />;

  if (status === 'error') {
    return (
      <View style={styles.error}>
        <AppText weight="bold" size={fontSizes.body} color={colors.textSecondary}>
          No se pudieron cargar tus vencimientos.
        </AppText>
      </View>
    );
  }

  const total = groups.NEEDS_ATTENTION.length + groups.UPCOMING.length + groups.CALM.length;
  if (total === 0) return <EmptyState onAdd={onAdd} />;

  return <DeadlineList groups={groups} today={new Date()} onPressRow={onOpenDeadline} onAdd={onAdd} />;
}

const styles = StyleSheet.create({
  error: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.screenBg },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/ui/screens/HomeScreen.test.tsx`
Expected: PASS (both cases).

- [ ] **Step 5: Commit**

```bash
git add src/ui/screens
git commit -m "feat(ui): add HomeScreen container with focus refresh + integration test"
```

---

## Task 16: Dev seed + wire into RepositoryProvider

**Files:**
- Create: `src/infrastructure/dev/seed-deadlines.ts`
- Modify: `src/ui/repository/repository-context.tsx`

- [ ] **Step 1: Create the dev seed (temporary)**

Create `src/infrastructure/dev/seed-deadlines.ts`:

```ts
import { randomUUID } from 'expo-crypto';
import type { Deadline } from '../../domain/deadline/deadline.schema';
import { deadlineSchema } from '../../domain/deadline/deadline.schema';
import type { DeadlineRepository } from '../../ports/deadline-repository';

/**
 * TEMPORARY / REMOVABLE dev-only seed. Populates the list with sample deadlines so the
 * home screen is visible before the "add" flow exists. Delete this file (and its call in
 * RepositoryProvider) once adding deadlines works.
 */
function daysFromNow(days: number): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

function sample(): Deadline[] {
  const now = new Date();
  const make = (partial: Omit<Deadline, 'id' | 'createdAt' | 'status' | 'reminderDaysBefore'>): Deadline =>
    deadlineSchema.parse({
      id: randomUUID(),
      createdAt: now,
      status: 'ACTIVE',
      reminderDaysBefore: [30, 7],
      ...partial,
    });

  return [
    make({ type: 'ITV', title: 'ITV — Clio', subtitle: 'Inspección técnica del coche', dueDate: daysFromNow(4), amount: 200, amountLabel: 'multa 200 €' }),
    make({ type: 'INSURANCE', title: 'Seguro del coche', subtitle: 'Renovación anual', dueDate: daysFromNow(6), amount: 487, amountLabel: '487 €/año' }),
    make({ type: 'DNI', title: 'DNI — Marta', subtitle: 'Documento de identidad', dueDate: daysFromNow(9) }),
    make({ type: 'SUBSCRIPTION', title: 'Netflix', subtitle: 'Suscripción mensual', dueDate: daysFromNow(14), amount: 12.99, amountLabel: '12,99 €/mes' }),
    make({ type: 'GAS_INSPECTION', title: 'Revisión de la caldera', subtitle: 'Revisión obligatoria de gas', dueDate: daysFromNow(31) }),
    make({ type: 'PASSPORT', title: 'Pasaporte — Marta', subtitle: 'Documento de viaje', dueDate: daysFromNow(200) }),
  ];
}

/** Inserts the sample deadlines only when the store is empty. No-op outside __DEV__. */
export async function seedDeadlinesIfEmpty(repo: DeadlineRepository): Promise<void> {
  if (!__DEV__) return;
  const existing = await repo.list();
  if (existing.length > 0) return;
  for (const deadline of sample()) {
    await repo.save(deadline);
  }
}
```

- [ ] **Step 2: Call the seed in the provider's real-repo branch**

In `src/ui/repository/repository-context.tsx`, add the import and call `seedDeadlinesIfEmpty` after building the repo. The effect body becomes:

```tsx
import { seedDeadlinesIfEmpty } from '../../infrastructure/dev/seed-deadlines';
```

```tsx
    void (async () => {
      const repo = await createDeadlineRepository();
      await seedDeadlinesIfEmpty(repo);
      if (!cancelled) setBuilt(repo);
    })();
```

- [ ] **Step 3: Verify provider test and typecheck still pass**

Run: `npx jest src/ui/repository/repository-context.test.tsx`
Expected: PASS (injected-repo path is unaffected; seed only runs on the no-prop branch).

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/infrastructure/dev/seed-deadlines.ts src/ui/repository/repository-context.tsx
git commit -m "feat(dev): seed sample deadlines when store is empty (__DEV__ only)"
```

---

## Task 17: Wire routes & full verification

**Files:**
- Modify: `app/index.tsx`

- [ ] **Step 1: Wire the home route to HomeScreen**

Replace `app/index.tsx` with:

```tsx
import { useRouter } from 'expo-router';
import { HomeScreen } from '../src/ui/screens/HomeScreen';

export default function Home() {
  const router = useRouter();
  return (
    <HomeScreen
      onOpenDeadline={(id) => router.push(`/deadline/${id}`)}
      onAdd={() => router.push('/add')}
    />
  );
}
```

- [ ] **Step 2: Full typecheck + test run**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm test`
Expected: all suites PASS (domain, persistence, UI units, component tests, HomeScreen integration).

- [ ] **Step 3: Manual smoke check on device/emulator**

Run: `npm run android` (or `npm start` and open in Expo Go).
Expected: app launches; the dev seed populates the list; "Mis vencimientos" with the three sections (Requieren atención / Próximas / Tranquilas), pills, and amounts is visible; "+ Añadir" opens the add placeholder; tapping a row opens the detail placeholder. Compare against `docs/design/Inicio.png` and refine token values if needed.

- [ ] **Step 4: Commit**

```bash
git add app/index.tsx
git commit -m "feat(ui): wire home route to HomeScreen with navigation"
```

---

## Self-review notes (already reconciled)

- **Spec coverage:** theme tokens (T2), group/urgency/icon/format mappings (T3–T6), InMemory fake (T7), provider+hook (T8–T9), components & screen (T10–T15), mandatory integration test (T15), dev seed (T16), routes + placeholders (T1, T17). Empty-state copy left as-is with an in-code NOTE per the spec.
- **Type consistency:** `urgencyColors` returns `{ base, tintBg }` consumed by `Pill`, `DeadlineRow`, `SectionHeader`, `DeadlineList`. `useDeadlines` returns `{ status, groups, error, refresh }` consumed by `HomeScreen`. `HomeScreen` props `{ onOpenDeadline, onAdd }` match `app/index.tsx` and the integration test. `groupLabel` keys match `DeadlineGroup`.
- **Ordering caveat:** `repository-context.tsx` (T8) imports `Loading` (T11) and the seed (T16); the task notes the temporary inline fallback so each task stays green if executed strictly in order.
```

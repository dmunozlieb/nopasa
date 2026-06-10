# Settings screen completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the Settings screen up to the approved design — card/section structure, a real local-first "Exportar mis datos", and a "Política de privacidad" screen — keeping unbuilt features as honest inert "Próximamente" rows.

**Architecture:** Hexagonal, mirroring the existing stack. Pure, framework-free export serialization (`buildDeadlineExport`, `exportFilename`) lives in `src/domain/export/`; a shared `local-date` helper is extracted from the deadline mapper. A new `DataExporter` port has an `expo-file-system`/`expo-sharing` adapter (mocked in tests) and a fake, wired through a `DataExporterProvider` context. The screen reuses existing components/DI; navigation stays prop-based.

**Tech Stack:** Expo SDK 56, React Native 0.85, Zod 4, expo-file-system (SDK 56 `File`/`Paths` API), expo-sharing, expo-constants, Jest + @testing-library/react-native (async/concurrent RNTL), TZ=Europe/Madrid.

---

## Notes for the implementer

- Tests run only under `src/` (jest `roots`) with `TZ=Europe/Madrid`. Run all with `npm test`; one file with `npm test -- <path>`. Typecheck: `npm run typecheck`.
- **RNTL here is async/concurrent:** `await render(...)`; make the first query after a render an awaited `findBy*`; await a `findBy*` after each state-changing `fireEvent`.
- Code/identifiers/comments/commits in English; no `Co-Authored-By` trailers.
- Theme tokens: `colors` (`text`, `textSecondary`, `textMuted`, `textFaint`, `brandBlue`, `screenBg`, `surfaceSoft`, `urgency.urgent.base`, `urgency.calm.base`), `fontSizes` (`title`, `body`, `label`, `small`), `radii` (`pill`, `card`), `spacing` (`xs`, `sm`, `md`, `lg`, `xl`, `xxxl`). Import from `'../theme'`.
- Expo native modules are mocked in `jest.setup.js` (see Task 7). Tests inject the fake exporter, so the adapter never runs under jest — but its module must be importable.

## File structure

Created:
- `src/domain/date/local-date.ts` — shared `toLocalDateString` / `fromLocalDateString`.
- `src/domain/export/build-deadline-export.ts` — pure `buildDeadlineExport`.
- `src/domain/export/export-filename.ts` — pure `exportFilename`.
- `src/ports/data-exporter.ts` — `DataExporter` port.
- `src/test-support/fake-data-exporter.ts` — fake recording calls.
- `src/ui/export/data-exporter-context.tsx` — `DataExporterProvider` + `useDataExporter`.
- `src/infrastructure/export/expo-data-exporter.ts` — SDK-56 adapter.
- `src/ui/components/NavRow.tsx` — tappable row (icon + label + subtitle + chevron, destructive variant).
- `src/ui/components/SettingsSectionLabel.tsx` — uppercase section label.
- `src/ui/screens/PrivacyScreen.tsx` — privacy policy screen (draft copy).
- `app/privacy.tsx` — privacy modal route.
- Test files alongside each unit.

Modified:
- `src/infrastructure/persistence/sqlite/deadline-mapper.ts` — import the shared `local-date` helper.
- `src/ui/components/ComingSoonRow.tsx` (+ new test) — optional `subtitle`.
- `src/ui/screens/SettingsScreen.tsx` (+ test) — card structure, export action, `onOpenPrivacy`.
- `app/settings.tsx` — pass `onOpenPrivacy`.
- `app/_layout.tsx` — mount `DataExporterProvider`, register the privacy route.
- `jest.setup.js` — mock `expo-file-system` and `expo-sharing`.
- `package.json` / `package-lock.json` — add the two expo deps.

---

### Task 1: Extract the shared `local-date` helper

**Files:**
- Create: `src/domain/date/local-date.ts`
- Test: `src/domain/date/local-date.test.ts`
- Modify: `src/infrastructure/persistence/sqlite/deadline-mapper.ts`

- [ ] **Step 1: Write the failing test**

`src/domain/date/local-date.test.ts`:

```ts
import { fromLocalDateString, toLocalDateString } from './local-date';

describe('local-date', () => {
  it('serializes a Date to a local YYYY-MM-DD string', () => {
    expect(toLocalDateString(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toLocalDateString(new Date(2026, 5, 10))).toBe('2026-06-10');
  });

  it('reconstructs a YYYY-MM-DD string to local midnight and round-trips', () => {
    const date = fromLocalDateString('2026-09-01');
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(8);
    expect(date.getDate()).toBe(1);
    expect(toLocalDateString(date)).toBe('2026-09-01');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/domain/date/local-date.test.ts`
Expected: FAIL — cannot find module `./local-date`.

- [ ] **Step 3: Write the implementation**

`src/domain/date/local-date.ts`:

```ts
/** Serializes a Date to a LOCAL calendar-date string "YYYY-MM-DD" (no time, no timezone). */
export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Reconstructs a "YYYY-MM-DD" calendar date as LOCAL midnight. */
export function fromLocalDateString(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}
```

- [ ] **Step 4: Refactor `deadline-mapper.ts` to use it**

In `src/infrastructure/persistence/sqlite/deadline-mapper.ts`, delete the two private functions `toLocalDateString` and `fromLocalDateString` (lines defining them) and add this import at the top, after the existing imports:

```ts
import { fromLocalDateString, toLocalDateString } from '../../../domain/date/local-date';
```

Leave the rest of the file (`toRow`, `rowToParams`, `fromRow`) unchanged — they already call `toLocalDateString` / `fromLocalDateString` by name.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- src/domain/date/local-date.test.ts src/infrastructure/persistence/sqlite/deadline-mapper.test.ts`
Expected: PASS (the new helper test, and the mapper tests still green after the refactor).

- [ ] **Step 6: Commit**

```bash
git add src/domain/date/local-date.ts src/domain/date/local-date.test.ts src/infrastructure/persistence/sqlite/deadline-mapper.ts
git commit -m "refactor(export): extract shared local-date helper from the deadline mapper"
```

---

### Task 2: `buildDeadlineExport` (pure)

**Files:**
- Create: `src/domain/export/build-deadline-export.ts`
- Test: `src/domain/export/build-deadline-export.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { buildDeadlineExport } from './build-deadline-export';
import { buildDeadline } from '../../test-support/build-deadline';

const exportedAt = new Date(2026, 5, 10, 9, 0, 0);

describe('buildDeadlineExport', () => {
  it('wraps deadlines in the versioned envelope', () => {
    const parsed = JSON.parse(buildDeadlineExport([], { exportedAt }));
    expect(parsed.app).toBe('nopasa');
    expect(parsed.schema).toBe(1);
    expect(parsed.exportedAt).toBe(exportedAt.toISOString());
    expect(parsed.deadlines).toEqual([]);
  });

  it('includes deadlines of every status and round-trips through JSON', () => {
    const deadlines = [
      buildDeadline({ id: 'a', status: 'ACTIVE' }),
      buildDeadline({ id: 'r', status: 'RESOLVED' }),
      buildDeadline({ id: 'c', status: 'CANCELLED' }),
    ];
    const parsed = JSON.parse(buildDeadlineExport(deadlines, { exportedAt }));
    expect(parsed).toEqual({
      app: 'nopasa',
      schema: 1,
      exportedAt: exportedAt.toISOString(),
      deadlines: JSON.parse(JSON.stringify(deadlines)),
    });
    expect(parsed.deadlines.map((d: { status: string }) => d.status)).toEqual([
      'ACTIVE',
      'RESOLVED',
      'CANCELLED',
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/domain/export/build-deadline-export.test.ts`
Expected: FAIL — cannot find module `./build-deadline-export`.

- [ ] **Step 3: Write the implementation**

```ts
import type { Deadline } from '../deadline/deadline.schema';

interface BuildOptions {
  /** When the export was produced; serialized as an ISO instant. */
  exportedAt: Date;
}

/**
 * Serializes every deadline into the canonical, schema-versioned export envelope.
 * Framework-free and round-trippable: Dates become ISO strings via JSON.stringify.
 * Includes deadlines of all statuses — the caller passes the full list.
 */
export function buildDeadlineExport(deadlines: Deadline[], { exportedAt }: BuildOptions): string {
  return JSON.stringify({ app: 'nopasa', schema: 1, exportedAt, deadlines });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/domain/export/build-deadline-export.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/export/build-deadline-export.ts src/domain/export/build-deadline-export.test.ts
git commit -m "feat(export): pure buildDeadlineExport (versioned JSON envelope)"
```

---

### Task 3: `exportFilename` (pure)

**Files:**
- Create: `src/domain/export/export-filename.ts`
- Test: `src/domain/export/export-filename.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { exportFilename } from './export-filename';

describe('exportFilename', () => {
  it('builds a dated JSON filename from the local date', () => {
    expect(exportFilename(new Date(2026, 5, 10))).toBe('nopasa-export-2026-06-10.json');
    expect(exportFilename(new Date(2026, 0, 5))).toBe('nopasa-export-2026-01-05.json');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/domain/export/export-filename.test.ts`
Expected: FAIL — cannot find module `./export-filename`.

- [ ] **Step 3: Write the implementation**

```ts
import { toLocalDateString } from '../date/local-date';

/** The export file's name, stamped with the local date: `nopasa-export-YYYY-MM-DD.json`. */
export function exportFilename(date: Date): string {
  return `nopasa-export-${toLocalDateString(date)}.json`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/domain/export/export-filename.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/export/export-filename.ts src/domain/export/export-filename.test.ts
git commit -m "feat(export): pure exportFilename helper"
```

---

### Task 4: `DataExporter` port

**Files:**
- Create: `src/ports/data-exporter.ts`

Interface only (like the other ports); verified by typecheck.

- [ ] **Step 1: Write the port**

```ts
/** Effects port for exporting data off the app. The UI depends on this, never on
 *  expo-file-system / expo-sharing directly. */
export interface DataExporter {
  /** Persist `content` under `filename`, then offer it to the user (system share sheet). */
  export(filename: string, content: string): Promise<void>;
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/ports/data-exporter.ts
git commit -m "feat(export): DataExporter port"
```

---

### Task 5: `FakeDataExporter`

**Files:**
- Create: `src/test-support/fake-data-exporter.ts`
- Test: `src/test-support/fake-data-exporter.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { FakeDataExporter } from './fake-data-exporter';

describe('FakeDataExporter', () => {
  it('records each export call', async () => {
    const exporter = new FakeDataExporter();
    await exporter.export('nopasa-export-2026-06-10.json', '{"app":"nopasa"}');
    expect(exporter.calls).toEqual([
      { filename: 'nopasa-export-2026-06-10.json', content: '{"app":"nopasa"}' },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/test-support/fake-data-exporter.test.ts`
Expected: FAIL — cannot find module `./fake-data-exporter`.

- [ ] **Step 3: Write the implementation**

```ts
import type { DataExporter } from '../ports/data-exporter';

/** In-memory DataExporter for tests: records every (filename, content) it is given. */
export class FakeDataExporter implements DataExporter {
  readonly calls: { filename: string; content: string }[] = [];

  async export(filename: string, content: string): Promise<void> {
    this.calls.push({ filename, content });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/test-support/fake-data-exporter.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/test-support/fake-data-exporter.ts src/test-support/fake-data-exporter.test.ts
git commit -m "test(export): fake DataExporter recording calls"
```

---

### Task 6: Install deps + adapter + jest mocks

**Files:**
- Create: `src/infrastructure/export/expo-data-exporter.ts`
- Modify: `jest.setup.js`
- Modify: `package.json`, `package-lock.json`

No unit test for the adapter (it imports `expo-file-system`/`expo-sharing`, mocked under jest and exercised manually on device). Verified by typecheck + the suite staying green. The jest mocks must land here because Task 8's context imports this adapter transitively.

- [ ] **Step 1: Install the SDK-56 deps**

Run: `npx expo install expo-file-system expo-sharing`
Expected: both added to `package.json` at SDK-56-compatible versions; `package-lock.json` updated.

- [ ] **Step 2: Write the adapter**

`src/infrastructure/export/expo-data-exporter.ts`:

```ts
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { DataExporter } from '../../ports/data-exporter';

/**
 * Writes the export to a file in the app's cache directory, then opens the system share
 * sheet so the user can save/send it. Sharing an app-owned file needs no special Android
 * permission. Thin wrapper over expo-file-system + expo-sharing — mocked in tests.
 */
export const expoDataExporter: DataExporter = {
  async export(filename: string, content: string): Promise<void> {
    const file = new File(Paths.cache, filename);
    file.write(content);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/json',
        dialogTitle: 'Exportar mis datos',
      });
    }
  },
};
```

- [ ] **Step 3: Add jest mocks**

Append to `jest.setup.js`:

```js
// Mock expo-file-system: the new File/Paths API can't load its native module under jsdom.
// A tiny stand-in makes the adapter importable; tests inject FakeDataExporter, so the real
// adapter never runs.
jest.mock('expo-file-system', () => ({
  __esModule: true,
  Paths: { cache: 'file:///cache', document: 'file:///document' },
  File: class {
    uri;
    constructor(dir, name) {
      this.uri = `${dir}/${name}`;
    }
    write() {}
  },
}));

// Mock expo-sharing similarly.
jest.mock('expo-sharing', () => ({
  __esModule: true,
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => undefined),
}));
```

- [ ] **Step 4: Typecheck and run the suite**

Run: `npm run typecheck`
Expected: no errors.

Run: `npm test`
Expected: PASS (no regressions; the mocks make the new modules importable).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/infrastructure/export/expo-data-exporter.ts jest.setup.js
git commit -m "feat(export): expo-file-system + expo-sharing adapter and jest mocks"
```

---

### Task 7: `DataExporterProvider` + `useDataExporter`

**Files:**
- Create: `src/ui/export/data-exporter-context.tsx`
- Test: `src/ui/export/data-exporter-context.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import type { ReactNode } from 'react';
import { renderHook } from '@testing-library/react-native';
import { FakeDataExporter } from '../../test-support/fake-data-exporter';
import { DataExporterProvider, useDataExporter } from './data-exporter-context';

describe('useDataExporter', () => {
  it('returns the injected exporter', async () => {
    const exporter = new FakeDataExporter();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <DataExporterProvider exporter={exporter}>{children}</DataExporterProvider>
    );
    const { result } = await renderHook(() => useDataExporter(), { wrapper });
    expect(result.current).toBe(exporter);
  });

  it('throws when used outside the provider', async () => {
    await expect(renderHook(() => useDataExporter())).rejects.toThrow(
      'useDataExporter must be used within a DataExporterProvider',
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/ui/export/data-exporter-context.test.tsx`
Expected: FAIL — cannot find module `./data-exporter-context`.

- [ ] **Step 3: Write the implementation**

```tsx
import { createContext, useContext, type ReactNode } from 'react';
import type { DataExporter } from '../../ports/data-exporter';
import { expoDataExporter } from '../../infrastructure/export/expo-data-exporter';

const DataExporterContext = createContext<DataExporter | null>(null);

interface DataExporterProviderProps {
  /** Inject a fake (tests). Omit for the production expo adapter. */
  exporter?: DataExporter;
  children: ReactNode;
}

export function DataExporterProvider({ exporter, children }: DataExporterProviderProps) {
  return (
    <DataExporterContext.Provider value={exporter ?? expoDataExporter}>
      {children}
    </DataExporterContext.Provider>
  );
}

export function useDataExporter(): DataExporter {
  const exporter = useContext(DataExporterContext);
  if (!exporter) {
    throw new Error('useDataExporter must be used within a DataExporterProvider');
  }
  return exporter;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/ui/export/data-exporter-context.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/export/data-exporter-context.tsx src/ui/export/data-exporter-context.test.tsx
git commit -m "feat(export): DataExporterProvider + useDataExporter"
```

---

### Task 8: `NavRow` component

**Files:**
- Create: `src/ui/components/NavRow.tsx`
- Test: `src/ui/components/NavRow.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';
import { NavRow } from './NavRow';

describe('NavRow', () => {
  it('renders the label and subtitle and calls onPress', async () => {
    const onPress = jest.fn();
    await render(
      <NavRow label="Exportar mis datos" subtitle="Guarda una copia en tu móvil." onPress={onPress} />,
    );
    expect(screen.getByText('Exportar mis datos')).toBeTruthy();
    expect(screen.getByText('Guarda una copia en tu móvil.')).toBeTruthy();
    fireEvent.press(screen.getByText('Exportar mis datos'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders without a subtitle', async () => {
    await render(<NavRow label="Política de privacidad" onPress={() => {}} />);
    expect(screen.getByText('Política de privacidad')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/ui/components/NavRow.test.tsx`
Expected: FAIL — cannot find module `./NavRow`.

- [ ] **Step 3: Write the implementation**

```tsx
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppText } from './AppText';
import { colors, fontSizes, spacing } from '../theme';

interface NavRowProps {
  label: string;
  subtitle?: string;
  icon?: ComponentProps<typeof MaterialCommunityIcons>['name'];
  /** Paints the label and icon in the urgent (red) color. */
  destructive?: boolean;
  onPress: () => void;
}

/** Tappable settings row: optional leading icon, label, optional subtitle, trailing chevron. */
export function NavRow({ label, subtitle, icon, destructive, onPress }: NavRowProps) {
  const labelColor = destructive ? colors.urgency.urgent.base : colors.text;
  const iconColor = destructive ? colors.urgency.urgent.base : colors.textSecondary;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.root}>
      {icon ? <MaterialCommunityIcons name={icon} size={22} color={iconColor} /> : null}
      <View style={styles.body}>
        <AppText weight="bold" size={fontSizes.body} color={labelColor}>
          {label}
        </AppText>
        {subtitle ? (
          <AppText weight="semibold" size={fontSizes.small} color={colors.textMuted}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  body: { flex: 1, gap: 2 },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/ui/components/NavRow.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/NavRow.tsx src/ui/components/NavRow.test.tsx
git commit -m "feat(settings): NavRow (icon + label + subtitle + chevron, destructive variant)"
```

---

### Task 9: `ComingSoonRow` gains an optional subtitle

**Files:**
- Modify: `src/ui/components/ComingSoonRow.tsx`
- Test: `src/ui/components/ComingSoonRow.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/ui/components/ComingSoonRow.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native';
import { ComingSoonRow } from './ComingSoonRow';

describe('ComingSoonRow', () => {
  it('renders the label and the inert "Próximamente" badge', async () => {
    await render(<ComingSoonRow label="Tema" />);
    expect(screen.getByText('Tema')).toBeTruthy();
    expect(screen.getByText('Próximamente')).toBeTruthy();
  });

  it('renders an optional subtitle', async () => {
    await render(<ComingSoonRow label="Resumen semanal" subtitle="Un repaso de lo que se acerca, cada lunes." />);
    expect(screen.getByText('Un repaso de lo que se acerca, cada lunes.')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/ui/components/ComingSoonRow.test.tsx`
Expected: FAIL — the subtitle case fails (no `subtitle` prop / text not found).

- [ ] **Step 3: Update the implementation**

Replace the entire contents of `src/ui/components/ComingSoonRow.tsx` with:

```tsx
import { StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { colors, fontSizes, radii, spacing } from '../theme';

interface ComingSoonRowProps {
  label: string;
  subtitle?: string;
}

/** A visible but inert settings row: names a future feature without faking a control. */
export function ComingSoonRow({ label, subtitle }: ComingSoonRowProps) {
  return (
    <View style={styles.root}>
      <View style={styles.body}>
        <AppText weight="bold" size={fontSizes.body} color={colors.textSecondary}>
          {label}
        </AppText>
        {subtitle ? (
          <AppText weight="semibold" size={fontSizes.small} color={colors.textFaint}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      <View style={styles.badge}>
        <AppText weight="bold" size={fontSizes.small} color={colors.textFaint}>
          Próximamente
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  body: { flex: 1, gap: 2 },
  badge: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: radii.pill, backgroundColor: colors.surfaceSoft },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/ui/components/ComingSoonRow.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/ComingSoonRow.tsx src/ui/components/ComingSoonRow.test.tsx
git commit -m "feat(settings): ComingSoonRow supports an optional subtitle"
```

---

### Task 10: `SettingsSectionLabel`

**Files:**
- Create: `src/ui/components/SettingsSectionLabel.tsx`
- Test: `src/ui/components/SettingsSectionLabel.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react-native';
import { SettingsSectionLabel } from './SettingsSectionLabel';

describe('SettingsSectionLabel', () => {
  it('renders the label uppercased', async () => {
    await render(<SettingsSectionLabel label="Avisos" />);
    expect(screen.getByText('AVISOS')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/ui/components/SettingsSectionLabel.test.tsx`
Expected: FAIL — cannot find module `./SettingsSectionLabel`.

- [ ] **Step 3: Write the implementation**

```tsx
import { StyleSheet } from 'react-native';
import { AppText } from './AppText';
import { colors, fontSizes, spacing } from '../theme';

interface SettingsSectionLabelProps {
  label: string;
}

/** Uppercase settings section label (no dot/count, unlike the Home SectionHeader). */
export function SettingsSectionLabel({ label }: SettingsSectionLabelProps) {
  return (
    <AppText weight="extrabold" size={fontSizes.label} color={colors.textSecondary} style={styles.label}>
      {label.toUpperCase()}
    </AppText>
  );
}

const styles = StyleSheet.create({
  label: { letterSpacing: 1.5, marginTop: spacing.sm },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/ui/components/SettingsSectionLabel.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/SettingsSectionLabel.tsx src/ui/components/SettingsSectionLabel.test.tsx
git commit -m "feat(settings): SettingsSectionLabel"
```

---

### Task 11: `PrivacyScreen` + route

**Files:**
- Create: `src/ui/screens/PrivacyScreen.tsx`
- Test: `src/ui/screens/PrivacyScreen.test.tsx`
- Create: `app/privacy.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';
import { PrivacyScreen } from './PrivacyScreen';

describe('PrivacyScreen', () => {
  it('shows the title and the on-device privacy text', async () => {
    await render(<PrivacyScreen onClose={() => {}} />);
    expect(screen.getByText('Política de privacidad')).toBeTruthy();
    expect(screen.getByText(/únicamente en este dispositivo/)).toBeTruthy();
  });

  it('calls onClose from the close button', async () => {
    const onClose = jest.fn();
    await render(<PrivacyScreen onClose={onClose} />);
    fireEvent.press(screen.getByLabelText('Cerrar'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/ui/screens/PrivacyScreen.test.tsx`
Expected: FAIL — cannot find module `./PrivacyScreen`.

- [ ] **Step 3: Write the implementation**

`src/ui/screens/PrivacyScreen.tsx`:

```tsx
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppText } from '../components/AppText';
import { colors, fontSizes, radii, spacing } from '../theme';

interface PrivacyScreenProps {
  onClose: () => void;
}

// DRAFT copy — must be reviewed by the product owner before publishing. Not legally final.
// Written to be faithful to how the app actually behaves today (fully on-device).
const PARAGRAPHS = [
  'Nopasa guarda toda tu información únicamente en este dispositivo.',
  'No usamos servidores ni copias en la nube: tus vencimientos no salen de tu móvil.',
  'No recogemos ni enviamos datos personales ni de uso, ni a nosotros ni a terceros.',
  'Los avisos son notificaciones locales que programa tu propio dispositivo.',
  'Si borras la app o usas «Borrar todos los datos», esa información desaparece y no podemos recuperarla.',
];

/** Plain-language privacy policy. Draft — see the note above before publishing. */
export function PrivacyScreen({ onClose }: PrivacyScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <View style={[styles.handle, { marginTop: insets.top + spacing.sm }]} />
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={onClose} hitSlop={8}>
          <MaterialCommunityIcons name="close" size={26} color={colors.textSecondary} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: spacing.xxxl + insets.bottom }]}>
        <AppText weight="extrabold" size={fontSizes.title}>
          Política de privacidad
        </AppText>
        {PARAGRAPHS.map((text) => (
          <AppText key={text} weight="semibold" size={fontSizes.body} color={colors.textMuted}>
            {text}
          </AppText>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.screenBg, borderTopLeftRadius: radii.card, borderTopRightRadius: radii.card },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: radii.pill, backgroundColor: colors.textFaint, opacity: 0.4 },
  header: { alignItems: 'flex-end', paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  content: { padding: spacing.xl, gap: spacing.lg },
});
```

- [ ] **Step 4: Create the route**

`app/privacy.tsx`:

```tsx
import { useRouter } from 'expo-router';
import { PrivacyScreen } from '../src/ui/screens/PrivacyScreen';

export default function PrivacyRoute() {
  const router = useRouter();
  return <PrivacyScreen onClose={() => router.back()} />;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/ui/screens/PrivacyScreen.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/ui/screens/PrivacyScreen.tsx src/ui/screens/PrivacyScreen.test.tsx app/privacy.tsx
git commit -m "feat(settings): PrivacyScreen with draft on-device privacy copy + route"
```

---

### Task 12: Refactor `SettingsScreen` (cards, export, privacy link)

**Files:**
- Modify: `src/ui/screens/SettingsScreen.tsx`
- Test: `src/ui/screens/SettingsScreen.test.tsx`

- [ ] **Step 1: Replace the test file**

Replace the entire contents of `src/ui/screens/SettingsScreen.test.tsx` with:

```tsx
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { buildDeadline } from '../../test-support/build-deadline';
import { InMemoryDeadlineRepository } from '../../test-support/in-memory-deadline-repository';
import { FakeNotificationScheduler } from '../../test-support/fake-notification-scheduler';
import { InMemorySettingsRepository } from '../../test-support/in-memory-settings-repository';
import { FakeDataExporter } from '../../test-support/fake-data-exporter';
import type { Clock } from '../../domain/deadline/deadline.factory';
import { RepositoryProvider } from '../repository/repository-context';
import { DeadlineDepsProvider } from '../deadline-deps/deadline-deps-context';
import { NotificationSchedulerProvider } from '../notification-scheduler/notification-scheduler-context';
import { DataExporterProvider } from '../export/data-exporter-context';
import { SettingsProvider } from '../settings/settings-context';
import { SettingsScreen } from './SettingsScreen';

function renderScreen({
  repo = new InMemoryDeadlineRepository(),
  scheduler = new FakeNotificationScheduler(),
  settingsRepo = new InMemorySettingsRepository(),
  exporter = new FakeDataExporter(),
  clock = { now: () => new Date(2026, 5, 10) } as Clock,
  onClose = () => {},
  onOpenPrivacy = () => {},
}: {
  repo?: InMemoryDeadlineRepository;
  scheduler?: FakeNotificationScheduler;
  settingsRepo?: InMemorySettingsRepository;
  exporter?: FakeDataExporter;
  clock?: Clock;
  onClose?: () => void;
  onOpenPrivacy?: () => void;
} = {}) {
  return render(
    <RepositoryProvider repository={repo}>
      <DeadlineDepsProvider clock={clock}>
        <NotificationSchedulerProvider scheduler={scheduler}>
          <DataExporterProvider exporter={exporter}>
            <SettingsProvider repository={settingsRepo}>
              <SettingsScreen onClose={onClose} onOpenPrivacy={onOpenPrivacy} />
            </SettingsProvider>
          </DataExporterProvider>
        </NotificationSchedulerProvider>
      </DeadlineDepsProvider>
    </RepositoryProvider>,
  );
}

describe('SettingsScreen', () => {
  it('persists a new reminder time', async () => {
    const settingsRepo = new InMemorySettingsRepository();
    await renderScreen({ settingsRepo });

    fireEvent.press(await screen.findByText('09:00'));
    fireEvent(await screen.findByTestId('datetimepicker'), 'change', { type: 'set' }, new Date(2026, 0, 1, 8, 30));

    await waitFor(async () => expect((await settingsRepo.load()).reminderTime).toEqual({ hour: 8, minute: 30 }));
  });

  it('persists changed default reminders', async () => {
    const settingsRepo = new InMemorySettingsRepository(); // default [30, 7]
    await renderScreen({ settingsRepo });

    fireEvent.press(await screen.findByText('1 día')); // add 1 → [30, 7, 1]

    await waitFor(async () => expect((await settingsRepo.load()).defaultReminderDaysBefore).toEqual([30, 7, 1]));
  });

  it('exports all deadlines to a dated file', async () => {
    const repo = new InMemoryDeadlineRepository([buildDeadline({ id: '1' }), buildDeadline({ id: '2' })]);
    const exporter = new FakeDataExporter();
    await renderScreen({ repo, exporter, clock: { now: () => new Date(2026, 5, 10) } as Clock });

    fireEvent.press(await screen.findByText('Exportar mis datos'));

    await waitFor(() => expect(exporter.calls).toHaveLength(1));
    expect(exporter.calls[0].filename).toBe('nopasa-export-2026-06-10.json');
    const parsed = JSON.parse(exporter.calls[0].content);
    expect(parsed.app).toBe('nopasa');
    expect(parsed.schema).toBe(1);
    expect(parsed.deadlines).toHaveLength(2);
  });

  it('does not export when there are no deadlines and shows a message', async () => {
    const exporter = new FakeDataExporter();
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderScreen({ repo: new InMemoryDeadlineRepository(), exporter });

    fireEvent.press(await screen.findByText('Exportar mis datos'));

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith('No tienes vencimientos que exportar todavía'),
    );
    expect(exporter.calls).toHaveLength(0);
    alertSpy.mockRestore();
  });

  it('opens the privacy policy', async () => {
    const onOpenPrivacy = jest.fn();
    await renderScreen({ onOpenPrivacy });

    fireEvent.press(await screen.findByText('Política de privacidad'));

    expect(onOpenPrivacy).toHaveBeenCalledTimes(1);
  });

  it('deletes all deadlines (cancelling their reminders) after confirming', async () => {
    const repo = new InMemoryDeadlineRepository([buildDeadline({ id: '1' }), buildDeadline({ id: '2' })]);
    const scheduler = new FakeNotificationScheduler();
    const onClose = jest.fn();
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.style === 'destructive')?.onPress?.();
    });
    await renderScreen({ repo, scheduler, onClose });

    fireEvent.press(await screen.findByText('Borrar todos los datos'));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(await repo.list()).toHaveLength(0);
    expect([...scheduler.cancelled].sort()).toEqual(['1', '2']);
    alertSpy.mockRestore();
  });

  it('renders the sections, the inert "Próximamente" rows and the version', async () => {
    await renderScreen({});
    expect(await screen.findByText('AVISOS')).toBeTruthy();
    expect(screen.getByText('APARIENCIA')).toBeTruthy();
    expect(screen.getByText('PRIVACIDAD Y DATOS')).toBeTruthy();
    expect(screen.getByText('Resumen semanal')).toBeTruthy();
    expect(screen.getByText('Tema')).toBeTruthy();
    expect(screen.getByText('Nopasa Premium')).toBeTruthy();
    expect(screen.getAllByText('Próximamente')).toHaveLength(3);
    expect(screen.getByText(/Versión/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/ui/screens/SettingsScreen.test.tsx`
Expected: FAIL — `onOpenPrivacy` not a prop / no "Exportar mis datos" / "AVISOS" elements yet.

- [ ] **Step 3: Replace the implementation**

Replace the entire contents of `src/ui/screens/SettingsScreen.tsx` with:

```tsx
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ReminderTime } from '../notification/reminder-time';
import { useSettings } from '../settings/settings-context';
import { useDeadlineRepository } from '../repository/repository-context';
import { useNotificationScheduler } from '../notification-scheduler/notification-scheduler-context';
import { useDeadlineDeps } from '../deadline-deps/deadline-deps-context';
import { useDataExporter } from '../export/data-exporter-context';
import { buildDeadlineExport } from '../../domain/export/build-deadline-export';
import { exportFilename } from '../../domain/export/export-filename';
import { AppText } from '../components/AppText';
import { Card } from '../components/Card';
import { ComingSoonRow } from '../components/ComingSoonRow';
import { FormField } from '../components/FormField';
import { NavRow } from '../components/NavRow';
import { ReminderChips } from '../components/ReminderChips';
import { SettingsSectionLabel } from '../components/SettingsSectionLabel';
import { TimePickerField } from '../components/TimePickerField';
import { colors, fontSizes, radii, spacing } from '../theme';

interface SettingsScreenProps {
  onClose: () => void;
  onOpenPrivacy: () => void;
}

/** Settings screen. Real preferences are persisted; "Próximamente" rows are inert. */
export function SettingsScreen({ onClose, onOpenPrivacy }: SettingsScreenProps) {
  const { settings, save } = useSettings();
  const repository = useDeadlineRepository();
  const scheduler = useNotificationScheduler();
  const { clock } = useDeadlineDeps();
  const exporter = useDataExporter();
  const insets = useSafeAreaInsets();

  const persist = async (next: Parameters<typeof save>[0]) => {
    try {
      await save(next);
    } catch {
      Alert.alert('No se pudo guardar', 'Inténtalo de nuevo.');
    }
  };

  const onChangeTime = (reminderTime: ReminderTime) => persist({ ...settings, reminderTime });
  const onChangeReminders = (defaultReminderDaysBefore: number[]) =>
    persist({ ...settings, defaultReminderDaysBefore });

  const exportData = async () => {
    const all = await repository.list();
    if (all.length === 0) {
      Alert.alert('No tienes vencimientos que exportar todavía');
      return;
    }
    const now = clock.now();
    try {
      await exporter.export(exportFilename(now), buildDeadlineExport(all, { exportedAt: now }));
    } catch {
      Alert.alert('No se pudo exportar', 'Inténtalo de nuevo.');
    }
  };

  const deleteAllData = async () => {
    const all = await repository.list();
    for (const deadline of all) {
      try {
        await scheduler.cancel(deadline.id);
      } catch {
        // best-effort
      }
      await repository.delete(deadline.id);
    }
    onClose();
  };

  const confirmDelete = () =>
    Alert.alert(
      'Borrar todos los datos',
      'Se borrarán todos tus vencimientos de este dispositivo. Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Borrar', style: 'destructive', onPress: () => { void deleteAllData(); } },
      ],
    );

  const version = Constants.expoConfig?.version ?? '—';

  return (
    <View style={styles.root}>
      <View style={[styles.handle, { marginTop: insets.top + spacing.sm }]} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: spacing.xxxl + insets.bottom }]}>
        <AppText weight="extrabold" size={fontSizes.title}>
          Ajustes
        </AppText>

        <SettingsSectionLabel label="Avisos" />
        <Card style={styles.card}>
          <FormField label="Avisarme por defecto">
            <AppText weight="semibold" size={fontSizes.small} color={colors.textMuted}>
              Se aplica a cada vencimiento nuevo. Podrás cambiarlo en cada uno.
            </AppText>
            <ReminderChips value={settings.defaultReminderDaysBefore} onChange={onChangeReminders} />
          </FormField>
          <View style={styles.divider} />
          <FormField label="Hora del aviso">
            <TimePickerField value={settings.reminderTime} onChange={onChangeTime} />
          </FormField>
          <View style={styles.divider} />
          <ComingSoonRow label="Resumen semanal" subtitle="Un repaso de lo que se acerca, cada lunes." />
        </Card>

        <SettingsSectionLabel label="Apariencia" />
        <Card style={styles.card}>
          <ComingSoonRow label="Tema" />
        </Card>

        <SettingsSectionLabel label="Privacidad y datos" />
        <Card style={styles.card}>
          <View style={styles.privacyNote}>
            <MaterialCommunityIcons name="lock-outline" size={18} color={colors.urgency.calm.base} />
            <AppText weight="semibold" size={fontSizes.label} color={colors.urgency.calm.base} style={styles.privacyNoteText}>
              Todos tus datos se guardan solo en este dispositivo.
            </AppText>
          </View>
          <View style={styles.divider} />
          <NavRow
            icon="tray-arrow-down"
            label="Exportar mis datos"
            subtitle="Guarda una copia en tu móvil."
            onPress={() => { void exportData(); }}
          />
          <View style={styles.divider} />
          <NavRow
            icon="trash-can-outline"
            label="Borrar todos los datos"
            subtitle="No se puede deshacer."
            destructive
            onPress={confirmDelete}
          />
        </Card>

        <Card style={styles.card}>
          <ComingSoonRow label="Nopasa Premium" subtitle="Copias de seguridad · ítems ilimitados." />
          <View style={styles.divider} />
          <NavRow icon="shield-lock-outline" label="Política de privacidad" onPress={onOpenPrivacy} />
        </Card>

        <AppText weight="semibold" size={fontSizes.small} color={colors.textFaint} style={styles.version}>
          Versión {version}
        </AppText>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.screenBg, borderTopLeftRadius: radii.card, borderTopRightRadius: radii.card },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: radii.pill, backgroundColor: colors.textFaint, opacity: 0.4 },
  content: { padding: spacing.xl, gap: spacing.md },
  card: { gap: spacing.md },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.textFaint, opacity: 0.3 },
  privacyNote: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  privacyNoteText: { flex: 1 },
  version: { textAlign: 'center', marginTop: spacing.sm },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/ui/screens/SettingsScreen.test.tsx`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/ui/screens/SettingsScreen.tsx src/ui/screens/SettingsScreen.test.tsx
git commit -m "feat(settings): card structure, export action and privacy link"
```

---

### Task 13: Wire the route prop and mount the provider

**Files:**
- Modify: `app/settings.tsx`
- Modify: `app/_layout.tsx`

No new unit tests (route files import `expo-router`, not exercised under jest; verified by typecheck + the suite staying green).

- [ ] **Step 1: Pass `onOpenPrivacy` from the settings route**

Replace the entire contents of `app/settings.tsx` with:

```tsx
import { useRouter } from 'expo-router';
import { SettingsScreen } from '../src/ui/screens/SettingsScreen';

export default function SettingsRoute() {
  const router = useRouter();
  return <SettingsScreen onClose={() => router.back()} onOpenPrivacy={() => router.push('/privacy')} />;
}
```

- [ ] **Step 2: Mount `DataExporterProvider` and register the privacy route**

In `app/_layout.tsx`, add the import next to the others:

```tsx
import { DataExporterProvider } from '../src/ui/export/data-exporter-context';
```

Replace the provider/Stack block with:

```tsx
    <SafeAreaProvider>
      <RepositoryProvider>
        <DeadlineDepsProvider>
          <NotificationSchedulerProvider>
            <DataExporterProvider>
              <SettingsProvider>
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="index" />
                  <Stack.Screen name="add" options={{ presentation: 'modal' }} />
                  <Stack.Screen name="deadline/[id]" options={{ presentation: 'modal' }} />
                  <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
                  <Stack.Screen name="privacy" options={{ presentation: 'modal' }} />
                </Stack>
              </SettingsProvider>
            </DataExporterProvider>
          </NotificationSchedulerProvider>
        </DeadlineDepsProvider>
      </RepositoryProvider>
    </SafeAreaProvider>
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/settings.tsx app/_layout.tsx
git commit -m "feat(settings): mount DataExporterProvider and wire the privacy route"
```

---

### Task 14: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the whole test suite**

Run: `npm test`
Expected: PASS — all previous tests plus the new ones green.

- [ ] **Step 2: Typecheck the project**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Confirm the bundle builds**

Run: `npx expo export --platform android`
Expected: exports `dist/` with no resolution errors (resolves `expo-file-system`, `expo-sharing`, the new modules, and the `privacy` route). Then delete the artifact: `rm -rf dist`.

- [ ] **Step 4: Commit (only if anything was adjusted during verification)**

```bash
git add -A
git commit -m "chore(settings): finalize settings screen completion"
```

---

## Self-review notes

- **Spec coverage:** card structure + section labels (Tasks 10, 12); inert rows with subtitle in their real sections (Tasks 9, 12); NavRow incl. destructive (Task 8); shared local-date helper (Task 1); pure `buildDeadlineExport` + `exportFilename` in `domain/export` (Tasks 2, 3); `DataExporter` port (Task 4), fake (Task 5), SDK-56 adapter + jest mocks + deps (Task 6), provider/hook (Task 7); export action with empty-list guard and best-effort failure (Task 12); privacy screen (draft copy) + route + nav link (Tasks 11, 12, 13); provider mount + route registration (Task 13); verification (Task 14). All spec sections map to a task.
- **Honesty:** Resumen semanal / Tema / Premium stay inert `ComingSoonRow`s (badge, no fake control), diverging from the mockup's live controls by design.
- **Type consistency:** `DataExporter.export(filename, content)` is identical across port, fake, adapter, provider, and the screen call. `buildDeadlineExport(deadlines, { exportedAt })` and `exportFilename(date)` signatures match their call sites. `clock` comes from `useDeadlineDeps().clock` (`Clock` from `deadline.factory`). `NavRow` props (`label`, `subtitle?`, `icon?`, `destructive?`, `onPress`) match every usage. `ComingSoonRow` gains `subtitle?` without breaking existing label-only usage.
- **No domain/port regressions:** existing domain models and ports untouched; only the new `DataExporter` port is added. The `local-date` extraction preserves `deadline-mapper` behavior (its tests stay green).
- **Out of scope honored:** Ayuda, import/restore, real Resumen/Tema/Premium behavior, hosting the policy at a URL, deadline editing, iOS, photo/OCR.

# Photo capture + confirm screen (Block 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the photo path work end-to-end with manual fill-in — pick photo/manual → capture photo → confirm screen (form, prefilled empty, with thumbnail) → save with a stable `photoUri` → see the photo in detail. **No OCR.**

**Architecture:** `/add` becomes a selector screen; routes live under `app/add/`. The existing manual form is extracted into a reusable `DeadlineForm` that both the manual and confirm screens render. Photos are copied from the OS cache to stable storage on save via a new `PhotoStore` port (expo-file-system adapter + fake). Domain and SQLite already round-trip `photoUri` — they are untouched.

**Tech Stack:** Expo SDK 56 (expo-router, expo-camera, expo-file-system v56 `File`/`Directory`/`Paths` API), React Native, TypeScript, Zod, Jest + @testing-library/react-native.

---

## Conventions (apply to every task)

- **All code, identifiers, comments, commit messages in English.** Spanish UI copy stays Spanish.
- **TDD**: write the failing test, run it red, implement minimal, run it green, commit. Use `superpowers:test-driven-development`.
- **Commits**: conventional-commit style (e.g. `feat(photo): ...`). **No `Co-Authored-By: Claude` / Claude signature.**
- **Test command:** `npm test` (`cross-env TZ=Europe/Madrid jest --passWithNoTests`). **Typecheck:** `npm run typecheck`.
- Jest `roots` is `<rootDir>/src` only → **every test file lives under `src/`**. Files in `app/` cannot be unit-tested (consistent with the existing untested `app/add.tsx`).
- Expo SDK 56 changed APIs — use exactly the signatures given here; when unsure, read `https://docs.expo.dev/versions/v56.0.0/`.
- Component tests: `render()` is async — `await render(...)`; after each state-changing `fireEvent`, `await` a `findBy*`/`waitFor` to flush the deferred re-render before the next interaction.

**Known pre-existing failure (not caused by this work):** `src/ui/screens/DeadlineDetailScreen.test.tsx` has one date-dependent failure — an ITV fixture dated `2026-06-11` now reads as expired (today is past it), so `/^Caduca/` no longer matches. It is fixed inside Task 10. Until then, "all tests pass" means "all except that one known failure."

---

## File Structure

**New (all with tests alongside, under `src/`):**
- `src/ports/photo-store.ts` — `PhotoStore` interface (bare port, no test).
- `src/test-support/fake-photo-store.ts` (+ test) — records calls, deterministic stable uri.
- `src/infrastructure/photos/expo-file-system-photo-store.ts` (+ test) — copies cache → `document/photos/`.
- `src/ui/photo-store/photo-store-context.tsx` (+ test) — provider + hook.
- `src/ui/components/DeadlineForm.tsx` (+ test) — extracted shared form.
- `src/ui/screens/AddOptionsScreen.tsx` (+ test) — selector.
- `src/ui/screens/CameraCaptureScreen.tsx` (+ test) — expo-camera capture.
- `src/ui/screens/ConfirmDeadlineScreen.tsx` (+ test) — thin `DeadlineForm` wrapper.
- `app/add/index.tsx`, `app/add/manual.tsx`, `app/add/camera.tsx`, `app/add/confirm.tsx` — route wiring (no tests; in `app/`).

**Modified:**
- `src/ui/deadline/add-form.ts` (+ test) — `toCreateInput(state, photoUri?)`.
- `src/ui/screens/AddDeadlineScreen.tsx` (+ test) — thin wrapper over `DeadlineForm`.
- `src/ui/screens/DeadlineDetailScreen.tsx` (+ test) — photo thumbnail; fix date fixture.
- `app/_layout.tsx` — add `PhotoStoreProvider`; replace `add` Stack.Screen with `add/*`.
- `app.json` — expo-camera plugin + `android.permission.CAMERA`.
- Remove `app/add.tsx`.

**Untouched (verified):** domain factory (`CreateDeadlineInput.photoUri?` exists), `deadline.schema.ts` (`photoUri: z.string().optional()`), SQLite mapper/columns. Real SQLite round-trip of `photoUri` is already asserted in `sqlite-deadline-repository.test.ts` and `deadline-mapper.test.ts` — do **not** add a new persistence test.

---

## Task 1: `toCreateInput(state, photoUri?)`

**Files:**
- Modify: `src/ui/deadline/add-form.ts`
- Test: `src/ui/deadline/add-form.test.ts`

- [ ] **Step 1: Write the failing tests** (append to the existing `toCreateInput` describe block; read the file first to match style)

```ts
it('includes photoUri when passed', () => {
  const state = baseState({ title: 'ITV' }); // use whatever factory/inline state the existing tests use
  expect(toCreateInput(state, 'file:///photos/a.jpg')).toMatchObject({ photoUri: 'file:///photos/a.jpg' });
});

it('omits photoUri when not passed', () => {
  const state = baseState({ title: 'ITV' });
  expect('photoUri' in toCreateInput(state)).toBe(false);
});
```

- [ ] **Step 2: Run red** — `npm test -- add-form` → FAIL (second arg / property missing).

- [ ] **Step 3: Implement**

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
    ...(photoUri ? { photoUri } : {}),
  };
}
```

- [ ] **Step 4: Run green** — `npm test -- add-form` → PASS. `npm run typecheck` → clean.

- [ ] **Step 5: Commit** — `feat(photo): thread optional photoUri through toCreateInput`

---

## Task 2: `PhotoStore` port + `FakePhotoStore`

**Files:**
- Create: `src/ports/photo-store.ts`
- Create: `src/test-support/fake-photo-store.ts`
- Test: `src/test-support/fake-photo-store.test.ts`

- [ ] **Step 1: Write the port** (bare interface, no test — matches repo convention for bare ports)

```ts
// src/ports/photo-store.ts
/** Effects port: moves a captured photo into stable app storage. UI depends on this,
 *  never on expo-file-system directly. */
export interface PhotoStore {
  /** Copy the photo at `sourceUri` into stable app storage; returns the stable uri. */
  persist(sourceUri: string): Promise<string>;
}
```

- [ ] **Step 2: Write the failing fake test**

```ts
// src/test-support/fake-photo-store.test.ts
import { FakePhotoStore } from './fake-photo-store';

describe('FakePhotoStore', () => {
  it('records the source and returns a deterministic stable uri', async () => {
    const store = new FakePhotoStore();
    const uri = await store.persist('file:///cache/cam1.jpg');
    expect(uri).toBe('stable:///0.jpg');
    expect(store.persisted).toEqual(['file:///cache/cam1.jpg']);
  });

  it('increments the stable uri per call', async () => {
    const store = new FakePhotoStore();
    await store.persist('file:///cache/a.jpg');
    expect(await store.persist('file:///cache/b.jpg')).toBe('stable:///1.jpg');
    expect(store.persisted).toEqual(['file:///cache/a.jpg', 'file:///cache/b.jpg']);
  });
});
```

- [ ] **Step 3: Run red** — `npm test -- fake-photo-store` → FAIL (module not found).

- [ ] **Step 4: Implement the fake**

```ts
// src/test-support/fake-photo-store.ts
import type { PhotoStore } from '../ports/photo-store';

/** In-memory PhotoStore for tests. Records each source uri and returns a
 *  deterministic stable uri (`stable:///<n>.jpg`) so tests can assert the
 *  stored photoUri is the stable one, not the source. */
export class FakePhotoStore implements PhotoStore {
  readonly persisted: string[] = [];

  async persist(sourceUri: string): Promise<string> {
    const uri = `stable:///${this.persisted.length}.jpg`;
    this.persisted.push(sourceUri);
    return uri;
  }
}
```

- [ ] **Step 5: Run green** — `npm test -- fake-photo-store` → PASS. `npm run typecheck` → clean.

- [ ] **Step 6: Commit** — `feat(photo): add PhotoStore port and FakePhotoStore`

---

## Task 3: expo-file-system `PhotoStore` adapter

**Files:**
- Create: `src/infrastructure/photos/expo-file-system-photo-store.ts`
- Test: `src/infrastructure/photos/expo-file-system-photo-store.test.ts`

Reference pattern — `src/infrastructure/export/expo-data-exporter.ts` (const-object adapter importing `{ File, Paths }` from `expo-file-system`).

**expo-file-system v56 API (use exactly this — NOT legacy `FileSystem.copyAsync`/`documentDirectory`):**
- `import { File, Directory, Paths } from 'expo-file-system';`
- `Paths.document` / `Paths.cache` → `Directory`.
- `new Directory(Paths.document, 'photos')` → `.uri`, `.exists` (boolean), `.create(options?)`.
- `new File(dir, name)` / `new File(sourceUri)` → `.uri`, `.extension` (e.g. `'.jpg'`), `.copy(dest: File|Directory): Promise<void>`.
- `randomUUID()` from `expo-crypto` (globally mocked in `jest.setup.js` to a fixed uuid).

- [ ] **Step 1: Write the failing test** (module-level `jest.mock` for `expo-file-system`, because the global `jest.setup.js` mock only has `Paths` + a minimal `File`)

```ts
// src/infrastructure/photos/expo-file-system-photo-store.test.ts
const created: string[] = [];
const copies: Array<{ from: string; to: string }> = [];
let dirExists = false;

jest.mock('expo-file-system', () => {
  class Directory {
    uri: string;
    constructor(...parts: any[]) { this.uri = parts.map((p) => (p?.uri ?? p)).join('/'); }
    get exists() { return dirExists; }
    create() { created.push(this.uri); }
  }
  class File {
    uri: string;
    constructor(...parts: any[]) { this.uri = parts.map((p) => (p?.uri ?? p)).join('/'); }
    get extension() { const m = this.uri.match(/\.[^./]+$/); return m ? m[0] : ''; }
    async copy(dest: any) { copies.push({ from: this.uri, to: dest.uri }); }
  }
  return {
    __esModule: true,
    Paths: { document: { uri: 'file:///document' }, cache: { uri: 'file:///cache' } },
    Directory,
    File,
  };
});

import { expoFileSystemPhotoStore } from './expo-file-system-photo-store';
// expo-crypto is globally mocked to randomUUID() === '00000000-0000-4000-8000-000000000000'

beforeEach(() => { created.length = 0; copies.length = 0; dirExists = false; });

describe('expoFileSystemPhotoStore', () => {
  it('copies the source into document/photos under a uuid name and returns that uri', async () => {
    const result = await expoFileSystemPhotoStore.persist('file:///cache/cam.jpg');
    expect(result).toBe('file:///document/photos/00000000-0000-4000-8000-000000000000.jpg');
    expect(copies).toEqual([
      { from: 'file:///cache/cam.jpg', to: 'file:///document/photos/00000000-0000-4000-8000-000000000000.jpg' },
    ]);
  });

  it('creates the photos directory when it does not exist', async () => {
    dirExists = false;
    await expoFileSystemPhotoStore.persist('file:///cache/cam.jpg');
    expect(created).toEqual(['file:///document/photos']);
  });

  it('does not create the photos directory when it already exists', async () => {
    dirExists = true;
    await expoFileSystemPhotoStore.persist('file:///cache/cam.jpg');
    expect(created).toEqual([]);
  });

  it('defaults the extension to .jpg when the source has none', async () => {
    const result = await expoFileSystemPhotoStore.persist('file:///cache/cam');
    expect(result).toBe('file:///document/photos/00000000-0000-4000-8000-000000000000.jpg');
  });
});
```

- [ ] **Step 2: Run red** — `npm test -- expo-file-system-photo-store` → FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
// src/infrastructure/photos/expo-file-system-photo-store.ts
import { randomUUID } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import type { PhotoStore } from '../../ports/photo-store';

/**
 * Copies a captured photo from the OS cache (which can be evicted) into the app's
 * stable document directory under `photos/`, using a self-generated uuid filename
 * (not coupled to any deadline id, which doesn't exist at persist time). Thin
 * wrapper over expo-file-system — mocked in tests.
 */
export const expoFileSystemPhotoStore: PhotoStore = {
  async persist(sourceUri: string): Promise<string> {
    const dir = new Directory(Paths.document, 'photos');
    if (!dir.exists) dir.create();
    const source = new File(sourceUri);
    const extension = source.extension || '.jpg';
    const dest = new File(dir, `${randomUUID()}${extension}`);
    await source.copy(dest);
    return dest.uri;
  },
};
```

- [ ] **Step 4: Run green** — `npm test -- expo-file-system-photo-store` → PASS. `npm run typecheck` → clean.

- [ ] **Step 5: Commit** — `feat(photo): add expo-file-system PhotoStore adapter`

---

## Task 4: `PhotoStoreProvider` + `usePhotoStore`, wired into `_layout`

**Files:**
- Create: `src/ui/photo-store/photo-store-context.tsx`
- Test: `src/ui/photo-store/photo-store-context.test.tsx`
- Modify: `app/_layout.tsx`

Mirror `src/ui/notification-scheduler/notification-scheduler-context.tsx` exactly (same shape). The test should mirror `src/ui/notification-scheduler/notification-scheduler-context.test.tsx` — read it first.

- [ ] **Step 1: Write the failing test**

```ts
// src/ui/photo-store/photo-store-context.test.tsx
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { FakePhotoStore } from '../../test-support/fake-photo-store';
import { PhotoStoreProvider, usePhotoStore } from './photo-store-context';

function Probe() {
  const store = usePhotoStore();
  return <Text>{store ? 'has-store' : 'no-store'}</Text>;
}

describe('PhotoStoreProvider / usePhotoStore', () => {
  it('provides the injected store', async () => {
    await render(
      <PhotoStoreProvider store={new FakePhotoStore()}>
        <Probe />
      </PhotoStoreProvider>,
    );
    expect(screen.getByText('has-store')).toBeTruthy();
  });

  it('throws when used outside a provider', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow('usePhotoStore must be used within a PhotoStoreProvider');
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run red** — `npm test -- photo-store-context` → FAIL.

- [ ] **Step 3: Implement the context**

```tsx
// src/ui/photo-store/photo-store-context.tsx
import { createContext, useContext, type ReactNode } from 'react';
import type { PhotoStore } from '../../ports/photo-store';
import { expoFileSystemPhotoStore } from '../../infrastructure/photos/expo-file-system-photo-store';

const PhotoStoreContext = createContext<PhotoStore | null>(null);

interface PhotoStoreProviderProps {
  /** Inject a fake (tests). Omit for the production expo-file-system adapter. */
  store?: PhotoStore;
  children: ReactNode;
}

export function PhotoStoreProvider({ store, children }: PhotoStoreProviderProps) {
  return (
    <PhotoStoreContext.Provider value={store ?? expoFileSystemPhotoStore}>
      {children}
    </PhotoStoreContext.Provider>
  );
}

export function usePhotoStore(): PhotoStore {
  const store = useContext(PhotoStoreContext);
  if (!store) {
    throw new Error('usePhotoStore must be used within a PhotoStoreProvider');
  }
  return store;
}
```

- [ ] **Step 4: Run green** — `npm test -- photo-store-context` → PASS.

- [ ] **Step 5: Wire into `app/_layout.tsx`** — add the import and wrap the provider stack (place it next to the other effect providers, e.g. just inside `NotificationSchedulerProvider`):

```tsx
import { PhotoStoreProvider } from '../src/ui/photo-store/photo-store-context';
```
Then add `<PhotoStoreProvider>` … `</PhotoStoreProvider>` around the existing inner providers (anywhere in the stack that wraps the `<Stack>`). Keep indentation consistent.

- [ ] **Step 6: Verify** — `npm test` (all pass except the known Task-10 failure). `npm run typecheck` → clean.

- [ ] **Step 7: Commit** — `feat(photo): add PhotoStoreProvider and wire it into the app`

---

## Task 5: Extract `DeadlineForm`; make `AddDeadlineScreen` a thin wrapper

**Files:**
- Create: `src/ui/components/DeadlineForm.tsx`
- Test: `src/ui/components/DeadlineForm.test.tsx`
- Modify: `src/ui/screens/AddDeadlineScreen.tsx`
- Modify: `src/ui/screens/AddDeadlineScreen.test.tsx`

**What moves:** the entire body of the current `AddDeadlineScreen` (state, `validateAddForm`, `onSave`, the JSX over `TypeSelector`/`FormField`/`DatePickerField`/`ReminderChips`/past-reminder hint, and the `styles`) moves into `DeadlineForm`. Read the current `AddDeadlineScreen.tsx` and move it verbatim, then apply the diffs below.

**`DeadlineForm` props:**
```ts
interface DeadlineFormProps {
  heading: string;
  photoUri?: string;                      // present → thumbnail + threaded into save
  initialValues?: Partial<AddFormState>;  // merged over defaults (empty in Block 1)
  onClose: () => void;
}
```

**Behavior changes vs. the old screen:**
1. The heading text comes from `props.heading` (was the literal `"Añadir un vencimiento"`).
2. Initial state merges `initialValues` over the existing defaults:
   ```ts
   const [state, setState] = useState<AddFormState>(() => ({
     type: 'OTHER',
     title: '',
     subtitle: defaultSubtitle('OTHER'),
     subtitleTouched: false,
     dueDate: startOfDay(deps.clock.now()),
     amount: '',
     reminderDaysBefore: settings.defaultReminderDaysBefore,
     ...initialValues,
   }));
   ```
3. Add `const photoStore = usePhotoStore();` and thread the photo into save:
   ```ts
   const onSave = async () => {
     if (!valid || submitting.current) return;
     submitting.current = true;
     try {
       const stableUri = photoUri ? await photoStore.persist(photoUri) : undefined;
       await createDeadline(toCreateInput(state, stableUri));
       onClose();
     } catch {
       submitting.current = false;
       Alert.alert('No se pudo guardar', 'Inténtalo de nuevo.');
     }
   };
   ```
4. When `photoUri` is set, render a thumbnail just under the heading. Use RN `Image`:
   ```tsx
   import { Image } from 'react-native';
   ...
   {photoUri ? (
     <Image testID="deadline-photo-thumbnail" source={{ uri: photoUri }} style={styles.thumbnail} resizeMode="cover" />
   ) : null}
   ```
   Add to styles: `thumbnail: { width: '100%', height: 180, borderRadius: radii.card, backgroundColor: colors.surfaceSoft }`.

- [ ] **Step 1: Write the failing `DeadlineForm` test** (integration with fakes; mirror `AddDeadlineScreen.test.tsx` provider wiring **plus** `PhotoStoreProvider`)

```tsx
// src/ui/components/DeadlineForm.test.tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { InMemoryDeadlineRepository } from '../../test-support/in-memory-deadline-repository';
import { InMemorySettingsRepository } from '../../test-support/in-memory-settings-repository';
import { FakeNotificationScheduler } from '../../test-support/fake-notification-scheduler';
import { FakePhotoStore } from '../../test-support/fake-photo-store';
import { RepositoryProvider } from '../repository/repository-context';
import { DeadlineDepsProvider } from '../deadline-deps/deadline-deps-context';
import { NotificationSchedulerProvider } from '../notification-scheduler/notification-scheduler-context';
import { PhotoStoreProvider } from '../photo-store/photo-store-context';
import { SettingsProvider } from '../settings/settings-context';
import { DeadlineForm } from './DeadlineForm';

function renderForm(opts: {
  repo: InMemoryDeadlineRepository;
  photoStore?: FakePhotoStore;
  photoUri?: string;
  onClose?: () => void;
}) {
  const photoStore = opts.photoStore ?? new FakePhotoStore();
  return render(
    <RepositoryProvider repository={opts.repo}>
      <DeadlineDepsProvider generateId={() => 'fixed-id'} clock={{ now: () => new Date(2026, 5, 8) }}>
        <NotificationSchedulerProvider scheduler={new FakeNotificationScheduler()}>
          <PhotoStoreProvider store={photoStore}>
            <SettingsProvider repository={new InMemorySettingsRepository()}>
              <DeadlineForm heading="Confirma los datos" photoUri={opts.photoUri} onClose={opts.onClose ?? (() => {})} />
            </SettingsProvider>
          </PhotoStoreProvider>
        </NotificationSchedulerProvider>
      </DeadlineDepsProvider>
    </RepositoryProvider>,
  );
}

describe('DeadlineForm', () => {
  it('renders the heading and a thumbnail when photoUri is set', async () => {
    await renderForm({ repo: new InMemoryDeadlineRepository(), photoUri: 'file:///cache/cam.jpg' });
    expect(screen.getByText('Confirma los datos')).toBeTruthy();
    expect(screen.getByTestId('deadline-photo-thumbnail')).toBeTruthy();
  });

  it('persists the photo on save and stores the STABLE uri, then closes', async () => {
    const repo = new InMemoryDeadlineRepository();
    const photoStore = new FakePhotoStore();
    const onClose = jest.fn();
    await renderForm({ repo, photoStore, photoUri: 'file:///cache/cam.jpg', onClose });

    fireEvent.changeText(await screen.findByPlaceholderText('Ej. ITV del coche'), 'ITV del coche');
    await screen.findByDisplayValue('ITV del coche');
    fireEvent.press(screen.getByText('Guardar'));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(photoStore.persisted).toEqual(['file:///cache/cam.jpg']);
    const saved = await repo.findById('fixed-id');
    expect(saved?.photoUri).toBe('stable:///0.jpg');
  });

  it('does not persist or set photoUri on a manual save (no photoUri)', async () => {
    const repo = new InMemoryDeadlineRepository();
    const photoStore = new FakePhotoStore();
    await renderForm({ repo, photoStore });

    fireEvent.changeText(await screen.findByPlaceholderText('Ej. ITV del coche'), 'Manual');
    await screen.findByDisplayValue('Manual');
    fireEvent.press(screen.getByText('Guardar'));

    await waitFor(async () => expect(await repo.findById('fixed-id')).not.toBeNull());
    expect(photoStore.persisted).toEqual([]);
    expect((await repo.findById('fixed-id'))?.photoUri).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run red** — `npm test -- DeadlineForm` → FAIL (module not found).

- [ ] **Step 3: Create `DeadlineForm.tsx`** — move the old screen body in, apply the 4 behavior changes above. The component signature is `export function DeadlineForm({ heading, photoUri, initialValues, onClose }: DeadlineFormProps)`. Keep all existing imports it needs; add `Image` (react-native), `usePhotoStore`. Move the `styles` block too and add `thumbnail`.

- [ ] **Step 4: Run green** — `npm test -- DeadlineForm` → PASS.

- [ ] **Step 5: Reduce `AddDeadlineScreen.tsx` to a thin wrapper**

```tsx
// src/ui/screens/AddDeadlineScreen.tsx
import { DeadlineForm } from '../components/DeadlineForm';

interface AddDeadlineScreenProps {
  onClose: () => void;
}

/** Manual add-a-deadline form (thin wrapper over the shared DeadlineForm). */
export function AddDeadlineScreen({ onClose }: AddDeadlineScreenProps) {
  return <DeadlineForm heading="Añadir un vencimiento" onClose={onClose} />;
}
```

- [ ] **Step 6: Fix `AddDeadlineScreen.test.tsx`** — add `PhotoStoreProvider` (with a `FakePhotoStore`) to its `renderScreen` wrapper so `usePhotoStore` resolves. Add imports:
```tsx
import { FakePhotoStore } from '../../test-support/fake-photo-store';
import { PhotoStoreProvider } from '../photo-store/photo-store-context';
```
Wrap `<AddDeadlineScreen .../>` with `<PhotoStoreProvider store={new FakePhotoStore()}>…</PhotoStoreProvider>` inside the existing provider tree. All existing assertions stay unchanged.

- [ ] **Step 7: Run green** — `npm test -- AddDeadlineScreen DeadlineForm` → PASS. Full `npm test` (all pass except the known Task-10 failure). `npm run typecheck` → clean.

- [ ] **Step 8: Commit** — `refactor(photo): extract DeadlineForm; thread photo persistence on save`

---

## Task 6: `AddOptionsScreen` (selector)

**Files:**
- Create: `src/ui/screens/AddOptionsScreen.tsx`
- Test: `src/ui/screens/AddOptionsScreen.test.tsx`

Per mockup `docs/design/añadir-vencimiento.png`: two large choices — "Hacer una foto" and "Escribirlo a mano" — and a footer line "Se lee en tu móvil. Nada se sube a internet." Props: `{ onPhoto, onManual, onClose }`. Reuse existing UI primitives (`AppText`, `Button` or `ActionButton`, the modal `handle` + `styles.root` pattern from `AddDeadlineScreen`/`DeadlineDetailScreen`). Match the app's theme tokens (`colors`, `spacing`, `radii`, `fontSizes`).

- [ ] **Step 1: Write the failing test**

```tsx
// src/ui/screens/AddOptionsScreen.test.tsx
import { fireEvent, render, screen } from '@testing-library/react-native';
import { AddOptionsScreen } from './AddOptionsScreen';

describe('AddOptionsScreen', () => {
  it('fires onPhoto when the photo option is pressed', async () => {
    const onPhoto = jest.fn();
    await render(<AddOptionsScreen onPhoto={onPhoto} onManual={() => {}} onClose={() => {}} />);
    fireEvent.press(screen.getByText('Hacer una foto'));
    expect(onPhoto).toHaveBeenCalledTimes(1);
  });

  it('fires onManual when the manual option is pressed', async () => {
    const onManual = jest.fn();
    await render(<AddOptionsScreen onPhoto={() => {}} onManual={onManual} onClose={() => {}} />);
    fireEvent.press(screen.getByText('Escribirlo a mano'));
    expect(onManual).toHaveBeenCalledTimes(1);
  });

  it('shows the privacy footer', async () => {
    await render(<AddOptionsScreen onPhoto={() => {}} onManual={() => {}} onClose={() => {}} />);
    expect(screen.getByText('Se lee en tu móvil. Nada se sube a internet.')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run red** — `npm test -- AddOptionsScreen` → FAIL.

- [ ] **Step 3: Implement** the selector. Two pressable rows/buttons whose labels are exactly `Hacer una foto` and `Escribirlo a mano`, calling `onPhoto`/`onManual`; a footer `AppText` with exactly `Se lee en tu móvil. Nada se sube a internet.`. Follow the modal `root` + `handle` layout of `AddDeadlineScreen` (with `useSafeAreaInsets`). Keep it focused.

- [ ] **Step 4: Run green** — `npm test -- AddOptionsScreen` → PASS. `npm run typecheck` → clean.

- [ ] **Step 5: Commit** — `feat(photo): add AddOptionsScreen selector`

---

## Task 7: `CameraCaptureScreen` (expo-camera)

**Files:**
- Modify: `package.json` (install expo-camera)
- Create: `src/ui/screens/CameraCaptureScreen.tsx`
- Test: `src/ui/screens/CameraCaptureScreen.test.tsx`

**Install first:** `npx expo install expo-camera` (gets the SDK-56-compatible version). Read `https://docs.expo.dev/versions/v56.0.0/sdk/camera/` to confirm the API.

**expo-camera v56 API used:**
- `import { CameraView, useCameraPermissions } from 'expo-camera';`
- `const [permission, requestPermission] = useCameraPermissions();` → `permission` has `.granted` (boolean) and `.canAskAgain`; can be `null` initially.
- `<CameraView ref={ref} style={...} facing="back" />`; capture via `await ref.current.takePictureAsync()` → `{ uri }`.

**Props:** `{ onCaptured(uri: string): void; onCancel(): void }`.
**Permission flow (in context, best-effort):** on mount, if `permission` not granted, call `requestPermission()`. If denied (`!permission.granted` after asking), show a short Spanish message and a button that calls `onCancel`. Never crash.

- [ ] **Step 1: Write the failing test** (mock `expo-camera` at the top of the test file)

```tsx
// src/ui/screens/CameraCaptureScreen.test.tsx
const takePictureAsync = jest.fn(async () => ({ uri: 'file:///cache/captured.jpg' }));
let mockPermission: { granted: boolean; canAskAgain: boolean } | null = { granted: true, canAskAgain: true };
const requestPermission = jest.fn(async () => mockPermission);

jest.mock('expo-camera', () => {
  const React = require('react');
  const { View, Pressable, Text } = require('react-native');
  return {
    __esModule: true,
    useCameraPermissions: () => [mockPermission, requestPermission],
    CameraView: React.forwardRef((props: any, ref: any) => {
      React.useImperativeHandle(ref, () => ({ takePictureAsync }));
      // expose a pressable proxy for the shutter via testID on a child
      return React.createElement(View, { testID: 'camera-view' }, props.children);
    }),
  };
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { CameraCaptureScreen } from './CameraCaptureScreen';

beforeEach(() => {
  mockPermission = { granted: true, canAskAgain: true };
  takePictureAsync.mockClear();
  requestPermission.mockClear();
});

describe('CameraCaptureScreen', () => {
  it('captures a photo and fires onCaptured with the uri', async () => {
    const onCaptured = jest.fn();
    await render(<CameraCaptureScreen onCaptured={onCaptured} onCancel={() => {}} />);
    fireEvent.press(await screen.findByTestId('shutter'));
    await waitFor(() => expect(onCaptured).toHaveBeenCalledWith('file:///cache/captured.jpg'));
  });

  it('shows a message and allows cancel when permission is denied', async () => {
    mockPermission = { granted: false, canAskAgain: false };
    const onCancel = jest.fn();
    await render(<CameraCaptureScreen onCaptured={() => {}} onCancel={onCancel} />);
    fireEvent.press(await screen.findByText('Cerrar'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run red** — `npm test -- CameraCaptureScreen` → FAIL.

- [ ] **Step 3: Implement.** Use a `useRef` for the `CameraView`. Render a shutter `Pressable` with `testID="shutter"` whose press does `const photo = await ref.current?.takePictureAsync(); if (photo?.uri) onCaptured(photo.uri);` (guard against double-press with a ref like the form does). When `permission` is missing/denied: `useEffect` requests on mount if `permission && !permission.granted && permission.canAskAgain`; if denied with no granted access, render a centered Spanish message (e.g. "Necesitamos permiso para usar la cámara.") + a `Cerrar` button → `onCancel`. Keep styles minimal/theme-consistent.

- [ ] **Step 4: Run green** — `npm test -- CameraCaptureScreen` → PASS. `npm run typecheck` → clean.

- [ ] **Step 5: Commit** — `feat(photo): add CameraCaptureScreen (expo-camera)`

---

## Task 8: `ConfirmDeadlineScreen` (thin wrapper)

**Files:**
- Create: `src/ui/screens/ConfirmDeadlineScreen.tsx`
- Test: `src/ui/screens/ConfirmDeadlineScreen.test.tsx`

- [ ] **Step 1: Write the failing test** (same provider wiring as DeadlineForm test; assert it persists the stable uri and shows the thumbnail)

```tsx
// src/ui/screens/ConfirmDeadlineScreen.test.tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { InMemoryDeadlineRepository } from '../../test-support/in-memory-deadline-repository';
import { InMemorySettingsRepository } from '../../test-support/in-memory-settings-repository';
import { FakeNotificationScheduler } from '../../test-support/fake-notification-scheduler';
import { FakePhotoStore } from '../../test-support/fake-photo-store';
import { RepositoryProvider } from '../repository/repository-context';
import { DeadlineDepsProvider } from '../deadline-deps/deadline-deps-context';
import { NotificationSchedulerProvider } from '../notification-scheduler/notification-scheduler-context';
import { PhotoStoreProvider } from '../photo-store/photo-store-context';
import { SettingsProvider } from '../settings/settings-context';
import { ConfirmDeadlineScreen } from './ConfirmDeadlineScreen';

function renderConfirm(repo: InMemoryDeadlineRepository, photoStore: FakePhotoStore, onClose = () => {}) {
  return render(
    <RepositoryProvider repository={repo}>
      <DeadlineDepsProvider generateId={() => 'fixed-id'} clock={{ now: () => new Date(2026, 5, 8) }}>
        <NotificationSchedulerProvider scheduler={new FakeNotificationScheduler()}>
          <PhotoStoreProvider store={photoStore}>
            <SettingsProvider repository={new InMemorySettingsRepository()}>
              <ConfirmDeadlineScreen photoUri="file:///cache/cam.jpg" onClose={onClose} />
            </SettingsProvider>
          </PhotoStoreProvider>
        </NotificationSchedulerProvider>
      </DeadlineDepsProvider>
    </RepositoryProvider>,
  );
}

describe('ConfirmDeadlineScreen', () => {
  it('shows the thumbnail and saves with the stable photoUri', async () => {
    const repo = new InMemoryDeadlineRepository();
    const photoStore = new FakePhotoStore();
    const onClose = jest.fn();
    await renderConfirm(repo, photoStore, onClose);

    expect(screen.getByTestId('deadline-photo-thumbnail')).toBeTruthy();
    fireEvent.changeText(await screen.findByPlaceholderText('Ej. ITV del coche'), 'ITV del coche');
    await screen.findByDisplayValue('ITV del coche');
    fireEvent.press(screen.getByText('Guardar'));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect((await repo.findById('fixed-id'))?.photoUri).toBe('stable:///0.jpg');
  });
});
```

- [ ] **Step 2: Run red** — `npm test -- ConfirmDeadlineScreen` → FAIL.

- [ ] **Step 3: Implement**

```tsx
// src/ui/screens/ConfirmDeadlineScreen.tsx
import { DeadlineForm } from '../components/DeadlineForm';

interface ConfirmDeadlineScreenProps {
  photoUri: string;
  onClose: () => void;
}

/** Confirm screen for the photo path (thin wrapper over the shared DeadlineForm). */
export function ConfirmDeadlineScreen({ photoUri, onClose }: ConfirmDeadlineScreenProps) {
  return <DeadlineForm heading="Confirma los datos" photoUri={photoUri} onClose={onClose} />;
}
```

- [ ] **Step 4: Run green** — `npm test -- ConfirmDeadlineScreen` → PASS. `npm run typecheck` → clean.

- [ ] **Step 5: Commit** — `feat(photo): add ConfirmDeadlineScreen`

---

## Task 9: Routes `app/add/*` + `_layout` registration

**Files:**
- Create: `app/add/index.tsx`, `app/add/manual.tsx`, `app/add/camera.tsx`, `app/add/confirm.tsx`
- Delete: `app/add.tsx`
- Modify: `app/_layout.tsx`

No unit tests (files in `app/` are outside jest `roots`). Verify via `npm run typecheck` + a manual smoke note. Navigation by callback, wiring `router` (expo-router `useRouter` / `useLocalSearchParams`).

- [ ] **Step 1: `app/add/index.tsx`** (selector; "+ Añadir" pushes `/add` → resolves here)

```tsx
import { useRouter } from 'expo-router';
import { AddOptionsScreen } from '../../src/ui/screens/AddOptionsScreen';

export default function AddOptionsRoute() {
  const router = useRouter();
  return (
    <AddOptionsScreen
      onPhoto={() => router.push('/add/camera')}
      onManual={() => router.push('/add/manual')}
      onClose={() => router.back()}
    />
  );
}
```

- [ ] **Step 2: `app/add/manual.tsx`**

```tsx
import { useRouter } from 'expo-router';
import { AddDeadlineScreen } from '../../src/ui/screens/AddDeadlineScreen';

export default function AddManualRoute() {
  const router = useRouter();
  return <AddDeadlineScreen onClose={() => router.back()} />;
}
```

- [ ] **Step 3: `app/add/camera.tsx`** (push to confirm with the encoded photoUri)

```tsx
import { useRouter } from 'expo-router';
import { CameraCaptureScreen } from '../../src/ui/screens/CameraCaptureScreen';

export default function AddCameraRoute() {
  const router = useRouter();
  return (
    <CameraCaptureScreen
      onCaptured={(uri) => router.push(`/add/confirm?photoUri=${encodeURIComponent(uri)}`)}
      onCancel={() => router.back()}
    />
  );
}
```

- [ ] **Step 4: `app/add/confirm.tsx`** (decode the param)

```tsx
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ConfirmDeadlineScreen } from '../../src/ui/screens/ConfirmDeadlineScreen';

export default function AddConfirmRoute() {
  const router = useRouter();
  const { photoUri } = useLocalSearchParams<{ photoUri: string }>();
  return <ConfirmDeadlineScreen photoUri={decodeURIComponent(photoUri ?? '')} onClose={() => router.back()} />;
}
```

- [ ] **Step 5: Delete `app/add.tsx`** — `git rm app/add.tsx`.

- [ ] **Step 6: Update `app/_layout.tsx` Stack** — replace the single `<Stack.Screen name="add" options={{ presentation: 'modal' }} />` with:

```tsx
<Stack.Screen name="add/index" options={{ presentation: 'modal' }} />
<Stack.Screen name="add/manual" options={{ presentation: 'modal' }} />
<Stack.Screen name="add/camera" options={{ presentation: 'modal' }} />
<Stack.Screen name="add/confirm" options={{ presentation: 'modal' }} />
```
(Leave the home `index` push to `/add` as-is — it resolves to `add/index`.)

- [ ] **Step 7: Verify** — `npm run typecheck` → clean. `npm test` (all pass except the known Task-10 failure, until Task 10 runs).

- [ ] **Step 8: Commit** — `feat(photo): add /add selector + camera/confirm routes; remove old add route`

---

## Task 10: Detail photo thumbnail + fix pre-existing date fixture

**Files:**
- Modify: `src/ui/screens/DeadlineDetailScreen.tsx`
- Modify: `src/ui/screens/DeadlineDetailScreen.test.tsx`

- [ ] **Step 1: Fix the pre-existing date-dependent failure** in `DeadlineDetailScreen.test.tsx` — the ITV fixture uses `dueDate: new Date(2026, 5, 11)` which is now in the past, so `/^Caduca/` fails. Bump it to a clearly-future date relative to "now" (e.g. `new Date(2027, 5, 11)`) and keep the assertion. Run `npm test -- DeadlineDetailScreen` → all green (regression baseline restored before adding new behavior).

- [ ] **Step 2: Write the failing thumbnail test** (add to the describe block)

```tsx
it('shows the photo thumbnail when the deadline has a photoUri', async () => {
  const repo = new InMemoryDeadlineRepository([
    buildDeadline({ id: '9', type: 'ITV', title: 'ITV — Clio', photoUri: 'file:///document/photos/x.jpg' }),
  ]);
  await renderWith(repo, '9');
  expect(await screen.findByTestId('deadline-detail-photo')).toBeTruthy();
});

it('shows no thumbnail when there is no photoUri', async () => {
  const repo = new InMemoryDeadlineRepository([buildDeadline({ id: '10', type: 'ITV', title: 'ITV — Clio' })]);
  await renderWith(repo, '10');
  await screen.findByText('ITV — Clio');
  expect(screen.queryByTestId('deadline-detail-photo')).toBeNull();
});
```

- [ ] **Step 3: Run red** — `npm test -- DeadlineDetailScreen` → the two new tests FAIL.

- [ ] **Step 4: Implement** — in `DeadlineDetailScreen.tsx` add `import { Image } from 'react-native';` and render, inside the `ScrollView` (e.g. after the header), when `deadline.photoUri`:

```tsx
{deadline.photoUri ? (
  <Image testID="deadline-detail-photo" source={{ uri: deadline.photoUri }} style={styles.photo} resizeMode="cover" />
) : null}
```
Add to styles: `photo: { width: '100%', height: 200, borderRadius: radii.card, backgroundColor: colors.surfaceSoft }`.

- [ ] **Step 5: Run green** — `npm test -- DeadlineDetailScreen` → PASS. Full `npm test` → all green now. `npm run typecheck` → clean.

- [ ] **Step 6: Commit** — `feat(photo): show photo thumbnail in deadline detail; fix dated ITV fixture`

---

## Task 11: Native config (`app.json`)

**Files:**
- Modify: `app.json`

No automated test (native config). Verify by reading the merged JSON.

- [ ] **Step 1: Add the expo-camera config plugin** to the `plugins` array in `app.json`:

```json
[
  "expo-camera",
  {
    "cameraPermission": "Permite a Nopasa hacer una foto del documento para leer la fecha por ti.",
    "recordAudioAndroid": false
  }
]
```

- [ ] **Step 2: Add the CAMERA permission** to `android.permissions`:

```json
"permissions": [
  "android.permission.POST_NOTIFICATIONS",
  "android.permission.CAMERA"
]
```

- [ ] **Step 3: Verify** — `npm run typecheck` (unaffected) and confirm `app.json` is valid JSON (e.g. `node -e "require('./app.json')"`).

- [ ] **Step 4: Commit** — `chore(android): add expo-camera plugin + CAMERA permission`

---

## Final review (after all tasks)

- [ ] Full `npm test` green; `npm run typecheck` clean.
- [ ] Dispatch a final code review over the whole branch (`superpowers:requesting-code-review`).
- [ ] Use `superpowers:finishing-a-development-branch` to merge `feat/photo-capture-confirm` → `main` and push (per project workflow: feature branch then merge+push).

## Self-review check (spec coverage)

- §1 Navigation/routes → Tasks 6–9. §2 DeadlineForm reuse → Task 5. §3 PhotoStore port/adapter/fake/wiring → Tasks 2–4. §4 Save & domain (`toCreateInput`, domain untouched) → Task 1 (+ verified no domain change). §5 Detail loop → Task 10. §6 Native config → Task 11. §7 Testing → covered per task (and the "already covered, don't duplicate" SQLite round-trip is explicitly left alone). §8 file list → matches File Structure above (`app/add.tsx` removed in Task 9).

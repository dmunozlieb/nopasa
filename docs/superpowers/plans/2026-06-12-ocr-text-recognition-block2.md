# OCR text recognition (Block 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire an on-device OCR engine end-to-end and surface the recognized text from the captured photo, to confirm ML Kit reads real documents before investing in parsing. **No parsing of that text into fields (date/amount/type) — that is Block 3.**

**Architecture:** A new `TextRecognizer` port (`recognize(photoUri) → RecognizedText`) with an expo-text-extractor (ML Kit Android / Apple Vision iOS) adapter, a fake, and a context/hook (`useTextRecognizer`) + provider in `_layout` — mirroring the existing `PhotoStore`/`NotificationScheduler` ports. OCR runs in **`ConfirmDeadlineScreen`** (which already has the `photoUri`): it shows a loading state, runs OCR best-effort with a timeout, then renders the unchanged `DeadlineForm` and a **temporary** "Texto detectado" preview. `RecognizedText` is a flat `{ text, lines }` shape that Block 3's pure parser will consume.

**Tech Stack:** Expo SDK 56, `expo-text-extractor` v2 (on-device ML Kit / Vision), React Native, TypeScript, Jest + @testing-library/react-native.

---

## Privacy verification (the non-negotiable — confirmed during planning)

- **Inference is 100% on-device.** `expo-text-extractor` uses Google ML Kit text recognition on Android and Apple Vision on iOS. The photo and the recognized text **never leave the device**; there is no cloud/API call with user data. The product promise, the privacy policy, and the selector footer "Se lee en tu móvil. Nada se sube a internet." hold.
- **Model distribution (Android nuance):** the library depends on `com.google.android.gms:play-services-mlkit-text-recognition` (the **Play Services** variant), so the OCR model is provided by Google Play Services rather than bundled in the APK. **This downloads a model, never uploads user data** — "nada se sube" remains true.
- **Mitigation (chosen):** a custom Expo **config plugin** injects the AndroidManifest meta-data `com.google.mlkit.vision.DEPENDENCIES = ocr` so **Play Store downloads the model at install time** → the model is present before first use, no runtime network needed in normal installs. For sideloaded builds where the install-time download didn't run, ML Kit falls back to a first-use download. Either way the OCR call is best-effort with a manual fallback, so the user is never blocked and no data is uploaded.
- iOS Vision is fully on-device with no model download, but **iOS is out of scope** for this block (Android only).

## Conventions (apply to every task)

- **All code/identifiers/comments/commit messages in English.** Spanish UI copy stays Spanish.
- **TDD**: failing test → red → minimal implementation → green → commit. Use `superpowers:test-driven-development`.
- **Commits**: conventional-commit style. **No `Co-Authored-By: Claude` / Claude signature.**
- **Test:** `npm test` (`cross-env TZ=Europe/Madrid jest --passWithNoTests`); scope with e.g. `npm test -- fake-text-recognizer`. **Typecheck:** `npm run typecheck`. Baseline is currently **all green (244 tests)**.
- Jest `roots` is `<rootDir>/src` only → every test lives under `src/`. Files in `app/` and `plugins/` are not unit-tested (verify via typecheck / prebuild).
- Component tests: `await render(...)`; after each state-changing `fireEvent`, `await` a `findBy*`/`waitFor` before the next interaction.

## Out of scope

Text→fields parsing + heuristics (Block 3); editing; iOS; gallery. **`DeadlineForm`, the domain, and SQLite do NOT change** (the form still receives empty `initialValues`). No new Android permission (OCR reads an already-captured local file).

---

## File Structure

**New (tests alongside, under `src/`):**
- `src/ports/text-recognizer.ts` — `RecognizedText` type + `TextRecognizer` interface (bare port, no test).
- `src/test-support/fake-text-recognizer.ts` (+ test) — configurable fake (result / empty / error / delay), records calls.
- `src/infrastructure/ocr/expo-text-extractor-recognizer.ts` (+ test) — maps `string[]` → `RecognizedText`.
- `src/ui/text-recognizer/text-recognizer-context.tsx` (+ test) — `TextRecognizerProvider` + `useTextRecognizer`.
- `src/ui/ocr/with-timeout.ts` (+ test) — pure `withTimeout` + `TimeoutError`.
- `plugins/with-mlkit-ocr-model.js` — config plugin (AndroidManifest meta-data; no test, verified via prebuild).

**Modified:**
- `jest.setup.js` — global inert mock for `expo-text-extractor` (so the adapter/provider are importable under jsdom).
- `src/ui/screens/ConfirmDeadlineScreen.tsx` (+ test) — runs OCR (loading gate, best-effort, timeout) then renders `DeadlineForm` + temporary preview.
- `app/_layout.tsx` — add `TextRecognizerProvider` to the provider stack.
- `app.json` — register the `./plugins/with-mlkit-ocr-model` config plugin.
- `package.json` / `package-lock.json` — add `expo-text-extractor`.

**Untouched (hard constraint):** `src/ui/components/DeadlineForm.tsx`, domain (`src/domain/**`), SQLite (`src/infrastructure/persistence/**`).

---

## Task 1: `TextRecognizer` port + `RecognizedText` + `FakeTextRecognizer`

**Files:** Create `src/ports/text-recognizer.ts`; Create `src/test-support/fake-text-recognizer.ts`; Test `src/test-support/fake-text-recognizer.test.ts`.

Reference style: `src/ports/photo-store.ts` (bare interface + doc comment, no test) and `src/test-support/fake-photo-store.ts`.

- [ ] **Step 1: Write the port** (no test)

```ts
// src/ports/text-recognizer.ts
/** Flat result of on-device OCR over a photo. `text` is the full recognized text;
 *  `lines` is the same content split into recognized lines. Shape kept deliberately
 *  flat so a pure parser (Block 3) can consume it without depending on the OCR lib. */
export interface RecognizedText {
  text: string;
  lines: string[];
}

/** Effects port: on-device text recognition (OCR) over a local photo. The UI depends
 *  on this, never on the OCR library directly. */
export interface TextRecognizer {
  /** Recognize text in the photo at `photoUri` (a local `file://` path). */
  recognize(photoUri: string): Promise<RecognizedText>;
}
```

- [ ] **Step 2: Write the failing fake test**

```ts
// src/test-support/fake-text-recognizer.test.ts
import { FakeTextRecognizer } from './fake-text-recognizer';

describe('FakeTextRecognizer', () => {
  it('returns the configured result and records the call', async () => {
    const fake = new FakeTextRecognizer({ result: { text: 'ITV\n2027', lines: ['ITV', '2027'] } });
    const out = await fake.recognize('file:///photos/a.jpg');
    expect(out).toEqual({ text: 'ITV\n2027', lines: ['ITV', '2027'] });
    expect(fake.calls).toEqual(['file:///photos/a.jpg']);
  });

  it('defaults to empty recognized text', async () => {
    const fake = new FakeTextRecognizer();
    expect(await fake.recognize('file:///photos/a.jpg')).toEqual({ text: '', lines: [] });
  });

  it('rejects when configured with an error', async () => {
    const fake = new FakeTextRecognizer({ error: new Error('ocr failed') });
    await expect(fake.recognize('file:///photos/a.jpg')).rejects.toThrow('ocr failed');
  });
});
```

- [ ] **Step 3: Run red** — `npm test -- fake-text-recognizer` → FAIL.

- [ ] **Step 4: Implement the fake**

```ts
// src/test-support/fake-text-recognizer.ts
import type { RecognizedText, TextRecognizer } from '../ports/text-recognizer';

interface FakeBehavior {
  result?: RecognizedText;
  error?: Error;
  /** Delay before resolving/rejecting, to exercise loading/timeout paths in screen tests. */
  delayMs?: number;
}

/** In-memory TextRecognizer for tests. Records each photoUri and returns a configured
 *  result (or empty), or rejects, optionally after a delay. */
export class FakeTextRecognizer implements TextRecognizer {
  readonly calls: string[] = [];

  constructor(private readonly behavior: FakeBehavior = {}) {}

  async recognize(photoUri: string): Promise<RecognizedText> {
    this.calls.push(photoUri);
    if (this.behavior.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, this.behavior.delayMs));
    }
    if (this.behavior.error) throw this.behavior.error;
    return this.behavior.result ?? { text: '', lines: [] };
  }
}
```

- [ ] **Step 5: Run green** — `npm test -- fake-text-recognizer` → PASS; `npm run typecheck` clean.

- [ ] **Step 6: Commit** — `feat(ocr): add TextRecognizer port and FakeTextRecognizer`

---

## Task 2: expo-text-extractor adapter (+ global jest mock)

**Files:** Modify `package.json`/lockfile (install); Create `src/infrastructure/ocr/expo-text-extractor-recognizer.ts`; Test `src/infrastructure/ocr/expo-text-extractor-recognizer.test.ts`; Modify `jest.setup.js`.

**expo-text-extractor v2 API (verified):**
- `import { extractTextFromImage, isSupported } from 'expo-text-extractor';`
- `extractTextFromImage(uri: string): Promise<string[]>` — resolves to an array of recognized text **lines**. On-device ML Kit (Android) / Vision (iOS).

- [ ] **Step 1: Install** — run `npx expo install expo-text-extractor` (SDK-56-compatible). If it needs interaction or fails (no network/sandbox), STOP and report BLOCKED — do not fake the dependency.

- [ ] **Step 2: Add a global inert mock to `jest.setup.js`** (the native module can't load under jsdom; mirrors the existing `expo-file-system`/`expo-notifications` mocks). Append:

```js
// Mock expo-text-extractor: the native ML Kit/Vision module can't load under jsdom.
// Inert default (no recognized lines) keeps the adapter/provider importable; the adapter's
// own test overrides the return value, and screen tests inject FakeTextRecognizer.
jest.mock('expo-text-extractor', () => ({
  __esModule: true,
  isSupported: true,
  extractTextFromImage: jest.fn(async () => []),
}));
```

- [ ] **Step 3: Write the failing adapter test** (override the global mock for this file)

```ts
// src/infrastructure/ocr/expo-text-extractor-recognizer.test.ts
import { extractTextFromImage } from 'expo-text-extractor';
import { expoTextExtractorRecognizer } from './expo-text-extractor-recognizer';

const mockExtract = extractTextFromImage as jest.MockedFunction<typeof extractTextFromImage>;

describe('expoTextExtractorRecognizer', () => {
  afterEach(() => mockExtract.mockReset());

  it('maps the recognized lines into RecognizedText (text joined by newlines)', async () => {
    mockExtract.mockResolvedValue(['ITV del coche', 'Caduca 11/06/2027']);
    const out = await expoTextExtractorRecognizer.recognize('file:///photos/a.jpg');
    expect(mockExtract).toHaveBeenCalledWith('file:///photos/a.jpg');
    expect(out).toEqual({ text: 'ITV del coche\nCaduca 11/06/2027', lines: ['ITV del coche', 'Caduca 11/06/2027'] });
  });

  it('returns empty RecognizedText when nothing is recognized', async () => {
    mockExtract.mockResolvedValue([]);
    expect(await expoTextExtractorRecognizer.recognize('file:///photos/a.jpg')).toEqual({ text: '', lines: [] });
  });
});
```

- [ ] **Step 4: Run red** — `npm test -- expo-text-extractor-recognizer` → FAIL (module not found).

- [ ] **Step 5: Implement**

```ts
// src/infrastructure/ocr/expo-text-extractor-recognizer.ts
import { extractTextFromImage } from 'expo-text-extractor';
import type { RecognizedText, TextRecognizer } from '../../ports/text-recognizer';

/**
 * On-device OCR adapter over expo-text-extractor (ML Kit on Android, Apple Vision on iOS).
 * Inference runs locally; the photo and text never leave the device. Thin wrapper —
 * mocked in tests.
 */
export const expoTextExtractorRecognizer: TextRecognizer = {
  async recognize(photoUri: string): Promise<RecognizedText> {
    const lines = await extractTextFromImage(photoUri);
    return { text: lines.join('\n'), lines };
  },
};
```

- [ ] **Step 6: Run green** — `npm test -- expo-text-extractor-recognizer` → PASS; full `npm test` green (the new global mock must not break other suites); `npm run typecheck` clean.

- [ ] **Step 7: Commit** — `feat(ocr): add expo-text-extractor on-device recognizer adapter` (include package.json + lockfile + jest.setup.js).

---

## Task 3: `TextRecognizerProvider` + `useTextRecognizer`, wired into `_layout`

**Files:** Create `src/ui/text-recognizer/text-recognizer-context.tsx`; Test `src/ui/text-recognizer/text-recognizer-context.test.tsx`; Modify `app/_layout.tsx`.

**Mirror exactly** `src/ui/photo-store/photo-store-context.tsx` and its test `src/ui/photo-store/photo-store-context.test.tsx` (renderHook style). READ BOTH FIRST.

- [ ] **Step 1: Write the failing test**

```tsx
// src/ui/text-recognizer/text-recognizer-context.test.tsx
import type { ReactNode } from 'react';
import { renderHook } from '@testing-library/react-native';
import { FakeTextRecognizer } from '../../test-support/fake-text-recognizer';
import { TextRecognizerProvider, useTextRecognizer } from './text-recognizer-context';

describe('TextRecognizerProvider / useTextRecognizer', () => {
  it('provides the injected recognizer', async () => {
    const recognizer = new FakeTextRecognizer();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <TextRecognizerProvider recognizer={recognizer}>{children}</TextRecognizerProvider>
    );
    const { result } = await renderHook(() => useTextRecognizer(), { wrapper });
    expect(result.current).toBe(recognizer);
  });

  it('falls back to the production default when none is injected', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <TextRecognizerProvider>{children}</TextRecognizerProvider>
    );
    const { result } = await renderHook(() => useTextRecognizer(), { wrapper });
    expect(typeof result.current.recognize).toBe('function');
  });

  it('throws when used outside a provider', async () => {
    await expect(renderHook(() => useTextRecognizer())).rejects.toThrow(
      'useTextRecognizer must be used within a TextRecognizerProvider',
    );
  });
});
```

- [ ] **Step 2: Run red** — `npm test -- text-recognizer-context` → FAIL.

- [ ] **Step 3: Implement**

```tsx
// src/ui/text-recognizer/text-recognizer-context.tsx
import { createContext, useContext, type ReactNode } from 'react';
import type { TextRecognizer } from '../../ports/text-recognizer';
import { expoTextExtractorRecognizer } from '../../infrastructure/ocr/expo-text-extractor-recognizer';

const TextRecognizerContext = createContext<TextRecognizer | null>(null);

interface TextRecognizerProviderProps {
  /** Inject a fake (tests). Omit for the production expo-text-extractor adapter. */
  recognizer?: TextRecognizer;
  children: ReactNode;
}

export function TextRecognizerProvider({ recognizer, children }: TextRecognizerProviderProps) {
  return (
    <TextRecognizerContext.Provider value={recognizer ?? expoTextExtractorRecognizer}>
      {children}
    </TextRecognizerContext.Provider>
  );
}

export function useTextRecognizer(): TextRecognizer {
  const recognizer = useContext(TextRecognizerContext);
  if (!recognizer) {
    throw new Error('useTextRecognizer must be used within a TextRecognizerProvider');
  }
  return recognizer;
}
```

- [ ] **Step 4: Run green** — `npm test -- text-recognizer-context` → PASS.

- [ ] **Step 5: Wire into `app/_layout.tsx`** — add the import and wrap the stack alongside `PhotoStoreProvider`:
```tsx
import { TextRecognizerProvider } from '../src/ui/text-recognizer/text-recognizer-context';
```
Place `<TextRecognizerProvider>…</TextRecognizerProvider>` directly inside `PhotoStoreProvider` (wrapping `DataExporterProvider`+`SettingsProvider`+`Stack`). Keep indentation consistent.

- [ ] **Step 6: Verify** — full `npm test` green; `npm run typecheck` clean.

- [ ] **Step 7: Commit** — `feat(ocr): add TextRecognizerProvider and wire it into the app`

---

## Task 4: `withTimeout` pure helper

**Files:** Create `src/ui/ocr/with-timeout.ts`; Test `src/ui/ocr/with-timeout.test.ts`.

- [ ] **Step 1: Write the failing test** (fake timers)

```ts
// src/ui/ocr/with-timeout.test.ts
import { withTimeout, TimeoutError } from './with-timeout';

describe('withTimeout', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('resolves with the value when the promise settles before the timeout', async () => {
    const result = withTimeout(Promise.resolve('ok'), 1000);
    await expect(result).resolves.toBe('ok');
  });

  it('rejects with TimeoutError when the timeout elapses first', async () => {
    const never = new Promise<string>(() => {});
    const result = withTimeout(never, 1000);
    const assertion = expect(result).rejects.toBeInstanceOf(TimeoutError);
    jest.advanceTimersByTime(1000);
    await assertion;
  });

  it('propagates the underlying rejection', async () => {
    const result = withTimeout(Promise.reject(new Error('boom')), 1000);
    await expect(result).rejects.toThrow('boom');
  });
});
```

- [ ] **Step 2: Run red** — `npm test -- with-timeout` → FAIL.

- [ ] **Step 3: Implement**

```ts
// src/ui/ocr/with-timeout.ts
/** Rejection raised by `withTimeout` when the deadline elapses before the promise settles. */
export class TimeoutError extends Error {
  constructor(message = 'Operation timed out') {
    super(message);
    this.name = 'TimeoutError';
  }
}

/** Resolves/rejects with `promise` if it settles within `ms`; otherwise rejects with
 *  TimeoutError. The timer is always cleared so it never leaks. */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError()), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
```

- [ ] **Step 4: Run green** — `npm test -- with-timeout` → PASS; `npm run typecheck` clean.

- [ ] **Step 5: Commit** — `feat(ocr): add withTimeout helper for best-effort OCR`

---

## Task 5: `ConfirmDeadlineScreen` runs OCR (loading gate + temporary preview)

**Files:** Modify `src/ui/screens/ConfirmDeadlineScreen.tsx`; Modify `src/ui/screens/ConfirmDeadlineScreen.test.tsx`.

The screen currently is a thin wrapper: `return <DeadlineForm heading="Confirma los datos" photoUri={photoUri} onClose={onClose} />`. It becomes stateful:

- On mount, run `useTextRecognizer().recognize(photoUri)` wrapped in `withTimeout(…, OCR_TIMEOUT_MS)`.
- While running → a loading view (modal handle + spinner + "Leyendo el documento…", `testID="ocr-loading"`).
- On settle/fail/timeout → set status `done`; on success keep `recognized`, on any error keep `null` (best-effort).
- **Render `DeadlineForm` ONLY after OCR resolves** (status `done`). This is the seam for Block 3: because `DeadlineForm` seeds its state once from `initialValues`, the recognized text (→ parsed `initialValues` in Block 3) must be ready before the form mounts. **In Block 2, `initialValues` stays empty (not passed); the text is not used to prefill.**
- When `recognized?.text` is non-empty, render a **temporary** "Texto detectado" preview (clearly labeled, `testID="detected-text"`) — Block 3 replaces it with real field prefill. `DeadlineForm` stays **unchanged**, so the preview is a sibling rendered ABOVE the form (capped height, internally scrollable).
- Use a mounted-guard ref so a late OCR resolution after unmount/cancel doesn't `setState`.

`OCR_TIMEOUT_MS = 8000` (named constant, the default). The screen takes an optional **`timeoutMs?: number`** prop (defaults to `OCR_TIMEOUT_MS`) so a test can inject a tiny timeout. The route (`app/add/confirm.tsx`) passes only `photoUri`/`onClose`, so it uses the default — no route change.

**Timeout coverage:** two complementary tests. (a) `with-timeout.test.ts` (Task 4) proves the timer fires with fake timers. (b) A **screen-level** test injects a small `timeoutMs` and a recognizer whose `recognize()` **never resolves**, proving the real `withTimeout` fallback path (timeout → caught → form renders) end-to-end — so the wrapper is actually verified, not assumed. (Real timers, ~20ms, `waitFor`.)

- [ ] **Step 1: Update the existing test + add new ones** (`src/ui/screens/ConfirmDeadlineScreen.test.tsx`). The Block-1 regression test must now (a) wrap in `TextRecognizerProvider`, and (b) `await` the form past the loading gate. Full file:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { InMemoryDeadlineRepository } from '../../test-support/in-memory-deadline-repository';
import { InMemorySettingsRepository } from '../../test-support/in-memory-settings-repository';
import { FakeNotificationScheduler } from '../../test-support/fake-notification-scheduler';
import { FakePhotoStore } from '../../test-support/fake-photo-store';
import { FakeTextRecognizer } from '../../test-support/fake-text-recognizer';
import type { RecognizedText, TextRecognizer } from '../../ports/text-recognizer';
import { RepositoryProvider } from '../repository/repository-context';
import { DeadlineDepsProvider } from '../deadline-deps/deadline-deps-context';
import { NotificationSchedulerProvider } from '../notification-scheduler/notification-scheduler-context';
import { PhotoStoreProvider } from '../photo-store/photo-store-context';
import { TextRecognizerProvider } from '../text-recognizer/text-recognizer-context';
import { SettingsProvider } from '../settings/settings-context';
import { ConfirmDeadlineScreen } from './ConfirmDeadlineScreen';

function renderConfirm(opts: {
  repo?: InMemoryDeadlineRepository;
  photoStore?: FakePhotoStore;
  recognizer?: TextRecognizer;
  timeoutMs?: number;
  onClose?: () => void;
}) {
  const repo = opts.repo ?? new InMemoryDeadlineRepository();
  const photoStore = opts.photoStore ?? new FakePhotoStore();
  const recognizer = opts.recognizer ?? new FakeTextRecognizer();
  const onClose = opts.onClose ?? (() => {});
  return {
    repo,
    photoStore,
    recognizer,
    ...render(
      <RepositoryProvider repository={repo}>
        <DeadlineDepsProvider generateId={() => 'fixed-id'} clock={{ now: () => new Date(2026, 5, 8) }}>
          <NotificationSchedulerProvider scheduler={new FakeNotificationScheduler()}>
            <PhotoStoreProvider store={photoStore}>
              <TextRecognizerProvider recognizer={recognizer}>
                <SettingsProvider repository={new InMemorySettingsRepository()}>
                  <ConfirmDeadlineScreen photoUri="file:///cache/cam.jpg" onClose={onClose} timeoutMs={opts.timeoutMs} />
                </SettingsProvider>
              </TextRecognizerProvider>
            </PhotoStoreProvider>
          </NotificationSchedulerProvider>
        </DeadlineDepsProvider>
      </RepositoryProvider>,
    ),
  };
}

const recognized = (result: RecognizedText) => new FakeTextRecognizer({ result });

describe('ConfirmDeadlineScreen', () => {
  it('runs OCR over the photo, then renders the form and a temporary detected-text preview', async () => {
    const recognizer = recognized({ text: 'ITV del coche\nCaduca 11/06/2027', lines: ['ITV del coche', 'Caduca 11/06/2027'] });
    const { recognizer: rec } = renderConfirm({ recognizer });

    // form appears only after OCR resolves
    expect(await screen.findByPlaceholderText('Ej. ITV del coche')).toBeTruthy();
    expect(rec.calls).toEqual(['file:///cache/cam.jpg']);
    expect(screen.getByTestId('detected-text')).toBeTruthy();
    expect(screen.getByText(/Caduca 11\/06\/2027/)).toBeTruthy();
  });

  it('still shows the thumbnail and saves with the stable photoUri (Block 1 regression)', async () => {
    const onClose = jest.fn();
    const { repo } = renderConfirm({ recognizer: recognized({ text: 'x', lines: ['x'] }), onClose });

    expect(await screen.findByTestId('deadline-photo-thumbnail')).toBeTruthy();
    fireEvent.changeText(await screen.findByPlaceholderText('Ej. ITV del coche'), 'ITV del coche');
    await screen.findByDisplayValue('ITV del coche');
    fireEvent.press(screen.getByText('Guardar'));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect((await repo.findById('fixed-id'))?.photoUri).toBe('stable:///0.jpg');
  });

  it('renders the form (no preview) when OCR returns empty text', async () => {
    renderConfirm({ recognizer: recognized({ text: '', lines: [] }) });
    expect(await screen.findByPlaceholderText('Ej. ITV del coche')).toBeTruthy();
    expect(screen.queryByTestId('detected-text')).toBeNull();
  });

  it('renders the form and allows manual save when OCR fails (best-effort)', async () => {
    const onClose = jest.fn();
    const recognizer = new FakeTextRecognizer({ error: new Error('ocr failed') });
    const { repo } = renderConfirm({ recognizer, onClose });

    expect(await screen.findByPlaceholderText('Ej. ITV del coche')).toBeTruthy();
    expect(screen.queryByTestId('detected-text')).toBeNull();
    fireEvent.changeText(screen.getByPlaceholderText('Ej. ITV del coche'), 'Manual');
    await screen.findByDisplayValue('Manual');
    fireEvent.press(screen.getByText('Guardar'));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(await repo.findById('fixed-id')).not.toBeNull();
  });

  it('falls back to the form when OCR hangs past the timeout (real withTimeout path)', async () => {
    // A recognizer whose promise never settles — only the injected timeout can resolve the screen.
    const hanging: TextRecognizer = { recognize: () => new Promise<RecognizedText>(() => {}) };
    renderConfirm({ recognizer: hanging, timeoutMs: 20 });

    expect(await screen.findByPlaceholderText('Ej. ITV del coche')).toBeTruthy();
    expect(screen.queryByTestId('detected-text')).toBeNull();
  });
});
```

- [ ] **Step 2: Run red** — `npm test -- ConfirmDeadlineScreen` → FAIL.

- [ ] **Step 3: Implement** `ConfirmDeadlineScreen.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RecognizedText } from '../../ports/text-recognizer';
import { useTextRecognizer } from '../text-recognizer/text-recognizer-context';
import { withTimeout } from '../ocr/with-timeout';
import { DeadlineForm } from '../components/DeadlineForm';
import { AppText } from '../components/AppText';
import { colors, fontSizes, radii, spacing } from '../theme';

const OCR_TIMEOUT_MS = 8000;

interface ConfirmDeadlineScreenProps {
  photoUri: string;
  onClose: () => void;
  /** OCR deadline in ms; injectable for tests. Defaults to OCR_TIMEOUT_MS. */
  timeoutMs?: number;
}

/**
 * Confirm screen for the photo path. Runs on-device OCR over the photo (best-effort,
 * with a timeout), then renders the shared DeadlineForm. Rendering the form only after
 * OCR resolves is intentional: DeadlineForm seeds its state once from initialValues, so
 * the recognized text (parsed into initialValues in Block 3) must be ready beforehand.
 * In Block 2 initialValues stays empty; the recognized text is only shown in a temporary
 * "Texto detectado" preview to verify OCR on real documents (Block 3 replaces it).
 */
export function ConfirmDeadlineScreen({ photoUri, onClose, timeoutMs = OCR_TIMEOUT_MS }: ConfirmDeadlineScreenProps) {
  const recognizer = useTextRecognizer();
  const insets = useSafeAreaInsets();
  const [reading, setReading] = useState(true);
  const [recognized, setRecognized] = useState<RecognizedText | null>(null);

  useEffect(() => {
    const mounted = { current: true };
    (async () => {
      try {
        const result = await withTimeout(recognizer.recognize(photoUri), timeoutMs);
        if (mounted.current) setRecognized(result);
      } catch {
        // Best-effort: OCR failure / timeout never blocks the manual path.
        if (mounted.current) setRecognized(null);
      } finally {
        if (mounted.current) setReading(false);
      }
    })();
    return () => {
      mounted.current = false;
    };
  }, [recognizer, photoUri, timeoutMs]);

  if (reading) {
    return (
      <View style={styles.root} testID="ocr-loading">
        <View style={[styles.handle, { marginTop: insets.top + spacing.sm }]} />
        <View style={styles.loading}>
          <ActivityIndicator color={colors.brandBlue} />
          <AppText weight="semibold" size={fontSizes.body} color={colors.textSecondary}>
            Leyendo el documento…
          </AppText>
        </View>
      </View>
    );
  }

  const detected = recognized?.text?.trim();

  return (
    <View style={styles.container}>
      {detected ? (
        <View style={styles.detected} testID="detected-text">
          <AppText weight="bold" size={fontSizes.small} color={colors.textMuted}>
            Texto detectado · temporal (bloque 2)
          </AppText>
          <ScrollView style={styles.detectedScroll}>
            <AppText weight="semibold" size={fontSizes.small} color={colors.textSecondary}>
              {recognized?.text}
            </AppText>
          </ScrollView>
        </View>
      ) : null}
      <View style={styles.formSlot}>
        <DeadlineForm heading="Confirma los datos" photoUri={photoUri} onClose={onClose} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.screenBg },
  formSlot: { flex: 1 },
  root: { flex: 1, backgroundColor: colors.screenBg, borderTopLeftRadius: radii.card, borderTopRightRadius: radii.card },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: radii.pill, backgroundColor: colors.textFaint, opacity: 0.4 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  detected: {
    maxHeight: 160,
    margin: spacing.lg,
    padding: spacing.lg,
    borderRadius: radii.card,
    backgroundColor: colors.surfaceSoft,
    gap: spacing.sm,
  },
  detectedScroll: { flexGrow: 0 },
});
```
(If any theme token name differs — e.g. `colors.brandBlue`, `colors.surfaceSoft`, `colors.textMuted`, `colors.textSecondary`, `colors.textFaint` — check `src/ui/theme` and use the existing ones; typecheck will catch mismatches.)

- [ ] **Step 4: Run green** — `npm test -- ConfirmDeadlineScreen` → PASS; full `npm test` green; `npm run typecheck` clean.

- [ ] **Step 5: Commit** — `feat(ocr): run on-device OCR in ConfirmDeadlineScreen with temporary detected-text preview`

---

## Task 6: Native config — config plugin + app.json

**Files:** Create `plugins/with-mlkit-ocr-model.js`; Modify `app.json`. No automated test (build-time); verify the plugin is valid JS and app.json is valid JSON. No new permission.

- [ ] **Step 1: Create the config plugin** (`plugins/with-mlkit-ocr-model.js`) — injects the install-time model meta-data so it survives prebuild:

```js
const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

/**
 * Adds the ML Kit "download model at install time" hint to AndroidManifest:
 *   <meta-data android:name="com.google.mlkit.vision.DEPENDENCIES" android:value="ocr" />
 * so Google Play Store fetches the on-device OCR model when the app is installed,
 * rather than on first use. Inference stays on-device; no user data is uploaded.
 */
module.exports = function withMlkitOcrModel(config) {
  return withAndroidManifest(config, (cfg) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(
      application,
      'com.google.mlkit.vision.DEPENDENCIES',
      'ocr',
    );
    return cfg;
  });
};
```

- [ ] **Step 2: Register it in `app.json`** — append to the `plugins` array (after the `expo-camera` entry):
```json
"./plugins/with-mlkit-ocr-model"
```
(expo-text-extractor autolinks as an Expo module — no app.json plugin entry is needed for the library itself.)

- [ ] **Step 3: Verify** — `node -e "require('./plugins/with-mlkit-ocr-model')"` (loads without error), `node -e "require('./app.json')"` (valid JSON), `npm run typecheck` clean. (Full meta-data verification happens at `npx expo prebuild` on the dev build.)

- [ ] **Step 4: Commit** — `chore(android): config plugin to preload the ML Kit OCR model at install`

---

## Final review (after all tasks)

- [ ] Full `npm test` green; `npm run typecheck` clean.
- [ ] **On-device verification (manual, dev build — the point of Block 2):** build a dev client (`eas build --profile development` or local prebuild+run), capture a real document, confirm the "Texto detectado" preview shows accurate recognized text, and confirm it works in airplane mode after the model is present (install-time download). This proves ML Kit reads real documents before investing in Block 3 parsing.
- [ ] `superpowers:finishing-a-development-branch` → merge `feat/ocr-text-recognition` → `main` + push (project workflow).

## Self-review check (brief coverage)

- On-device + privacy confirmed (Play Services variant; install-time model via config plugin; never uploads) → Privacy section + Task 6. Engine/API verified (`expo-text-extractor` v2, `extractTextFromImage → string[]`) → Task 2. Port + adapter + fake + context/hook + provider → Tasks 1–3. `RecognizedText = { text, lines }` flat for Block 3's parser → Task 1. OCR runs in confirm with loading + best-effort + timeout, form rendered only after OCR resolves → Task 5. Temporary visible "Texto detectado" → Task 5 (always-on, clearly labeled; not `__DEV__`-gated, so it shows in any dev/preview build used for verification — Block 3 removes it). Native config plugin, no new permission → Task 6. Tests: adapter (lib mocked), fake, confirm (success/empty/failure + Block-1 photoUri regression), withTimeout → Tasks 1,2,4,5. DeadlineForm/domain/SQLite untouched (form still gets empty initialValues) → enforced across the plan.

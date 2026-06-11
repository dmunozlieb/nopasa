# Photo capture + confirm screen (Block 1) — Design

**Date:** 2026-06-11
**Scope:** Block 1 of the photo + OCR path. Capture flow + confirm screen, **no OCR**. The
photo path works end-to-end with manual fill-in: pick photo/manual → capture photo → confirm
screen (the form, prefilled empty, with thumbnail) → save with `photoUri` → see it in detail.

**Out of scope:** OCR (Block 2), parsing/heuristics (Block 3), editing, iOS, gallery
(expo-image-picker). The flow receives a source-agnostic `photoUri` so gallery can later slot
in as a second entry to the same pipeline without rework.

---

## 1. Navigation & routes

`"+ Añadir"` (home and empty state) keeps pushing to `/add`, but `/add` stops being the form
and becomes the **selector** screen (per mockup `docs/design/añadir-vencimiento.png`). Routes
are organized under an `app/add/` folder:

| Route | Screen | Role |
|-------|--------|------|
| `app/add/index.tsx` | `AddOptionsScreen` | Selector: "Hacer una foto" / "Escribirlo a mano" + footer "Se lee en tu móvil. Nada se sube a internet." |
| `app/add/manual.tsx` | `AddDeadlineScreen` | Existing manual form (now a thin wrapper, see §2) |
| `app/add/camera.tsx` | `CameraCaptureScreen` | expo-camera capture → on capture navigates to confirm |
| `app/add/confirm.tsx` | `ConfirmDeadlineScreen` | Reads `photoUri` param, renders the form prefilled-empty with thumbnail |

**Navigation by callback**, consistent with the rest of the app. Each screen takes callbacks;
the route component wires `router`:

- `AddOptionsScreen({ onPhoto, onManual, onClose })`
- `CameraCaptureScreen({ onCaptured(uri), onCancel })`
- `ConfirmDeadlineScreen({ photoUri, onClose })`

The captured `photoUri` (a `file://` cache path) travels from camera → confirm as a **route
param**, `encodeURIComponent`-encoded on push and decoded in the confirm route via
`useLocalSearchParams`. All four routes are registered in `_layout.tsx` as modals
(`presentation: 'modal'`), replacing the single `add` entry with `add/index`, `add/manual`,
`add/camera`, `add/confirm`.

The home "+ Añadir" callback (`app/index.tsx`) is unchanged: it still pushes `/add`, which now
resolves to the selector.

## 2. Form reuse — `DeadlineForm`

The body of the current `AddDeadlineScreen` (form state, `validateAddForm`, `onSave`, and the
JSX over `TypeSelector` / `FormField` / `DatePickerField` / `ReminderChips` / past-reminder hint)
is extracted into a shared **`DeadlineForm`** component:

```ts
interface DeadlineFormProps {
  heading: string;
  photoUri?: string;                 // when present: shows thumbnail + threaded into save
  initialValues?: Partial<AddFormState>;  // merged over defaults; empty in Block 1
  onClose: () => void;
}
```

- `initialValues` is a partial merged over the existing defaults (type `OTHER`, default subtitle,
  `startOfDay(clock.now())`, empty amount, `settings.defaultReminderDaysBefore`). Empty in
  Block 1; this is the seam the OCR prefill plugs into in Block 3.
- When `photoUri` is set, `DeadlineForm` renders a **thumbnail at the top** (framed under the
  heading) and threads the photo into the save (see §3).
- `DeadlineForm` owns the single `onSave` path for both manual and confirm.

`AddDeadlineScreen` and `ConfirmDeadlineScreen` become **thin wrappers**:

- `AddDeadlineScreen({ onClose })` → `<DeadlineForm heading="Añadir un vencimiento" onClose={onClose} />`
- `ConfirmDeadlineScreen({ photoUri, onClose })` → `<DeadlineForm heading="Confirma los datos" photoUri={photoUri} onClose={onClose} />`

No duplication of validation/save logic: both screens render the same `DeadlineForm`.

## 3. Photo persistence — `PhotoStore` port

expo-camera writes the photo to the cache, which the OS may evict. On save, the photo is copied
to stable storage and **that** path is stored as `photoUri`.

- **Port** `src/ports/photo-store.ts`:
  ```ts
  export interface PhotoStore {
    /** Copy the photo at `sourceUri` into stable app storage; returns the stable uri. */
    persist(sourceUri: string): Promise<string>;
  }
  ```
- **Adapter** `src/infrastructure/photos/expo-file-system-photo-store.ts`: copies the cache file
  into `documentDirectory/photos/` using a **self-generated unique filename**
  (uuid/timestamp) — **not** coupled to the deadline id, which does not exist yet at persist
  time. Creates the `photos/` directory if absent.
- **Fake** `src/test-support/fake-photo-store.ts`: records `persist` calls and returns a
  deterministic stable uri (e.g. `stable:///<n>.jpg`), so integration tests can assert the
  stored `photoUri` is the stable one, not the source.
- **Wiring** `src/ui/photo-store/photo-store-context.tsx`: `PhotoStoreProvider` (optional
  injected fake; defaults to the expo-file-system adapter) + `usePhotoStore` hook, mirroring
  `NotificationSchedulerProvider`. Added to the provider stack in `app/_layout.tsx`.

**Persist happens on save, not on capture.** If the user captures and cancels without saving,
no orphan file is left in stable storage (only the cache photo, which the OS reclaims). The
`DeadlineForm.onSave` flow:

```ts
const stableUri = photoUri ? await photoStore.persist(photoUri) : undefined;
await createDeadline(toCreateInput(state, stableUri));
```

Manual saves (no `photoUri`) never call `persist`.

(Known negligible edge, **not handled now**: a `repository.save` failure immediately after a
successful `persist` would leave one tiny orphan photo. Acceptable for this block.)

## 4. Save & domain

- `toCreateInput(state, photoUri?)` gains an optional second argument and includes `photoUri`
  in the returned `CreateDeadlineInput` when present.
- **Domain and SQLite are untouched.** `CreateDeadlineInput` (`deadline.factory.ts:21`), the
  schema (`deadline.schema.ts:32`), and the mapper/columns already accept and round-trip
  `photoUri`. Save continues through `useCreateDeadline` unchanged.

## 5. Detail — close the loop

`DeadlineDetailScreen`: when `deadline.photoUri` is set, render the **photo as a thumbnail**, so
a deadline created from a photo shows that photo in its detail.

## 6. Native config (`app.json`)

- Add the expo-camera config plugin:
  `["expo-camera", { "cameraPermission": "Permite a Nopasa hacer una foto del documento para leer la fecha por ti.", "recordAudioAndroid": false }]`
  (`recordAudioAndroid: false` keeps the microphone permission out.)
- Add `"android.permission.CAMERA"` to `android.permissions` (the list is otherwise minimal;
  CAMERA was the permission deliberately deferred until now).

Permission is requested **in context** on the camera screen via `useCameraPermissions`
(best-effort): if denied, show a short message and return (`onCancel`); it never crashes.

## 7. Testing

**Pure / logic:**
- `toCreateInput` includes `photoUri` when passed (and omits it when not).
- `FakePhotoStore` behavior.
- `expo-file-system-photo-store` adapter with **expo-file-system mocked**: copies source into
  `documentDirectory/photos/` under a self-generated name and returns that path.

**Component / integration (fakes + fixed clock):**
- `AddOptionsScreen` fires `onPhoto` / `onManual` for each path.
- `CameraCaptureScreen` with **expo-camera mocked**: capturing fires `onCaptured(uri)`; the
  route then navigates to confirm with the `photoUri`.
- `ConfirmDeadlineScreen` with a `photoUri`: saving persists a `Deadline` whose `photoUri` is
  the **stable uri** (asserted via `findById` with the fake repo + `FakePhotoStore`), and the
  thumbnail is shown.
- `DeadlineDetailScreen` shows the photo when `photoUri` is present.

**Already covered (verify, don't duplicate):** real SQLite round-trip of `photoUri` is asserted
in `sqlite-deadline-repository.test.ts:15` (a `Deadline` with `photoUri` survives
`save` → `findById` through `NodeSqliteExecutor`) and in `deadline-mapper.test.ts:13`. No new
persistence test needed; the fake-repo integration test only verifies the flow threads the
stable `photoUri`.

expo-camera and expo-file-system are thin wrappers: mocked in tests, no native coverage.

## 8. New / modified files

**New:**
- `src/ports/photo-store.ts`
- `src/infrastructure/photos/expo-file-system-photo-store.ts`
- `src/test-support/fake-photo-store.ts`
- `src/ui/photo-store/photo-store-context.tsx`
- `src/ui/components/DeadlineForm.tsx`
- `src/ui/screens/AddOptionsScreen.tsx`
- `src/ui/screens/CameraCaptureScreen.tsx`
- `src/ui/screens/ConfirmDeadlineScreen.tsx`
- `app/add/index.tsx`, `app/add/manual.tsx`, `app/add/camera.tsx`, `app/add/confirm.tsx`
- Tests alongside each of the above.

**Modified:**
- `src/ui/screens/AddDeadlineScreen.tsx` → thin wrapper over `DeadlineForm`.
- `src/ui/deadline/add-form.ts` → `toCreateInput(state, photoUri?)`.
- `src/ui/screens/DeadlineDetailScreen.tsx` → photo thumbnail when present.
- `app/_layout.tsx` → add `PhotoStoreProvider`; replace `add` Stack.Screen with `add/*`.
- `app.json` → expo-camera plugin + CAMERA permission.
- Remove `app/add.tsx` (replaced by `app/add/index.tsx`).

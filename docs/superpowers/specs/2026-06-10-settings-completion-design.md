# Settings screen completion — design

Date: 2026-06-10
Status: Approved

## Goal

Bring the existing Settings screen closer to the approved design (`docs/design/ajustes.png`)
by adding the three things the design has and the current screen lacks:

1. **Card structure with section headers** — refactor `SettingsScreen` to group rows into
   cards under uppercase section labels (AVISOS, APARIENCIA, PRIVACIDAD Y DATOS, and a
   bottom card), with the inert "Próximamente" rows placed in their real section (not
   piled at the end).
2. **Exportar mis datos** — a real, local-first export: serialize all deadlines to a
   versioned JSON file and hand it to the system share sheet.
3. **Política de privacidad** — a new screen + route with plain-language, app-faithful
   text (a draft to be reviewed by the owner before publishing).

The project's **honesty rule** stands: anything wired to a real feature is real;
anything whose feature does not exist yet is a visible-but-inert **"Próximamente"** row —
never a control that pretends to work.

## Honesty divergence from the mockup (endorsed)

`ajustes.png` shows "Resumen semanal" with a lit toggle and "Tema" with a working
segmented control. Those features do not exist yet, so we **do not** render the live
control (a toggle that does nothing, or a theme selector that changes no theme, lies to
the user). We keep the rows — to preserve the design's structure and signal the roadmap —
but as a label + subtitle + inert **"Próximamente"** badge, never a fake control. Every
other part of the screen matches the design.

## Architecture

Hexagonal, consistent with the existing stack. No changes to existing domain models or
existing ports; the only new port is `DataExporter`.

- **Pure, framework-free** (canonical portable form of the data, schema-versioned):
  `buildDeadlineExport` and the export filename builder live in `src/domain/export/`.
  They are the export analogue of the persistence mapper (domain → external
  representation), with no presentation/copy — so they belong outside `ui/`.
- **Shared date helper:** `toLocalDateString` / `fromLocalDateString` are extracted from
  `deadline-mapper.ts` into a neutral `src/domain/date/local-date.ts` and reused by both
  the mapper and the export filename builder (single source of truth for local
  `YYYY-MM-DD`). Behavior is identical; the mapper's existing tests stay green.
- **Port** `DataExporter` in `src/ports/`; **adapter** (`expo-file-system` +
  `expo-sharing`) in `src/infrastructure/export/`; **fake** in `src/test-support/`.
- **DI**: `DataExporterProvider` + `useDataExporter()` (React context, genuinely UI) in
  `src/ui/export/`, mounted in `app/_layout.tsx`, mirroring `NotificationSchedulerProvider`
  (no state, optional injection).
- The screen reuses existing components/DI; navigation stays prop-based (`onClose`,
  `onOpenPrivacy`), wired by the route files.

## Screen structure — `src/ui/screens/SettingsScreen.tsx` (refactor)

Modal header (drag handle + "Ajustes") unchanged. Body becomes section labels + cards:

- **New `SettingsSectionLabel`** (presentational): uppercase, `textSecondary`, the
  design's letter-spacing. The existing `SectionHeader` (dot + count, for Home) is left
  untouched — it does not fit settings sections.

- **AVISOS** (`Card`):
  - `Avisarme por defecto` — text *"Se aplica a cada vencimiento nuevo. Podrás cambiarlo
    en cada uno."* + `ReminderChips` (reused). On change → `save({ ...settings,
    defaultReminderDaysBefore })`.
  - divider → `Hora del aviso` — `TimePickerField` (reused). On change → `save({
    ...settings, reminderTime })`.
  - divider → `Resumen semanal` — **inert `ComingSoonRow`** with subtitle *"Un repaso de
    lo que se acerca, cada lunes."*

- **APARIENCIA** (`Card`):
  - `Tema` — **inert `ComingSoonRow`**.

- **PRIVACIDAD Y DATOS** (`Card`):
  - lock icon + *"Todos tus datos se guardan solo en este dispositivo."*
  - divider → `Exportar mis datos` — `NavRow` (download icon, subtitle *"Guarda una copia
    en tu móvil."*, chevron). Runs the export action.
  - divider → `Borrar todos los datos` — `NavRow` **destructive** (trash icon, red,
    subtitle *"No se puede deshacer."*, chevron). Same confirm + delete logic as today.

- **Bottom card** (`Card`):
  - `Nopasa Premium` — **inert `ComingSoonRow`** with subtitle *"Copias de seguridad ·
    ítems ilimitados."*
  - `Política de privacidad` — `NavRow` (lock icon, chevron) → `onOpenPrivacy()`.
  - (No "Ayuda" — out of scope.)

- **Footer**: `Versión {version}` (`expo-constants`), as today.

`SettingsScreen` gains a prop `onOpenPrivacy: () => void` alongside `onClose`.

### New row components

- **`NavRow`** (`src/ui/components/NavRow.tsx`): leading icon (optional) + label +
  optional subtitle + trailing chevron + `onPress`; `destructive?: boolean` variant
  (red label/icon). Used by Exportar / Borrar / Política. `accessibilityRole="button"`.
- **`ComingSoonRow`** (extend existing): add an optional `subtitle?` prop. Still
  label + "Próximamente" badge; no functional control. Existing call sites unaffected.

## Export feature

### Pure — `src/domain/export/`

```
build-deadline-export.ts
  buildDeadlineExport(deadlines: Deadline[], { exportedAt: Date }): string
    → JSON.stringify({ app: 'nopasa', schema: 1, exportedAt: <ISO>, deadlines })
    Dates (dueDate, createdAt, exportedAt) serialize to ISO via JSON.stringify.
    Includes every deadline of every status (repository.list() already returns all).
    Round-trippable: JSON.parse(result) deep-equals the envelope (dates as ISO strings).

  exportFilename(date: Date): string  →  `nopasa-export-${toLocalDateString(date)}.json`
    Uses the shared toLocalDateString (local YYYY-MM-DD, DST-safe).
```

### Port — `src/ports/data-exporter.ts`

```
interface DataExporter {
  /** Persist `content` under `filename`, then offer it to the user (share sheet). */
  export(filename: string, content: string): Promise<void>;
}
```

### Adapter — `src/infrastructure/export/expo-data-exporter.ts`

Writes `content` to a file in the app's directory with `expo-file-system`, then opens the
system share sheet with `expo-sharing` (sharing an app-owned file needs no special Android
permission). Thin wrapper following the **SDK 56** docs for both modules — mocked in
tests, no native coverage. `expo-file-system` and `expo-sharing` are added as dependencies
at their SDK-56 versions.

### Fake — `src/test-support/fake-data-exporter.ts`

Records the last `{ filename, content }` (and/or a list of calls) for assertions.

### Action (in `SettingsScreen`)

```
onExport:
  const all = await repository.list();
  if (all.length === 0) { Alert.alert('No tienes vencimientos que exportar todavía'); return; }
  const now      = clock.now();
  const content  = buildDeadlineExport(all, { exportedAt: now });
  const filename = exportFilename(now);
  try { await exporter.export(filename, content); }
  catch { Alert.alert('No se pudo exportar', 'Inténtalo de nuevo.'); }   // best-effort
```

`repository` from `useDeadlineRepository`, `exporter` from `useDataExporter`, `clock`
from `useDeadlineDeps().clock`. Export-only; import/restore is out of scope.

## Privacy screen

- **Route** `app/privacy.tsx` (modal, like add/detail/settings): `<PrivacyScreen
  onClose={() => router.back()} />`.
- **`src/ui/screens/PrivacyScreen.tsx`** — props `{ onClose }`. Modal header + scrollable
  plain-language text faithful to the app: data lives only on this device, no servers and
  no cloud copies, no collection or transmission of information, notifications are local.
- **The text is a DRAFT** — flagged in a code comment as pending owner review before
  publishing; not legally final.
- `app/settings.tsx` passes `onOpenPrivacy={() => router.push('/privacy')}` to
  `SettingsScreen`; the "Política de privacidad" `NavRow` calls it.

## Wiring — `app/_layout.tsx`

Add `DataExporterProvider` among the existing port providers, and register the privacy
route:

```
<Stack.Screen name="privacy" options={{ presentation: 'modal' }} />
```

## Data flow

```
SettingsScreen
  Exportar → repository.list() → empty? soft Alert, stop
                               → buildDeadlineExport(all, { exportedAt: clock.now() })
                               → exporter.export(exportFilename(clock.now()), content)  [best-effort]
  Política de privacidad → onOpenPrivacy() → router.push('/privacy')
  (Hora / Avisos / Borrar — unchanged behavior)
```

## Error handling

- Export with no deadlines → soft informational Alert, no export call.
- Export failure (write/share) → caught, Alert; best-effort, never throws to the user.
- Delete-all-data → unchanged (per-deadline `cancel` best-effort + `delete`).

## Testing

**Pure (no React):**
- `buildDeadlineExport`: envelope shape (`app`, `schema: 1`, `exportedAt`, `deadlines`);
  all fields present; deadlines of every status included; round-trip
  (`JSON.parse(result)` deep-equals the envelope); empty list → `deadlines: []`.
- `exportFilename`: `nopasa-export-YYYY-MM-DD.json` from a fixed clock date.
- `local-date`: `toLocalDateString` / `fromLocalDateString` behavior preserved after
  extraction (existing deadline-mapper tests also cover this indirectly).

**Integration / components (fakes + deterministic clock):**
- Export with data → `exporter.export` called once with the expected filename and content
  (fake exporter).
- Export with an empty list → shows the message and does **not** call the exporter.
- "Política de privacidad" row → calls `onOpenPrivacy`.
- Card structure renders the correct sections (AVISOS / APARIENCIA / PRIVACIDAD Y DATOS /
  bottom) and the inert "Próximamente" rows.
- Regression: changing the time persists; changing default reminders persists; delete-all
  confirms → cancels notifications + deletes deadlines.

The `expo-file-system` / `expo-sharing` adapter is a thin wrapper: mock it; no native
coverage.

## Out of scope

Ayuda; import/restore; real behavior for Resumen semanal / Tema / Premium (stay
"Próximamente"); hosting the privacy policy at a URL for the Play listing (a publishing
task, not code); editing deadlines; iOS; photo/OCR.

## Quality

Do not touch existing domain models or existing ports; add only the `DataExporter` port.
Reuse components (`Card`, `FormField`, `ReminderChips`, `TimePickerField`, `AppText`,
`ComingSoonRow`) and DI providers. The UI depends on abstractions. The extracted
`local-date` helper is a single source of truth for local `YYYY-MM-DD`. Inert rows never
fake functionality.

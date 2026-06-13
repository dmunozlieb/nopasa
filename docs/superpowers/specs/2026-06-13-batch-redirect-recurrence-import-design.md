# Batch — Home-after-save · longer recurrence · import data — Design Spec

Date: 2026-06-13
Status: Approved (design); pending implementation plan

A batch of two small tweaks + one feature. Import pulls in `expo-document-picker`
(native) → **this batch needs an EAS rebuild to test on device.**

---

## Item 1 — Return to Home after saving (photo + manual)

### Problem
Saving a deadline today calls `onClose()`, wired in the route to `router.back()`,
which goes back ONE step → lands on an intermediate screen (camera/selector), not
Home. Cancel today is the native modal swipe-down (back one step), which never goes
through `onClose`.

### Decision (locked)
A successful save closes the WHOLE add flow and lands on Home (where the new
deadline is visible — focus-refresh already covers it). Cancel stays as-is (back
one step). Distinguish save-success (→ Home, discard the add stack) from cancel
(→ back) via a separate `onSaved` callback in `DeadlineForm`.

### Design
- `DeadlineForm` gains an **`onSaved`** prop. The successful-save path calls
  `onSaved()` instead of the current `onClose()`.
- `AddDeadlineScreen` and `ConfirmDeadlineScreen` forward `onSaved`.
- Route files wire it to dismiss the whole modal stack:
  `app/add/manual.tsx` and `app/add/confirm.tsx` → `onSaved={() => router.dismissAll()}`.
  Confirm the exact expo-router v56 API (`router.dismissAll()` vs `router.dismissTo('/')`)
  against the versioned docs at implementation time; both add routes are
  `presentation: 'modal'` over the `index` (Home) stack root, so dismissing the
  modal stack returns to Home.
- **Cancel needs no code**: verified there is no explicit cancel/close button in the
  add-form flow — `DeadlineForm` has only the non-pressable drag handle + the
  "Guardar" button; `AddDeadlineScreen`/`ConfirmDeadlineScreen` only wrap it. The
  only cancel is the native swipe-down (back one step), unchanged. (`AddOptionsScreen`
  keeps its own `onClose` → back; it does not save.) If implementation reveals an
  orphaned `onClose`-driven cancel button anywhere in the flow, give it its own
  `onCancel` → back, distinct from `onSaved` → Home.
- `onClose` is no longer called by the save path; remove it from the add-form flow
  props if it becomes unused (avoid a dead prop).

### Tests
- `AddDeadlineScreen`: saving → `onSaved` called (not `onClose`); persistence intact.
- `ConfirmDeadlineScreen`: saving → `onSaved` called.
- Cancel: no screen-level code path (native gesture) — nothing to assert; the
  Home-landing wiring lives in the thin route files (outside the `src` test roots).

---

## Item 2 — Recurrence: longer cycles + custom in years

### Decisions (locked)
Add "Cada 5 años" (60) and "Cada 10 años" (120) presets — the 2-year ceiling
doesn't cover DNI/passport (5–10 years). Custom must allow years, not only months,
via a unit toggle (default **years** — the reason to go custom), always storing in
months (years × 12). Raise the cap to fit 10 years and custom years (~50 years).

### Design
- `RecurrenceSelect` `PRESETS`: add `{ label: 'Cada 5 años', months: 60 }` and
  `{ label: 'Cada 10 años', months: 120 }`. `PRESET_MONTHS` already derives from
  `PRESETS` — no second list to update.
- **Custom unit toggle**: a two-option segmented control (meses / años) shown when
  "Personalizado" is active, default **'years'**. The typed value is interpreted via
  the selected unit; the parsed result is always months.
- `parseRecurrenceMonths(raw: string, unit: 'months' | 'years' = 'months'): number | undefined`:
  - Parse `raw` as a positive integer (reject empty, non-numeric, zero, negative,
    fractional — as today).
  - For `unit === 'years'`: multiply by 12. For `'months'`: as-is.
  - Reject if the resulting months exceed `MAX_RECURRENCE_MONTHS` (so 51 years /
    601 months → undefined). The default `unit` is `'months'` so existing callers
    are unaffected.
- `MAX_RECURRENCE_MONTHS`: 999 → **600** (≈50 years). Existing parse test ('1000' →
  undefined) still holds.
- `RecurrenceSelect` local state: add `customUnit: 'months' | 'years'` (default
  `'years'`). `selectCustom`, `onChangeCustom`, and the unit toggle all call
  `onChange(parseRecurrenceMonths(customText, customUnit))`. On mount, if `value` is
  a non-preset number, infer the unit (`value % 12 === 0` → years with
  `customText = String(value / 12)`, else months) so editing a passed-in custom value
  reads naturally.
- `recurrenceLabel`: **no change** — it already returns "Cada N años" when
  `months % 12 === 0` (60 → "Cada 5 años", 120 → "Cada 10 años", 84 → "Cada 7 años")
  and "Cada N meses" otherwise (15 → "Cada 15 meses"). Add test cases only.

### Tests
- `RecurrenceSelect`: shows "Cada 5 años" / "Cada 10 años"; selecting them reports
  60 / 120; custom in years → `onChange(años × 12)` (e.g. 5 → 60); unit toggle
  re-parses; default unit is years; on-mount unit inference for a non-preset value.
- `parseRecurrenceMonths`: years unit (`'5','years'` → 60); over-cap rejected
  (`'601','months'` and `'51','years'` → undefined); months unit unchanged
  (regression for the default arg).
- `recurrenceLabel`: 60 → "Cada 5 años", 120 → "Cada 10 años" (added cases).

---

## Item 3 — Import data (mirror of export, non-destructive merge)

Completes the round-trip of the existing, round-trippable export (schema 1).

### Decisions (locked)
- **Merge, not replace** — non-destructive. Import adds deadlines you don't have and
  skips those you already have by ID (never deletes or overwrites current data).
- **Schema check** — accept `schema: 1`, reject an unknown version with a clear
  message. Zod-validate each deadline and skip corrupt ones (resilient, like the
  SQLite repo).
- **Reschedule notifications** for imported (new) deadlines, best-effort, reusing
  `buildNotificationPlan` + scheduler — a restore must recover reminders too. Only
  reschedule the newly-imported deadlines whose `status === 'ACTIVE'` (don't
  resurrect reminders for resolved/cancelled items the export also carries).
- **Confirmation count N = valid deadlines found in the file** (after parse, before
  dedup). The repo is only read when merging.
- **Result message — itemized, hiding zero lines**: "Importados N" + " · M ya
  existían" (if M > 0) + " · K no válidos" (if K > 0). Distinguishing "already
  existed" (benign) from "invalid" (data loss) matters in a restore feature.

### Date reconstruction (resolved)
The export serializes dates via `JSON.stringify` on the raw `Deadline` objects, so
**both `dueDate` and `createdAt` are full ISO UTC strings** (NOT date-only
"YYYY-MM-DD"; the SQLite mapper's `toLocalDateString` is unrelated to the export).
Reconstruct **both** with `z.coerce.date()`: it round-trips the exact instant, which
in Europe/Madrid reads back as the correct local midnight for `dueDate`. (Using
`fromLocalDateString` would break — it can't parse a full ISO string.) The full-ISO
round-trip is timezone-stable within the same timezone, which is inherent to the
existing export format; the app is Spain-only (Europe/Madrid). Export is left intact.

### Structure (mirror of export)

| Export (exists) | Import (new) |
|---|---|
| `src/domain/export/build-deadline-export.ts` (pure) | `src/domain/import/parse-deadline-import.ts` (pure) |
| port `DataExporter.export(filename, content)` | port `DataImporter.pickAndRead(): Promise<string \| null>` |
| `src/infrastructure/export/expo-data-exporter.ts` | `src/infrastructure/import/expo-data-importer.ts` |
| `src/test-support/fake-data-exporter.ts` | `src/test-support/fake-data-importer.ts` |
| `src/ui/export/data-exporter-context.tsx` | `src/ui/import/data-importer-context.tsx` |

### Components

**Pure parser** — `parseDeadlineImport(jsonText: string): DeadlineImportResult`
```
type ImportSchemaError = 'unreadable' | 'unsupported-version';
interface DeadlineImportResult {
  deadlines: Deadline[];   // valid, fully-typed (dates reconstructed)
  invalidCount: number;    // entries dropped because they failed validation
  schemaError?: ImportSchemaError; // when the whole file is rejected (deadlines empty)
}
```
- `JSON.parse` throws → `{ deadlines: [], invalidCount: 0, schemaError: 'unreadable' }`.
- Parsed but `app !== 'nopasa'` (or the envelope is missing / not an object) →
  `'unreadable'` too. "Not a Nopasa file" reads the same as "couldn't read it" and
  avoids implying it's a Nopasa file of another version when the user simply picked
  the wrong file (a common mistake in a restore flow).
- `app === 'nopasa'` but `schema !== 1` → `'unsupported-version'` — only genuine
  Nopasa files of another version get the "versión no compatible" message.
- Otherwise iterate `deadlines[]`: validate each with an import schema =
  `deadlineSchema.extend({ dueDate: z.coerce.date(), createdAt: z.coerce.date() })`.
  Valid → collect; invalid (`safeParse` fails) → `invalidCount++`. Resilient: one
  bad entry never aborts the rest.
- The error is an enum (language-agnostic domain); Spanish copy lives in UI.

**Port** — `DataImporter.pickAndRead(): Promise<string | null>` (null = user
cancelled the picker; not an error).

**Adapter** — `expoDataImporter`: `expo-document-picker` `getDocumentAsync` (accept
any/`application/json`, `copyToCacheDirectory: true`) → read the picked uri's text via
the expo-file-system v56 `File` API (mirror `expoDataExporter`'s `File`/`Paths` use) →
return content, or `null` if `result.canceled`. Verify exact APIs against expo v56 docs.

**Fake** — `FakeDataImporter` returns a preset content string (or null), configurable.

**DI** — `DataImporterProvider` / `useDataImporter` (mirror exporter context); add the
provider to `app/_layout.tsx` next to `DataExporterProvider`.

**Merge use-case hook** — `useMergeImportedDeadlines(): (deadlines: Deadline[]) => Promise<{ imported: number; alreadyExisted: number }>`
- `const existing = new Set((await repo.list()).map((d) => d.id))`.
- For each deadline: if `existing.has(d.id)` → `alreadyExisted++` (never overwrite);
  else `await repo.save(d)`, `imported++`, and if `d.status === 'ACTIVE'`, best-effort
  reschedule: `buildNotificationPlan(d, { now: clock.now(), reminderTime: settings.reminderTime })`
  then `scheduler.schedule(d.id, plan)` (try/catch swallows — never fail the import).
- Pulls repo + scheduler + deadline-deps (clock) + settings, like `useCreateDeadline`.

**Pure copy helpers** (UI):
- `importErrorMessage(code: ImportSchemaError): string` — `'unreadable'` → "No pudimos
  leer el archivo. ¿Seguro que es una copia de Nopasa?" (covers both "didn't parse" and
  "parsed but isn't a Nopasa file"); `'unsupported-version'` → "Este archivo es de una
  versión no compatible de Nopasa." (final wording at impl).
- `importResultMessage({ imported, alreadyExisted, invalidCount }): string` —
  "Importados {imported}", then " · {M} ya existían" only if M > 0, then
  " · {K} no válidos" only if K > 0.

**Settings UX** — `SettingsScreen` `importData()`, wired to a new `NavRow`
"Importar mis datos" (icon e.g. `tray-arrow-up`) next to "Exportar mis datos":
1. `const text = await importer.pickAndRead()`; if `text === null` → return (cancel, no-op).
2. `const { deadlines, invalidCount, schemaError } = parseDeadlineImport(text)`.
3. `schemaError` → `Alert.alert('No se pudo importar', importErrorMessage(schemaError))`; return.
4. `deadlines.length === 0`:
   - if `invalidCount > 0` → `Alert.alert('No se pudo importar', 'No se pudo leer ningún vencimiento válido.')`;
   - else → `Alert.alert('El archivo no contiene vencimientos')`; return.
5. Confirm: `Alert.alert('Importar', '¿Importar ${deadlines.length} vencimientos?', [{ text:'Cancelar', style:'cancel' }, { text:'Importar', onPress: () => void doMerge() }])`.
6. `doMerge`: `const { imported, alreadyExisted } = await merge(deadlines)`;
   `Alert.alert('Importación completada', importResultMessage({ imported, alreadyExisted, invalidCount }))`.
   (Wrap merge in try/catch → "No se pudo importar" on unexpected failure.)

**app.json / deps** — add `expo-document-picker` (~56). No Android config plugin
needed; iOS out of scope. **Requires an EAS rebuild to test on device.**

### Tests
- `parseDeadlineImport` (pure): round-trip valid (feed `buildDeadlineExport` output →
  same deadlines back, **asserting exact instant equality** on `dueDate`/`createdAt`,
  e.g. `expect(result.deadlines[0].dueDate).toEqual(original.dueDate)` under
  TZ=Europe/Madrid); unknown schema → `'unsupported-version'`, deadlines empty;
  non-JSON → `'unreadable'`; wrong `app` (not Nopasa) → `'unreadable'`; mixed file with
  some corrupt entries → valid collected + `invalidCount` correct; dates are real
  `Date` objects.
- `useMergeImportedDeadlines` (fakes + clock): existing IDs → `alreadyExisted`, not
  overwritten; new → saved + `imported`; new ACTIVE → `scheduler.schedule` called with
  a plan from its date; new RESOLVED/CANCELLED → saved but NOT scheduled; scheduler
  throw → still saved (best-effort).
- `importResultMessage` (pure): imported-only; imported + already-existed; imported +
  invalid; all three; zero lines hidden.
- `importErrorMessage` (pure): both codes.
- `SettingsScreen` integration (Alert spy, fakes): "Importar mis datos" → cancelled
  picker (fake null) → no-op; valid file → confirm → merge → result Alert; bad file →
  error Alert; all-invalid file → "ningún vencimiento válido"; **round-trip**:
  export (FakeDataExporter content) fed to FakeDataImporter → import → repo has the
  same deadlines via `findById`.
- **Regression**: export tests intact; recurrence (presets, label, parse default
  months arg) and manual add unchanged.

---

## Out of scope
Orientation fix (separate), iOS, overwriting on import (skip-existing is deliberate),
changing the export format.

## Quality bar
Pure parser in the domain; non-destructive merge; resilient to corrupt entries;
reuses the scheduler for imported reminders; mirrors the export structure; pure,
tested copy helpers.

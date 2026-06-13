# OCR Parsing → Form Prefill (Photo Path · Block 3)

**Date:** 2026-06-13
**Status:** Approved — ready for implementation plan

## Goal

Turn the `RecognizedText` produced by on-device OCR (Block 2) into a best-effort guess
of deadline fields — type, due date, title/subtitle, and amount when applicable — that
prefills the confirm form.

Philosophy (firm): **OCR assists, the user confirms.** The parser *proposes*; the user
*corrects*. We do not need to be right every time — a 70–80% hit rate that saves typing
is the value. Partial results are valuable. **Never emit junk:** fill only what we have
with confidence, leave the rest empty.

## Architecture

- **Pure domain parser** in `src/domain/ocr-parsing/`, no I/O, each piece independently
  testable. Entry point: `parseDeadlineHints(recognized: RecognizedText, { now: Date }): DeadlineHints`.
- **Domain output type `DeadlineHints`** (domain types only, all optional). The domain
  does **not** know the UI — it never imports `AddFormState` or anything from `src/ui`.
- **UI mapper** in `src/ui/deadline/` translates `DeadlineHints → Partial<AddFormState>`
  (amount → ES text, date → picker, title/subtitle via `typeLabel`/`defaultSubtitle`,
  `subtitleTouched` handling).
- Feeds the **existing `initialValues` seam** of `DeadlineForm` (empty in Block 2). The
  confirm screen, after OCR resolves, runs the parser and passes the mapped result as
  `initialValues`.
- **Domain `Deadline` / SQLite do not change.**

```
RecognizedText
   │  (src/domain/ocr-parsing/ — pure, no UI/infra imports)
   ▼
parseDeadlineHints(recognized, { now })
   ├─ detectType(text)              → DeadlineType | undefined
   ├─ extractDateCandidates(text)   → DateCandidate[]
   ├─ selectDueDate(cands, text, …) → Date | undefined
   └─ extractAmount(text)           → number | undefined   (gated by type)
   ▼
DeadlineHints { type?, dueDate?, amount? }
   │  (src/ui/deadline/hints-to-initial-values.ts)
   ▼
Partial<AddFormState>  ──► DeadlineForm initialValues  ──►  prefilled confirm
```

## Domain output type

```ts
// src/domain/ocr-parsing/deadline-hints.ts
export interface DeadlineHints {
  type?: DeadlineType;   // only when a keyword matched with confidence
  dueDate?: Date;        // local midnight (startOfDay); always today-or-future (calendar)
  amount?: number;       // positive; only for INSURANCE / SUBSCRIPTION
}
```

## Module layout (domain)

`src/domain/ocr-parsing/`, all pure & sin I/O:

- `deadline-hints.ts` — the `DeadlineHints` interface.
- `parse-deadline-hints.ts` — `parseDeadlineHints(recognized, { now }): DeadlineHints`.
  Orchestrates the sub-steps; composes a best-effort result where each field is
  independent (one field's absence never blocks the others).
- `detect-type.ts` — `detectType(text): DeadlineType | undefined`.
- `extract-dates.ts` — `extractDateCandidates(text): DateCandidate[]`
  (`DateCandidate = { date: Date; offset: number; raw: string }`).
- `select-due-date.ts` — `selectDueDate(candidates, text, { now }): Date | undefined`.
- `extract-amount.ts` — `extractAmount(text): number | undefined`.
- `keywords.ts` — type keyword tables + expiry-label tables.

## Type detection

Normalize text before matching: lowercase + **strip accents** (OCR routinely drops
tildes). Matching rules:

- **Multi-word keywords: tolerant of lost spaces.** Join words with flexible whitespace
  (`\s*`, zero-or-more) so OCR space loss still matches — e.g.
  `documento\s*nacional\s*de\s*identidad` matches the real DNI anchor's
  `DOCUMENTO NACIONALDE IDENTIDAD` (missing space). This is the substantive fix the DNI
  anchor exists to catch: a strict phrase match would fail on `NACIONALDE`.
- **Single-word keywords: word-boundary only** (`\bgas\b`), so `gas` does **not** match
  inside `gastos`.

Keyword tables (normalized, representative — extensible):

| Type | Keywords |
|------|----------|
| ITV | `itv`, `inspeccion tecnica` |
| DNI | `documento nacional de identidad` (tolerant), `dni` (single-word backup — unreliable; OCR may garble to "DM") |
| PASSPORT | `pasaporte`, `passport` |
| DRIVING_LICENSE | `permiso de conducir`, `carnet de conducir` |
| INSURANCE | `seguro`, `poliza` |
| SUBSCRIPTION | `suscripcion`, `subscription` |
| WARRANTY | `garantia` |
| GAS_INSPECTION | `gas` (word-boundary), `revision del gas` |

Multiple matches → most **specific** wins (multi-word phrase > single word), with a fixed
priority order as tie-break. No match → `undefined` (see decision A).

## Date extraction

Spanish day-first formats:

- Numeric: `DD/MM/YYYY`, `DD-MM-YYYY`, `DD.MM.YYYY`, `DD MM YYYY` (spaces — as on the DNI).
- Textual month: `DD de <mes> de YYYY` (enero … diciembre).
- **4-digit years only** in v1 (2-digit deferred — too ambiguous).

Validation: range (day 1–31, month 1–12) and **round-trip** (construct
`new Date(y, m-1, d)`, reject overflow like `31/02` → March). Plausibility window: year
within `[now − 30y, now + 30y]`; discard outside. Each candidate keeps its character
`offset` (for label proximity).

## Due-date selection (the iterative core)

**"Future/valid" is a calendar-date comparison, not a timestamp comparison.** A candidate
is future-or-current when `candidate.date >= startOfDay(now)` — i.e. compared by *day*,
not by instant. Modeling it as `candidate.date > now` would wrongly drop a deadline due
**today**: today's date is local midnight (00:00), which is `< now` (e.g. 14:30), so a
legitimate due-today document (a receipt that expires today) would be discarded. The app
already handles "today"/N=0, so this must stay consistent with `daysBetween`/urgency.

Strategy — **label proximity by character window** (robust to how OCR splits lines):

1. Locate expiry labels in the text: `validez`, `valido/válida hasta`, `caduca`,
   `caducidad`, `vencimiento`, `vence`, `renovacion` (normalized). The bare `hasta` is
   **excluded** v1 — too common ("hasta luego", "hasta el 50%", addresses) and prone to
   pulling promotional dates; the phrase forms (`válido/válida hasta`) are the safe ones.
2. For each label, take the nearest candidate **after** the label within a character
   window (covers same line + next line).
3. Among label-associated candidates: prefer a **future-or-current** date
   (`>= startOfDay(now)`); if several, the **latest**. → Resolves the hard DNI case
   (emission past + validity future appear together → pick validity).
4. No label match → same criterion over all candidates (future-or-current, latest).
5. **No future-or-current candidate → empty** (decision B). Never emit a past date as a
   due date.

## Amount

ES patterns: `1.234,56 €`, `49,99€`, `€ 12,00`, `12 EUR/euros` (dot thousands, comma
decimal). Parse to a positive number. **Gated**: emit `amount` only when
`type ∈ {INSURANCE, SUBSCRIPTION}`. If multiple amounts → take the **first** plausible
(decision C). `amountLabel` is out of scope — `AddFormState` has no such field in v1.

## UI wiring (confirm + subtitle-sync)

`src/ui/deadline/hints-to-initial-values.ts`:

```ts
hintsToInitialValues(hints: DeadlineHints): Partial<AddFormState>
// if hints.type:    type, title = typeLabel(type),
//                   subtitle = defaultSubtitle(type), subtitleTouched = false
// if hints.dueDate: dueDate
// if hints.amount:  amount = ES text, e.g. "49,99"
```

**subtitle-sync rule.** The prefill sets `subtitle = defaultSubtitle(type)` (never a
custom value) with `subtitleTouched = false`. The two are therefore consistent, and if the
user later **changes the type**, `syncSubtitle` re-syncs the subtitle to the new type's
default — desired, and nothing of the user's is overwritten (there is no custom value to
preserve). `title = typeLabel(type)` leaves the form **valid** out of the gate (non-empty
title), editable.

`ConfirmDeadlineScreen` changes:

- After OCR resolves:
  `hints = recognized ? parseDeadlineHints(recognized, { now: deps.clock.now() }) : {}`
  → `initialValues = hintsToInitialValues(hints)` →
  `<DeadlineForm initialValues={…} photoUri={photoUri} … />`.
- Passing `{ now: deps.clock.now() }` keeps the parse deterministic under the test clock.
- **Remove** the temporary "Texto detectado" preview block.
- OCR fail/empty → `initialValues` empty → manual form intact (best-effort, never blocks).
- Regression: still pass `photoUri` to `DeadlineForm` (photo persistence on save intact).

## Fixtures & tests (TDD)

Fixture shape (so adding real samples later is one entry):

```ts
{ name: string; recognized: RecognizedText; now: Date; expected: Partial<DeadlineHints> }
```

A table-driven test iterates the set. Fixtures:

- **`dni-anonymized`** (anchor): real OCR noise preserved (lost spaces incl.
  `NACIONALDE`, line order, date formats, garbles); **PII replaced with fake values of the
  same format** (name, DNI number, support number); dates deterministic relative to the
  test clock (**validity future > emission past**). Real PII is never committed.
- Synthetic-but-realistic: `itv`, `insurance`, `subscription`, `passport`.
- **`due-today`**: a document whose expiry equals the test clock's day → `dueDate` must be
  set (pins the calendar-date comparison; a timestamp comparison would drop it). The DNI
  anchor does not exercise this (validity is years out).
- `noise-only` → empty hints.

Domain tests:

- `detectType`: each keyword → type; **DNI matches despite `NACIONALDE`** (lost space);
  word-boundary (`gas` not in `gastos`); no match → `undefined`.
- `extractDateCandidates`: each format; reject invalid (`32`, `13`) and overflow (`31/02`);
  plausibility window.
- `selectDueDate`: label proximity; **DNI → validity, not emission**; future-or-current
  preference; **due today is kept** (calendar `>= startOfDay(now)`, not timestamp `> now`,
  even with `now` at 14:30); **no future-or-current → empty**; noise tolerance.
- `extractAmount`: ES formats; gating by type; first-of-many.
- `parseDeadlineHints`: table-driven per fixture; partials; never junk.

UI tests:

- `hintsToInitialValues`: mapping (type → title/subtitle/touched, date, amount text);
  empty hints → empty `Partial`.
- `ConfirmDeadlineScreen` (fakes + fake clock): OCR text → form prefilled (type chip
  selected + date visible); OCR fail/empty → empty form, manual works; **regression:
  persists `photoUri` on save**.

Verification: `npm test` (TZ=Europe/Madrid) green; `npm run typecheck` clean.

## Decisions

- **A — Type with no confident match → `undefined`** (not explicit `OTHER`). Form stays
  on `OTHER` with empty title — identical to opening the blank manual form, the correct
  baseline. Prefilling `title="Otro"` only adds friction (user would delete it).
- **B — No future-or-current date → empty `dueDate`.** A due date is by nature
  today-or-future; prefilling a past date would be actively misleading and would pollute
  urgency/notifications. A wrong date is worse than none. "Future-or-current" is a
  calendar-date test (`>= startOfDay(now)`) so a deadline due **today** is kept, not
  dropped by a timestamp comparison.
- **C — Multiple amounts → first plausible.** Discard "largest": in insurance the largest
  figure is usually the insured capital (e.g. 150.000,00), not the user's premium (e.g.
  263,38) — "largest" would be systematically wrong. "First" is predictable and testable;
  amount is the lowest-weight field, gated to two types, and the user sees/confirms it
  before saving, so a bad guess is cheap.

## Out of scope

- Photo orientation / EXIF fix (separate).
- iOS, gallery.
- Any change to domain `Deadline` / SQLite.
- 2-digit years; `amountLabel` capture.

## Optional (low priority)

- A discreet **dev-only "copy text"** affordance to harvest real OCR samples for heuristic
  tuning (replaces the removed "Texto detectado" preview as a dev tool). The plan may
  include or defer it.
```
# OCR Parsing → Form Prefill (Block 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Parse the OCR `RecognizedText` into a best-effort `DeadlineHints` (type, due date, amount) that prefills the confirm form — "OCR assists, the user confirms".

**Architecture:** A pure domain parser in `src/domain/ocr-parsing/` (no I/O, no UI imports) composed of small testable units: `normalize` → `detectType` / `extractDateCandidates` / `selectDueDate` / `extractAmount` → `parseDeadlineHints`. A UI mapper `hintsToInitialValues` (in `src/ui/deadline/`) translates `DeadlineHints` to `Partial<AddFormState>`, feeding the existing `initialValues` seam of `DeadlineForm`. `ConfirmDeadlineScreen` runs the parser after OCR and passes the mapped values; the temporary "Texto detectado" preview is removed.

**Tech Stack:** TypeScript, React Native (Expo SDK 56), Jest (`jest-expo`), React Native Testing Library. Tests run with `TZ=Europe/Madrid`.

**Spec:** `docs/superpowers/specs/2026-06-13-ocr-parsing-prefill-block3-design.md`

**Key decisions baked in:**
- Multi-word keywords match with flexible whitespace (`documento\s*nacional\s*de\s*identidad`) to survive OCR space loss (`NACIONALDE`); single-word keywords use word boundaries (`\bgas\b`).
- "Future-or-current" is a **calendar-date** test (`candidate.date >= startOfDay(now)`), never a timestamp test — a deadline due **today** must be kept.
- No future-or-current date → empty `dueDate` (never a past date). No confident type → no `type` hint. Multiple amounts → **first** plausible (not largest). Amount gated to `INSURANCE`/`SUBSCRIPTION`.

**Conventions to follow (from the codebase):**
- All code/identifiers/comments in English.
- Domain dates are local-midnight `Date` (see `src/domain/shared/date.ts` `startOfDay`).
- Commit messages in English; **no `Co-Authored-By` trailer**.
- Run a single test file with: `npm test -- <path>` (Jest passes through). Run everything with `npm test`.

---

## File Structure

**Created (domain — pure, zero UI/infra imports):**
- `src/domain/ocr-parsing/normalize-text.ts` — lowercase + strip accents (OCR-tolerant).
- `src/domain/ocr-parsing/keywords.ts` — type keyword table, expiry-label table, regex builder.
- `src/domain/ocr-parsing/detect-type.ts` — `detectType(text): DeadlineType | undefined`.
- `src/domain/ocr-parsing/extract-dates.ts` — `extractDateCandidates(text): DateCandidate[]`.
- `src/domain/ocr-parsing/select-due-date.ts` — `selectDueDate(text, { now }): Date | undefined`.
- `src/domain/ocr-parsing/extract-amount.ts` — `extractAmount(text): number | undefined`.
- `src/domain/ocr-parsing/deadline-hints.ts` — `DeadlineHints` interface.
- `src/domain/ocr-parsing/parse-deadline-hints.ts` — orchestrator.
- `src/domain/ocr-parsing/__fixtures__/deadline-samples.ts` — fixture set (DNI anchor anonymized + synthetics).

**Created (UI):**
- `src/ui/deadline/hints-to-initial-values.ts` — `hintsToInitialValues(hints): Partial<AddFormState>`.

**Modified:**
- `src/ui/screens/ConfirmDeadlineScreen.tsx` — run parser, pass `initialValues`, remove preview.
- `src/ui/screens/ConfirmDeadlineScreen.test.tsx` — assert prefill; drop preview assertions.

---

## Task 1: `normalize-text`

**Files:**
- Create: `src/domain/ocr-parsing/normalize-text.ts`
- Test: `src/domain/ocr-parsing/normalize-text.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/domain/ocr-parsing/normalize-text.test.ts
import { normalize } from './normalize-text';

describe('normalize', () => {
  it('lowercases the text', () => {
    expect(normalize('DOCUMENTO')).toBe('documento');
  });

  it('strips accents/tildes (OCR drops them)', () => {
    expect(normalize('Inspección Técnica')).toBe('inspeccion tecnica');
    expect(normalize('Válido')).toBe('valido');
  });

  it('is idempotent', () => {
    const once = normalize('Pólizá CADUCIDAD');
    expect(normalize(once)).toBe(once);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/domain/ocr-parsing/normalize-text.test.ts`
Expected: FAIL — cannot find module `./normalize-text`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/domain/ocr-parsing/normalize-text.ts
/** Lowercase + strip diacritics (accents/tildes) so OCR text that dropped accents
 *  still matches. Idempotent: normalize(normalize(x)) === normalize(x). */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '') // strip accents/tildes
    .toLowerCase();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/domain/ocr-parsing/normalize-text.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/ocr-parsing/normalize-text.ts src/domain/ocr-parsing/normalize-text.test.ts
git commit -m "feat(ocr): OCR-tolerant text normalizer (Block 3)"
```

---

## Task 2: `detect-type` + `keywords`

**Files:**
- Create: `src/domain/ocr-parsing/keywords.ts`
- Create: `src/domain/ocr-parsing/detect-type.ts`
- Test: `src/domain/ocr-parsing/detect-type.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/domain/ocr-parsing/detect-type.test.ts
import { detectType } from './detect-type';

describe('detectType', () => {
  it('detects DNI from the full phrase even with the space the OCR ate (NACIONALDE)', () => {
    expect(detectType('DOCUMENTO NACIONALDE IDENTIDAD')).toBe('DNI');
  });

  it('detects each category from its keyword', () => {
    expect(detectType('Tu seguro de hogar')).toBe('INSURANCE');
    expect(detectType('SUSCRIPCION PREMIUM')).toBe('SUBSCRIPTION');
    expect(detectType('ITV favorable')).toBe('ITV');
    expect(detectType('PERMISO DE CONDUCIR')).toBe('DRIVING_LICENSE');
    expect(detectType('Pasaporte')).toBe('PASSPORT');
    expect(detectType('Garantía del producto')).toBe('WARRANTY');
    expect(detectType('Revisión del gas natural')).toBe('GAS_INSPECTION');
  });

  it('matches single-word "gas" only on a word boundary, not inside "gastos"', () => {
    expect(detectType('gastos varios del mes')).toBeUndefined();
  });

  it('prefers the most specific (multi-word) match over a stray single word', () => {
    // "documento nacional de identidad" (4 words) wins even if "dni" also appears
    expect(detectType('DOCUMENTO NACIONAL DE IDENTIDAD\nDNI 12345678Z')).toBe('DNI');
  });

  it('returns undefined when nothing matches', () => {
    expect(detectType('Cumpleaños de la abuela')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/domain/ocr-parsing/detect-type.test.ts`
Expected: FAIL — cannot find module `./detect-type`.

- [ ] **Step 3: Write `keywords.ts`**

```ts
// src/domain/ocr-parsing/keywords.ts
import type { DeadlineType } from '../deadline/deadline.schema';

/** A normalized keyword (no accents, lowercase) that signals a deadline type.
 *  Array order is the tie-break priority when two keywords are equally specific:
 *  earlier wins. Multi-word phrases are more specific than single words. */
interface TypeKeyword {
  type: DeadlineType;
  keyword: string;
}

export const TYPE_KEYWORDS: TypeKeyword[] = [
  { type: 'DNI', keyword: 'documento nacional de identidad' },
  { type: 'DRIVING_LICENSE', keyword: 'permiso de conducir' },
  { type: 'DRIVING_LICENSE', keyword: 'carnet de conducir' },
  { type: 'GAS_INSPECTION', keyword: 'revision del gas' },
  { type: 'ITV', keyword: 'inspeccion tecnica' },
  { type: 'ITV', keyword: 'itv' },
  { type: 'PASSPORT', keyword: 'pasaporte' },
  { type: 'PASSPORT', keyword: 'passport' },
  { type: 'INSURANCE', keyword: 'seguro' },
  { type: 'INSURANCE', keyword: 'poliza' },
  { type: 'SUBSCRIPTION', keyword: 'suscripcion' },
  { type: 'SUBSCRIPTION', keyword: 'subscription' },
  { type: 'WARRANTY', keyword: 'garantia' },
  { type: 'GAS_INSPECTION', keyword: 'gas' },
  { type: 'DNI', keyword: 'dni' }, // single-word backup; OCR may garble it
];

/** Expiry-label keywords (normalized). The bare "hasta" is deliberately excluded:
 *  too common ("hasta luego", "hasta el 50%") and prone to pulling promotional
 *  dates; the phrase forms below are the safe ones. */
export const EXPIRY_LABELS: string[] = [
  'validez',
  'valido hasta',
  'valida hasta',
  'caduca',
  'caducidad',
  'vencimiento',
  'vence',
  'renovacion',
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Builds a matcher for a normalized keyword/label. Multi-word phrases join their
 *  words with `\s*` (zero-or-more whitespace) so OCR space loss still matches;
 *  single words are anchored on word boundaries to avoid partial hits. */
export function keywordToRegExp(keyword: string): RegExp {
  const words = keyword.split(' ');
  const body =
    words.length > 1
      ? words.map(escapeRegExp).join('\\s*')
      : `\\b${escapeRegExp(words[0])}\\b`;
  return new RegExp(body);
}
```

- [ ] **Step 4: Write `detect-type.ts`**

```ts
// src/domain/ocr-parsing/detect-type.ts
import type { DeadlineType } from '../deadline/deadline.schema';
import { normalize } from './normalize-text';
import { TYPE_KEYWORDS, keywordToRegExp } from './keywords';

/** Best guess of the deadline type from the OCR text, or undefined when no keyword
 *  matches with confidence (the form then keeps its blank OTHER default). The most
 *  specific match wins (multi-word phrase > single word); ties break by table order. */
export function detectType(text: string): DeadlineType | undefined {
  const norm = normalize(text);
  let best: { type: DeadlineType; words: number; order: number } | undefined;

  TYPE_KEYWORDS.forEach((entry, order) => {
    if (!keywordToRegExp(entry.keyword).test(norm)) return;
    const words = entry.keyword.split(' ').length;
    if (best === undefined || words > best.words) {
      best = { type: entry.type, words, order };
    }
  });

  return best?.type;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/domain/ocr-parsing/detect-type.test.ts`
Expected: PASS (all cases).

- [ ] **Step 6: Commit**

```bash
git add src/domain/ocr-parsing/keywords.ts src/domain/ocr-parsing/detect-type.ts src/domain/ocr-parsing/detect-type.test.ts
git commit -m "feat(ocr): space-tolerant type detection from keywords (Block 3)"
```

---

## Task 3: `extract-dates`

**Files:**
- Create: `src/domain/ocr-parsing/extract-dates.ts`
- Test: `src/domain/ocr-parsing/extract-dates.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/domain/ocr-parsing/extract-dates.test.ts
import { extractDateCandidates } from './extract-dates';

describe('extractDateCandidates', () => {
  it('parses day-first numeric dates with /, -, . and space separators', () => {
    expect(extractDateCandidates('11/06/2027')[0].date).toEqual(new Date(2027, 5, 11));
    expect(extractDateCandidates('11-06-2027')[0].date).toEqual(new Date(2027, 5, 11));
    expect(extractDateCandidates('11.06.2027')[0].date).toEqual(new Date(2027, 5, 11));
    expect(extractDateCandidates('14 03 2031')[0].date).toEqual(new Date(2031, 2, 14));
  });

  it('parses textual Spanish month dates', () => {
    expect(extractDateCandidates('15 de marzo de 2027')[0].date).toEqual(new Date(2027, 2, 15));
  });

  it('rejects out-of-range and overflow dates (round-trip check)', () => {
    expect(extractDateCandidates('32/01/2026')).toEqual([]);
    expect(extractDateCandidates('15/13/2026')).toEqual([]);
    expect(extractDateCandidates('31/02/2026')).toEqual([]);
  });

  it('returns multiple candidates sorted by position, each with its offset', () => {
    const cands = extractDateCandidates('emitido 07 12 2021, valido 14 03 2031');
    expect(cands.map((c) => c.date)).toEqual([new Date(2021, 11, 7), new Date(2031, 2, 14)]);
    expect(cands[0].offset).toBeLessThan(cands[1].offset);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/domain/ocr-parsing/extract-dates.test.ts`
Expected: FAIL — cannot find module `./extract-dates`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/domain/ocr-parsing/extract-dates.ts
import { normalize } from './normalize-text';

/** A date found in the OCR text. `offset` is the character index in the normalized
 *  text (used to measure proximity to expiry labels). */
export interface DateCandidate {
  date: Date; // local midnight
  offset: number;
  raw: string;
}

const MONTHS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** Builds a local-midnight Date, rejecting out-of-range parts and calendar overflow
 *  (e.g. 31/02 → would roll into March), returning undefined when invalid. */
function buildDate(day: number, month: number, year: number): Date | undefined {
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return undefined;
  }
  return date;
}

/** Extracts all plausible day-first dates from the text. Plausibility relative to a
 *  clock (year window, past/future) is applied later in selectDueDate, which has `now`. */
export function extractDateCandidates(text: string): DateCandidate[] {
  const norm = normalize(text);
  const out: DateCandidate[] = [];

  const numeric = /(\d{1,2})[/\-.\s](\d{1,2})[/\-.\s](\d{4})/g;
  for (const m of norm.matchAll(numeric)) {
    const date = buildDate(Number(m[1]), Number(m[2]), Number(m[3]));
    if (date) out.push({ date, offset: m.index ?? 0, raw: m[0] });
  }

  const textual = new RegExp(`(\\d{1,2})\\s+de\\s+(${MONTHS_ES.join('|')})\\s+de\\s+(\\d{4})`, 'g');
  for (const m of norm.matchAll(textual)) {
    const month = MONTHS_ES.indexOf(m[2]) + 1;
    const date = buildDate(Number(m[1]), month, Number(m[3]));
    if (date) out.push({ date, offset: m.index ?? 0, raw: m[0] });
  }

  return out.sort((a, b) => a.offset - b.offset);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/domain/ocr-parsing/extract-dates.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/ocr-parsing/extract-dates.ts src/domain/ocr-parsing/extract-dates.test.ts
git commit -m "feat(ocr): day-first date candidate extraction (Block 3)"
```

---

## Task 4: `select-due-date`

**Files:**
- Create: `src/domain/ocr-parsing/select-due-date.ts`
- Test: `src/domain/ocr-parsing/select-due-date.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/domain/ocr-parsing/select-due-date.test.ts
import { selectDueDate } from './select-due-date';

describe('selectDueDate', () => {
  const now = new Date(2026, 5, 13, 14, 30); // 2026-06-13 14:30 (time-of-day on purpose)

  it('picks the validity over the emission on a DNI (emission past, validity future)', () => {
    const text = 'IDESP BAA000000\nVALIDEZ\n14 03 2031\nDNI 00000000T\n07 12 2021';
    expect(selectDueDate(text, { now })).toEqual(new Date(2031, 2, 14));
  });

  it('keeps a deadline due TODAY (calendar comparison, not timestamp > now)', () => {
    // 13/06/2026 is local midnight (00:00); now is 14:30 the same day. Must NOT be dropped.
    expect(selectDueDate('FECHA LIMITE 13/06/2026', { now })).toEqual(new Date(2026, 5, 13));
  });

  it('returns undefined when every date is in the past', () => {
    expect(selectDueDate('emitido 01/01/2020', { now })).toBeUndefined();
  });

  it('filters out implausible years (outside the ±30y window)', () => {
    expect(selectDueDate('fecha 01/01/1700', { now })).toBeUndefined();
  });

  it('associates a date to an expiry phrase label ("valido hasta")', () => {
    expect(selectDueDate('Oferta valido hasta 10/10/2030', { now })).toEqual(new Date(2030, 9, 10));
  });

  it('without any label, prefers the latest future date', () => {
    expect(selectDueDate('10/05/2028 y 10/05/2030', { now })).toEqual(new Date(2030, 4, 10));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/domain/ocr-parsing/select-due-date.test.ts`
Expected: FAIL — cannot find module `./select-due-date`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/domain/ocr-parsing/select-due-date.ts
import { startOfDay } from '../shared/date';
import { normalize } from './normalize-text';
import { extractDateCandidates, type DateCandidate } from './extract-dates';
import { EXPIRY_LABELS, keywordToRegExp } from './keywords';

/** Chars after an expiry label within which a date is considered "the label's date".
 *  Wide enough to cover the same line plus the next (labels and values often wrap). */
const LABEL_WINDOW = 40;

/** Picks the due date: among today-or-future candidates, prefer those near an expiry
 *  label; among the chosen pool, take the latest. Returns undefined when no candidate
 *  is today-or-future — we never surface a past date as a deadline.
 *
 *  "Today-or-future" is a CALENDAR comparison (date >= startOfDay(now)), so a deadline
 *  due today survives even though its midnight is < now's time-of-day. */
export function selectDueDate(text: string, { now }: { now: Date }): Date | undefined {
  const norm = normalize(text);
  const minYear = now.getFullYear() - 30;
  const maxYear = now.getFullYear() + 30;
  const today = startOfDay(now).getTime();

  const plausible = extractDateCandidates(norm).filter((c) => {
    const y = c.date.getFullYear();
    return y >= minYear && y <= maxYear;
  });
  const future = plausible.filter((c) => c.date.getTime() >= today);
  if (future.length === 0) return undefined;

  const labelOffsets = findLabelOffsets(norm);
  const labelled = future.filter((c) =>
    labelOffsets.some((l) => c.offset >= l && c.offset - l <= LABEL_WINDOW),
  );
  const pool = labelled.length > 0 ? labelled : future;
  return latest(pool).date;
}

function latest(candidates: DateCandidate[]): DateCandidate {
  return candidates.reduce((a, b) => (b.date.getTime() > a.date.getTime() ? b : a));
}

function findLabelOffsets(norm: string): number[] {
  const offsets: number[] = [];
  for (const label of EXPIRY_LABELS) {
    const re = new RegExp(keywordToRegExp(label).source, 'g');
    for (const m of norm.matchAll(re)) offsets.push(m.index ?? 0);
  }
  return offsets;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/domain/ocr-parsing/select-due-date.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/ocr-parsing/select-due-date.ts src/domain/ocr-parsing/select-due-date.test.ts
git commit -m "feat(ocr): due-date selection by label proximity + calendar-future (Block 3)"
```

---

## Task 5: `extract-amount`

**Files:**
- Create: `src/domain/ocr-parsing/extract-amount.ts`
- Test: `src/domain/ocr-parsing/extract-amount.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/domain/ocr-parsing/extract-amount.test.ts
import { extractAmount } from './extract-amount';

describe('extractAmount', () => {
  it('parses ES amounts with the euro sign on either side', () => {
    expect(extractAmount('263,38 €')).toBe(263.38);
    expect(extractAmount('€ 12,00')).toBe(12);
    expect(extractAmount('1.234,56€')).toBe(1234.56);
  });

  it('parses integer amounts marked with EUR/euros', () => {
    expect(extractAmount('Total 12 EUR')).toBe(12);
  });

  it('returns undefined when there is no euro amount', () => {
    expect(extractAmount('sin importe en este documento')).toBeUndefined();
  });

  it('takes the FIRST plausible amount, not the largest (premium before capital)', () => {
    // 150.000,00 (insured capital) is larger but later; the premium 263,38 comes first.
    expect(extractAmount('Prima 263,38 € Capital asegurado 150.000,00 €')).toBe(263.38);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/domain/ocr-parsing/extract-amount.test.ts`
Expected: FAIL — cannot find module `./extract-amount`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/domain/ocr-parsing/extract-amount.ts
import { normalize } from './normalize-text';

const NUMBER = '\\d{1,3}(?:\\.\\d{3})*(?:,\\d{2})?|\\d+(?:,\\d{2})?';
const AMOUNT_RE = new RegExp(
  `(?:€|eur(?:os)?)\\s*(${NUMBER})|(${NUMBER})\\s*(?:€|eur(?:os)?)`,
  'g',
);

/** Parses a Spanish-formatted money string ("1.234,56" → 1234.56). Dots are thousands
 *  separators, comma is the decimal. */
function parseEsAmount(raw: string): number | undefined {
  const value = Number(raw.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

/** First plausible euro amount in the text, or undefined. "First" (not "largest") is a
 *  deliberate choice: in insurance the largest figure is usually the insured capital,
 *  not the premium the user pays. Gating to relevant types is the caller's job. */
export function extractAmount(text: string): number | undefined {
  const norm = normalize(text);
  for (const m of norm.matchAll(AMOUNT_RE)) {
    const value = parseEsAmount(m[1] ?? m[2]);
    if (value !== undefined) return value;
  }
  return undefined;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/domain/ocr-parsing/extract-amount.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/ocr-parsing/extract-amount.ts src/domain/ocr-parsing/extract-amount.test.ts
git commit -m "feat(ocr): first-plausible euro amount extraction (Block 3)"
```

---

## Task 6: `parse-deadline-hints` + fixtures

**Files:**
- Create: `src/domain/ocr-parsing/deadline-hints.ts`
- Create: `src/domain/ocr-parsing/parse-deadline-hints.ts`
- Create: `src/domain/ocr-parsing/__fixtures__/deadline-samples.ts`
- Test: `src/domain/ocr-parsing/parse-deadline-hints.test.ts`

- [ ] **Step 1: Write `deadline-hints.ts`**

```ts
// src/domain/ocr-parsing/deadline-hints.ts
import type { DeadlineType } from '../deadline/deadline.schema';

/** Best-effort fields parsed from OCR text. Every field is optional and independent:
 *  we fill only what we have with confidence and leave the rest for the user. Domain
 *  types only — the UI maps this to its form state, the domain never knows the UI. */
export interface DeadlineHints {
  type?: DeadlineType;
  dueDate?: Date; // local midnight; always today-or-future (calendar)
  amount?: number; // positive; only for INSURANCE / SUBSCRIPTION
}
```

- [ ] **Step 2: Write the fixtures**

```ts
// src/domain/ocr-parsing/__fixtures__/deadline-samples.ts
import type { RecognizedText } from '../../../ports/text-recognizer';
import type { DeadlineHints } from '../deadline-hints';

export interface DeadlineSample {
  name: string;
  recognized: RecognizedText;
  now: Date;
  expected: DeadlineHints;
}

/** Wrap a multi-line block as RecognizedText (text + line array). */
function recognized(text: string): RecognizedText {
  return { text, lines: text.split('\n') };
}

const NOW = new Date(2026, 5, 13, 14, 30); // 2026-06-13 14:30

export const DEADLINE_SAMPLES: DeadlineSample[] = [
  {
    // ANCHOR: real DNI OCR noise preserved (lost space "NACIONALDE", line order, "07 12 2021"
    // emission), PII replaced with same-format fakes. Validity (2031) future > emission (2021) past.
    name: 'dni-anonymized',
    recognized: recognized(
      [
        'ESPANA',
        'DOCUMENTO NACIONALDE IDENTIDAD',
        'APELLIDOS',
        'GARCIA EJEMPLO',
        'NOMBRE',
        'MARIA',
        'IDESP',
        'BAA000000',
        'VALIDEZ',
        '14 03 2031',
        'DNI 00000000T',
        '07 12 2021',
      ].join('\n'),
    ),
    now: NOW,
    expected: { type: 'DNI', dueDate: new Date(2031, 2, 14) },
  },
  {
    name: 'itv',
    recognized: recognized(
      [
        'INSPECCION TECNICA DE VEHICULOS',
        'ESTACION ITV',
        'MATRICULA 1234 ABC',
        'FECHA INSPECCION 10 05 2026',
        'PROXIMA INSPECCION',
        '10 05 2028',
        'FAVORABLE',
      ].join('\n'),
    ),
    now: NOW,
    expected: { type: 'ITV', dueDate: new Date(2028, 4, 10) },
  },
  {
    // Premium (263,38) appears BEFORE the larger capital (150.000,00): "first" picks the premium.
    name: 'insurance',
    recognized: recognized(
      [
        'SEGURO DE HOGAR',
        'POLIZA N 1234567',
        'PRIMA ANUAL 263,38 €',
        'CAPITAL ASEGURADO 150.000,00 €',
        'FECHA DE EFECTO 01 07 2025',
        'VENCIMIENTO 01 07 2027',
      ].join('\n'),
    ),
    now: NOW,
    expected: { type: 'INSURANCE', dueDate: new Date(2027, 6, 1), amount: 263.38 },
  },
  {
    name: 'subscription',
    recognized: recognized(
      ['SUSCRIPCION PREMIUM', 'PLAN ANUAL', 'IMPORTE 89,99 €', 'RENOVACION 15 03 2027'].join('\n'),
    ),
    now: NOW,
    expected: { type: 'SUBSCRIPTION', dueDate: new Date(2027, 2, 15), amount: 89.99 },
  },
  {
    name: 'passport',
    recognized: recognized(
      [
        'PASAPORTE',
        'APELLIDOS GARCIA EJEMPLO',
        'FECHA DE EXPEDICION 12 04 2020',
        'FECHA DE CADUCIDAD',
        '12 04 2030',
      ].join('\n'),
    ),
    now: NOW,
    expected: { type: 'PASSPORT', dueDate: new Date(2030, 3, 12) },
  },
  {
    // due TODAY + no recognizable type: partial result (date only). The 45,00 € is NOT
    // emitted because the type is not INSURANCE/SUBSCRIPTION (amount stays gated).
    name: 'due-today',
    recognized: recognized(['RECIBO', 'TOTAL A PAGAR 45,00 €', 'FECHA LIMITE 13 06 2026'].join('\n')),
    now: NOW,
    expected: { dueDate: new Date(2026, 5, 13) },
  },
  {
    name: 'noise-only',
    recognized: recognized(['GRACIAS POR SU COMPRA', 'HASTA LUEGO', 'WWW.EJEMPLO.COM'].join('\n')),
    now: NOW,
    expected: {},
  },
];
```

- [ ] **Step 3: Write the failing test**

```ts
// src/domain/ocr-parsing/parse-deadline-hints.test.ts
import { parseDeadlineHints } from './parse-deadline-hints';
import { DEADLINE_SAMPLES } from './__fixtures__/deadline-samples';

describe('parseDeadlineHints', () => {
  it.each(DEADLINE_SAMPLES)('matches the expected hints for "$name"', (sample) => {
    expect(parseDeadlineHints(sample.recognized, { now: sample.now })).toEqual(sample.expected);
  });

  it('does not emit an amount for a non-gated type even when a euro figure is present', () => {
    const recognized = { text: 'ITV favorable 49,99 €\nProxima 10/10/2030', lines: [] };
    const hints = parseDeadlineHints(recognized, { now: new Date(2026, 5, 13) });
    expect(hints.amount).toBeUndefined();
    expect(hints.type).toBe('ITV');
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm test -- src/domain/ocr-parsing/parse-deadline-hints.test.ts`
Expected: FAIL — cannot find module `./parse-deadline-hints`.

- [ ] **Step 5: Write minimal implementation**

```ts
// src/domain/ocr-parsing/parse-deadline-hints.ts
import type { RecognizedText } from '../../ports/text-recognizer';
import type { DeadlineHints } from './deadline-hints';
import { detectType } from './detect-type';
import { selectDueDate } from './select-due-date';
import { extractAmount } from './extract-amount';

/** Pure parser: turns OCR text into best-effort DeadlineHints. Each field is computed
 *  independently; an absent field never blocks the others. Amount is gated to the two
 *  types where it is meaningful (INSURANCE, SUBSCRIPTION). */
export function parseDeadlineHints(recognized: RecognizedText, { now }: { now: Date }): DeadlineHints {
  const text = recognized.text;
  const type = detectType(text);
  const dueDate = selectDueDate(text, { now });
  const amount =
    type === 'INSURANCE' || type === 'SUBSCRIPTION' ? extractAmount(text) : undefined;

  const hints: DeadlineHints = {};
  if (type !== undefined) hints.type = type;
  if (dueDate !== undefined) hints.dueDate = dueDate;
  if (amount !== undefined) hints.amount = amount;
  return hints;
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- src/domain/ocr-parsing/parse-deadline-hints.test.ts`
Expected: PASS — all 7 fixtures + the gating case.

- [ ] **Step 7: Commit**

```bash
git add src/domain/ocr-parsing/deadline-hints.ts src/domain/ocr-parsing/parse-deadline-hints.ts src/domain/ocr-parsing/parse-deadline-hints.test.ts src/domain/ocr-parsing/__fixtures__/deadline-samples.ts
git commit -m "feat(ocr): compose DeadlineHints parser with fixture suite (Block 3)"
```

---

## Task 7: `hints-to-initial-values` (UI mapper)

**Files:**
- Create: `src/ui/deadline/hints-to-initial-values.ts`
- Test: `src/ui/deadline/hints-to-initial-values.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/ui/deadline/hints-to-initial-values.test.ts
import { hintsToInitialValues } from './hints-to-initial-values';

describe('hintsToInitialValues', () => {
  it('maps a full hint: type → title/subtitle/touched, date, amount as ES text', () => {
    const values = hintsToInitialValues({
      type: 'INSURANCE',
      dueDate: new Date(2027, 6, 1),
      amount: 263.38,
    });
    expect(values).toEqual({
      type: 'INSURANCE',
      title: 'Seguro',
      subtitle: 'Póliza de seguro',
      subtitleTouched: false,
      dueDate: new Date(2027, 6, 1),
      amount: '263,38',
    });
  });

  it('derives title/subtitle from the type and leaves subtitleTouched false (re-syncs on type change)', () => {
    const values = hintsToInitialValues({ type: 'DNI' });
    expect(values).toEqual({
      type: 'DNI',
      title: 'DNI',
      subtitle: 'Documento nacional de identidad',
      subtitleTouched: false,
    });
  });

  it('maps a date-only hint without touching type/title/subtitle/amount', () => {
    expect(hintsToInitialValues({ dueDate: new Date(2026, 5, 13) })).toEqual({
      dueDate: new Date(2026, 5, 13),
    });
  });

  it('maps empty hints to an empty object (blank manual form)', () => {
    expect(hintsToInitialValues({})).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/ui/deadline/hints-to-initial-values.test.ts`
Expected: FAIL — cannot find module `./hints-to-initial-values`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/ui/deadline/hints-to-initial-values.ts
import type { DeadlineHints } from '../../domain/ocr-parsing/deadline-hints';
import type { AddFormState } from './add-form';
import { typeLabel } from './type-labels';
import { defaultSubtitle } from './default-subtitle';

/** Formats a number as the form's amount text (ES comma decimal), matching parseAmount. */
function amountToInput(amount: number): string {
  return amount.toString().replace('.', ',');
}

/** Maps domain DeadlineHints to the form's initialValues seam. Title/subtitle come from
 *  the existing per-type defaults (never invented from OCR). subtitleTouched stays false
 *  so that if the user later changes the type, the subtitle re-syncs to the new default —
 *  there is no custom value to preserve. Absent hints leave the field at its form default. */
export function hintsToInitialValues(hints: DeadlineHints): Partial<AddFormState> {
  const values: Partial<AddFormState> = {};
  if (hints.type !== undefined) {
    values.type = hints.type;
    values.title = typeLabel(hints.type);
    values.subtitle = defaultSubtitle(hints.type);
    values.subtitleTouched = false;
  }
  if (hints.dueDate !== undefined) values.dueDate = hints.dueDate;
  if (hints.amount !== undefined) values.amount = amountToInput(hints.amount);
  return values;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/ui/deadline/hints-to-initial-values.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/deadline/hints-to-initial-values.ts src/ui/deadline/hints-to-initial-values.test.ts
git commit -m "feat(ocr): map DeadlineHints to form initialValues (Block 3)"
```

---

## Task 8: Wire `ConfirmDeadlineScreen` to the parser

**Files:**
- Modify: `src/ui/screens/ConfirmDeadlineScreen.tsx`
- Modify: `src/ui/screens/ConfirmDeadlineScreen.test.tsx`

- [ ] **Step 1: Update the test first (prefill + drop preview assertions)**

Replace the entire contents of `src/ui/screens/ConfirmDeadlineScreen.test.tsx` with:

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

async function renderConfirm(opts: {
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
  const result = await render(
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
  );
  return { repo, photoStore, recognizer, ...result };
}

const recognized = (result: RecognizedText) => new FakeTextRecognizer({ result });

describe('ConfirmDeadlineScreen', () => {
  it('prefills type and due date from the recognized text', async () => {
    const recognizer = recognized({
      text: 'SEGURO DE HOGAR\nVencimiento 11/06/2027',
      lines: ['SEGURO DE HOGAR', 'Vencimiento 11/06/2027'],
    });
    await renderConfirm({ recognizer });

    // type INSURANCE → title "Seguro", subtitle from the per-type default
    expect(await screen.findByDisplayValue('Seguro')).toBeTruthy();
    expect(screen.getByDisplayValue('Póliza de seguro')).toBeTruthy();
    // due date prefilled and rendered by the picker field (formatDate → "11 jun 2027")
    expect(screen.getByText('11 jun 2027')).toBeTruthy();
  });

  it('still shows the thumbnail and saves with the stable photoUri (Block 1 regression)', async () => {
    const onClose = jest.fn();
    const { repo } = await renderConfirm({ recognizer: recognized({ text: 'x', lines: ['x'] }), onClose });

    expect(await screen.findByTestId('deadline-photo-thumbnail')).toBeTruthy();
    fireEvent.changeText(await screen.findByPlaceholderText('Ej. ITV del coche'), 'ITV del coche');
    await screen.findByDisplayValue('ITV del coche');
    fireEvent.press(screen.getByText('Guardar'));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect((await repo.findById('fixed-id'))?.photoUri).toBe('stable:///0.jpg');
  });

  it('renders a blank form when OCR returns empty text', async () => {
    await renderConfirm({ recognizer: recognized({ text: '', lines: [] }) });
    const title = await screen.findByPlaceholderText('Ej. ITV del coche');
    expect(title.props.value).toBe('');
  });

  it('renders the form and allows manual save when OCR fails (best-effort)', async () => {
    const onClose = jest.fn();
    const recognizer = new FakeTextRecognizer({ error: new Error('ocr failed') });
    const { repo } = await renderConfirm({ recognizer, onClose });

    fireEvent.changeText(await screen.findByPlaceholderText('Ej. ITV del coche'), 'Manual');
    await screen.findByDisplayValue('Manual');
    fireEvent.press(screen.getByText('Guardar'));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(await repo.findById('fixed-id')).not.toBeNull();
  });

  it('falls back to the form when OCR hangs past the timeout (real withTimeout path)', async () => {
    const hanging: TextRecognizer = { recognize: () => new Promise<RecognizedText>(() => {}) };
    await renderConfirm({ recognizer: hanging, timeoutMs: 20 });

    expect(await screen.findByPlaceholderText('Ej. ITV del coche')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/ui/screens/ConfirmDeadlineScreen.test.tsx`
Expected: FAIL — the first test cannot find `Seguro`/`11 jun 2027` because the screen does not yet parse/prefill.

- [ ] **Step 3: Rewrite `ConfirmDeadlineScreen.tsx`**

Replace the entire contents of `src/ui/screens/ConfirmDeadlineScreen.tsx` with:

```tsx
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AddFormState } from '../deadline/add-form';
import { parseDeadlineHints } from '../../domain/ocr-parsing/parse-deadline-hints';
import { hintsToInitialValues } from '../deadline/hints-to-initial-values';
import { useTextRecognizer } from '../text-recognizer/text-recognizer-context';
import { useDeadlineDeps } from '../deadline-deps/deadline-deps-context';
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
 * with a timeout), parses the recognized text into form prefill (DeadlineHints →
 * initialValues), then renders the shared DeadlineForm. Rendering the form only after
 * OCR resolves is intentional: DeadlineForm seeds its state once from initialValues, so
 * the parsed values must be ready beforehand. OCR failure/timeout/empty leaves
 * initialValues empty — the manual path is never blocked.
 */
export function ConfirmDeadlineScreen({ photoUri, onClose, timeoutMs = OCR_TIMEOUT_MS }: ConfirmDeadlineScreenProps) {
  const recognizer = useTextRecognizer();
  const { clock } = useDeadlineDeps();
  const insets = useSafeAreaInsets();
  const [reading, setReading] = useState(true);
  const [initialValues, setInitialValues] = useState<Partial<AddFormState>>({});
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      try {
        const result = await withTimeout(recognizer.recognize(photoUri), timeoutMs);
        if (mountedRef.current) {
          const hints = parseDeadlineHints(result, { now: clock.now() });
          setInitialValues(hintsToInitialValues(hints));
        }
      } catch {
        // Best-effort: OCR failure / timeout never blocks the manual path (initialValues stays empty).
      } finally {
        if (mountedRef.current) setReading(false);
      }
    })();
    return () => {
      mountedRef.current = false;
    };
  }, [recognizer, photoUri, timeoutMs, clock]);

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

  return (
    <View style={styles.container}>
      <DeadlineForm heading="Confirma los datos" photoUri={photoUri} initialValues={initialValues} onClose={onClose} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.screenBg },
  root: { flex: 1, backgroundColor: colors.screenBg, borderTopLeftRadius: radii.card, borderTopRightRadius: radii.card },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: radii.pill, backgroundColor: colors.textFaint, opacity: 0.4 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/ui/screens/ConfirmDeadlineScreen.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ui/screens/ConfirmDeadlineScreen.tsx src/ui/screens/ConfirmDeadlineScreen.test.tsx
git commit -m "feat(ocr): prefill confirm form from OCR hints; drop temp preview (Block 3)"
```

---

## Task 9: Full verification

- [ ] **Step 1: Run the whole test suite**

Run: `npm test`
Expected: PASS — all suites green (the 259 existing tests plus the new Block 3 tests).

- [ ] **Step 2: Run the type checker**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Confirm parser isolation (no UI/infra imports in the domain)**

Run: `git grep -nE "from '\.\./\.\./(ui|infrastructure)" src/domain/ocr-parsing`
Expected: **no output** (the domain parser imports only from `../deadline`, `../shared`, and `../../ports`).

- [ ] **Step 4: Final commit if anything was adjusted during verification**

```bash
git status
# commit only if there are pending changes from fixes
```

---

## Self-Review

**Spec coverage:**
- Pure domain parser `parseDeadlineHints(recognized, { now })` → Task 6. ✓
- `DeadlineHints { type?, dueDate?, amount? }` domain type → Task 6. ✓
- UI mapper `hints → Partial<AddFormState>` in `src/ui/deadline/` → Task 7. ✓
- Feeds existing `initialValues` seam; confirm runs parser after OCR → Task 8. ✓
- Type detection with accent-insensitive + space-tolerant multi-word + word-boundary single-word → Task 2. ✓
- Date extraction (numeric `/ - . space` + textual month, 4-digit year, range + round-trip) → Task 3. ✓
- Due-date selection: label proximity window, future-or-current **calendar** comparison, latest, DNI validity, no-future → empty → Task 4. ✓
- Amount: ES formats, first-plausible (not largest), gated to INSURANCE/SUBSCRIPTION → Tasks 5 & 6. ✓
- subtitle-sync rule (default subtitle, touched=false, re-syncs on type change) → Task 7 + its test. ✓
- Remove temporary "Texto detectado" preview → Task 8. ✓
- Best-effort: OCR fail/empty → empty form, manual works; regression persists photoUri → Task 8 tests. ✓
- Fixtures: DNI anchor anonymized (NACIONALDE, validity>emission) + synthetic itv/insurance/subscription/passport + due-today + noise-only → Task 6. ✓
- Decisions A (no type → undefined), B (no future → empty, calendar), C (first amount) → Tasks 2/4/5 + tests. ✓
- Domain `Deadline`/SQLite unchanged; no domain→UI import → Task 9 Step 3 guard. ✓

**Placeholder scan:** none — every step has concrete code/commands.

**Type consistency:** `DeadlineHints`, `DateCandidate`, `parseDeadlineHints(recognized, { now })`, `selectDueDate(text, { now })`, `extractDateCandidates(text)`, `detectType(text)`, `extractAmount(text)`, `hintsToInitialValues(hints)`, `keywordToRegExp(keyword)`, `EXPIRY_LABELS`, `TYPE_KEYWORDS` — names and signatures used consistently across tasks.

**Out of scope (per spec):** the optional dev-only "copy text" affordance is intentionally not included (low priority); EXIF/orientation, iOS, gallery, 2-digit years, `amountLabel` capture excluded.
```
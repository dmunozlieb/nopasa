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

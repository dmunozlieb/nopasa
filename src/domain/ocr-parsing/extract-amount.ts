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

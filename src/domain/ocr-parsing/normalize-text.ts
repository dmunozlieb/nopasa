/** Lowercase + strip diacritics (accents/tildes) so OCR text that dropped accents
 *  still matches. Idempotent: normalize(normalize(x)) === normalize(x). */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '') // strip accents/tildes
    .toLowerCase();
}

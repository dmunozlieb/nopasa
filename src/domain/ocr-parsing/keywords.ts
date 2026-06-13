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

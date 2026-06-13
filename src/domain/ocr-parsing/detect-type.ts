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

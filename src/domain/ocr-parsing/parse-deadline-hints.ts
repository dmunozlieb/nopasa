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

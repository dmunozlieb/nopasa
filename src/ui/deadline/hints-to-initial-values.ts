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

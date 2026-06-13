import type { DeadlineType } from '../deadline/deadline.schema';

/** Best-effort fields parsed from OCR text. Every field is optional and independent:
 *  we fill only what we have with confidence and leave the rest for the user. Domain
 *  types only — the UI maps this to its form state, the domain never knows the UI. */
export interface DeadlineHints {
  type?: DeadlineType;
  dueDate?: Date; // local midnight; always today-or-future (calendar)
  amount?: number; // positive; only for INSURANCE / SUBSCRIPTION
}

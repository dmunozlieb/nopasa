import type { Deadline } from '../../domain/deadline/deadline.schema';

/** Spanish euro amount with comma decimals, e.g. 12.99 -> "12,99 €". */
function formatEuros(amount: number): string {
  return `${String(amount).replace('.', ',')} €`;
}

/**
 * Single source of truth for the amount line shown on the home row and the detail.
 * Prefers `amountLabel` (current data already embeds the figure, e.g. "multa 200 €");
 * falls back to the numeric `amount`; hidden (null) when there is neither.
 */
export function formatAmountLine(deadline: Deadline): string | null {
  if (deadline.amountLabel) return deadline.amountLabel;
  if (deadline.amount != null) return formatEuros(deadline.amount);
  return null;
}

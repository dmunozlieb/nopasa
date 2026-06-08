import { buildDeadline } from '../../test-support/build-deadline';
import { formatAmountLine } from './format-amount';

describe('formatAmountLine', () => {
  it('returns the amountLabel when present (it already includes the figure)', () => {
    expect(formatAmountLine(buildDeadline({ amountLabel: 'multa 200 €', amount: 200 }))).toBe('multa 200 €');
    expect(formatAmountLine(buildDeadline({ amountLabel: '12,99 €/mes' }))).toBe('12,99 €/mes');
  });

  it('formats the amount in euros when there is no label', () => {
    expect(formatAmountLine(buildDeadline({ amount: 200 }))).toBe('200 €');
    expect(formatAmountLine(buildDeadline({ amount: 12.99 }))).toBe('12,99 €');
  });

  it('returns null when there is neither label nor amount', () => {
    expect(formatAmountLine(buildDeadline())).toBeNull();
  });
});

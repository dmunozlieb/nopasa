import { parseDeadlineHints } from './parse-deadline-hints';
import { DEADLINE_SAMPLES } from './__fixtures__/deadline-samples';

describe('parseDeadlineHints', () => {
  it.each(DEADLINE_SAMPLES)('matches the expected hints for "$name"', (sample) => {
    expect(parseDeadlineHints(sample.recognized, { now: sample.now })).toEqual(sample.expected);
  });

  it('does not emit an amount for a non-gated type even when a euro figure is present', () => {
    const recognized = { text: 'ITV favorable 49,99 €\nProxima 10/10/2030', lines: [] };
    const hints = parseDeadlineHints(recognized, { now: new Date(2026, 5, 13) });
    expect(hints.amount).toBeUndefined();
    expect(hints.type).toBe('ITV');
  });
});

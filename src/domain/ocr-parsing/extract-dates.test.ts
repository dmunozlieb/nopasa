import { extractDateCandidates } from './extract-dates';

describe('extractDateCandidates', () => {
  it('parses day-first numeric dates with /, -, . and space separators', () => {
    expect(extractDateCandidates('11/06/2027')[0].date).toEqual(new Date(2027, 5, 11));
    expect(extractDateCandidates('11-06-2027')[0].date).toEqual(new Date(2027, 5, 11));
    expect(extractDateCandidates('11.06.2027')[0].date).toEqual(new Date(2027, 5, 11));
    expect(extractDateCandidates('14 03 2031')[0].date).toEqual(new Date(2031, 2, 14));
  });

  it('parses textual Spanish month dates', () => {
    expect(extractDateCandidates('15 de marzo de 2027')[0].date).toEqual(new Date(2027, 2, 15));
  });

  it('rejects out-of-range and overflow dates (round-trip check)', () => {
    expect(extractDateCandidates('32/01/2026')).toEqual([]);
    expect(extractDateCandidates('15/13/2026')).toEqual([]);
    expect(extractDateCandidates('31/02/2026')).toEqual([]);
  });

  it('returns multiple candidates sorted by position, each with its offset', () => {
    const cands = extractDateCandidates('emitido 07 12 2021, valido 14 03 2031');
    expect(cands.map((c) => c.date)).toEqual([new Date(2021, 11, 7), new Date(2031, 2, 14)]);
    expect(cands[0].offset).toBeLessThan(cands[1].offset);
  });
});

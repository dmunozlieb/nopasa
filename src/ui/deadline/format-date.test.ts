import { formatDate, formatShortDate } from './format-date';

describe('formatDate', () => {
  it('formats as "D mmm YYYY" with Spanish month abbreviations', () => {
    expect(formatDate(new Date(2026, 5, 11))).toBe('11 jun 2026');
    expect(formatDate(new Date(2026, 0, 5))).toBe('5 ene 2026');
    expect(formatDate(new Date(2026, 11, 31))).toBe('31 dic 2026');
  });
});

describe('formatShortDate', () => {
  it('formats a Spanish short date without the year', () => {
    expect(formatShortDate(new Date(2026, 5, 11))).toBe('11 jun');
    expect(formatShortDate(new Date(2026, 6, 4))).toBe('4 jul');
    expect(formatShortDate(new Date(2026, 8, 1))).toBe('1 sep');
  });
});

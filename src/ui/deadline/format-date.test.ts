import { formatDate } from './format-date';

describe('formatDate', () => {
  it('formats as "D mmm YYYY" with Spanish month abbreviations', () => {
    expect(formatDate(new Date(2026, 5, 11))).toBe('11 jun 2026');
    expect(formatDate(new Date(2026, 0, 5))).toBe('5 ene 2026');
    expect(formatDate(new Date(2026, 11, 31))).toBe('31 dic 2026');
  });
});

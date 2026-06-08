import { formatTimeRemaining } from './format-time-remaining';

describe('formatTimeRemaining', () => {
  it('returns "hoy" for 0', () => {
    expect(formatTimeRemaining(0)).toBe('hoy');
  });

  it('returns "vencido" for any negative value', () => {
    expect(formatTimeRemaining(-1)).toBe('vencido');
    expect(formatTimeRemaining(-30)).toBe('vencido');
  });

  it('returns days up to and including 60', () => {
    expect(formatTimeRemaining(1)).toBe('1 día');
    expect(formatTimeRemaining(4)).toBe('4 días');
    expect(formatTimeRemaining(60)).toBe('60 días');
  });

  it('returns rounded months from 61 to under a year', () => {
    expect(formatTimeRemaining(61)).toBe('2 meses');
    expect(formatTimeRemaining(31)).toBe('31 días'); // still days (<=60)
    expect(formatTimeRemaining(45)).toBe('45 días'); // still days
    expect(formatTimeRemaining(364)).toBe('12 meses');
  });

  it('uses singular "1 mes" when rounding gives one month', () => {
    expect(formatTimeRemaining(75)).toBe('3 meses');
  });

  it('returns years from 365 up, with singular/plural', () => {
    expect(formatTimeRemaining(365)).toBe('1 año');
    expect(formatTimeRemaining(366)).toBe('1 año');
    expect(formatTimeRemaining(730)).toBe('2 años');
  });
});

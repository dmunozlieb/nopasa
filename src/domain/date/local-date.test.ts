import { fromLocalDateString, toLocalDateString } from './local-date';

describe('local-date', () => {
  it('serializes a Date to a local YYYY-MM-DD string', () => {
    expect(toLocalDateString(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toLocalDateString(new Date(2026, 5, 10))).toBe('2026-06-10');
  });

  it('reconstructs a YYYY-MM-DD string to local midnight and round-trips', () => {
    const date = fromLocalDateString('2026-09-01');
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(8);
    expect(date.getDate()).toBe(1);
    expect(toLocalDateString(date)).toBe('2026-09-01');
  });
});

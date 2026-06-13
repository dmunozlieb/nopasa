import { addMonths, nextDueDate } from './recurrence';

describe('addMonths', () => {
  it('adds whole months keeping the local calendar day', () => {
    expect(addMonths(new Date(2026, 0, 15), 1)).toEqual(new Date(2026, 1, 15));
  });

  it('adds a full year', () => {
    expect(addMonths(new Date(2026, 5, 8), 12)).toEqual(new Date(2027, 5, 8));
  });

  it('rolls the year over when months overflow December', () => {
    expect(addMonths(new Date(2026, 11, 10), 2)).toEqual(new Date(2027, 1, 10));
  });

  it('clamps to the last day of a shorter target month (31 Jan + 1 → 28 Feb)', () => {
    expect(addMonths(new Date(2026, 0, 31), 1)).toEqual(new Date(2026, 1, 28));
  });

  it('clamps to 29 Feb in a leap year', () => {
    expect(addMonths(new Date(2028, 0, 31), 1)).toEqual(new Date(2028, 1, 29));
  });

  it('clamps 31 Mar + 1 month to 30 Apr', () => {
    expect(addMonths(new Date(2026, 2, 31), 1)).toEqual(new Date(2026, 3, 30));
  });

  // DST guard: Spain springs forward on Sun 29 Mar 2026. Component math keeps the
  // result at local midnight on the right calendar day regardless of the clock shift.
  it('stays at local midnight on the right day across a DST month', () => {
    const result = addMonths(new Date(2026, 1, 28), 1);
    expect(result).toEqual(new Date(2026, 2, 28));
    expect(result.getHours()).toBe(0);
  });
});

describe('nextDueDate', () => {
  it('returns the first cycle after the due date when not yet past', () => {
    // Renewed near the due date: one year forward.
    expect(nextDueDate(new Date(2026, 5, 8), 12, new Date(2026, 5, 13))).toEqual(new Date(2027, 5, 8));
  });

  it('keeps advancing past stale cycles on a late renewal', () => {
    // Due far in the past; first multiple not strictly before today wins.
    expect(nextDueDate(new Date(2026, 0, 10), 1, new Date(2026, 5, 13))).toEqual(new Date(2026, 6, 10));
  });

  it('anchors to the original date with no end-of-month drift (yearly on 31 Jan)', () => {
    // 31-Jan yearly must always land 31-Jan, never drifting to Feb via repeated clamps.
    expect(nextDueDate(new Date(2020, 0, 31), 12, new Date(2026, 5, 13))).toEqual(new Date(2027, 0, 31));
  });

  it('keeps a candidate that equals today (today is not strictly past)', () => {
    expect(nextDueDate(new Date(2026, 4, 13), 1, new Date(2026, 5, 13))).toEqual(new Date(2026, 5, 13));
  });
});

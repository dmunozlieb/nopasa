import { startOfDay, daysBetween } from './date';

describe('startOfDay', () => {
  it('strips the time-of-day, keeping the local calendar day', () => {
    const result = startOfDay(new Date(2026, 5, 7, 23, 45, 12));
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(5);
    expect(result.getDate()).toBe(7);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
  });
});

describe('daysBetween', () => {
  it('returns 0 for the same calendar day', () => {
    expect(daysBetween(new Date(2026, 0, 10), new Date(2026, 0, 10))).toBe(0);
  });

  it('counts whole days forward', () => {
    expect(daysBetween(new Date(2026, 0, 10), new Date(2026, 0, 17))).toBe(7);
  });

  it('returns negative when the target is in the past', () => {
    expect(daysBetween(new Date(2026, 0, 17), new Date(2026, 0, 10))).toBe(-7);
  });

  it('ignores the time-of-day on either side', () => {
    const from = new Date(2026, 0, 10, 23, 59, 59);
    const to = new Date(2026, 0, 11, 0, 0, 1);
    expect(daysBetween(from, to)).toBe(1);
  });

  // Spain DST 2026: spring-forward on Sun 29 Mar (23h day), fall-back on Sun 25 Oct (25h day).
  // Pinned to TZ=Europe/Madrid via the test script, so a naive ms/86_400_000 would drift here.
  it('counts exact calendar days across the spring-forward DST change', () => {
    expect(daysBetween(new Date(2026, 2, 28), new Date(2026, 2, 30))).toBe(2);
  });

  it('counts exact calendar days across the fall-back DST change', () => {
    expect(daysBetween(new Date(2026, 9, 24), new Date(2026, 9, 26))).toBe(2);
  });
});

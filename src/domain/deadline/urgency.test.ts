import { daysRemaining, urgencyLevel, URGENT_MAX_DAYS, UPCOMING_MAX_DAYS } from './urgency';
import { buildDeadline } from '../../test-support/build-deadline';

const today = new Date(2026, 0, 1);
const inDays = (n: number) => buildDeadline({ dueDate: new Date(2026, 0, 1 + n) });

describe('daysRemaining', () => {
  it('is 0 when due today', () => {
    expect(daysRemaining(inDays(0), today)).toBe(0);
  });

  it('is positive in the future', () => {
    expect(daysRemaining(inDays(5), today)).toBe(5);
  });

  it('is negative when overdue', () => {
    expect(daysRemaining(inDays(-3), today)).toBe(-3);
  });
});

describe('urgencyLevel', () => {
  it('thresholds are 10 and 60', () => {
    expect(URGENT_MAX_DAYS).toBe(10);
    expect(UPCOMING_MAX_DAYS).toBe(60);
  });

  it('overdue is urgent', () => {
    expect(urgencyLevel(inDays(-1), today)).toBe('urgent');
  });

  it('exactly 10 days is urgent (lower-bound inclusive)', () => {
    expect(urgencyLevel(inDays(10), today)).toBe('urgent');
  });

  it('11 days is upcoming', () => {
    expect(urgencyLevel(inDays(11), today)).toBe('upcoming');
  });

  it('exactly 60 days is upcoming (upper-bound inclusive)', () => {
    expect(urgencyLevel(inDays(60), today)).toBe('upcoming');
  });

  it('61 days is calm', () => {
    expect(urgencyLevel(inDays(61), today)).toBe('calm');
  });
});

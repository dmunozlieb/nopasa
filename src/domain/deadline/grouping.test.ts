import { groupAndSort } from './grouping';
import { buildDeadline } from '../../test-support/build-deadline';

const today = new Date(2026, 0, 1);
const at = (id: string, days: number, extra = {}) =>
  buildDeadline({ id, dueDate: new Date(2026, 0, 1 + days), ...extra });

describe('groupAndSort', () => {
  it('returns three empty groups for an empty list', () => {
    expect(groupAndSort([], today)).toEqual({
      NEEDS_ATTENTION: [],
      UPCOMING: [],
      CALM: [],
    });
  });

  it('places each deadline in the group matching its urgency', () => {
    const result = groupAndSort([at('a', 5), at('b', 30), at('c', 200)], today);
    expect(result.NEEDS_ATTENTION.map((d) => d.id)).toEqual(['a']);
    expect(result.UPCOMING.map((d) => d.id)).toEqual(['b']);
    expect(result.CALM.map((d) => d.id)).toEqual(['c']);
  });

  it('sorts each group by daysRemaining ascending (most urgent first)', () => {
    const result = groupAndSort([at('later', 8), at('overdue', -2), at('soon', 3)], today);
    expect(result.NEEDS_ATTENTION.map((d) => d.id)).toEqual(['overdue', 'soon', 'later']);
  });

  it('excludes RESOLVED and CANCELLED deadlines entirely', () => {
    const result = groupAndSort(
      [
        at('active', 5),
        at('done', 5, { status: 'RESOLVED' }),
        at('void', 5, { status: 'CANCELLED' }),
      ],
      today,
    );
    expect(result.NEEDS_ATTENTION.map((d) => d.id)).toEqual(['active']);
  });
});

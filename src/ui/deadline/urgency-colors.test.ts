import { urgencyColors } from './urgency-colors';
import { colors } from '../theme/colors';

describe('urgencyColors', () => {
  it('maps each urgency level to its color set', () => {
    expect(urgencyColors('urgent')).toEqual(colors.urgency.urgent);
    expect(urgencyColors('upcoming')).toEqual(colors.urgency.upcoming);
    expect(urgencyColors('calm')).toEqual(colors.urgency.calm);
  });

  it('exposes the exact base hex from the design', () => {
    expect(urgencyColors('urgent').base).toBe('#C25A45');
    expect(urgencyColors('upcoming').base).toBe('#C2883B');
    expect(urgencyColors('calm').base).toBe('#5F8A67');
  });
});

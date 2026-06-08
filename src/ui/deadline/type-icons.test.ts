import { DeadlineType } from '../../domain/deadline/deadline.schema';
import { typeIcon } from './type-icons';

describe('typeIcon', () => {
  it('returns a non-empty icon name for every deadline type', () => {
    for (const type of DeadlineType.options) {
      expect(typeof typeIcon(type)).toBe('string');
      expect(typeIcon(type).length).toBeGreaterThan(0);
    }
  });

  it('maps known types to their MaterialCommunityIcons name', () => {
    expect(typeIcon('ITV')).toBe('car');
    expect(typeIcon('INSURANCE')).toBe('shield-check');
    expect(typeIcon('OTHER')).toBe('dots-horizontal');
  });
});

import { groupLabel } from './group-labels';

describe('groupLabel', () => {
  it('maps each group key to its Spanish label', () => {
    expect(groupLabel('NEEDS_ATTENTION')).toBe('Requieren atención');
    expect(groupLabel('UPCOMING')).toBe('Próximas');
    expect(groupLabel('CALM')).toBe('Tranquilas');
  });
});

import { syncSubtitle } from './subtitle-sync';

describe('syncSubtitle', () => {
  it('mirrors the type default while untouched, ignoring the current value', () => {
    expect(syncSubtitle({ type: 'ITV', current: 'anything', touched: false })).toBe(
      'Inspección técnica del coche',
    );
  });

  it('preserves the user value once touched', () => {
    expect(syncSubtitle({ type: 'ITV', current: 'Mi texto', touched: true })).toBe('Mi texto');
  });

  it('preserves an empty value once touched (user cleared it on purpose)', () => {
    expect(syncSubtitle({ type: 'ITV', current: '', touched: true })).toBe('');
  });
});

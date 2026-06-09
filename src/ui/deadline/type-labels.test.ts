import { DeadlineType } from '../../domain/deadline/deadline.schema';
import { typeLabel } from './type-labels';

describe('typeLabel', () => {
  it('returns a short Spanish label for every type', () => {
    expect(typeLabel('ITV')).toBe('ITV');
    expect(typeLabel('DNI')).toBe('DNI');
    expect(typeLabel('PASSPORT')).toBe('Pasaporte');
    expect(typeLabel('DRIVING_LICENSE')).toBe('Permiso');
    expect(typeLabel('INSURANCE')).toBe('Seguro');
    expect(typeLabel('SUBSCRIPTION')).toBe('Suscripción');
    expect(typeLabel('WARRANTY')).toBe('Garantía');
    expect(typeLabel('GAS_INSPECTION')).toBe('Gas');
    expect(typeLabel('OTHER')).toBe('Otro');
  });

  it('covers all nine enum values', () => {
    for (const type of DeadlineType.options) {
      expect(typeLabel(type).length).toBeGreaterThan(0);
    }
  });
});

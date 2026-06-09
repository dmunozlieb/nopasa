import { DeadlineType } from '../../domain/deadline/deadline.schema';
import { defaultSubtitle } from './default-subtitle';

describe('defaultSubtitle', () => {
  it('returns an informative, period-agnostic default per type', () => {
    expect(defaultSubtitle('ITV')).toBe('Inspección técnica del coche');
    expect(defaultSubtitle('DNI')).toBe('Documento nacional de identidad');
    expect(defaultSubtitle('PASSPORT')).toBe('Documento para viajar fuera de la UE');
    expect(defaultSubtitle('DRIVING_LICENSE')).toBe('Permiso de conducir');
    expect(defaultSubtitle('INSURANCE')).toBe('Póliza de seguro');
    expect(defaultSubtitle('SUBSCRIPTION')).toBe('Suscripción');
    expect(defaultSubtitle('WARRANTY')).toBe('Garantía del producto');
    expect(defaultSubtitle('GAS_INSPECTION')).toBe('Revisión del gas');
    expect(defaultSubtitle('OTHER')).toBe('');
  });

  it('defines an entry for all nine types', () => {
    for (const type of DeadlineType.options) {
      expect(typeof defaultSubtitle(type)).toBe('string');
    }
  });
});

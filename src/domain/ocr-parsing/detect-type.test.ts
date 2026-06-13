import { detectType } from './detect-type';

describe('detectType', () => {
  it('detects DNI from the full phrase even with the space the OCR ate (NACIONALDE)', () => {
    expect(detectType('DOCUMENTO NACIONALDE IDENTIDAD')).toBe('DNI');
  });

  it('detects each category from its keyword', () => {
    expect(detectType('Tu seguro de hogar')).toBe('INSURANCE');
    expect(detectType('SUSCRIPCION PREMIUM')).toBe('SUBSCRIPTION');
    expect(detectType('ITV favorable')).toBe('ITV');
    expect(detectType('PERMISO DE CONDUCIR')).toBe('DRIVING_LICENSE');
    expect(detectType('Pasaporte')).toBe('PASSPORT');
    expect(detectType('Garantía del producto')).toBe('WARRANTY');
    expect(detectType('Revisión del gas natural')).toBe('GAS_INSPECTION');
  });

  it('matches single-word "gas" only on a word boundary, not inside "gastos"', () => {
    expect(detectType('gastos varios del mes')).toBeUndefined();
  });

  it('prefers the most specific (multi-word) match over a stray single word', () => {
    expect(detectType('DOCUMENTO NACIONAL DE IDENTIDAD\nDNI 12345678Z')).toBe('DNI');
  });

  it('returns undefined when nothing matches', () => {
    expect(detectType('Cumpleaños de la abuela')).toBeUndefined();
  });
});

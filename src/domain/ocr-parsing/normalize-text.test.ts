import { normalize } from './normalize-text';

describe('normalize', () => {
  it('lowercases the text', () => {
    expect(normalize('DOCUMENTO')).toBe('documento');
  });

  it('strips accents/tildes (OCR drops them)', () => {
    expect(normalize('Inspección Técnica')).toBe('inspeccion tecnica');
    expect(normalize('Válido')).toBe('valido');
  });

  it('is idempotent', () => {
    const once = normalize('Pólizá CADUCIDAD');
    expect(normalize(once)).toBe(once);
  });
});

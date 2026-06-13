import { hintsToInitialValues } from './hints-to-initial-values';

describe('hintsToInitialValues', () => {
  it('maps a full hint: type → title/subtitle/touched, date, amount as ES text', () => {
    const values = hintsToInitialValues({
      type: 'INSURANCE',
      dueDate: new Date(2027, 6, 1),
      amount: 263.38,
    });
    expect(values).toEqual({
      type: 'INSURANCE',
      title: 'Seguro',
      subtitle: 'Póliza de seguro',
      subtitleTouched: false,
      dueDate: new Date(2027, 6, 1),
      amount: '263,38',
    });
  });

  it('derives title/subtitle from the type and leaves subtitleTouched false (re-syncs on type change)', () => {
    const values = hintsToInitialValues({ type: 'DNI' });
    expect(values).toEqual({
      type: 'DNI',
      title: 'DNI',
      subtitle: 'Documento nacional de identidad',
      subtitleTouched: false,
    });
  });

  it('maps a date-only hint without touching type/title/subtitle/amount', () => {
    expect(hintsToInitialValues({ dueDate: new Date(2026, 5, 13) })).toEqual({
      dueDate: new Date(2026, 5, 13),
    });
  });

  it('maps empty hints to an empty object (blank manual form)', () => {
    expect(hintsToInitialValues({})).toEqual({});
  });
});

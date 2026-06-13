import { recurrenceLabel } from './recurrence-label';

describe('recurrenceLabel', () => {
  it('labels a monthly recurrence', () => {
    expect(recurrenceLabel(1)).toBe('Cada mes');
  });
  it('labels a yearly recurrence', () => {
    expect(recurrenceLabel(12)).toBe('Cada año');
  });
  it('labels whole-year multiples in years', () => {
    expect(recurrenceLabel(24)).toBe('Cada 2 años');
    expect(recurrenceLabel(36)).toBe('Cada 3 años');
  });
  it('labels other periods in months', () => {
    expect(recurrenceLabel(3)).toBe('Cada 3 meses');
  });
});

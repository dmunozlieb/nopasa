import { selectDueDate } from './select-due-date';

describe('selectDueDate', () => {
  const now = new Date(2026, 5, 13, 14, 30); // 2026-06-13 14:30 (time-of-day on purpose)

  it('picks the validity over the emission on a DNI (emission past, validity future)', () => {
    const text = 'IDESP BAA000000\nVALIDEZ\n14 03 2031\nDNI 00000000T\n07 12 2021';
    expect(selectDueDate(text, { now })).toEqual(new Date(2031, 2, 14));
  });

  it('keeps a deadline due TODAY (calendar comparison, not timestamp > now)', () => {
    expect(selectDueDate('FECHA LIMITE 13/06/2026', { now })).toEqual(new Date(2026, 5, 13));
  });

  it('returns undefined when every date is in the past', () => {
    expect(selectDueDate('emitido 01/01/2020', { now })).toBeUndefined();
  });

  it('filters out implausible years (outside the ±30y window)', () => {
    expect(selectDueDate('fecha 01/01/1700', { now })).toBeUndefined();
  });

  it('associates a date to an expiry phrase label ("valido hasta")', () => {
    expect(selectDueDate('Oferta valido hasta 10/10/2030', { now })).toEqual(new Date(2030, 9, 10));
  });

  it('without any label, prefers the latest future date', () => {
    expect(selectDueDate('10/05/2028 y 10/05/2030', { now })).toEqual(new Date(2030, 4, 10));
  });
});

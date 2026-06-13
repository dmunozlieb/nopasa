import { extractAmount } from './extract-amount';

describe('extractAmount', () => {
  it('parses ES amounts with the euro sign on either side', () => {
    expect(extractAmount('263,38 €')).toBe(263.38);
    expect(extractAmount('€ 12,00')).toBe(12);
    expect(extractAmount('1.234,56€')).toBe(1234.56);
  });

  it('parses integer amounts marked with EUR/euros', () => {
    expect(extractAmount('Total 12 EUR')).toBe(12);
  });

  it('parses a single-decimal amount without truncating it', () => {
    expect(extractAmount('5,5 €')).toBe(5.5);
  });

  it('returns undefined when there is no euro amount', () => {
    expect(extractAmount('sin importe en este documento')).toBeUndefined();
  });

  it('takes the FIRST plausible amount, not the largest (premium before capital)', () => {
    expect(extractAmount('Prima 263,38 € Capital asegurado 150.000,00 €')).toBe(263.38);
  });
});

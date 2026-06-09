import { parseAmount, toCreateInput, validateAddForm, type AddFormState } from './add-form';

function baseState(overrides: Partial<AddFormState> = {}): AddFormState {
  return {
    type: 'ITV',
    title: 'ITV del coche',
    subtitle: 'Inspección técnica del coche',
    subtitleTouched: false,
    dueDate: new Date(2026, 5, 8),
    amount: '',
    reminderDaysBefore: [30, 7],
    ...overrides,
  };
}

describe('validateAddForm', () => {
  it('accepts a valid state', () => {
    expect(validateAddForm(baseState())).toEqual({ valid: true, errors: {} });
  });

  it('rejects an empty or whitespace-only title with a hint', () => {
    expect(validateAddForm(baseState({ title: '' })).valid).toBe(false);
    expect(validateAddForm(baseState({ title: '   ' })).errors.title).toBe('Ponle un nombre');
  });

  it('rejects an invalid date (defensive)', () => {
    expect(validateAddForm(baseState({ dueDate: new Date(NaN) })).valid).toBe(false);
  });
});

describe('parseAmount', () => {
  it('parses comma decimals to a number', () => {
    expect(parseAmount('12,99')).toBe(12.99);
  });
  it('returns undefined for empty, non-numeric or non-positive input', () => {
    expect(parseAmount('')).toBeUndefined();
    expect(parseAmount('   ')).toBeUndefined();
    expect(parseAmount('abc')).toBeUndefined();
    expect(parseAmount('0')).toBeUndefined();
    expect(parseAmount('-5')).toBeUndefined();
  });
});

describe('toCreateInput', () => {
  it('maps a valid state to a CreateDeadlineInput', () => {
    const input = toCreateInput(
      baseState({ title: '  ITV del coche  ', amount: '12,99', reminderDaysBefore: [7, 30, 1] }),
    );
    expect(input).toEqual({
      type: 'ITV',
      title: 'ITV del coche',
      subtitle: 'Inspección técnica del coche',
      dueDate: new Date(2026, 5, 8),
      amount: 12.99,
      reminderDaysBefore: [1, 7, 30],
    });
  });

  it('omits amount when blank and subtitle when empty; normalizes dueDate to midnight', () => {
    const input = toCreateInput(
      baseState({ subtitle: '   ', amount: '', dueDate: new Date(2026, 5, 8, 15, 30) }),
    );
    expect(input.amount).toBeUndefined();
    expect(input.subtitle).toBeUndefined();
    expect(input.dueDate).toEqual(new Date(2026, 5, 8));
  });
});

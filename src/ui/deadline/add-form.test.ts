import { parseAmount, parseRecurrenceMonths, toCreateInput, validateAddForm, type AddFormState } from './add-form';

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

describe('parseRecurrenceMonths', () => {
  it('parses a positive integer', () => {
    expect(parseRecurrenceMonths('3')).toBe(3);
  });
  it('returns undefined for empty, non-numeric, zero, negative, fractional or over-cap', () => {
    expect(parseRecurrenceMonths('')).toBeUndefined();
    expect(parseRecurrenceMonths('  ')).toBeUndefined();
    expect(parseRecurrenceMonths('abc')).toBeUndefined();
    expect(parseRecurrenceMonths('0')).toBeUndefined();
    expect(parseRecurrenceMonths('-3')).toBeUndefined();
    expect(parseRecurrenceMonths('1.5')).toBeUndefined();
    expect(parseRecurrenceMonths('1000')).toBeUndefined();
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

  it('includes photoUri in the output when provided', () => {
    const input = toCreateInput(baseState(), 'file:///tmp/photo.jpg');
    expect(input.photoUri).toBe('file:///tmp/photo.jpg');
  });

  it('omits photoUri from the output when not provided', () => {
    const input = toCreateInput(baseState());
    expect('photoUri' in input).toBe(false);
  });

  it('includes recurrenceMonths when set', () => {
    const input = toCreateInput(baseState({ recurrenceMonths: 12 }));
    expect(input.recurrenceMonths).toBe(12);
  });

  it('omits recurrenceMonths when undefined', () => {
    const input = toCreateInput(baseState());
    expect('recurrenceMonths' in input).toBe(false);
  });
});

import { fireEvent, render, screen } from '@testing-library/react-native';
import { DatePickerField } from './DatePickerField';

describe('DatePickerField', () => {
  it('shows the formatted date and is closed initially', async () => {
    await render(<DatePickerField value={new Date(2026, 0, 1)} onChange={() => {}} />);
    expect(screen.getByText('1 ene 2026')).toBeTruthy();
    expect(screen.queryByTestId('datetimepicker')).toBeNull();
  });

  it('opens the picker on press and reports the chosen date', async () => {
    const onChange = jest.fn();
    await render(<DatePickerField value={new Date(2026, 0, 1)} onChange={onChange} />);
    fireEvent.press(screen.getByText('1 ene 2026'));
    const picker = await screen.findByTestId('datetimepicker');
    fireEvent(picker, 'change', { type: 'set' }, new Date(2026, 1, 2));
    expect(onChange).toHaveBeenCalledWith(new Date(2026, 1, 2));
  });
});

import { fireEvent, render, screen } from '@testing-library/react-native';
import { TimePickerField } from './TimePickerField';

describe('TimePickerField', () => {
  it('shows the zero-padded time and is closed initially', async () => {
    await render(<TimePickerField value={{ hour: 9, minute: 0 }} onChange={() => {}} />);
    expect(screen.getByText('09:00')).toBeTruthy();
    expect(screen.queryByTestId('datetimepicker')).toBeNull();
  });

  it('opens the picker on press and reports the chosen time', async () => {
    const onChange = jest.fn();
    await render(<TimePickerField value={{ hour: 9, minute: 0 }} onChange={onChange} />);
    fireEvent.press(screen.getByText('09:00'));
    const picker = await screen.findByTestId('datetimepicker');
    fireEvent(picker, 'change', { type: 'set' }, new Date(2026, 0, 1, 8, 30));
    expect(onChange).toHaveBeenCalledWith({ hour: 8, minute: 30 });
  });
});

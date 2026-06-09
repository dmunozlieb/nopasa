import { fireEvent, render, screen } from '@testing-library/react-native';
import { ReminderChips } from './ReminderChips';

describe('ReminderChips', () => {
  it('renders 30/7/1 with day pluralization', async () => {
    await render(<ReminderChips value={[30, 7]} onChange={() => {}} />);
    expect(screen.getByText('30 días')).toBeTruthy();
    expect(screen.getByText('7 días')).toBeTruthy();
    expect(screen.getByText('1 día')).toBeTruthy();
  });

  it('adds a day when an unselected chip is pressed', async () => {
    const onChange = jest.fn();
    await render(<ReminderChips value={[30, 7]} onChange={onChange} />);
    fireEvent.press(screen.getByText('1 día'));
    expect(onChange).toHaveBeenCalledWith([30, 7, 1]);
  });

  it('removes a day when a selected chip is pressed', async () => {
    const onChange = jest.fn();
    await render(<ReminderChips value={[30, 7]} onChange={onChange} />);
    fireEvent.press(screen.getByText('30 días'));
    expect(onChange).toHaveBeenCalledWith([7]);
  });
});

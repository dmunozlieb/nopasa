import { fireEvent, render, screen } from '@testing-library/react-native';
import { ScreenHeader } from './ScreenHeader';

describe('ScreenHeader', () => {
  it('renders the title and no gear when onSettings is absent', async () => {
    await render(<ScreenHeader title="Mis vencimientos" />);
    expect(screen.getByText('Mis vencimientos')).toBeTruthy();
    expect(screen.queryByLabelText('Ajustes')).toBeNull();
  });

  it('renders a gear that calls onSettings when provided', async () => {
    const onSettings = jest.fn();
    await render(<ScreenHeader title="Mis vencimientos" onSettings={onSettings} />);
    fireEvent.press(screen.getByLabelText('Ajustes'));
    expect(onSettings).toHaveBeenCalledTimes(1);
  });
});

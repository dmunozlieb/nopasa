import { fireEvent, render, screen } from '@testing-library/react-native';
import { PrivacyScreen } from './PrivacyScreen';

describe('PrivacyScreen', () => {
  it('shows the title and the on-device privacy text', async () => {
    await render(<PrivacyScreen onClose={() => {}} />);
    expect(screen.getByText('Política de privacidad')).toBeTruthy();
    expect(screen.getByText(/únicamente en este dispositivo/)).toBeTruthy();
  });

  it('calls onClose from the close button', async () => {
    const onClose = jest.fn();
    await render(<PrivacyScreen onClose={onClose} />);
    fireEvent.press(screen.getByLabelText('Cerrar'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

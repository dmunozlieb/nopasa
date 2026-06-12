import { fireEvent, render, screen } from '@testing-library/react-native';
import { AddOptionsScreen } from './AddOptionsScreen';

describe('AddOptionsScreen', () => {
  it('fires onPhoto when the photo option is pressed', async () => {
    const onPhoto = jest.fn();
    await render(<AddOptionsScreen onPhoto={onPhoto} onManual={() => {}} onClose={() => {}} />);
    fireEvent.press(screen.getByText('Hacer una foto'));
    expect(onPhoto).toHaveBeenCalledTimes(1);
  });
  it('fires onManual when the manual option is pressed', async () => {
    const onManual = jest.fn();
    await render(<AddOptionsScreen onPhoto={() => {}} onManual={onManual} onClose={() => {}} />);
    fireEvent.press(screen.getByText('Escribirlo a mano'));
    expect(onManual).toHaveBeenCalledTimes(1);
  });
  it('shows the privacy footer', async () => {
    await render(<AddOptionsScreen onPhoto={() => {}} onManual={() => {}} onClose={() => {}} />);
    expect(screen.getByText('Se lee en tu móvil. Nada se sube a internet.')).toBeTruthy();
  });
});

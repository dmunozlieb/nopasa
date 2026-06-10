import { fireEvent, render, screen } from '@testing-library/react-native';
import { NavRow } from './NavRow';

describe('NavRow', () => {
  it('renders the label and subtitle and calls onPress', async () => {
    const onPress = jest.fn();
    await render(
      <NavRow label="Exportar mis datos" subtitle="Guarda una copia en tu móvil." onPress={onPress} />,
    );
    expect(screen.getByText('Exportar mis datos')).toBeTruthy();
    expect(screen.getByText('Guarda una copia en tu móvil.')).toBeTruthy();
    fireEvent.press(screen.getByText('Exportar mis datos'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders without a subtitle', async () => {
    await render(<NavRow label="Política de privacidad" onPress={() => {}} />);
    expect(screen.getByText('Política de privacidad')).toBeTruthy();
  });
});

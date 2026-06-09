import { render, screen, fireEvent } from '@testing-library/react-native';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('shows the headline, button and privacy line', async () => {
    await render(<EmptyState onAdd={() => {}} onOpenSettings={() => {}} />);
    expect(screen.getByText('Aquí no se te pasará nada')).toBeTruthy();
    expect(screen.getByText('Añadir mi primer vencimiento')).toBeTruthy();
    expect(screen.getByText('Se lee en tu móvil. Nada se sube a internet.')).toBeTruthy();
  });

  it('calls onAdd when the button is pressed', async () => {
    const onAdd = jest.fn();
    await render(<EmptyState onAdd={onAdd} onOpenSettings={() => {}} />);
    fireEvent.press(screen.getByText('Añadir mi primer vencimiento'));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('renders a settings gear that calls onOpenSettings', async () => {
    const onOpenSettings = jest.fn();
    await render(<EmptyState onAdd={() => {}} onOpenSettings={onOpenSettings} />);
    fireEvent.press(screen.getByLabelText('Ajustes'));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });
});

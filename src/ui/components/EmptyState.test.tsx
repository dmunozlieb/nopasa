import { render, screen, fireEvent } from '@testing-library/react-native';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  describe('first-use variant', () => {
    it('shows the welcome headline, first-time CTA and privacy line', async () => {
      await render(<EmptyState variant="first-use" onAdd={() => {}} onOpenSettings={() => {}} />);
      expect(screen.getByText('Aquí no se te pasará nada')).toBeTruthy();
      expect(screen.getByText('Añadir mi primer vencimiento')).toBeTruthy();
      expect(screen.getByText('Se lee en tu móvil. Nada se sube a internet.')).toBeTruthy();
    });

    it('calls onAdd when the button is pressed', async () => {
      const onAdd = jest.fn();
      await render(<EmptyState variant="first-use" onAdd={onAdd} onOpenSettings={() => {}} />);
      fireEvent.press(screen.getByText('Añadir mi primer vencimiento'));
      expect(onAdd).toHaveBeenCalledTimes(1);
    });

    it('renders a settings gear that calls onOpenSettings', async () => {
      const onOpenSettings = jest.fn();
      await render(<EmptyState variant="first-use" onAdd={() => {}} onOpenSettings={onOpenSettings} />);
      fireEvent.press(screen.getByLabelText('Ajustes'));
      expect(onOpenSettings).toHaveBeenCalledTimes(1);
    });
  });

  describe('all-caught-up variant', () => {
    it('shows the reassuring copy and the generic CTA, without the privacy line', async () => {
      await render(<EmptyState variant="all-caught-up" onAdd={() => {}} onOpenSettings={() => {}} />);
      expect(screen.getByText('Todo en orden')).toBeTruthy();
      expect(
        screen.getByText('No tienes vencimientos pendientes. Te avisaremos cuando se acerque alguno.'),
      ).toBeTruthy();
      expect(screen.getByText('Añadir un vencimiento')).toBeTruthy();
      expect(screen.queryByText('Se lee en tu móvil. Nada se sube a internet.')).toBeNull();
    });

    it('keeps the settings gear', async () => {
      const onOpenSettings = jest.fn();
      await render(<EmptyState variant="all-caught-up" onAdd={() => {}} onOpenSettings={onOpenSettings} />);
      fireEvent.press(screen.getByLabelText('Ajustes'));
      expect(onOpenSettings).toHaveBeenCalledTimes(1);
    });
  });
});

import { render, screen } from '@testing-library/react-native';
import { ComingSoonRow } from './ComingSoonRow';

describe('ComingSoonRow', () => {
  it('renders the label and the inert "Próximamente" badge', async () => {
    await render(<ComingSoonRow label="Tema" />);
    expect(screen.getByText('Tema')).toBeTruthy();
    expect(screen.getByText('Próximamente')).toBeTruthy();
  });

  it('renders an optional subtitle', async () => {
    await render(<ComingSoonRow label="Resumen semanal" subtitle="Un repaso de lo que se acerca, cada lunes." />);
    expect(screen.getByText('Un repaso de lo que se acerca, cada lunes.')).toBeTruthy();
  });
});

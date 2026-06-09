import { fireEvent, render, screen } from '@testing-library/react-native';
import { TypeSelector } from './TypeSelector';

describe('TypeSelector', () => {
  it('renders all nine type labels', async () => {
    await render(<TypeSelector value="OTHER" onChange={() => {}} />);
    for (const label of ['ITV', 'DNI', 'Pasaporte', 'Permiso', 'Seguro', 'Suscripción', 'Garantía', 'Gas', 'Otro']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it('calls onChange with the pressed type', async () => {
    const onChange = jest.fn();
    await render(<TypeSelector value="OTHER" onChange={onChange} />);
    fireEvent.press(screen.getByText('Seguro'));
    expect(onChange).toHaveBeenCalledWith('INSURANCE');
  });
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { RecurrenceSelect } from './RecurrenceSelect';

describe('RecurrenceSelect', () => {
  it('renders the presets and the custom chip', async () => {
    await render(<RecurrenceSelect value={undefined} onChange={() => {}} />);
    expect(screen.getByText('No se repite')).toBeTruthy();
    expect(screen.getByText('Cada mes')).toBeTruthy();
    expect(screen.getByText('Cada año')).toBeTruthy();
    expect(screen.getByText('Cada 2 años')).toBeTruthy();
    expect(screen.getByText('Personalizado')).toBeTruthy();
  });

  it('reports the months for a preset', async () => {
    const onChange = jest.fn();
    await render(<RecurrenceSelect value={undefined} onChange={onChange} />);
    fireEvent.press(screen.getByText('Cada año'));
    expect(onChange).toHaveBeenCalledWith(12);
  });

  it('reports undefined for "No se repite"', async () => {
    const onChange = jest.fn();
    await render(<RecurrenceSelect value={12} onChange={onChange} />);
    fireEvent.press(screen.getByText('No se repite'));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('reveals the custom field and reports the typed integer', async () => {
    const onChange = jest.fn();
    await render(<RecurrenceSelect value={undefined} onChange={onChange} />);
    fireEvent.press(screen.getByText('Personalizado'));
    const input = await screen.findByTestId('recurrence-custom-input');
    fireEvent.changeText(input, '3');
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('reports undefined for invalid custom input', async () => {
    const onChange = jest.fn();
    await render(<RecurrenceSelect value={undefined} onChange={onChange} />);
    fireEvent.press(screen.getByText('Personalizado'));
    const input = await screen.findByTestId('recurrence-custom-input');
    fireEvent.changeText(input, 'abc');
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });

  it('shows the custom field when value is a non-preset number', async () => {
    await render(<RecurrenceSelect value={3} onChange={() => {}} />);
    expect(screen.getByTestId('recurrence-custom-input')).toBeTruthy();
  });

  it('collapses the custom field when a preset is selected after custom mode', async () => {
    await render(<RecurrenceSelect value={undefined} onChange={() => {}} />);
    fireEvent.press(screen.getByText('Personalizado'));
    expect(await screen.findByTestId('recurrence-custom-input')).toBeTruthy();
    fireEvent.press(screen.getByText('Cada mes'));
    await waitFor(() => expect(screen.queryByTestId('recurrence-custom-input')).toBeNull());
  });
});

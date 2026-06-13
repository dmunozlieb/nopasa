import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { RecurrenceSelect } from './RecurrenceSelect';

describe('RecurrenceSelect', () => {
  it('renders all presets including the long cycles and the custom chip', async () => {
    await render(<RecurrenceSelect value={undefined} onChange={() => {}} />);
    expect(screen.getByText('No se repite')).toBeTruthy();
    expect(screen.getByText('Cada mes')).toBeTruthy();
    expect(screen.getByText('Cada año')).toBeTruthy();
    expect(screen.getByText('Cada 2 años')).toBeTruthy();
    expect(screen.getByText('Cada 5 años')).toBeTruthy();
    expect(screen.getByText('Cada 10 años')).toBeTruthy();
    expect(screen.getByText('Personalizado')).toBeTruthy();
  });

  it('reports the months for the long-cycle presets', async () => {
    const onChange = jest.fn();
    await render(<RecurrenceSelect value={undefined} onChange={onChange} />);
    fireEvent.press(screen.getByText('Cada 5 años'));
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(60));
    fireEvent.press(screen.getByText('Cada 10 años'));
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(120));
  });

  it('reports the months for a short preset', async () => {
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

  it('custom input defaults to years: typing 5 reports 60 months', async () => {
    const onChange = jest.fn();
    await render(<RecurrenceSelect value={undefined} onChange={onChange} />);
    fireEvent.press(screen.getByText('Personalizado'));
    const input = await screen.findByTestId('recurrence-custom-input');
    fireEvent.changeText(input, '5');
    expect(onChange).toHaveBeenLastCalledWith(60);
  });

  it('switching the custom unit to months reparses the typed value', async () => {
    const onChange = jest.fn();
    await render(<RecurrenceSelect value={undefined} onChange={onChange} />);
    fireEvent.press(screen.getByText('Personalizado'));
    const input = await screen.findByTestId('recurrence-custom-input');
    fireEvent.changeText(input, '3'); // years → 36
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(36));
    fireEvent.press(screen.getByText('meses'));
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(3)); // months → 3
  });

  it('reports undefined for invalid custom input', async () => {
    const onChange = jest.fn();
    await render(<RecurrenceSelect value={undefined} onChange={onChange} />);
    fireEvent.press(screen.getByText('Personalizado'));
    const input = await screen.findByTestId('recurrence-custom-input');
    fireEvent.changeText(input, 'abc');
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });

  it('shows the custom field and infers years for a whole-year non-preset value', async () => {
    await render(<RecurrenceSelect value={36} onChange={() => {}} />);
    const input = await screen.findByTestId('recurrence-custom-input');
    expect(input.props.value).toBe('3'); // 36 months → 3 years
    expect(screen.getByText('años')).toBeTruthy();
  });

  it('collapses the custom field when a preset is selected after custom mode', async () => {
    await render(<RecurrenceSelect value={undefined} onChange={() => {}} />);
    fireEvent.press(screen.getByText('Personalizado'));
    expect(await screen.findByTestId('recurrence-custom-input')).toBeTruthy();
    fireEvent.press(screen.getByText('Cada mes'));
    await waitFor(() => expect(screen.queryByTestId('recurrence-custom-input')).toBeNull());
  });
});

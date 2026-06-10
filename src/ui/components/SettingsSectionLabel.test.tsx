import { render, screen } from '@testing-library/react-native';
import { SettingsSectionLabel } from './SettingsSectionLabel';

describe('SettingsSectionLabel', () => {
  it('renders the label uppercased', async () => {
    await render(<SettingsSectionLabel label="Avisos" />);
    expect(screen.getByText('AVISOS')).toBeTruthy();
  });
});

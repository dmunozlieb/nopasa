import type { ReactNode } from 'react';
import { renderHook } from '@testing-library/react-native';
import { FakeDataExporter } from '../../test-support/fake-data-exporter';
import { DataExporterProvider, useDataExporter } from './data-exporter-context';

describe('useDataExporter', () => {
  it('returns the injected exporter', async () => {
    const exporter = new FakeDataExporter();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <DataExporterProvider exporter={exporter}>{children}</DataExporterProvider>
    );
    const { result } = await renderHook(() => useDataExporter(), { wrapper });
    expect(result.current).toBe(exporter);
  });

  it('throws when used outside the provider', async () => {
    await expect(renderHook(() => useDataExporter())).rejects.toThrow(
      'useDataExporter must be used within a DataExporterProvider',
    );
  });
});

import { createContext, useContext, type ReactNode } from 'react';
import type { DataExporter } from '../../ports/data-exporter';
import { expoDataExporter } from '../../infrastructure/export/expo-data-exporter';

const DataExporterContext = createContext<DataExporter | null>(null);

interface DataExporterProviderProps {
  /** Inject a fake (tests). Omit for the production expo adapter. */
  exporter?: DataExporter;
  children: ReactNode;
}

export function DataExporterProvider({ exporter, children }: DataExporterProviderProps) {
  return (
    <DataExporterContext.Provider value={exporter ?? expoDataExporter}>
      {children}
    </DataExporterContext.Provider>
  );
}

export function useDataExporter(): DataExporter {
  const exporter = useContext(DataExporterContext);
  if (!exporter) {
    throw new Error('useDataExporter must be used within a DataExporterProvider');
  }
  return exporter;
}

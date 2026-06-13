import { createContext, useContext, type ReactNode } from 'react';
import type { DataImporter } from '../../ports/data-importer';
import { expoDataImporter } from '../../infrastructure/import/expo-data-importer';

const DataImporterContext = createContext<DataImporter | null>(null);

interface DataImporterProviderProps {
  /** Inject a fake (tests). Omit for the production expo adapter. */
  importer?: DataImporter;
  children: ReactNode;
}

export function DataImporterProvider({ importer, children }: DataImporterProviderProps) {
  return (
    <DataImporterContext.Provider value={importer ?? expoDataImporter}>
      {children}
    </DataImporterContext.Provider>
  );
}

export function useDataImporter(): DataImporter {
  const importer = useContext(DataImporterContext);
  if (!importer) {
    throw new Error('useDataImporter must be used within a DataImporterProvider');
  }
  return importer;
}

import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import type { DataImporter } from '../../ports/data-importer';

/**
 * Lets the user pick a file via the system document picker, then reads its text.
 * Returns null if the user cancels. Thin wrapper over expo-document-picker +
 * expo-file-system — mocked in tests (real path verified on a dev build).
 */
export const expoDataImporter: DataImporter = {
  async pickAndRead(): Promise<string | null> {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/json',
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return null;
    return new File(result.assets[0].uri).text();
  },
};

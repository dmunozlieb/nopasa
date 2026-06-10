import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { DataExporter } from '../../ports/data-exporter';

/**
 * Writes the export to a file in the app's cache directory, then opens the system share
 * sheet so the user can save/send it. Sharing an app-owned file needs no special Android
 * permission. Thin wrapper over expo-file-system + expo-sharing — mocked in tests.
 */
export const expoDataExporter: DataExporter = {
  async export(filename: string, content: string): Promise<void> {
    const file = new File(Paths.cache, filename);
    file.write(content);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/json',
        dialogTitle: 'Exportar mis datos',
      });
    }
  },
};

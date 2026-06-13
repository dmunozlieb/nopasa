/** Effects port for importing data into the app. The UI depends on this, never on
 *  expo-document-picker / expo-file-system directly. */
export interface DataImporter {
  /** Let the user pick a file and return its text content, or null if they cancelled. */
  pickAndRead(): Promise<string | null>;
}

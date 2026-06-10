/** Effects port for exporting data off the app. The UI depends on this, never on
 *  expo-file-system / expo-sharing directly. */
export interface DataExporter {
  /** Persist `content` under `filename`, then offer it to the user (system share sheet). */
  export(filename: string, content: string): Promise<void>;
}

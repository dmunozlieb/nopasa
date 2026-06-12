/**
 * Effects port for persistent photo storage. The UI depends on this, never on
 * expo-file-system directly. The implementation copies temporary camera photos
 * into stable app storage; the stable uri is what gets persisted in the domain.
 */
export interface PhotoStore {
  /** Copy the photo at `sourceUri` into stable app storage; returns the stable uri. */
  persist(sourceUri: string): Promise<string>;
}

import { randomUUID } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import type { PhotoStore } from '../../ports/photo-store';

/**
 * Copies a captured photo from the OS cache (which can be evicted) into the app's
 * stable document directory under `photos/`, using a self-generated uuid filename
 * (not coupled to any deadline id, which doesn't exist at persist time). Thin
 * wrapper over expo-file-system — mocked in tests.
 */
export const expoFileSystemPhotoStore: PhotoStore = {
  async persist(sourceUri: string): Promise<string> {
    const dir = new Directory(Paths.document, 'photos');
    if (!dir.exists) dir.create();
    const source = new File(sourceUri);
    const extension = source.extension || '.jpg';
    const dest = new File(dir, `${randomUUID()}${extension}`);
    await source.copy(dest);
    return dest.uri;
  },
};

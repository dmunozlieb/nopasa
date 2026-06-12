import { createContext, useContext, type ReactNode } from 'react';
import type { PhotoStore } from '../../ports/photo-store';
import { expoFileSystemPhotoStore } from '../../infrastructure/photos/expo-file-system-photo-store';

const PhotoStoreContext = createContext<PhotoStore | null>(null);

interface PhotoStoreProviderProps {
  /** Inject a fake (tests). Omit for the production expo-file-system adapter. */
  store?: PhotoStore;
  children: ReactNode;
}

export function PhotoStoreProvider({ store, children }: PhotoStoreProviderProps) {
  return (
    <PhotoStoreContext.Provider value={store ?? expoFileSystemPhotoStore}>
      {children}
    </PhotoStoreContext.Provider>
  );
}

export function usePhotoStore(): PhotoStore {
  const store = useContext(PhotoStoreContext);
  if (!store) {
    throw new Error('usePhotoStore must be used within a PhotoStoreProvider');
  }
  return store;
}

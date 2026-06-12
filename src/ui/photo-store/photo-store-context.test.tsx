import type { ReactNode } from 'react';
import { renderHook } from '@testing-library/react-native';
import { FakePhotoStore } from '../../test-support/fake-photo-store';
import { PhotoStoreProvider, usePhotoStore } from './photo-store-context';

describe('PhotoStoreProvider / usePhotoStore', () => {
  it('provides the injected store', async () => {
    const store = new FakePhotoStore();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <PhotoStoreProvider store={store}>{children}</PhotoStoreProvider>
    );
    const { result } = await renderHook(() => usePhotoStore(), { wrapper });
    expect(result.current).toBe(store);
  });

  it('falls back to the production default when none is injected', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <PhotoStoreProvider>{children}</PhotoStoreProvider>
    );
    const { result } = await renderHook(() => usePhotoStore(), { wrapper });
    expect(typeof result.current.persist).toBe('function');
  });

  it('throws when used outside a provider', async () => {
    await expect(renderHook(() => usePhotoStore())).rejects.toThrow(
      'usePhotoStore must be used within a PhotoStoreProvider',
    );
  });
});

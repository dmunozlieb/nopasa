import { FakePhotoStore } from './fake-photo-store';

describe('FakePhotoStore', () => {
  it('records the source and returns a deterministic stable uri', async () => {
    const store = new FakePhotoStore();
    const uri = await store.persist('file:///cache/cam1.jpg');
    expect(uri).toBe('stable:///0.jpg');
    expect(store.persisted).toEqual(['file:///cache/cam1.jpg']);
  });

  it('increments the stable uri per call', async () => {
    const store = new FakePhotoStore();
    await store.persist('file:///cache/a.jpg');
    expect(await store.persist('file:///cache/b.jpg')).toBe('stable:///1.jpg');
    expect(store.persisted).toEqual(['file:///cache/a.jpg', 'file:///cache/b.jpg']);
  });
});

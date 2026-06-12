const mockCreated: string[] = [];
const mockCopies: Array<{ from: string; to: string }> = [];
let mockDirExists = false;

jest.mock('expo-file-system', () => {
  class Directory {
    uri: string;
    constructor(...parts: any[]) { this.uri = parts.map((p) => (p?.uri ?? p)).join('/'); }
    get exists() { return mockDirExists; }
    create() { mockCreated.push(this.uri); }
  }
  class File {
    uri: string;
    constructor(...parts: any[]) { this.uri = parts.map((p) => (p?.uri ?? p)).join('/'); }
    get extension() { const m = this.uri.match(/\.[^./]+$/); return m ? m[0] : ''; }
    async copy(dest: any) { mockCopies.push({ from: this.uri, to: dest.uri }); }
  }
  return {
    __esModule: true,
    Paths: { document: { uri: 'file:///document' }, cache: { uri: 'file:///cache' } },
    Directory,
    File,
  };
});

import { expoFileSystemPhotoStore } from './expo-file-system-photo-store';

beforeEach(() => { mockCreated.length = 0; mockCopies.length = 0; mockDirExists = false; });

describe('expoFileSystemPhotoStore', () => {
  it('copies the source into document/photos under a uuid name and returns that uri', async () => {
    const result = await expoFileSystemPhotoStore.persist('file:///cache/cam.jpg');
    expect(result).toBe('file:///document/photos/00000000-0000-4000-8000-000000000000.jpg');
    expect(mockCopies).toEqual([
      { from: 'file:///cache/cam.jpg', to: 'file:///document/photos/00000000-0000-4000-8000-000000000000.jpg' },
    ]);
  });

  it('creates the photos directory when it does not exist', async () => {
    mockDirExists = false;
    await expoFileSystemPhotoStore.persist('file:///cache/cam.jpg');
    expect(mockCreated).toEqual(['file:///document/photos']);
  });

  it('does not create the photos directory when it already exists', async () => {
    mockDirExists = true;
    await expoFileSystemPhotoStore.persist('file:///cache/cam.jpg');
    expect(mockCreated).toEqual([]);
  });

  it('defaults the extension to .jpg when the source has none', async () => {
    const result = await expoFileSystemPhotoStore.persist('file:///cache/cam');
    expect(result).toBe('file:///document/photos/00000000-0000-4000-8000-000000000000.jpg');
  });
});

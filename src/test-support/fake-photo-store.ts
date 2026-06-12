import type { PhotoStore } from '../ports/photo-store';

/** In-memory PhotoStore for tests. Records each source uri and returns a
 *  deterministic stable uri (`stable:///<n>.jpg`) so tests can assert the
 *  stored photoUri is the stable one, not the source. */
export class FakePhotoStore implements PhotoStore {
  readonly persisted: string[] = [];
  async persist(sourceUri: string): Promise<string> {
    const uri = `stable:///${this.persisted.length}.jpg`;
    this.persisted.push(sourceUri);
    return uri;
  }
}

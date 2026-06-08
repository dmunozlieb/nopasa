import { buildDeadline } from './build-deadline';
import { InMemoryDeadlineRepository } from './in-memory-deadline-repository';

describe('InMemoryDeadlineRepository', () => {
  it('saves and lists deadlines', async () => {
    const repo = new InMemoryDeadlineRepository();
    const d = buildDeadline({ id: 'a' });
    await repo.save(d);
    expect(await repo.list()).toEqual([d]);
  });

  it('can be seeded via the constructor', async () => {
    const d = buildDeadline({ id: 'a' });
    const repo = new InMemoryDeadlineRepository([d]);
    expect(await repo.list()).toEqual([d]);
  });

  it('finds by id and returns null when absent', async () => {
    const repo = new InMemoryDeadlineRepository([buildDeadline({ id: 'a' })]);
    expect(await repo.findById('a')).not.toBeNull();
    expect(await repo.findById('missing')).toBeNull();
  });

  it('updates an existing deadline in place', async () => {
    const repo = new InMemoryDeadlineRepository([buildDeadline({ id: 'a', title: 'old' })]);
    await repo.update(buildDeadline({ id: 'a', title: 'new' }));
    expect((await repo.findById('a'))?.title).toBe('new');
  });

  it('deletes by id', async () => {
    const repo = new InMemoryDeadlineRepository([buildDeadline({ id: 'a' })]);
    await repo.delete('a');
    expect(await repo.list()).toEqual([]);
  });

  it('returns copies so the internal store is not mutated by callers', async () => {
    const repo = new InMemoryDeadlineRepository([buildDeadline({ id: 'a' })]);
    const list = await repo.list();
    list.pop();
    expect(await repo.list()).toHaveLength(1);
  });
});

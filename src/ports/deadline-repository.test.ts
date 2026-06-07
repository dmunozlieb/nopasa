import type { DeadlineRepository } from './deadline-repository';
import type { Deadline } from '../domain/deadline/deadline.schema';
import { buildDeadline } from '../test-support/build-deadline';

// An in-memory fake proves the interface is implementable and well-shaped.
class InMemoryDeadlineRepository implements DeadlineRepository {
  private readonly store = new Map<string, Deadline>();
  async save(deadline: Deadline): Promise<void> {
    this.store.set(deadline.id, deadline);
  }
  async list(): Promise<Deadline[]> {
    return [...this.store.values()];
  }
  async findById(id: string): Promise<Deadline | null> {
    return this.store.get(id) ?? null;
  }
  async update(deadline: Deadline): Promise<void> {
    this.store.set(deadline.id, deadline);
  }
  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }
}

describe('DeadlineRepository contract', () => {
  it('can be implemented and exercised through its async methods', async () => {
    const repo: DeadlineRepository = new InMemoryDeadlineRepository();
    const d = buildDeadline({ id: 'x1' });

    await repo.save(d);
    expect(await repo.list()).toHaveLength(1);
    expect(await repo.findById('x1')).toEqual(d);

    await repo.delete('x1');
    expect(await repo.findById('x1')).toBeNull();
  });
});

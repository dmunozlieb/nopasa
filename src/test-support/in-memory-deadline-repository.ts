import type { Deadline } from '../domain/deadline/deadline.schema';
import type { DeadlineRepository } from '../ports/deadline-repository';

/** In-memory DeadlineRepository for tests and previews. Implements the full port. */
export class InMemoryDeadlineRepository implements DeadlineRepository {
  private readonly store: Map<string, Deadline>;

  constructor(initial: Deadline[] = []) {
    this.store = new Map(initial.map((d) => [d.id, d]));
  }

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

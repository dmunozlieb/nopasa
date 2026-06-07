import type { Deadline } from '../domain/deadline/deadline.schema';

/**
 * Persistence boundary for deadlines. Async by design (built for SQLite).
 * No implementation this session — this contract keeps the domain independent
 * of storage. A SQLite-backed adapter and its migrations come in a later session.
 */
export interface DeadlineRepository {
  save(deadline: Deadline): Promise<void>;
  list(): Promise<Deadline[]>;
  findById(id: string): Promise<Deadline | null>;
  update(deadline: Deadline): Promise<void>;
  delete(id: string): Promise<void>;
}

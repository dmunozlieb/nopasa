import type { Deadline } from '../../../domain/deadline/deadline.schema';
import type { DeadlineRepository } from '../../../ports/deadline-repository';
import { consoleLogger, type Logger } from '../../logging/logger';
import { fromRow, rowToParams, toRow } from './deadline-mapper';
import type { DeadlineRow } from './deadline-row';
import type { SqlExecutor } from './sql-executor';

const INSERT_SQL =
  'INSERT INTO deadlines ' +
  '(id, type, title, subtitle, due_date, amount, amount_label, reminder_days_before, recurrence_months, photo_uri, created_at, status) ' +
  'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

const UPDATE_SQL =
  'UPDATE deadlines SET ' +
  'type = ?, title = ?, subtitle = ?, due_date = ?, amount = ?, amount_label = ?, ' +
  'reminder_days_before = ?, recurrence_months = ?, photo_uri = ?, created_at = ?, status = ? ' +
  'WHERE id = ?';

const SELECT_COLUMNS =
  'id, type, title, subtitle, due_date, amount, amount_label, reminder_days_before, recurrence_months, photo_uri, created_at, status';
const SELECT_ALL_SQL = `SELECT ${SELECT_COLUMNS} FROM deadlines`;
const SELECT_BY_ID_SQL = `${SELECT_ALL_SQL} WHERE id = ?`;
const DELETE_SQL = 'DELETE FROM deadlines WHERE id = ?';

/** SQLite-backed DeadlineRepository. Resilient to corrupt rows: warns and skips/returns null. */
export class SqliteDeadlineRepository implements DeadlineRepository {
  constructor(
    private readonly executor: SqlExecutor,
    private readonly logger: Logger = consoleLogger,
  ) {}

  async save(deadline: Deadline): Promise<void> {
    await this.executor.run(INSERT_SQL, rowToParams(toRow(deadline)));
  }

  async update(deadline: Deadline): Promise<void> {
    const params = rowToParams(toRow(deadline)); // [id, ...rest]
    await this.executor.run(UPDATE_SQL, [...params.slice(1), params[0]]);
  }

  async delete(id: string): Promise<void> {
    await this.executor.run(DELETE_SQL, [id]);
  }

  async list(): Promise<Deadline[]> {
    const rows = await this.executor.all<DeadlineRow>(SELECT_ALL_SQL);
    const deadlines: Deadline[] = [];
    for (const row of rows) {
      try {
        deadlines.push(fromRow(row));
      } catch (error) {
        this.logger.warn(`Skipping corrupt deadline row (id=${row.id})`, error);
      }
    }
    return deadlines;
  }

  async findById(id: string): Promise<Deadline | null> {
    const row = await this.executor.getFirst<DeadlineRow>(SELECT_BY_ID_SQL, [id]);
    if (row === null) {
      return null;
    }
    try {
      return fromRow(row);
    } catch (error) {
      this.logger.warn(`Ignoring corrupt deadline row (id=${id})`, error);
      return null;
    }
  }
}

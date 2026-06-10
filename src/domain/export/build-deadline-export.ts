import type { Deadline } from '../deadline/deadline.schema';

interface BuildOptions {
  /** When the export was produced; serialized as an ISO instant. */
  exportedAt: Date;
}

/**
 * Serializes every deadline into the canonical, schema-versioned export envelope.
 * Framework-free and round-trippable: Dates become ISO strings via JSON.stringify.
 * Includes deadlines of all statuses — the caller passes the full list.
 */
export function buildDeadlineExport(deadlines: Deadline[], { exportedAt }: BuildOptions): string {
  return JSON.stringify({ app: 'nopasa', schema: 1, exportedAt, deadlines });
}

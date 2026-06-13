import { z } from 'zod';
import { deadlineSchema, type Deadline } from '../deadline/deadline.schema';

export type ImportSchemaError = 'unreadable' | 'unsupported-version';

export interface DeadlineImportResult {
  deadlines: Deadline[];
  invalidCount: number;
  schemaError?: ImportSchemaError;
}

/** The canonical Deadline schema with the two date fields coerced from ISO strings: the
 *  export serializes Dates via JSON.stringify → full ISO, which z.coerce.date() reads
 *  back to the exact instant (local midnight in the same timezone, for dueDate). */
const importDeadlineSchema = deadlineSchema.extend({
  dueDate: z.coerce.date(),
  createdAt: z.coerce.date(),
});

/**
 * Pure parser for an exported Nopasa file. Resilient: a corrupt entry is skipped and
 * counted (invalidCount), never aborting the rest — mirrors the SQLite repo's edge
 * validation. A whole file that can't be read or isn't a Nopasa file → 'unreadable';
 * a genuine Nopasa file of another schema → 'unsupported-version'.
 */
export function parseDeadlineImport(jsonText: string): DeadlineImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { deadlines: [], invalidCount: 0, schemaError: 'unreadable' };
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { deadlines: [], invalidCount: 0, schemaError: 'unreadable' };
  }
  const envelope = parsed as { app?: unknown; schema?: unknown; deadlines?: unknown };
  if (envelope.app !== 'nopasa') {
    return { deadlines: [], invalidCount: 0, schemaError: 'unreadable' };
  }
  if (envelope.schema !== 1) {
    return { deadlines: [], invalidCount: 0, schemaError: 'unsupported-version' };
  }

  const rawList = Array.isArray(envelope.deadlines) ? envelope.deadlines : [];
  const deadlines: Deadline[] = [];
  let invalidCount = 0;
  for (const entry of rawList) {
    const result = importDeadlineSchema.safeParse(entry);
    if (result.success) deadlines.push(result.data);
    else invalidCount += 1;
  }
  return { deadlines, invalidCount };
}

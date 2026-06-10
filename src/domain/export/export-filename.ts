import { toLocalDateString } from '../date/local-date';

/** The export file's name, stamped with the local date: `nopasa-export-YYYY-MM-DD.json`. */
export function exportFilename(date: Date): string {
  return `nopasa-export-${toLocalDateString(date)}.json`;
}

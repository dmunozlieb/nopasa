import { exportFilename } from './export-filename';

describe('exportFilename', () => {
  it('builds a dated JSON filename from the local date', () => {
    expect(exportFilename(new Date(2026, 5, 10))).toBe('nopasa-export-2026-06-10.json');
    expect(exportFilename(new Date(2026, 0, 5))).toBe('nopasa-export-2026-01-05.json');
  });
});

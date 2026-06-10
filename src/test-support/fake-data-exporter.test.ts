import { FakeDataExporter } from './fake-data-exporter';

describe('FakeDataExporter', () => {
  it('records each export call', async () => {
    const exporter = new FakeDataExporter();
    await exporter.export('nopasa-export-2026-06-10.json', '{"app":"nopasa"}');
    expect(exporter.calls).toEqual([
      { filename: 'nopasa-export-2026-06-10.json', content: '{"app":"nopasa"}' },
    ]);
  });
});

import type { DataExporter } from '../ports/data-exporter';

/** In-memory DataExporter for tests: records every (filename, content) it is given. */
export class FakeDataExporter implements DataExporter {
  readonly calls: { filename: string; content: string }[] = [];

  async export(filename: string, content: string): Promise<void> {
    this.calls.push({ filename, content });
  }
}

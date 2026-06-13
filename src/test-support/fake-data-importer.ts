import type { DataImporter } from '../ports/data-importer';

/** In-memory DataImporter for tests: returns a preset content string (or null = cancelled). */
export class FakeDataImporter implements DataImporter {
  constructor(private readonly content: string | null = null) {}

  async pickAndRead(): Promise<string | null> {
    return this.content;
  }
}

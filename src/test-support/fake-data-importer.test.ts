import { FakeDataImporter } from './fake-data-importer';

describe('FakeDataImporter', () => {
  it('returns the preset content', async () => {
    expect(await new FakeDataImporter('{"app":"nopasa"}').pickAndRead()).toBe('{"app":"nopasa"}');
  });
  it('returns null when configured as cancelled', async () => {
    expect(await new FakeDataImporter().pickAndRead()).toBeNull();
  });
});

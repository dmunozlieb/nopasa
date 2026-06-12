import { FakeTextRecognizer } from './fake-text-recognizer';

describe('FakeTextRecognizer', () => {
  it('returns the configured result and records the call', async () => {
    const fake = new FakeTextRecognizer({ result: { text: 'ITV\n2027', lines: ['ITV', '2027'] } });
    const out = await fake.recognize('file:///photos/a.jpg');
    expect(out).toEqual({ text: 'ITV\n2027', lines: ['ITV', '2027'] });
    expect(fake.calls).toEqual(['file:///photos/a.jpg']);
  });

  it('defaults to empty recognized text', async () => {
    const fake = new FakeTextRecognizer();
    expect(await fake.recognize('file:///photos/a.jpg')).toEqual({ text: '', lines: [] });
  });

  it('rejects when configured with an error', async () => {
    const fake = new FakeTextRecognizer({ error: new Error('ocr failed') });
    await expect(fake.recognize('file:///photos/a.jpg')).rejects.toThrow('ocr failed');
  });
});

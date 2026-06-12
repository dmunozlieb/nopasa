import { extractTextFromImage } from 'expo-text-extractor';
import { expoTextExtractorRecognizer } from './expo-text-extractor-recognizer';

const mockExtract = extractTextFromImage as jest.MockedFunction<typeof extractTextFromImage>;

describe('expoTextExtractorRecognizer', () => {
  afterEach(() => mockExtract.mockReset());

  it('maps the recognized lines into RecognizedText (text joined by newlines)', async () => {
    mockExtract.mockResolvedValue(['ITV del coche', 'Caduca 11/06/2027']);
    const out = await expoTextExtractorRecognizer.recognize('file:///photos/a.jpg');
    expect(mockExtract).toHaveBeenCalledWith('file:///photos/a.jpg');
    expect(out).toEqual({ text: 'ITV del coche\nCaduca 11/06/2027', lines: ['ITV del coche', 'Caduca 11/06/2027'] });
  });

  it('returns empty RecognizedText when nothing is recognized', async () => {
    mockExtract.mockResolvedValue([]);
    expect(await expoTextExtractorRecognizer.recognize('file:///photos/a.jpg')).toEqual({ text: '', lines: [] });
  });
});

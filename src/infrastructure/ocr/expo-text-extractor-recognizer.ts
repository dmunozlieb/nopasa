import { extractTextFromImage } from 'expo-text-extractor';
import type { RecognizedText, TextRecognizer } from '../../ports/text-recognizer';

/**
 * On-device OCR adapter over expo-text-extractor (ML Kit on Android, Apple Vision on iOS).
 * Inference runs locally; the photo and text never leave the device. Thin wrapper —
 * mocked in tests.
 */
export const expoTextExtractorRecognizer: TextRecognizer = {
  async recognize(photoUri: string): Promise<RecognizedText> {
    const lines = await extractTextFromImage(photoUri);
    return { text: lines.join('\n'), lines };
  },
};

import type { RecognizedText, TextRecognizer } from '../ports/text-recognizer';

interface FakeBehavior {
  result?: RecognizedText;
  error?: Error;
  /** Delay before resolving/rejecting, to exercise loading/timeout paths in screen tests. */
  delayMs?: number;
}

/** In-memory TextRecognizer for tests. Records each photoUri and returns a configured
 *  result (or empty), or rejects, optionally after a delay. */
export class FakeTextRecognizer implements TextRecognizer {
  readonly calls: string[] = [];

  constructor(private readonly behavior: FakeBehavior = {}) {}

  async recognize(photoUri: string): Promise<RecognizedText> {
    this.calls.push(photoUri);
    if (this.behavior.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, this.behavior.delayMs));
    }
    if (this.behavior.error) throw this.behavior.error;
    return this.behavior.result ?? { text: '', lines: [] };
  }
}

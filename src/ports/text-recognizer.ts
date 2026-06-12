/** Flat result of on-device OCR over a photo. `text` is the full recognized text;
 *  `lines` is the same content split into recognized lines. Shape kept deliberately
 *  flat so a pure parser (Block 3) can consume it without depending on the OCR lib. */
export interface RecognizedText {
  text: string;
  lines: string[];
}

/** Effects port: on-device text recognition (OCR) over a local photo. The UI depends
 *  on this, never on the OCR library directly. */
export interface TextRecognizer {
  /** Recognize text in the photo at `photoUri` (a local `file://` path). */
  recognize(photoUri: string): Promise<RecognizedText>;
}

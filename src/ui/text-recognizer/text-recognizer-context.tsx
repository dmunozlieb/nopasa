import { createContext, useContext, type ReactNode } from 'react';
import type { TextRecognizer } from '../../ports/text-recognizer';
import { expoTextExtractorRecognizer } from '../../infrastructure/ocr/expo-text-extractor-recognizer';

const TextRecognizerContext = createContext<TextRecognizer | null>(null);

interface TextRecognizerProviderProps {
  /** Inject a fake (tests). Omit for the production expo-text-extractor adapter. */
  recognizer?: TextRecognizer;
  children: ReactNode;
}

export function TextRecognizerProvider({ recognizer, children }: TextRecognizerProviderProps) {
  return (
    <TextRecognizerContext.Provider value={recognizer ?? expoTextExtractorRecognizer}>
      {children}
    </TextRecognizerContext.Provider>
  );
}

export function useTextRecognizer(): TextRecognizer {
  const recognizer = useContext(TextRecognizerContext);
  if (!recognizer) {
    throw new Error('useTextRecognizer must be used within a TextRecognizerProvider');
  }
  return recognizer;
}

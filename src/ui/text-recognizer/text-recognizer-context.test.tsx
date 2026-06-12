import type { ReactNode } from 'react';
import { renderHook } from '@testing-library/react-native';
import { FakeTextRecognizer } from '../../test-support/fake-text-recognizer';
import { TextRecognizerProvider, useTextRecognizer } from './text-recognizer-context';

describe('TextRecognizerProvider / useTextRecognizer', () => {
  it('provides the injected recognizer', async () => {
    const recognizer = new FakeTextRecognizer();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <TextRecognizerProvider recognizer={recognizer}>{children}</TextRecognizerProvider>
    );
    const { result } = await renderHook(() => useTextRecognizer(), { wrapper });
    expect(result.current).toBe(recognizer);
  });

  it('falls back to the production default when none is injected', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <TextRecognizerProvider>{children}</TextRecognizerProvider>
    );
    const { result } = await renderHook(() => useTextRecognizer(), { wrapper });
    expect(typeof result.current.recognize).toBe('function');
  });

  it('throws when used outside a provider', async () => {
    await expect(renderHook(() => useTextRecognizer())).rejects.toThrow(
      'useTextRecognizer must be used within a TextRecognizerProvider',
    );
  });
});

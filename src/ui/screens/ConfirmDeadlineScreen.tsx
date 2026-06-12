import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RecognizedText } from '../../ports/text-recognizer';
import { useTextRecognizer } from '../text-recognizer/text-recognizer-context';
import { withTimeout } from '../ocr/with-timeout';
import { DeadlineForm } from '../components/DeadlineForm';
import { AppText } from '../components/AppText';
import { colors, fontSizes, radii, spacing } from '../theme';

const OCR_TIMEOUT_MS = 8000;

interface ConfirmDeadlineScreenProps {
  photoUri: string;
  onClose: () => void;
  /** OCR deadline in ms; injectable for tests. Defaults to OCR_TIMEOUT_MS. */
  timeoutMs?: number;
}

/**
 * Confirm screen for the photo path. Runs on-device OCR over the photo (best-effort,
 * with a timeout), then renders the shared DeadlineForm. Rendering the form only after
 * OCR resolves is intentional: DeadlineForm seeds its state once from initialValues, so
 * the recognized text (parsed into initialValues in Block 3) must be ready beforehand.
 * In Block 2 initialValues stays empty; the recognized text is only shown in a temporary
 * "Texto detectado" preview to verify OCR on real documents (Block 3 replaces it).
 */
export function ConfirmDeadlineScreen({ photoUri, onClose, timeoutMs = OCR_TIMEOUT_MS }: ConfirmDeadlineScreenProps) {
  const recognizer = useTextRecognizer();
  const insets = useSafeAreaInsets();
  const [reading, setReading] = useState(true);
  const [recognized, setRecognized] = useState<RecognizedText | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      try {
        const result = await withTimeout(recognizer.recognize(photoUri), timeoutMs);
        if (mountedRef.current) setRecognized(result);
      } catch {
        // Best-effort: OCR failure / timeout never blocks the manual path.
        if (mountedRef.current) setRecognized(null);
      } finally {
        if (mountedRef.current) setReading(false);
      }
    })();
    return () => {
      mountedRef.current = false;
    };
  }, [recognizer, photoUri, timeoutMs]);

  if (reading) {
    return (
      <View style={styles.root} testID="ocr-loading">
        <View style={[styles.handle, { marginTop: insets.top + spacing.sm }]} />
        <View style={styles.loading}>
          <ActivityIndicator color={colors.brandBlue} />
          <AppText weight="semibold" size={fontSizes.body} color={colors.textSecondary}>
            Leyendo el documento…
          </AppText>
        </View>
      </View>
    );
  }

  const detected = recognized?.text?.trim();

  return (
    <View style={styles.container}>
      {detected ? (
        <View style={styles.detected} testID="detected-text">
          <AppText weight="bold" size={fontSizes.small} color={colors.textMuted}>
            Texto detectado · temporal (bloque 2)
          </AppText>
          <ScrollView style={styles.detectedScroll}>
            <AppText weight="semibold" size={fontSizes.small} color={colors.textSecondary}>
              {recognized?.text}
            </AppText>
          </ScrollView>
        </View>
      ) : null}
      <View style={styles.formSlot}>
        <DeadlineForm heading="Confirma los datos" photoUri={photoUri} onClose={onClose} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.screenBg },
  formSlot: { flex: 1 },
  root: { flex: 1, backgroundColor: colors.screenBg, borderTopLeftRadius: radii.card, borderTopRightRadius: radii.card },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: radii.pill, backgroundColor: colors.textFaint, opacity: 0.4 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  detected: {
    maxHeight: 160,
    margin: spacing.lg,
    padding: spacing.lg,
    borderRadius: radii.card,
    backgroundColor: colors.surfaceSoft,
    gap: spacing.sm,
  },
  detectedScroll: { flexGrow: 0 },
});

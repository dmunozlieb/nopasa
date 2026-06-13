import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AddFormState } from '../deadline/add-form';
import { parseDeadlineHints } from '../../domain/ocr-parsing/parse-deadline-hints';
import { hintsToInitialValues } from '../deadline/hints-to-initial-values';
import { useTextRecognizer } from '../text-recognizer/text-recognizer-context';
import { useDeadlineDeps } from '../deadline-deps/deadline-deps-context';
import { withTimeout } from '../ocr/with-timeout';
import { DeadlineForm } from '../components/DeadlineForm';
import { AppText } from '../components/AppText';
import { colors, fontSizes, radii, spacing } from '../theme';

const OCR_TIMEOUT_MS = 8000;

interface ConfirmDeadlineScreenProps {
  photoUri: string;
  onSaved: () => void;
  /** OCR deadline in ms; injectable for tests. Defaults to OCR_TIMEOUT_MS. */
  timeoutMs?: number;
}

/**
 * Confirm screen for the photo path. Runs on-device OCR over the photo (best-effort,
 * with a timeout), parses the recognized text into form prefill (DeadlineHints →
 * initialValues), then renders the shared DeadlineForm. Rendering the form only after
 * OCR resolves is intentional: DeadlineForm seeds its state once from initialValues, so
 * the parsed values must be ready beforehand. OCR failure/timeout/empty leaves
 * initialValues empty — the manual path is never blocked.
 */
export function ConfirmDeadlineScreen({ photoUri, onSaved, timeoutMs = OCR_TIMEOUT_MS }: ConfirmDeadlineScreenProps) {
  const recognizer = useTextRecognizer();
  const { clock } = useDeadlineDeps();
  const insets = useSafeAreaInsets();
  const [reading, setReading] = useState(true);
  const [initialValues, setInitialValues] = useState<Partial<AddFormState>>({});
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      try {
        const result = await withTimeout(recognizer.recognize(photoUri), timeoutMs);
        if (mountedRef.current) {
          const hints = parseDeadlineHints(result, { now: clock.now() });
          setInitialValues(hintsToInitialValues(hints));
        }
      } catch {
        // Best-effort: OCR failure / timeout never blocks the manual path (initialValues stays empty).
      } finally {
        if (mountedRef.current) setReading(false);
      }
    })();
    return () => {
      mountedRef.current = false;
    };
  }, [recognizer, photoUri, timeoutMs, clock]);

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

  return (
    <View style={styles.container}>
      <DeadlineForm heading="Confirma los datos" photoUri={photoUri} initialValues={initialValues} onSaved={onSaved} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.screenBg },
  root: { flex: 1, backgroundColor: colors.screenBg, borderTopLeftRadius: radii.card, borderTopRightRadius: radii.card },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: radii.pill, backgroundColor: colors.textFaint, opacity: 0.4 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
});

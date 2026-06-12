import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../components/AppText';
import { colors, fontSizes, radii, spacing } from '../theme';

interface AddOptionsScreenProps {
  onPhoto: () => void;
  onManual: () => void;
  onClose: () => void;
}

/** Selector screen: user picks between taking a photo or entering data manually. */
export function AddOptionsScreen({ onPhoto, onManual, onClose }: AddOptionsScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <View style={[styles.handle, { marginTop: insets.top + spacing.sm }]} />
      <View style={[styles.content, { paddingBottom: spacing.xxxl + insets.bottom }]}>
        <AppText weight="extrabold" size={fontSizes.title}>
          ¿Cómo quieres añadirlo?
        </AppText>

        <Pressable style={styles.option} onPress={onPhoto}>
          <AppText weight="bold" size={fontSizes.body}>
            Hacer una foto
          </AppText>
          <AppText weight="semibold" size={fontSizes.label} color={colors.textMuted}>
            Fotografía el documento y rellenamos los datos
          </AppText>
        </Pressable>

        <Pressable style={styles.option} onPress={onManual}>
          <AppText weight="bold" size={fontSizes.body}>
            Escribirlo a mano
          </AppText>
          <AppText weight="semibold" size={fontSizes.label} color={colors.textMuted}>
            Introduce los datos tú mismo
          </AppText>
        </Pressable>

        <AppText weight="semibold" size={fontSizes.small} color={colors.textFaint} style={styles.footer}>
          Se lee en tu móvil. Nada se sube a internet.
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.screenBg,
    borderTopLeftRadius: radii.card,
    borderTopRightRadius: radii.card,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.textFaint,
    opacity: 0.4,
  },
  content: {
    flex: 1,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  option: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.card,
    padding: spacing.xl,
    gap: spacing.xs,
  },
  footer: {
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});

import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppText } from '../components/AppText';
import { colors, fontSizes, radii, spacing } from '../theme';

interface PrivacyScreenProps {
  onClose: () => void;
}

// DRAFT copy — must be reviewed by the product owner before publishing. Not legally final.
// Written to be faithful to how the app actually behaves today (fully on-device).
const PARAGRAPHS = [
  'Nopasa guarda toda tu información únicamente en este dispositivo.',
  'No usamos servidores ni copias en la nube: tus vencimientos no salen de tu móvil.',
  'No recogemos ni enviamos datos personales ni de uso, ni a nosotros ni a terceros.',
  'Los avisos son notificaciones locales que programa tu propio dispositivo.',
  'Si borras la app o usas «Borrar todos los datos», esa información desaparece y no podemos recuperarla.',
];

/** Plain-language privacy policy. Draft — see the note above before publishing. */
export function PrivacyScreen({ onClose }: PrivacyScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <View style={[styles.handle, { marginTop: insets.top + spacing.sm }]} />
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={onClose} hitSlop={8}>
          <MaterialCommunityIcons name="close" size={26} color={colors.textSecondary} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: spacing.xxxl + insets.bottom }]}>
        <AppText weight="extrabold" size={fontSizes.title}>
          Política de privacidad
        </AppText>
        {PARAGRAPHS.map((text) => (
          <AppText key={text} weight="semibold" size={fontSizes.body} color={colors.textMuted}>
            {text}
          </AppText>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.screenBg, borderTopLeftRadius: radii.card, borderTopRightRadius: radii.card },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: radii.pill, backgroundColor: colors.textFaint, opacity: 0.4 },
  header: { alignItems: 'flex-end', paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  content: { padding: spacing.xl, gap: spacing.lg },
});

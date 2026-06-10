import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fontSizes, radii, spacing } from '../theme';
import { AppText } from './AppText';
import { Button } from './Button';

type EmptyStateVariant = 'first-use' | 'all-caught-up';

interface EmptyStateProps {
  variant: EmptyStateVariant;
  onAdd: () => void;
  onOpenSettings: () => void;
}

const COPY: Record<EmptyStateVariant, { headline: string; support: string; cta: string }> = {
  'first-use': {
    headline: 'Aquí no se te pasará nada',
    support:
      'Guarda tus documentos y fechas importantes —DNI, ITV, seguros, suscripciones— y te avisamos antes de que caduquen.',
    cta: 'Añadir mi primer vencimiento',
  },
  'all-caught-up': {
    headline: 'Todo en orden',
    support: 'No tienes vencimientos pendientes. Te avisaremos cuando se acerque alguno.',
    cta: 'Añadir un vencimiento',
  },
};

/**
 * Empty state with two data-driven variants:
 * - 'first-use': nothing stored yet (matches docs/design/Primer uso.png).
 * - 'all-caught-up': deadlines exist but none are active (all resolved/cancelled).
 * The home picks the variant from data; this component is presentational. Both keep the
 * settings gear so the user is never stranded with no way back to settings.
 */
export function EmptyState({ variant, onAdd, onOpenSettings }: EmptyStateProps) {
  const insets = useSafeAreaInsets();
  const copy = COPY[variant];
  const isFirstUse = variant === 'first-use';
  return (
    <View style={[styles.root, { paddingTop: spacing.xl + insets.top, paddingBottom: spacing.xl + insets.bottom }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ajustes"
        onPress={onOpenSettings}
        hitSlop={8}
        style={[styles.settingsButton, { top: insets.top + spacing.sm }]}
      >
        <MaterialCommunityIcons name="cog" size={26} color={colors.textSecondary} />
      </Pressable>
      <AppText weight="extrabold" size={fontSizes.body} color={colors.brandBlue} style={styles.wordmark}>
        nopasa
      </AppText>

      <View style={styles.center}>
        {isFirstUse ? (
          <View style={styles.illustration}>
            <View style={styles.iconCircle}>
              <MaterialCommunityIcons name="calendar-blank" size={48} color={colors.brandBlue} />
            </View>
            <View style={[styles.badge, styles.badgeCheck]}>
              <MaterialCommunityIcons name="check" size={16} color={colors.white} />
            </View>
            <View style={[styles.badge, styles.badgeDoc]}>
              <MaterialCommunityIcons name="file-document-outline" size={18} color={colors.urgency.upcoming.base} />
            </View>
            <View style={[styles.badge, styles.badgeShield]}>
              <MaterialCommunityIcons name="shield-check" size={18} color={colors.urgency.urgent.base} />
            </View>
          </View>
        ) : (
          <View style={styles.illustration}>
            <View style={styles.iconCircle}>
              <MaterialCommunityIcons name="calendar-check" size={48} color={colors.urgency.calm.base} />
            </View>
          </View>
        )}

        <AppText weight="black" size={fontSizes.h1} style={styles.headline}>
          {copy.headline}
        </AppText>
        <AppText weight="semibold" size={fontSizes.body} color={colors.textMuted} style={styles.support}>
          {copy.support}
        </AppText>
      </View>

      <View style={styles.footer}>
        <Button label={copy.cta} icon="plus" onPress={onAdd} />
        {isFirstUse ? (
          <View style={styles.privacy}>
            <MaterialCommunityIcons name="lock-outline" size={14} color={colors.urgency.calm.base} />
            <AppText weight="semibold" size={fontSizes.small} color={colors.urgency.calm.base}>
              Se lee en tu móvil. Nada se sube a internet.
            </AppText>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.screenBg, padding: spacing.xl },
  wordmark: { textAlign: 'center', letterSpacing: 0.5, marginTop: spacing.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  illustration: { width: 160, height: 160, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  iconCircle: {
    width: 120, height: 120, borderRadius: radii.pill,
    backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center',
  },
  badge: { position: 'absolute', alignItems: 'center', justifyContent: 'center', borderRadius: radii.icon },
  badgeCheck: { width: 28, height: 28, borderRadius: radii.pill, backgroundColor: colors.urgency.calm.base, top: 22, right: 28 },
  badgeDoc: { width: 40, height: 40, backgroundColor: colors.urgency.upcoming.tintBg, top: 14, left: 16 },
  badgeShield: { width: 40, height: 40, backgroundColor: colors.urgency.urgent.tintBg, bottom: 22, right: 12 },
  headline: { textAlign: 'center' },
  support: { textAlign: 'center', lineHeight: 24, paddingHorizontal: spacing.lg },
  footer: { gap: spacing.md },
  privacy: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  settingsButton: { position: 'absolute', right: spacing.xl, zIndex: 1 },
});

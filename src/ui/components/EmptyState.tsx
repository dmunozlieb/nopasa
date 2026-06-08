import { StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fontSizes, radii, spacing } from '../theme';
import { AppText } from './AppText';
import { Button } from './Button';

interface EmptyStateProps {
  onAdd: () => void;
}

/**
 * First-use empty state (docs/design/Primer uso.png).
 * NOTE (future session): copy assumes first use; it also shows when all deadlines
 * are resolved. Distinguishing "first use" from "all caught up" is out of scope now.
 */
export function EmptyState({ onAdd }: EmptyStateProps) {
  return (
    <View style={styles.root}>
      <AppText weight="extrabold" size={fontSizes.body} color={colors.brandBlue} style={styles.wordmark}>
        nopasa
      </AppText>

      <View style={styles.center}>
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

        <AppText weight="black" size={fontSizes.h1} style={styles.headline}>
          Aquí no se te pasará nada
        </AppText>
        <AppText weight="semibold" size={fontSizes.body} color={colors.textMuted} style={styles.support}>
          Guarda tus documentos y fechas importantes —DNI, ITV, seguros, suscripciones— y te avisamos antes de que caduquen.
        </AppText>
      </View>

      <View style={styles.footer}>
        <Button label="Añadir mi primer vencimiento" icon="plus" onPress={onAdd} />
        <View style={styles.privacy}>
          <MaterialCommunityIcons name="lock-outline" size={14} color={colors.urgency.calm.base} />
          <AppText weight="semibold" size={fontSizes.small} color={colors.urgency.calm.base}>
            Se lee en tu móvil. Nada se sube a internet.
          </AppText>
        </View>
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
});

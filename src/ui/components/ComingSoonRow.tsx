import { StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { colors, fontSizes, radii, spacing } from '../theme';

interface ComingSoonRowProps {
  label: string;
  subtitle?: string;
}

/** A visible but inert settings row: names a future feature without faking a control. */
export function ComingSoonRow({ label, subtitle }: ComingSoonRowProps) {
  return (
    <View style={styles.root}>
      <View style={styles.body}>
        <AppText weight="bold" size={fontSizes.body} color={colors.textSecondary}>
          {label}
        </AppText>
        {subtitle ? (
          <AppText weight="semibold" size={fontSizes.small} color={colors.textFaint}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      <View style={styles.badge}>
        <AppText weight="bold" size={fontSizes.small} color={colors.textFaint}>
          Próximamente
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  body: { flex: 1, gap: 2 },
  badge: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: radii.pill, backgroundColor: colors.surfaceSoft },
});

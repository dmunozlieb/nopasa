import { StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { colors, fontSizes, radii, spacing } from '../theme';

interface ComingSoonRowProps {
  label: string;
}

/** A visible but inert settings row: names a future feature without faking a control. */
export function ComingSoonRow({ label }: ComingSoonRowProps) {
  return (
    <View style={styles.root}>
      <AppText weight="bold" size={fontSizes.body} color={colors.textSecondary}>
        {label}
      </AppText>
      <View style={styles.badge}>
        <AppText weight="bold" size={fontSizes.small} color={colors.textFaint}>
          Próximamente
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md },
  badge: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: radii.pill, backgroundColor: colors.surfaceSoft },
});

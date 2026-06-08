import { StyleSheet, View } from 'react-native';
import { colors, fontSizes, radii, spacing } from '../theme';
import { AppText } from './AppText';

interface SectionHeaderProps {
  label: string;
  count: number;
  dotColor: string;
}

/** Uppercase section label with a colored dot and a count badge. */
export function SectionHeader({ label, count, dotColor }: SectionHeaderProps) {
  return (
    <View style={styles.root}>
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <AppText weight="extrabold" size={fontSizes.label} color={colors.textSecondary} style={styles.label}>
        {label.toUpperCase()}
      </AppText>
      <View style={styles.badge}>
        <AppText weight="bold" size={fontSizes.small} color={colors.textSecondary}>
          {count}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  dot: { width: 8, height: 8, borderRadius: radii.pill },
  label: { letterSpacing: 1.5 },
  badge: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
});

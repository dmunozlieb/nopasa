import { StyleSheet, View } from 'react-native';
import { fontSizes, radii, spacing } from '../theme';
import type { UrgencyColorSet } from '../deadline/urgency-colors';
import { AppText } from './AppText';

interface PillProps {
  label: string;
  urgency: UrgencyColorSet;
}

/** Rounded urgency chip: tinted background, colored dot + text. */
export function Pill({ label, urgency }: PillProps) {
  return (
    <View style={[styles.root, { backgroundColor: urgency.tintBg }]}>
      <View style={[styles.dot, { backgroundColor: urgency.base }]} />
      <AppText weight="bold" size={fontSizes.pill} color={urgency.base}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  dot: { width: 7, height: 7, borderRadius: radii.pill },
});

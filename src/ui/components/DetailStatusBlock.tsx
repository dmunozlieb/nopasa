import { StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { UrgencyColorSet } from '../deadline/urgency-colors';
import { fontSizes, radii, spacing } from '../theme';
import { AppText } from './AppText';

interface DetailStatusBlockProps {
  urgency: UrgencyColorSet;
  headline: string;
  date: string;
  consequence: string;
}

/** Urgency-tinted status block: big headline + date + divider + calm consequence. */
export function DetailStatusBlock({ urgency, headline, date, consequence }: DetailStatusBlockProps) {
  return (
    <View style={[styles.root, { backgroundColor: urgency.tintBg }]}>
      <AppText weight="black" size={28} color={urgency.base}>
        {headline}
      </AppText>
      <AppText weight="bold" size={fontSizes.label} color={urgency.base} style={styles.date}>
        {date}
      </AppText>
      <View style={[styles.divider, { backgroundColor: urgency.base }]} />
      <View style={styles.consequenceRow}>
        <MaterialCommunityIcons name="information-outline" size={18} color={urgency.base} />
        <AppText weight="semibold" size={fontSizes.label} color={urgency.base} style={styles.consequence}>
          {consequence}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { borderRadius: radii.card, padding: spacing.lg },
  date: { opacity: 0.9, marginTop: 2 },
  divider: { height: StyleSheet.hairlineWidth, opacity: 0.3, marginVertical: spacing.md },
  consequenceRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  consequence: { flex: 1, lineHeight: 20 },
});

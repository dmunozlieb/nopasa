import { StyleSheet } from 'react-native';
import { AppText } from './AppText';
import { colors, fontSizes, spacing } from '../theme';

interface SettingsSectionLabelProps {
  label: string;
}

/** Uppercase settings section label (no dot/count, unlike the Home SectionHeader). */
export function SettingsSectionLabel({ label }: SettingsSectionLabelProps) {
  return (
    <AppText weight="extrabold" size={fontSizes.label} color={colors.textSecondary} style={styles.label}>
      {label.toUpperCase()}
    </AppText>
  );
}

const styles = StyleSheet.create({
  label: { letterSpacing: 1.5, marginTop: spacing.sm },
});

import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { colors, fontSizes, spacing } from '../theme';

interface FormFieldProps {
  label: string;
  /** Optional error/help line shown under the control, in the urgent color. */
  hint?: string;
  children: ReactNode;
}

/** Label + control + optional hint row. Layout only; holds no state. */
export function FormField({ label, hint, children }: FormFieldProps) {
  return (
    <View style={styles.root}>
      <AppText weight="bold" size={fontSizes.label} color={colors.textSecondary}>
        {label}
      </AppText>
      {children}
      {hint ? (
        <AppText weight="semibold" size={fontSizes.small} color={colors.urgency.urgent.base}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
});

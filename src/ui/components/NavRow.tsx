import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppText } from './AppText';
import { colors, fontSizes, spacing } from '../theme';

interface NavRowProps {
  label: string;
  subtitle?: string;
  icon?: ComponentProps<typeof MaterialCommunityIcons>['name'];
  /** Paints the label and icon in the urgent (red) color. */
  destructive?: boolean;
  onPress: () => void;
}

/** Tappable settings row: optional leading icon, label, optional subtitle, trailing chevron. */
export function NavRow({ label, subtitle, icon, destructive, onPress }: NavRowProps) {
  const labelColor = destructive ? colors.urgency.urgent.base : colors.text;
  const iconColor = destructive ? colors.urgency.urgent.base : colors.textSecondary;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.root}>
      {icon ? <MaterialCommunityIcons name={icon} size={22} color={iconColor} /> : null}
      <View style={styles.body}>
        <AppText weight="bold" size={fontSizes.body} color={labelColor}>
          {label}
        </AppText>
        {subtitle ? (
          <AppText weight="semibold" size={fontSizes.small} color={colors.textMuted}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  body: { flex: 1, gap: 2 },
});

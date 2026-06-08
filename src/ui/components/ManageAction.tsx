import { Pressable, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fontSizes, spacing } from '../theme';
import { AppText } from './AppText';

interface ManageActionProps {
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  onPress: () => void;
}

/** Low-emphasis management action (icon + muted label). */
export function ManageAction({ label, icon, onPress }: ManageActionProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.root, pressed && styles.pressed]}
    >
      <MaterialCommunityIcons name={icon} size={18} color={colors.textMuted} />
      <AppText weight="bold" size={fontSizes.label} color={colors.textMuted} style={styles.label}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  pressed: { opacity: 0.6 },
  label: { flexShrink: 1 },
});

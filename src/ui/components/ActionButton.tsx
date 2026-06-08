import { Pressable, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fontSizes, radii, spacing } from '../theme';
import { AppText } from './AppText';

interface ActionButtonProps {
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
}

/** "Qué puedes hacer" row: leading icon + label + trailing chevron. */
export function ActionButton({ label, icon, onPress, variant = 'primary' }: ActionButtonProps) {
  const isPrimary = variant === 'primary';
  const fg = isPrimary ? colors.white : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.root, isPrimary ? styles.primary : styles.secondary, pressed && styles.pressed]}
    >
      <MaterialCommunityIcons name={icon} size={20} color={fg} />
      <AppText weight="extrabold" size={fontSizes.body} color={fg} style={styles.label}>
        {label}
      </AppText>
      <MaterialCommunityIcons name="chevron-right" size={22} color={fg} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radii.button,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  primary: { backgroundColor: colors.brandBlue },
  secondary: {
    backgroundColor: colors.cardBg,
    shadowColor: '#2C2A26',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  pressed: { opacity: 0.9 },
  label: { flex: 1 },
});

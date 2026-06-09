import { Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fontSizes, radii, spacing } from '../theme';
import { AppText } from './AppText';

interface ButtonProps {
  label: string;
  onPress: () => void;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  disabled?: boolean;
}

/** Primary full-width blue CTA. Dimmed and inert when disabled. */
export function Button({ label, onPress, icon, disabled = false }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.root, disabled && styles.disabled, pressed && styles.pressed]}
    >
      <View style={styles.content}>
        {icon ? <MaterialCommunityIcons name={icon} size={20} color={colors.white} /> : null}
        <AppText weight="extrabold" size={fontSizes.body} color={colors.white}>
          {label}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.brandBlue,
    borderRadius: radii.button,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.85 },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
});

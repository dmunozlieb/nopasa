import { Pressable, StyleSheet, View, type ViewProps } from 'react-native';
import { colors, radii, spacing } from '../theme';

interface CardProps extends ViewProps {
  onPress?: () => void;
}

/** White rounded surface with a soft shadow. Pressable when onPress is given. */
export function Card({ onPress, style, children, ...rest }: CardProps) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.root, pressed && styles.pressed, style]}>
        {children}
      </Pressable>
    );
  }
  return (
    <View style={[styles.root, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.card,
    padding: spacing.lg,
    shadowColor: '#2C2A26',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  pressed: { opacity: 0.96 },
});

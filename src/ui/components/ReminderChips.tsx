import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { colors, fontSizes, radii, spacing } from '../theme';

const OPTIONS = [30, 7, 1] as const;

interface ReminderChipsProps {
  value: number[];
  onChange: (days: number[]) => void;
}

/** Multi-select chips for reminder lead days. Preserves the incoming order; the
 *  domain input is sorted later by toCreateInput. */
export function ReminderChips({ value, onChange }: ReminderChipsProps) {
  const toggle = (day: number) =>
    onChange(value.includes(day) ? value.filter((d) => d !== day) : [...value, day]);

  return (
    <View style={styles.row}>
      {OPTIONS.map((day) => {
        const selected = value.includes(day);
        return (
          <Pressable
            key={day}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => toggle(day)}
            style={[styles.chip, selected && styles.chipSelected]}
          >
            <AppText weight="bold" size={fontSizes.label} color={selected ? colors.white : colors.textSecondary}>
              {day} {day === 1 ? 'día' : 'días'}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceSoft,
  },
  chipSelected: { backgroundColor: colors.brandBlue },
});

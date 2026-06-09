import { Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DeadlineType, type DeadlineType as DeadlineTypeValue } from '../../domain/deadline/deadline.schema';
import { typeIcon } from '../deadline/type-icons';
import { typeLabel } from '../deadline/type-labels';
import { AppText } from './AppText';
import { colors, fontSizes, radii, spacing } from '../theme';

interface TypeSelectorProps {
  value: DeadlineTypeValue;
  onChange: (type: DeadlineTypeValue) => void;
}

/** Wrapping grid (3 per row) of icon+label chips; the active chip is brandBlue. */
export function TypeSelector({ value, onChange }: TypeSelectorProps) {
  return (
    <View style={styles.grid}>
      {DeadlineType.options.map((type) => {
        const selected = type === value;
        const tint = selected ? colors.white : colors.textSecondary;
        return (
          <Pressable
            key={type}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(type)}
            style={[styles.chip, selected && styles.chipSelected]}
          >
            <MaterialCommunityIcons name={typeIcon(type)} size={20} color={tint} />
            <AppText weight="bold" size={fontSizes.small} color={tint}>
              {typeLabel(type)}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    width: '31%',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radii.button,
    backgroundColor: colors.surfaceSoft,
  },
  chipSelected: { backgroundColor: colors.brandBlue },
});

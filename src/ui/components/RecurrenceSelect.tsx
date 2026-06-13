import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { parseRecurrenceMonths } from '../deadline/add-form';
import { AppText } from './AppText';
import { colors, fontSizes, radii, spacing } from '../theme';

interface RecurrenceSelectProps {
  value: number | undefined;
  onChange: (months: number | undefined) => void;
}

interface Preset {
  label: string;
  months: number | undefined;
}

const PRESETS: Preset[] = [
  { label: 'No se repite', months: undefined },
  { label: 'Cada mes', months: 1 },
  { label: 'Cada año', months: 12 },
  { label: 'Cada 2 años', months: 24 },
];

/** Derived from PRESETS so a new preset can't silently drift from this list. */
const PRESET_MONTHS = PRESETS.map((p) => p.months).filter((m): m is number => m !== undefined);

/** Friendly recurrence presets plus a custom "N months" escape hatch. The active
 *  chip is derived from `value`; a local `custom` flag distinguishes "Personalizado
 *  with empty/invalid input" (months undefined, custom on) from "No se repite". */
export function RecurrenceSelect({ value, onChange }: RecurrenceSelectProps) {
  const valueIsCustom = value !== undefined && !PRESET_MONTHS.includes(value);
  const [custom, setCustom] = useState(valueIsCustom);
  const [customText, setCustomText] = useState(valueIsCustom ? String(value) : '');

  const customSelected = custom || valueIsCustom;

  const selectPreset = (preset: Preset) => {
    setCustom(false);
    onChange(preset.months);
  };

  const selectCustom = () => {
    setCustom(true);
    onChange(parseRecurrenceMonths(customText));
  };

  const onChangeCustom = (text: string) => {
    setCustomText(text);
    onChange(parseRecurrenceMonths(text));
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        {PRESETS.map((preset) => {
          const selected = !customSelected && value === preset.months;
          return (
            <Pressable
              key={preset.label}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => selectPreset(preset)}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <AppText weight="bold" size={fontSizes.label} color={selected ? colors.white : colors.textSecondary}>
                {preset.label}
              </AppText>
            </Pressable>
          );
        })}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: customSelected }}
          onPress={selectCustom}
          style={[styles.chip, customSelected && styles.chipSelected]}
        >
          <AppText weight="bold" size={fontSizes.label} color={customSelected ? colors.white : colors.textSecondary}>
            Personalizado
          </AppText>
        </Pressable>
      </View>
      {customSelected ? (
        <TextInput
          testID="recurrence-custom-input"
          placeholder="Cada cuántos meses"
          placeholderTextColor={colors.textFaint}
          value={customText}
          onChangeText={onChangeCustom}
          keyboardType="number-pad"
          style={styles.input}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceSoft,
  },
  chipSelected: { backgroundColor: colors.brandBlue },
  input: {
    fontFamily: 'Nunito_700Bold',
    fontSize: fontSizes.body,
    color: colors.text,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.button,
    backgroundColor: colors.surfaceSoft,
  },
});

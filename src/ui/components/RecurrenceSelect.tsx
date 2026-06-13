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
  { label: 'Cada 5 años', months: 60 },
  { label: 'Cada 10 años', months: 120 },
];

/** Derived from PRESETS so a new preset can't silently drift from this list. */
const PRESET_MONTHS = PRESETS.map((p) => p.months).filter((m): m is number => m !== undefined);

type Unit = 'months' | 'years';

/** Friendly recurrence presets plus a custom "N" escape hatch with a months/years unit
 *  toggle (default years — the reason to go custom). The active chip is derived from
 *  `value`; a local `custom` flag distinguishes "Personalizado with empty/invalid input"
 *  (months undefined, custom on) from "No se repite". Custom always stores months. */
export function RecurrenceSelect({ value, onChange }: RecurrenceSelectProps) {
  const valueIsCustom = value !== undefined && !PRESET_MONTHS.includes(value);
  const inferredUnit: Unit = valueIsCustom && value! % 12 === 0 ? 'years' : 'months';
  const [custom, setCustom] = useState(valueIsCustom);
  const [unit, setUnit] = useState<Unit>(valueIsCustom ? inferredUnit : 'years');
  const [customText, setCustomText] = useState(
    valueIsCustom ? String(inferredUnit === 'years' ? value! / 12 : value) : '',
  );

  const customSelected = custom || valueIsCustom;

  const selectPreset = (preset: Preset) => {
    if (custom) setCustom(false);
    onChange(preset.months);
  };

  const selectCustom = () => {
    setCustom(true);
    onChange(parseRecurrenceMonths(customText, unit));
  };

  const onChangeCustom = (text: string) => {
    setCustomText(text);
    onChange(parseRecurrenceMonths(text, unit));
  };

  const selectUnit = (next: Unit) => {
    setUnit(next);
    onChange(parseRecurrenceMonths(customText, next));
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
        <View style={styles.customRow}>
          <TextInput
            testID="recurrence-custom-input"
            placeholder="Cada cuántos"
            placeholderTextColor={colors.textFaint}
            value={customText}
            onChangeText={onChangeCustom}
            keyboardType="number-pad"
            style={styles.input}
          />
          <View style={styles.unitRow}>
            {(['months', 'years'] as Unit[]).map((u) => {
              const selected = unit === u;
              return (
                <Pressable
                  key={u}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => selectUnit(u)}
                  style={[styles.unitChip, selected && styles.chipSelected]}
                >
                  <AppText weight="bold" size={fontSizes.label} color={selected ? colors.white : colors.textSecondary}>
                    {u === 'months' ? 'meses' : 'años'}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radii.pill, backgroundColor: colors.surfaceSoft },
  chipSelected: { backgroundColor: colors.brandBlue },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  input: {
    flex: 1,
    fontFamily: 'Nunito_700Bold',
    fontSize: fontSizes.body,
    color: colors.text,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.button,
    backgroundColor: colors.surfaceSoft,
  },
  unitRow: { flexDirection: 'row', gap: spacing.sm },
  unitChip: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radii.pill, backgroundColor: colors.surfaceSoft },
});

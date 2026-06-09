import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { AppText } from './AppText';
import { colors, fontSizes, radii, spacing } from '../theme';

interface Time {
  hour: number;
  minute: number;
}

interface TimePickerFieldProps {
  value: Time;
  onChange: (time: Time) => void;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Tappable field that opens the native time picker (mode "time"). Reports only
 *  confirmed selections; dismissals leave the value unchanged. */
export function TimePickerField({ value, onChange }: TimePickerFieldProps) {
  const [open, setOpen] = useState(false);

  const handleChange = (event: DateTimePickerEvent, selected?: Date) => {
    setOpen(false);
    if (event.type === 'set' && selected) {
      onChange({ hour: selected.getHours(), minute: selected.getMinutes() });
    }
  };

  const pickerValue = new Date();
  pickerValue.setHours(value.hour, value.minute, 0, 0);

  return (
    <>
      <Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={styles.field}>
        <MaterialCommunityIcons name="clock-outline" size={18} color={colors.textSecondary} />
        <AppText weight="bold" size={fontSizes.body}>{`${pad(value.hour)}:${pad(value.minute)}`}</AppText>
      </Pressable>
      {open ? <DateTimePicker value={pickerValue} mode="time" onChange={handleChange} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.button,
    backgroundColor: colors.surfaceSoft,
  },
});

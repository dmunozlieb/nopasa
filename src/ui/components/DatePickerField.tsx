import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { formatDate } from '../deadline/format-date';
import { AppText } from './AppText';
import { colors, fontSizes, radii, spacing } from '../theme';

interface DatePickerFieldProps {
  value: Date;
  onChange: (date: Date) => void;
}

/** Tappable field that opens the native date picker (mode "date"). Reports only
 *  confirmed selections; dismissals leave the value unchanged. */
export function DatePickerField({ value, onChange }: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);

  const handleChange = (event: DateTimePickerEvent, selected?: Date) => {
    setOpen(false);
    if (event.type === 'set' && selected) onChange(selected);
  };

  return (
    <>
      <Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={styles.field}>
        <MaterialCommunityIcons name="calendar" size={18} color={colors.textSecondary} />
        <AppText weight="bold" size={fontSizes.body}>
          {formatDate(value)}
        </AppText>
      </Pressable>
      {open ? <DateTimePicker value={value} mode="date" onChange={handleChange} /> : null}
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

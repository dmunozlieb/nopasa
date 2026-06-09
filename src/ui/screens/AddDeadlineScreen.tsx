import { useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { DeadlineType } from '../../domain/deadline/deadline.schema';
import { startOfDay } from '../../domain/shared/date';
import { defaultSubtitle } from '../deadline/default-subtitle';
import { syncSubtitle } from '../deadline/subtitle-sync';
import { toCreateInput, validateAddForm, type AddFormState } from '../deadline/add-form';
import { useCreateDeadline } from '../hooks/use-create-deadline';
import { useDeadlineDeps } from '../deadline-deps/deadline-deps-context';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { DatePickerField } from '../components/DatePickerField';
import { FormField } from '../components/FormField';
import { ReminderChips } from '../components/ReminderChips';
import { TypeSelector } from '../components/TypeSelector';
import { colors, fontSizes, radii, spacing } from '../theme';

interface AddDeadlineScreenProps {
  onClose: () => void;
}

/** Manual add-a-deadline form. Builds a Deadline via the factory and persists it. */
export function AddDeadlineScreen({ onClose }: AddDeadlineScreenProps) {
  const deps = useDeadlineDeps();
  const createDeadline = useCreateDeadline();
  const insets = useSafeAreaInsets();

  const [state, setState] = useState<AddFormState>(() => ({
    type: 'OTHER',
    title: '',
    subtitle: defaultSubtitle('OTHER'),
    subtitleTouched: false,
    dueDate: startOfDay(deps.clock.now()),
    amount: '',
    reminderDaysBefore: [30, 7],
  }));
  const [titleTouched, setTitleTouched] = useState(false);
  // Re-entry guard kept in a ref so pressing twice can't double-save, without a
  // state update inside the async handler (which would defer a re-render and
  // collide with the test renderer's act scope).
  const submitting = useRef(false);

  const { valid, errors } = validateAddForm(state);
  const titleHint = titleTouched ? errors.title : undefined;

  const onChangeType = (type: DeadlineType) =>
    setState((s) => ({ ...s, type, subtitle: syncSubtitle({ type, current: s.subtitle, touched: s.subtitleTouched }) }));

  const onChangeTitle = (title: string) => {
    setTitleTouched(true);
    setState((s) => ({ ...s, title }));
  };

  const onChangeSubtitle = (subtitle: string) =>
    setState((s) => ({ ...s, subtitle, subtitleTouched: true }));

  const onSave = async () => {
    if (!valid || submitting.current) return;
    submitting.current = true;
    try {
      await createDeadline(toCreateInput(state));
      onClose();
    } catch {
      submitting.current = false;
      Alert.alert('No se pudo guardar', 'Inténtalo de nuevo.');
    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.handle, { marginTop: insets.top + spacing.sm }]} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: spacing.xxxl + insets.bottom }]}>
        <AppText weight="extrabold" size={fontSizes.title}>
          Añadir un vencimiento
        </AppText>

        <FormField label="Tipo">
          <TypeSelector value={state.type} onChange={onChangeType} />
        </FormField>

        <FormField label="Título" hint={titleHint}>
          <TextInput
            placeholder="Ej. ITV del coche"
            placeholderTextColor={colors.textFaint}
            value={state.title}
            onChangeText={onChangeTitle}
            style={styles.input}
          />
        </FormField>

        <FormField label="Subtítulo">
          <TextInput
            placeholder={defaultSubtitle(state.type)}
            placeholderTextColor={colors.textFaint}
            value={state.subtitle}
            onChangeText={onChangeSubtitle}
            style={styles.input}
          />
        </FormField>

        <FormField label="Fecha clave">
          <DatePickerField value={state.dueDate} onChange={(dueDate) => setState((s) => ({ ...s, dueDate }))} />
        </FormField>

        <FormField label="Importe (€)">
          <TextInput
            placeholder="0,00"
            placeholderTextColor={colors.textFaint}
            value={state.amount}
            onChangeText={(amount) => setState((s) => ({ ...s, amount }))}
            keyboardType="decimal-pad"
            style={styles.input}
          />
        </FormField>

        <FormField label="Avisarme">
          <ReminderChips
            value={state.reminderDaysBefore}
            onChange={(reminderDaysBefore) => setState((s) => ({ ...s, reminderDaysBefore }))}
          />
        </FormField>

        <Button label="Guardar" onPress={onSave} disabled={!valid} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.screenBg, borderTopLeftRadius: radii.card, borderTopRightRadius: radii.card },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: radii.pill, backgroundColor: colors.textFaint, opacity: 0.4 },
  content: { padding: spacing.xl, gap: spacing.lg },
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

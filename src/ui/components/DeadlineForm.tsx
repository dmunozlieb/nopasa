import { useRef, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { DeadlineType } from '../../domain/deadline/deadline.schema';
import { startOfDay } from '../../domain/shared/date';
import { defaultSubtitle } from '../deadline/default-subtitle';
import { syncSubtitle } from '../deadline/subtitle-sync';
import { toCreateInput, validateAddForm, type AddFormState } from '../deadline/add-form';
import { useCreateDeadline } from '../hooks/use-create-deadline';
import { useDeadlineDeps } from '../deadline-deps/deadline-deps-context';
import { useSettings } from '../settings/settings-context';
import { remindersAllInPast } from '../notification/reminder-fire-times';
import { usePhotoStore } from '../photo-store/photo-store-context';
import { AppText } from './AppText';
import { Button } from './Button';
import { DatePickerField } from './DatePickerField';
import { FormField } from './FormField';
import { RecurrenceSelect } from './RecurrenceSelect';
import { ReminderChips } from './ReminderChips';
import { TypeSelector } from './TypeSelector';
import { colors, fontSizes, radii, spacing } from '../theme';

interface DeadlineFormProps {
  heading: string;
  photoUri?: string;
  initialValues?: Partial<AddFormState>;
  onClose: () => void;
}

/** Shared deadline form used by AddDeadlineScreen and the photo-confirm flow. */
export function DeadlineForm({ heading, photoUri, initialValues, onClose }: DeadlineFormProps) {
  const deps = useDeadlineDeps();
  const { settings } = useSettings();
  const createDeadline = useCreateDeadline();
  const insets = useSafeAreaInsets();
  const photoStore = usePhotoStore();

  const [state, setState] = useState<AddFormState>(() => ({
    type: 'OTHER',
    title: '',
    subtitle: defaultSubtitle('OTHER'),
    subtitleTouched: false,
    dueDate: startOfDay(deps.clock.now()),
    amount: '',
    reminderDaysBefore: settings.defaultReminderDaysBefore,
    ...initialValues,
  }));
  const [titleTouched, setTitleTouched] = useState(false);
  // Re-entry guard kept in a ref so pressing twice can't double-save, without a
  // state update inside the async handler (which would defer a re-render and
  // collide with the test renderer's act scope).
  const submitting = useRef(false);

  const { valid, errors } = validateAddForm(state);
  const titleHint = titleTouched ? errors.title : undefined;
  const showPastHint = remindersAllInPast(
    state.dueDate,
    state.reminderDaysBefore,
    deps.clock.now(),
    settings.reminderTime,
  );

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
      const stableUri = photoUri ? await photoStore.persist(photoUri) : undefined;
      await createDeadline(toCreateInput(state, stableUri));
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
          {heading}
        </AppText>

        {photoUri ? (
          <Image testID="deadline-photo-thumbnail" source={{ uri: photoUri }} style={styles.thumbnail} resizeMode="cover" />
        ) : null}

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

        <FormField label="¿Se repite?">
          <RecurrenceSelect
            value={state.recurrenceMonths}
            onChange={(recurrenceMonths) => setState((s) => ({ ...s, recurrenceMonths }))}
          />
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

        {showPastHint ? (
          <View style={styles.pastHint}>
            <MaterialCommunityIcons name="clock-alert-outline" size={16} color={colors.urgency.upcoming.base} />
            <AppText weight="semibold" size={fontSizes.small} color={colors.urgency.upcoming.base} style={styles.pastHintText}>
              Para esta fecha, tus avisos ya han pasado. Puedes guardarlo igualmente o acercar la fecha.
            </AppText>
          </View>
        ) : null}

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
  pastHint: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  pastHintText: { flex: 1 },
  thumbnail: { width: '100%', height: 180, borderRadius: radii.card, backgroundColor: colors.surfaceSoft },
});

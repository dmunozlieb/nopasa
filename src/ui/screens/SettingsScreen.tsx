import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ReminderTime } from '../notification/reminder-time';
import { useSettings } from '../settings/settings-context';
import { useDeadlineRepository } from '../repository/repository-context';
import { useNotificationScheduler } from '../notification-scheduler/notification-scheduler-context';
import { AppText } from '../components/AppText';
import { ComingSoonRow } from '../components/ComingSoonRow';
import { FormField } from '../components/FormField';
import { ReminderChips } from '../components/ReminderChips';
import { TimePickerField } from '../components/TimePickerField';
import { colors, fontSizes, radii, spacing } from '../theme';

interface SettingsScreenProps {
  onClose: () => void;
}

/** Settings screen. Real preferences are persisted; "Próximamente" rows are inert. */
export function SettingsScreen({ onClose }: SettingsScreenProps) {
  const { settings, save } = useSettings();
  const repository = useDeadlineRepository();
  const scheduler = useNotificationScheduler();
  const insets = useSafeAreaInsets();

  const persist = async (next: Parameters<typeof save>[0]) => {
    try {
      await save(next);
    } catch {
      Alert.alert('No se pudo guardar', 'Inténtalo de nuevo.');
    }
  };

  const onChangeTime = (reminderTime: ReminderTime) => persist({ ...settings, reminderTime });
  const onChangeReminders = (defaultReminderDaysBefore: number[]) =>
    persist({ ...settings, defaultReminderDaysBefore });

  const deleteAllData = async () => {
    const all = await repository.list();
    for (const deadline of all) {
      try {
        await scheduler.cancel(deadline.id);
      } catch {
        // best-effort
      }
      await repository.delete(deadline.id);
    }
    onClose();
  };

  const confirmDelete = () =>
    Alert.alert(
      'Borrar todos los datos',
      'Se borrarán todos tus vencimientos de este dispositivo. Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Borrar', style: 'destructive', onPress: () => { void deleteAllData(); } },
      ],
    );

  const version = Constants.expoConfig?.version ?? '—';

  return (
    <View style={styles.root}>
      <View style={[styles.handle, { marginTop: insets.top + spacing.sm }]} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: spacing.xxxl + insets.bottom }]}>
        <AppText weight="extrabold" size={fontSizes.title}>
          Ajustes
        </AppText>

        <FormField label="Hora del aviso">
          <TimePickerField value={settings.reminderTime} onChange={onChangeTime} />
        </FormField>

        <FormField label="Avisarme por defecto">
          <ReminderChips value={settings.defaultReminderDaysBefore} onChange={onChangeReminders} />
        </FormField>

        <FormField label="Privacidad">
          <AppText weight="semibold" size={fontSizes.label} color={colors.textMuted}>
            Tus datos se guardan solo en este dispositivo. No hay servidores ni copias en la nube.
          </AppText>
        </FormField>

        <Pressable accessibilityRole="button" onPress={confirmDelete} style={styles.delete}>
          <MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.urgency.urgent.base} />
          <AppText weight="bold" size={fontSizes.body} color={colors.urgency.urgent.base}>
            Borrar todos los datos
          </AppText>
        </Pressable>

        <View style={styles.comingSoon}>
          <ComingSoonRow label="Resumen semanal" />
          <ComingSoonRow label="Tema claro / oscuro" />
          <ComingSoonRow label="Premium" />
        </View>

        <AppText weight="semibold" size={fontSizes.small} color={colors.textFaint} style={styles.version}>
          Versión {version}
        </AppText>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.screenBg, borderTopLeftRadius: radii.card, borderTopRightRadius: radii.card },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: radii.pill, backgroundColor: colors.textFaint, opacity: 0.4 },
  content: { padding: spacing.xl, gap: spacing.lg },
  delete: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  comingSoon: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.textFaint, paddingTop: spacing.sm },
  version: { textAlign: 'center', marginTop: spacing.sm },
});

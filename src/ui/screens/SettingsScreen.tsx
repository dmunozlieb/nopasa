import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ReminderTime } from '../notification/reminder-time';
import { useSettings } from '../settings/settings-context';
import { useDeadlineRepository } from '../repository/repository-context';
import { useNotificationScheduler } from '../notification-scheduler/notification-scheduler-context';
import { useDeadlineDeps } from '../deadline-deps/deadline-deps-context';
import { useDataExporter } from '../export/data-exporter-context';
import { useDataImporter } from '../import/data-importer-context';
import { useMergeImportedDeadlines } from '../hooks/use-merge-imported-deadlines';
import { buildDeadlineExport } from '../../domain/export/build-deadline-export';
import { exportFilename } from '../../domain/export/export-filename';
import { parseDeadlineImport } from '../../domain/import/parse-deadline-import';
import { importErrorMessage, importResultMessage } from '../import/import-messages';
import { AppText } from '../components/AppText';
import { Card } from '../components/Card';
import { ComingSoonRow } from '../components/ComingSoonRow';
import { FormField } from '../components/FormField';
import { NavRow } from '../components/NavRow';
import { ReminderChips } from '../components/ReminderChips';
import { SettingsSectionLabel } from '../components/SettingsSectionLabel';
import { TimePickerField } from '../components/TimePickerField';
import { colors, fontSizes, radii, spacing } from '../theme';

interface SettingsScreenProps {
  onClose: () => void;
  onOpenPrivacy: () => void;
}

/** Settings screen. Real preferences are persisted; "Próximamente" rows are inert. */
export function SettingsScreen({ onClose, onOpenPrivacy }: SettingsScreenProps) {
  const { settings, save } = useSettings();
  const repository = useDeadlineRepository();
  const scheduler = useNotificationScheduler();
  const { clock } = useDeadlineDeps();
  const exporter = useDataExporter();
  const importer = useDataImporter();
  const mergeImported = useMergeImportedDeadlines();
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

  const exportData = async () => {
    const all = await repository.list();
    if (all.length === 0) {
      Alert.alert('No tienes vencimientos que exportar todavía');
      return;
    }
    const now = clock.now();
    try {
      await exporter.export(exportFilename(now), buildDeadlineExport(all, { exportedAt: now }));
    } catch {
      Alert.alert('No se pudo exportar', 'Inténtalo de nuevo.');
    }
  };

  const importData = async () => {
    let text: string | null;
    try {
      text = await importer.pickAndRead();
    } catch {
      Alert.alert('No se pudo importar', 'Inténtalo de nuevo.');
      return;
    }
    if (text === null) return; // cancelled, no-op
    const { deadlines, invalidCount, schemaError } = parseDeadlineImport(text);
    if (schemaError) {
      Alert.alert('No se pudo importar', importErrorMessage(schemaError));
      return;
    }
    if (deadlines.length === 0) {
      Alert.alert(
        'No se pudo importar',
        invalidCount > 0 ? 'No se pudo leer ningún vencimiento válido.' : 'El archivo no contiene vencimientos.',
      );
      return;
    }
    Alert.alert('Importar', `¿Importar ${deadlines.length} vencimientos?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Importar',
        onPress: () => {
          void (async () => {
            try {
              const { imported, alreadyExisted } = await mergeImported(deadlines);
              Alert.alert('Importación completada', importResultMessage({ imported, alreadyExisted, invalidCount }));
            } catch {
              Alert.alert('No se pudo importar', 'Inténtalo de nuevo.');
            }
          })();
        },
      },
    ]);
  };

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

        <SettingsSectionLabel label="Avisos" />
        <Card style={styles.card}>
          <FormField label="Avisarme por defecto">
            <AppText weight="semibold" size={fontSizes.small} color={colors.textMuted}>
              Se aplica a cada vencimiento nuevo. Podrás cambiarlo en cada uno.
            </AppText>
            <ReminderChips value={settings.defaultReminderDaysBefore} onChange={onChangeReminders} />
          </FormField>
          <View style={styles.divider} />
          <FormField label="Hora del aviso">
            <TimePickerField value={settings.reminderTime} onChange={onChangeTime} />
          </FormField>
          <View style={styles.divider} />
          <ComingSoonRow label="Resumen semanal" subtitle="Un repaso de lo que se acerca, cada lunes." />
        </Card>

        <SettingsSectionLabel label="Apariencia" />
        <Card style={styles.card}>
          <ComingSoonRow label="Tema" />
        </Card>

        <SettingsSectionLabel label="Privacidad y datos" />
        <Card style={styles.card}>
          <View style={styles.privacyNote}>
            <MaterialCommunityIcons name="lock-outline" size={18} color={colors.urgency.calm.base} />
            <AppText weight="semibold" size={fontSizes.label} color={colors.urgency.calm.base} style={styles.privacyNoteText}>
              Todos tus datos se guardan solo en este dispositivo.
            </AppText>
          </View>
          <View style={styles.divider} />
          <NavRow
            icon="tray-arrow-down"
            label="Exportar mis datos"
            subtitle="Guarda una copia en tu móvil."
            onPress={() => { void exportData(); }}
          />
          <View style={styles.divider} />
          <NavRow
            icon="tray-arrow-up"
            label="Importar mis datos"
            subtitle="Restaura una copia."
            onPress={() => { void importData(); }}
          />
          <View style={styles.divider} />
          <NavRow
            icon="trash-can-outline"
            label="Borrar todos los datos"
            subtitle="No se puede deshacer."
            destructive
            onPress={confirmDelete}
          />
        </Card>

        <Card style={styles.card}>
          <ComingSoonRow label="Nopasa Premium" subtitle="Copias de seguridad · ítems ilimitados." />
          <View style={styles.divider} />
          <NavRow icon="shield-lock-outline" label="Política de privacidad" onPress={onOpenPrivacy} />
        </Card>

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
  content: { padding: spacing.xl, gap: spacing.md },
  card: { gap: spacing.md },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.textFaint, opacity: 0.3 },
  privacyNote: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  privacyNoteText: { flex: 1 },
  version: { textAlign: 'center', marginTop: spacing.sm },
});

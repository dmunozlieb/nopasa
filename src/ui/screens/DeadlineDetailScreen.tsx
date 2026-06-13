import { useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { daysRemaining, urgencyLevel } from '../../domain/deadline/urgency';
import { detailPresentation } from '../deadline/detail-presentation';
import { formatAmountLine } from '../deadline/format-amount';
import { formatDate } from '../deadline/format-date';
import { statusHeadline } from '../deadline/status-headline';
import { typeIcon } from '../deadline/type-icons';
import { urgencyColors } from '../deadline/urgency-colors';
import { useDeadline } from '../hooks/use-deadline';
import { useDeadlineRepository } from '../repository/repository-context';
import { useNotificationScheduler } from '../notification-scheduler/notification-scheduler-context';
import { nextDueDate } from '../../domain/deadline/recurrence';
import { recurrenceLabel } from '../deadline/recurrence-label';
import { useRenewDeadline } from '../hooks/use-renew-deadline';
import { DatePickerField } from '../components/DatePickerField';
import { colors, fontSizes, radii, spacing } from '../theme';
import { ActionButton } from '../components/ActionButton';
import { AppText } from '../components/AppText';
import { DetailStatusBlock } from '../components/DetailStatusBlock';
import { Loading } from '../components/Loading';
import { ManageAction } from '../components/ManageAction';

interface DeadlineDetailScreenProps {
  id: string;
  onClose: () => void;
}

/** Detail of one deadline: type-adapted copy + action layer; "mark as" updates status. */
export function DeadlineDetailScreen({ id, onClose }: DeadlineDetailScreenProps) {
  const { status, deadline } = useDeadline(id);
  const repo = useDeadlineRepository();
  const scheduler = useNotificationScheduler();
  const insets = useSafeAreaInsets();
  const renew = useRenewDeadline();
  const [renewing, setRenewing] = useState(false);
  const [renewDate, setRenewDate] = useState<Date>(() => new Date());

  if (status === 'loading') return <Loading />;

  if (status !== 'ready' || !deadline) {
    const message =
      status === 'error'
        ? 'No se pudo cargar este vencimiento.'
        : 'No encontramos este vencimiento.';
    return (
      <View style={[styles.centered, { paddingTop: spacing.xxxl + insets.top }]}>
        <AppText weight="bold" size={fontSizes.body} color={colors.textSecondary} style={styles.centeredText}>
          {message}
        </AppText>
        <ManageAction label="Cerrar" icon="close" onPress={onClose} />
      </View>
    );
  }

  const today = new Date();
  const level = urgencyLevel(deadline, today);
  const urgency = urgencyColors(level);
  const presentation = detailPresentation(deadline.type);
  const headline = statusHeadline(presentation.verb, daysRemaining(deadline, today));
  const amountLine = formatAmountLine(deadline);

  const notYet = () => Alert.alert('Próximamente', 'Esta acción estará disponible más adelante.');

  const markAs = async () => {
    await repo.update({ ...deadline, status: presentation.manage.targetStatus });
    try {
      await scheduler.cancel(deadline.id);
    } catch {
      // Cancellation is best-effort; closing should not depend on it.
    }
    onClose();
  };

  const isRecurrent = deadline.recurrenceMonths != null;

  const startRenew = () => {
    setRenewDate(nextDueDate(deadline.dueDate, deadline.recurrenceMonths!, new Date()));
    setRenewing(true);
  };

  const confirmRenew = async () => {
    await renew(deadline, renewDate);
    onClose();
  };

  const confirmStopRepeating = () =>
    Alert.alert(
      'Dejar de repetir',
      'Este vencimiento dejará de renovarse y saldrá de tu lista. No se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Dejar de repetir', style: 'destructive', onPress: () => { void markAs(); } },
      ],
    );

  return (
    <View style={styles.root}>
      <View style={[styles.handle, { marginTop: insets.top + spacing.sm }]} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: spacing.xxxl + insets.bottom }]}>
        <View style={styles.header}>
          <View style={[styles.icon, { backgroundColor: urgency.tintBg }]}>
            <MaterialCommunityIcons name={typeIcon(deadline.type)} size={24} color={urgency.base} />
          </View>
          <View style={styles.headerText}>
            <AppText weight="extrabold" size={fontSizes.title}>
              {deadline.title}
            </AppText>
            {deadline.subtitle ? (
              <AppText weight="semibold" size={fontSizes.label} color={colors.textMuted}>
                {deadline.subtitle}
              </AppText>
            ) : null}
          </View>
        </View>

        {deadline.photoUri ? (
          <Image testID="deadline-detail-photo" source={{ uri: deadline.photoUri }} style={styles.photo} resizeMode="cover" />
        ) : null}

        <DetailStatusBlock
          urgency={urgency}
          headline={headline}
          date={formatDate(deadline.dueDate)}
          consequence={presentation.consequence}
        />

        {deadline.recurrenceMonths != null ? (
          <View style={styles.recurrenceRow}>
            <MaterialCommunityIcons name="calendar-refresh" size={16} color={colors.textFaint} />
            <AppText weight="semibold" size={fontSizes.small} color={colors.textFaint}>
              {`Se repite ${recurrenceLabel(deadline.recurrenceMonths).toLowerCase()}`}
            </AppText>
          </View>
        ) : null}

        {amountLine ? (
          <View style={styles.amountRow}>
            <MaterialCommunityIcons name="cash" size={18} color={colors.textFaint} />
            <AppText weight="bold" size={fontSizes.label} color={colors.textFaint}>
              {amountLine}
            </AppText>
          </View>
        ) : null}

        <AppText weight="extrabold" size={fontSizes.title} style={styles.sectionTitle}>
          Qué puedes hacer
        </AppText>
        <View style={styles.actions}>
          <ActionButton label={presentation.primaryAction} icon="calendar-check" onPress={notYet} variant="primary" />
          <ActionButton label={presentation.secondaryAction} icon="magnify" onPress={notYet} variant="secondary" />
        </View>

        <View style={styles.manageDivider} />
        <View style={styles.manageRow}>
          {isRecurrent ? (
            <>
              <ManageAction label="Marcar como renovada" icon="calendar-refresh" onPress={startRenew} />
              <ManageAction label="Dejar de repetir" icon="close-circle-outline" onPress={confirmStopRepeating} />
            </>
          ) : (
            <>
              <ManageAction label={presentation.manage.label} icon="check" onPress={markAs} />
              <ManageAction label="Posponer el aviso" icon="clock-outline" onPress={notYet} />
            </>
          )}
        </View>

        {renewing ? (
          <View style={styles.renewBox}>
            <AppText weight="bold" size={fontSizes.label} color={colors.textSecondary}>
              ¿Cuál es la nueva fecha?
            </AppText>
            <DatePickerField value={renewDate} onChange={setRenewDate} />
            <View style={styles.renewActions}>
              <ActionButton label="Confirmar renovación" icon="check" onPress={confirmRenew} variant="primary" />
              <ManageAction label="Cancelar" icon="close" onPress={() => setRenewing(false)} />
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.screenBg, borderTopLeftRadius: radii.card, borderTopRightRadius: radii.card },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: radii.pill, backgroundColor: colors.textFaint, opacity: 0.4 },
  content: { padding: spacing.xl, gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: { width: 48, height: 48, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, gap: 2 },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionTitle: { marginTop: spacing.sm },
  actions: { gap: spacing.md },
  manageDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.textFaint, opacity: 0.25, marginTop: spacing.sm },
  manageRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl, backgroundColor: colors.screenBg },
  centeredText: { textAlign: 'center' },
  photo: { width: '100%', height: 200, borderRadius: radii.card, backgroundColor: colors.surfaceSoft },
  recurrenceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  renewBox: { gap: spacing.md, padding: spacing.lg, borderRadius: radii.card, backgroundColor: colors.surfaceSoft },
  renewActions: { gap: spacing.sm },
});

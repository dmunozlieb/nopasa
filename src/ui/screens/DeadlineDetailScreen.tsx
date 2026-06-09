import { Alert, ScrollView, StyleSheet, View } from 'react-native';
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

        <DetailStatusBlock
          urgency={urgency}
          headline={headline}
          date={formatDate(deadline.dueDate)}
          consequence={presentation.consequence}
        />

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
          <ManageAction label={presentation.manage.label} icon="check" onPress={markAs} />
          <ManageAction label="Posponer el aviso" icon="clock-outline" onPress={notYet} />
        </View>
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
});

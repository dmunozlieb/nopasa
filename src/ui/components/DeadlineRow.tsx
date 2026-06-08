import { StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Deadline } from '../../domain/deadline/deadline.schema';
import { daysRemaining, urgencyLevel } from '../../domain/deadline/urgency';
import { formatAmountLine } from '../deadline/format-amount';
import { formatTimeRemaining } from '../deadline/format-time-remaining';
import { typeIcon } from '../deadline/type-icons';
import { urgencyColors } from '../deadline/urgency-colors';
import { colors, fontSizes, radii, spacing } from '../theme';
import { AppText } from './AppText';
import { Card } from './Card';
import { Pill } from './Pill';

interface DeadlineRowProps {
  deadline: Deadline;
  today: Date;
  onPress: () => void;
}

/** One deadline as a tappable card: tinted icon, title/subtitle, urgency pill, optional amount. */
export function DeadlineRow({ deadline, today, onPress }: DeadlineRowProps) {
  const level = urgencyLevel(deadline, today);
  const urgency = urgencyColors(level);
  const days = daysRemaining(deadline, today);
  const amountLine = formatAmountLine(deadline);

  return (
    <Card onPress={onPress} style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: urgency.tintBg }]}>
          <MaterialCommunityIcons name={typeIcon(deadline.type)} size={22} color={urgency.base} />
        </View>
        <View style={styles.body}>
          <AppText weight="extrabold" size={fontSizes.title}>
            {deadline.title}
          </AppText>
          {deadline.subtitle ? (
            <AppText weight="semibold" size={fontSizes.label} color={colors.textMuted}>
              {deadline.subtitle}
            </AppText>
          ) : null}
        </View>
        <View style={styles.right}>
          <Pill label={formatTimeRemaining(days)} urgency={urgency} />
          {amountLine ? (
            <AppText weight="bold" size={fontSizes.small} color={colors.textFaint} style={styles.amount}>
              {amountLine}
            </AppText>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: { width: 48, height: 48, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 2 },
  right: { alignItems: 'flex-end', gap: spacing.xs },
  amount: { marginTop: 2 },
});

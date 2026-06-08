import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { DeadlineGroup, GroupedDeadlines } from '../../domain/deadline/grouping';
import type { UrgencyLevel } from '../../domain/deadline/urgency';
import { groupLabel } from '../deadline/group-labels';
import { urgencyColors } from '../deadline/urgency-colors';
import { colors, spacing } from '../theme';
import { Button } from './Button';
import { DeadlineRow } from './DeadlineRow';
import { ScreenHeader } from './ScreenHeader';
import { SectionHeader } from './SectionHeader';

interface DeadlineListProps {
  groups: GroupedDeadlines;
  today: Date;
  onPressRow: (id: string) => void;
  onAdd: () => void;
}

const ORDER: { key: DeadlineGroup; level: UrgencyLevel }[] = [
  { key: 'NEEDS_ATTENTION', level: 'urgent' },
  { key: 'UPCOMING', level: 'upcoming' },
  { key: 'CALM', level: 'calm' },
];

function summaryText(n: number): string {
  return n === 1 ? '1 cosa requiere tu atención' : `${n} cosas requieren tu atención`;
}

export function DeadlineList({ groups, today, onPressRow, onAdd }: DeadlineListProps) {
  const attention = groups.NEEDS_ATTENTION.length;
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: spacing.xl + insets.top }]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          title="Mis vencimientos"
          summary={summaryText(attention)}
          summaryDotColor={colors.urgency.urgent.base}
        />
        {ORDER.map(({ key, level }) => {
          const items = groups[key];
          if (items.length === 0) return null;
          return (
            <View key={key} style={styles.section}>
              <SectionHeader label={groupLabel(key)} count={items.length} dotColor={urgencyColors(level).base} />
              {items.map((d) => (
                <DeadlineRow key={d.id} deadline={d} today={today} onPress={() => onPressRow(d.id)} />
              ))}
            </View>
          );
        })}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: spacing.xl + insets.bottom }]}>
        <Button label="Añadir" icon="plus" onPress={onAdd} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.screenBg },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  section: { marginBottom: spacing.lg },
  footer: { padding: spacing.xl, backgroundColor: colors.screenBg },
});

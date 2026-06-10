import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { colors, fontSizes, spacing } from '../theme';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { DeadlineList } from '../components/DeadlineList';
import { EmptyState } from '../components/EmptyState';
import { Loading } from '../components/Loading';
import { useDeadlines } from '../hooks/use-deadlines';

interface HomeScreenProps {
  onOpenDeadline: (id: string) => void;
  onAdd: () => void;
  onOpenSettings: () => void;
}

/** Home container: loads deadlines, refreshes on focus, picks loading/error/empty/list. */
export function HomeScreen({ onOpenDeadline, onAdd, onOpenSettings }: HomeScreenProps) {
  const { status, groups, today, storedCount, refresh } = useDeadlines();

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  if (status === 'loading') return <Loading />;

  if (status === 'error') {
    return (
      <View style={styles.error}>
        <AppText weight="bold" size={fontSizes.body} color={colors.textSecondary}>
          No se pudieron cargar tus vencimientos.
        </AppText>
        <Button label="Reintentar" onPress={() => { void refresh(); }} />
      </View>
    );
  }

  const activeTotal = groups.NEEDS_ATTENTION.length + groups.UPCOMING.length + groups.CALM.length;
  if (activeTotal === 0) {
    const variant = storedCount === 0 ? 'first-use' : 'all-caught-up';
    return <EmptyState variant={variant} onAdd={onAdd} onOpenSettings={onOpenSettings} />;
  }

  return <DeadlineList groups={groups} today={today} onPressRow={onOpenDeadline} onAdd={onAdd} onOpenSettings={onOpenSettings} />;
}

const styles = StyleSheet.create({
  error: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.lg, backgroundColor: colors.screenBg },
});

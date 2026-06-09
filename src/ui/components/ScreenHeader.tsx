import { Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fontSizes, spacing } from '../theme';
import { AppText } from './AppText';

interface ScreenHeaderProps {
  title: string;
  summary?: string;
  summaryDotColor?: string;
  /** When provided, renders a gear button (top-right) that opens settings. */
  onSettings?: () => void;
}

/** Big screen title with an optional summary line and an optional settings gear. */
export function ScreenHeader({ title, summary, summaryDotColor, onSettings }: ScreenHeaderProps) {
  return (
    <View style={styles.root}>
      <View style={styles.titleRow}>
        <AppText weight="black" size={fontSizes.h1}>
          {title}
        </AppText>
        {onSettings ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Ajustes" onPress={onSettings} hitSlop={8}>
            <MaterialCommunityIcons name="cog" size={26} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>
      {summary ? (
        <View style={styles.summary}>
          {summaryDotColor ? <View style={[styles.dot, { backgroundColor: summaryDotColor }]} /> : null}
          <AppText weight="bold" size={fontSizes.body} color={colors.textSecondary}>
            {summary}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm, marginBottom: spacing.xl },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summary: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 9, height: 9, borderRadius: 999 },
});

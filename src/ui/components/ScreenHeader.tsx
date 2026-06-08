import { StyleSheet, View } from 'react-native';
import { colors, fontSizes, spacing } from '../theme';
import { AppText } from './AppText';

interface ScreenHeaderProps {
  title: string;
  summary?: string;
  summaryDotColor?: string;
}

/** Big screen title with an optional summary line (colored dot + text). */
export function ScreenHeader({ title, summary, summaryDotColor }: ScreenHeaderProps) {
  return (
    <View style={styles.root}>
      <AppText weight="black" size={fontSizes.h1}>
        {title}
      </AppText>
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
  summary: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 9, height: 9, borderRadius: 999 },
});

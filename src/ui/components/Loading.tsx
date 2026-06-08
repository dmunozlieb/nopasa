import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors } from '../theme';

/** Full-screen centered spinner on the app background. */
export function Loading() {
  return (
    <View style={styles.root}>
      <ActivityIndicator color={colors.brandBlue} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.screenBg },
});

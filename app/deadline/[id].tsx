import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

/** Placeholder. The detail screen is built in a later session. */
export default function DeadlineDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <View>
      <Text>Detalle del vencimiento {id} (próximamente)</Text>
    </View>
  );
}

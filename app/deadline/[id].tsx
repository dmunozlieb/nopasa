import { useLocalSearchParams, useRouter } from 'expo-router';
import { DeadlineDetailScreen } from '../../src/ui/screens/DeadlineDetailScreen';

export default function DeadlineDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  return <DeadlineDetailScreen id={id} onClose={() => router.back()} />;
}

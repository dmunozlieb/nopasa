import { useRouter } from 'expo-router';
import { AddDeadlineScreen } from '../../src/ui/screens/AddDeadlineScreen';

export default function AddManualRoute() {
  const router = useRouter();
  return <AddDeadlineScreen onSaved={() => router.dismissAll()} />;
}

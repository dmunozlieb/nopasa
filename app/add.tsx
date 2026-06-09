import { useRouter } from 'expo-router';
import { AddDeadlineScreen } from '../src/ui/screens/AddDeadlineScreen';

export default function AddDeadlineRoute() {
  const router = useRouter();
  return <AddDeadlineScreen onClose={() => router.back()} />;
}

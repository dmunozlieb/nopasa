import { useRouter } from 'expo-router';
import { AddOptionsScreen } from '../../src/ui/screens/AddOptionsScreen';

export default function AddOptionsRoute() {
  const router = useRouter();
  return (
    <AddOptionsScreen
      onPhoto={() => router.push('/add/camera')}
      onManual={() => router.push('/add/manual')}
      onClose={() => router.back()}
    />
  );
}

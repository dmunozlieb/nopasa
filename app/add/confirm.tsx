import { useLocalSearchParams, useRouter } from 'expo-router';
import { ConfirmDeadlineScreen } from '../../src/ui/screens/ConfirmDeadlineScreen';

export default function AddConfirmRoute() {
  const router = useRouter();
  const { photoUri } = useLocalSearchParams<{ photoUri: string }>();
  return <ConfirmDeadlineScreen photoUri={decodeURIComponent(photoUri ?? '')} onClose={() => router.back()} />;
}

import { useRouter } from 'expo-router';
import { PrivacyScreen } from '../src/ui/screens/PrivacyScreen';

export default function PrivacyRoute() {
  const router = useRouter();
  return <PrivacyScreen onClose={() => router.back()} />;
}

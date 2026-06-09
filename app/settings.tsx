import { useRouter } from 'expo-router';
import { SettingsScreen } from '../src/ui/screens/SettingsScreen';

export default function SettingsRoute() {
  const router = useRouter();
  return <SettingsScreen onClose={() => router.back()} />;
}

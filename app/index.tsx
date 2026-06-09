import { useRouter } from 'expo-router';
import { HomeScreen } from '../src/ui/screens/HomeScreen';

export default function Home() {
  const router = useRouter();
  return (
    <HomeScreen
      onOpenDeadline={(id) => router.push(`/deadline/${id}`)}
      onAdd={() => router.push('/add')}
      onOpenSettings={() => router.push('/settings')}
    />
  );
}

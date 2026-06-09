import {
  useFonts,
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
} from '@expo-google-fonts/nunito';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RepositoryProvider } from '../src/ui/repository/repository-context';
import { DeadlineDepsProvider } from '../src/ui/deadline-deps/deadline-deps-context';
import { NotificationSchedulerProvider } from '../src/ui/notification-scheduler/notification-scheduler-context';
import { Loading } from '../src/ui/components/Loading';

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Nunito_900Black,
  });

  if (!fontsLoaded && !fontError) return <Loading />;

  return (
    <SafeAreaProvider>
      <RepositoryProvider>
        <DeadlineDepsProvider>
          <NotificationSchedulerProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="add" options={{ presentation: 'modal' }} />
              <Stack.Screen name="deadline/[id]" options={{ presentation: 'modal' }} />
            </Stack>
          </NotificationSchedulerProvider>
        </DeadlineDepsProvider>
      </RepositoryProvider>
    </SafeAreaProvider>
  );
}

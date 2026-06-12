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
import { PhotoStoreProvider } from '../src/ui/photo-store/photo-store-context';
import { DataExporterProvider } from '../src/ui/export/data-exporter-context';
import { SettingsProvider } from '../src/ui/settings/settings-context';
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
            <PhotoStoreProvider>
              <DataExporterProvider>
                <SettingsProvider>
                  <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="index" />
                    <Stack.Screen name="add" options={{ presentation: 'modal' }} />
                    <Stack.Screen name="deadline/[id]" options={{ presentation: 'modal' }} />
                    <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
                    <Stack.Screen name="privacy" options={{ presentation: 'modal' }} />
                  </Stack>
                </SettingsProvider>
              </DataExporterProvider>
            </PhotoStoreProvider>
          </NotificationSchedulerProvider>
        </DeadlineDepsProvider>
      </RepositoryProvider>
    </SafeAreaProvider>
  );
}

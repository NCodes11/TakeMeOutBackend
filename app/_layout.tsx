import { Stack } from 'expo-router';
import { JosefinSans_700Bold } from '@expo-google-fonts/josefin-sans';
import { useFonts } from 'expo-font';
import { useEffect } from 'react';
import { PaperProvider } from 'react-native-paper';
import { LocationProvider } from '@/context/LocationContext';
import { PreferencesProvider } from '@/context/PreferencesContext';
import { appTheme } from '@/theme/appTheme';
import { usePlanStore } from '@/store/usePlanStore';

export default function RootLayout() {
  const boot = usePlanStore((s) => s.boot);
  const [fontsLoaded] = useFonts({
    JosefinSans_700Bold,
  });

  useEffect(() => {
    // Initialize local persistence/state once when the app shell mounts.
    if (typeof boot !== 'function') return;
    boot();
  }, [boot]);

  if (!fontsLoaded) return null;

  return (
    // Global providers + stack routes shared across every screen.
    <PaperProvider theme={appTheme}>
      <PreferencesProvider>
        <LocationProvider>
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: appTheme.colors.surface },
              headerTintColor: appTheme.colors.onSurface,
              headerShadowVisible: false,
              contentStyle: { backgroundColor: appTheme.colors.background },
              headerTitleStyle: { fontWeight: '700' },
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false, title: 'Home' }} />
            <Stack.Screen name="wizard" options={{ title: 'Build Plan' }} />
            <Stack.Screen name="generated/[id]" options={{ title: 'Your Day Plan' }} />
            <Stack.Screen name="plan/[id]" options={{ title: 'Plan Details' }} />
            <Stack.Screen name="today/[id]" options={{ title: 'Navigate' }} />
            <Stack.Screen name="saved" options={{ title: 'Saved Plans' }} />
            <Stack.Screen name="settings" options={{ title: 'Settings' }} />
            <Stack.Screen name="feature-request" options={{ title: 'Suggest a Feature' }} />
          </Stack>
        </LocationProvider>
      </PreferencesProvider>
    </PaperProvider>
  );
}

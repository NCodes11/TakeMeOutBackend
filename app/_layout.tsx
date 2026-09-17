import { router, Stack } from 'expo-router';
import {
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
} from '@expo-google-fonts/ibm-plex-mono';
import { useFonts } from 'expo-font';
import { useEffect } from 'react';
import { Pressable, StatusBar, StyleSheet } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LocationProvider } from '@/context/LocationContext';
import { PreferencesProvider, usePreferences } from '@/context/PreferencesContext';
import { darkTheme, fonts, getAppPalette, lightTheme, shadows } from '@/theme/appTheme';
import { usePlanStore } from '@/store/usePlanStore';

function BackButton({
  color,
  surface,
  border,
}: {
  color: string;
  surface: string;
  border: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      hitSlop={10}
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      style={({ pressed }) => [
        styles.back,
        shadows.raised,
        {
          backgroundColor: surface,
          borderColor: border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <MaterialCommunityIcons name="chevron-left" size={22} color={color} />
    </Pressable>
  );
}

function RootNavigator() {
  const { themeMode } = usePreferences();
  const dark = themeMode === 'dark';
  const theme = dark ? darkTheme : lightTheme;
  const p = getAppPalette(dark);

  return (
    <PaperProvider theme={theme}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} backgroundColor={p.canvas} />
      <LocationProvider>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: p.canvas },
            headerTintColor: p.textHigh,
            headerShadowVisible: false,
            headerTitleAlign: 'center',
            headerTitleStyle: {
              fontFamily: fonts.displaySemi,
              fontSize: 15,
              color: p.textHigh,
            },
            headerBackVisible: false,
            headerLeft: () => (
              <BackButton color={p.textHigh} surface={p.surfaceRaised} border={p.lineStrong} />
            ),
            contentStyle: { backgroundColor: p.canvas },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false, title: 'Home' }} />
          <Stack.Screen name="wizard" options={{ title: 'Plan your day' }} />
          <Stack.Screen name="generated/[id]" options={{ title: 'Ready route' }} />
          <Stack.Screen name="plan/[id]" options={{ title: 'Plan' }} />
          <Stack.Screen name="today/[id]" options={{ title: 'Today' }} />
          <Stack.Screen name="saved" options={{ title: 'Saved plans' }} />
          <Stack.Screen name="settings" options={{ title: 'Settings' }} />
          <Stack.Screen name="feature-request" options={{ title: 'Suggest a feature' }} />
        </Stack>
      </LocationProvider>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  back: {
    width: 36,
    height: 36,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default function RootLayout() {
  const boot = usePlanStore((s) => s.boot);
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
  });

  useEffect(() => {
    if (typeof boot !== 'function') return;
    boot();
  }, [boot]);

  if (!fontsLoaded) return null;

  return (
    <PreferencesProvider>
      <RootNavigator />
    </PreferencesProvider>
  );
}

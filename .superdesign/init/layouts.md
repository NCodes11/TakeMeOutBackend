# Shared layouts

## `app/_layout.tsx`

The root app shell registers every Expo Router screen and installs the theme, preferences, location, font, and persisted-plan providers.

```tsx
import { Stack } from 'expo-router';
import { JosefinSans_700Bold } from '@expo-google-fonts/josefin-sans';
import { useFonts } from 'expo-font';
import { useEffect } from 'react';
import { PaperProvider } from 'react-native-paper';
import { LocationProvider } from '@/context/LocationContext';
import { PreferencesProvider, usePreferences } from '@/context/PreferencesContext';
import { darkTheme, lightTheme } from '@/theme/appTheme';
import { usePlanStore } from '@/store/usePlanStore';

function RootNavigator() {
  const { themeMode } = usePreferences();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;

  return (
    <PaperProvider theme={theme}>
      <LocationProvider>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: theme.colors.background },
            headerTintColor: theme.colors.onSurface,
            headerShadowVisible: false,
            contentStyle: { backgroundColor: theme.colors.background },
            headerTitleStyle: { fontWeight: '900' },
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
    </PaperProvider>
  );
}

export default function RootLayout() {
  const boot = usePlanStore((s) => s.boot);
  const [fontsLoaded] = useFonts({
    JosefinSans_700Bold,
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
```

## `src/components/ui/AppScreen.tsx`

The shared page-level safe-area and scroll shell used on all routes except the hand-authored home screen.

```tsx
import { ReactNode } from 'react';
import {
  Image,
  ImageSourcePropType,
  Pressable,
  ScrollView,
  ScrollViewProps,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, useTheme } from 'react-native-paper';
import { spacing } from '@/theme/appTheme';

interface AppScreenProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: ScrollViewProps['contentContainerStyle'];
  variant?: 'default' | 'landing';
  logoSource?: ImageSourcePropType;
  onMenuPress?: () => void;
}

export const AppScreen = ({
  children,
  title,
  subtitle,
  scroll = true,
  style,
  contentContainerStyle,
  variant = 'default',
  logoSource,
  onMenuPress,
}: AppScreenProps) => {
  const theme = useTheme();
  const isLanding = variant === 'landing';

  const body = (
    <View style={[isLanding ? styles.landingContent : styles.content, style]}>
      {isLanding ? (
        <>
          <View style={styles.landingHeader}>
            {logoSource ? (
              <Image source={logoSource} style={styles.smallLogo} resizeMode="contain" />
            ) : (
              <View
                style={[
                  styles.logoPlaceholder,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.primary,
                  },
                ]}
              >
                <Text style={[styles.logoPlaceholderText, { color: theme.colors.primary }]}>✓</Text>
              </View>
            )}

            {onMenuPress ? (
              <Pressable onPress={onMenuPress} hitSlop={12} style={styles.menuButton}>
                <Text style={[styles.menuIcon, { color: theme.colors.onSurface }]}>☰</Text>
              </Pressable>
            ) : null}
          </View>
        </>
      ) : null}

      {title ? (
        <View style={isLanding ? styles.landingTitleBlock : styles.header}>
          {!isLanding ? (
            <View style={[styles.titleAccent, { backgroundColor: theme.colors.primary }]} />
          ) : null}

          <Text
            variant={isLanding ? 'headlineLarge' : 'headlineMedium'}
            style={[
              isLanding ? styles.landingTitle : styles.title,
              { color: theme.colors.onSurface },
            ]}
          >
            {title}
          </Text>

          {subtitle ? (
            <Text
              variant="bodyMedium"
              style={[
                isLanding ? styles.landingSubtitle : styles.subtitle,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      ) : subtitle ? (
        <Text
          variant="bodyMedium"
          style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}
        >
          {subtitle}
        </Text>
      ) : null}

      {children}
    </View>
  );

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        {
          backgroundColor: theme.colors.background,
        },
      ]}
    >
      {scroll ? (
        <ScrollView
          contentContainerStyle={[
            isLanding ? styles.landingScrollContent : styles.scrollContent,
            contentContainerStyle,
          ]}
          showsVerticalScrollIndicator={false}
        >
          {body}
        </ScrollView>
      ) : (
        body
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xxl + spacing.md,
  },
  content: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: spacing.xl,
    gap: spacing.lg,
  },
  header: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  title: {
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 36,
  },
  titleAccent: {
    width: 42,
    height: 4,
    borderRadius: 4,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  landingScrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xxl,
  },
  landingContent: {
    flex: 1,
    minHeight: '100%',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.lg,
  },
  landingHeader: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  smallLogo: {
    width: 44,
    height: 44,
  },
  logoPlaceholder: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoPlaceholderText: {
    fontSize: 22,
    fontWeight: '800',
  },
  menuButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIcon: {
    fontSize: 26,
    fontWeight: '700',
    marginTop: -2,
  },
  landingTitleBlock: {
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    gap: spacing.sm,
    zIndex: 2,
  },
  landingTitle: {
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0,
    lineHeight: 40,
  },
  landingSubtitle: {
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 260,
  },
});
```

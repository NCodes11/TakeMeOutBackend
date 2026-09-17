import type { ConfigContext, ExpoConfig } from 'expo/config';

const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

export default ({ config }: ConfigContext): ExpoConfig => {
  return {
    ...config,
    name: 'Take Me Out',
    slug: 'take-me-out',
    scheme: 'takemeout',
    version: '1.0.0',
    orientation: 'portrait',
    userInterfaceStyle: 'automatic',
    icon: './assets/icon.png',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#F7F6FC',
    },
    plugins: ['expo-router', 'expo-font', 'expo-location', 'expo-sqlite', 'expo-asset'],
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'CY-Phoenix-CY-D64F97FE-DE34-11E8-8889-43762E4BB4D9.supplies.wall.phoenix',
      buildNumber: '16',
      config: {
        googleMapsApiKey,
        usesNonExemptEncryption: false,
      },
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          'Take Me Out uses your location to build nearby plans and open directions from your current location.',
      },
    },
    android: {
      package: 'com.daydate.app',
      versionCode: 16,
      softwareKeyboardLayoutMode: 'resize',
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#F7F6FC',
      },
      config: {
        googleMaps: {
          apiKey: googleMapsApiKey,
        },
      },
    },
    web: {
      bundler: 'metro',
      favicon: './assets/favicon.png',
    },
    runtimeVersion: {
      policy: 'appVersion',
    },
    experiments: {
      typedRoutes: true,
    },
  };
};

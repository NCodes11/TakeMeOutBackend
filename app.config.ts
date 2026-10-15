import type { ConfigContext, ExpoConfig } from 'expo/config';

const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

// Current identifiers from Google's iOS SDK setup guide. Keeping the list in
// config lets the Expo plugin keep Info.plist in sync on every native build.
const googleMobileAdsSkAdNetworkItems = [
  'cstr6suwn9.skadnetwork',
  '4fzdc2evr5.skadnetwork',
  '2fnua5tdw4.skadnetwork',
  'ydx93a7ass.skadnetwork',
  'p78axxw29g.skadnetwork',
  'v72qych5uu.skadnetwork',
  'ludvb6z3bs.skadnetwork',
  'cp8zw746q7.skadnetwork',
  '3sh42y64q3.skadnetwork',
  'c6k4g5qg8m.skadnetwork',
  's39g8k73mm.skadnetwork',
  'wg4vff78zm.skadnetwork',
  '3qy4746246.skadnetwork',
  'f38h382jlk.skadnetwork',
  'hs6bdukanm.skadnetwork',
  'mlmmfzh3r3.skadnetwork',
  'v4nxqhlyqp.skadnetwork',
  'wzmmz9fp6w.skadnetwork',
  'su67r6k2v3.skadnetwork',
  'yclnxrl5pm.skadnetwork',
  't38b2kh725.skadnetwork',
  '7ug5zh24hu.skadnetwork',
  'gta9lk7p23.skadnetwork',
  'vutu7akeur.skadnetwork',
  'y5ghdn5j9k.skadnetwork',
  'v9wttpbfk9.skadnetwork',
  'n38lu8286q.skadnetwork',
  '47vhws6wlr.skadnetwork',
  'kbd757ywx3.skadnetwork',
  '9t245vhmpl.skadnetwork',
  'a2p9lx4jpn.skadnetwork',
  '22mmun2rn5.skadnetwork',
  '44jx6755aq.skadnetwork',
  'k674qkevps.skadnetwork',
  '4468km3ulz.skadnetwork',
  '2u9pt9hc89.skadnetwork',
  '8s468mfl3y.skadnetwork',
  'klf5c3l5u5.skadnetwork',
  'ppxm28t8ap.skadnetwork',
  'kbmxgpxpgc.skadnetwork',
  'uw77j35x4d.skadnetwork',
  '578prtvx9j.skadnetwork',
  '4dzt52r2t5.skadnetwork',
  'tl55sbb4fm.skadnetwork',
  'c3frkrj4fj.skadnetwork',
  'e5fvkxwrpn.skadnetwork',
  '8c4e2ghe7u.skadnetwork',
  '3rd42ekr43.skadnetwork',
  '97r2b46745.skadnetwork',
  '3qcr597p9d.skadnetwork',
];

export default ({ config }: ConfigContext): ExpoConfig => {
  return {
    ...config,
    name: 'Take Me Out',
    slug: 'take-me-out',
    scheme: 'takemeout',
    // App Store Connect has already approved 1.0.4, so new submissions must
    // use the next release train. Expo writes this into CFBundleShortVersionString.
    version: '1.0.5',
    orientation: 'portrait',
    userInterfaceStyle: 'automatic',
    icon: './assets/icon.png',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#F7F6FC',
    },
    plugins: [
      'expo-router',
      'expo-font',
      'expo-location',
      'expo-sqlite',
      'expo-asset',
      [
        'react-native-google-mobile-ads',
        {
          iosAppId: 'ca-app-pub-9884050953952460~1707832289',
          skAdNetworkItems: googleMobileAdsSkAdNetworkItems,
        },
      ],
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'CY-Phoenix-CY-D64F97FE-DE34-11E8-8889-43762E4BB4D9.supplies.wall.phoenix',
      // Unique build inside the 1.0.5 App Store Connect train.
      buildNumber: '22',
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

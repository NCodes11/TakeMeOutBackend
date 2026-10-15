import { router } from 'expo-router';
import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  AppScreen,
  MonoLabel,
  SectionLabel,
  Segmented,
  SwitchRow,
  ValueRow,
} from '@/components/ui';
import { DistanceUnits, ThemeMode, usePreferences } from '@/context/PreferencesContext';
import { hasAdPrivacyOptions, showAdPrivacyOptions } from '@/services/admob';
import { spacing } from '@/theme/appTheme';

const APPEARANCE_OPTIONS: readonly { value: ThemeMode; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const UNIT_OPTIONS: readonly { value: DistanceUnits; label: string }[] = [
  { value: 'miles', label: 'Miles' },
  { value: 'km', label: 'km' },
];

export default function SettingsScreen() {
  const { timeFormat, setTimeFormat, themeMode, setThemeMode, distanceUnits, setDistanceUnits } =
    usePreferences();
  const [adPrivacyOptionsAvailable, setAdPrivacyOptionsAvailable] = useState(false);

  useEffect(() => {
    let active = true;

    void hasAdPrivacyOptions().then((available) => {
      if (active) setAdPrivacyOptionsAvailable(available);
    });

    return () => {
      active = false;
    };
  }, []);

  const version = Constants.expoConfig?.version || '1.0.0';
  const build =
    Constants.expoConfig?.ios?.buildNumber ||
    String(Constants.expoConfig?.android?.versionCode || '');

  return (
    <AppScreen title="Settings">
      <SectionLabel first>Display</SectionLabel>

      <ValueRow label="Appearance">
        <Segmented
          options={APPEARANCE_OPTIONS}
          value={themeMode}
          onChange={(next) => {
            setThemeMode(next).catch(() => undefined);
          }}
          style={styles.segment}
        />
      </ValueRow>

      <SwitchRow
        label="24-hour time"
        value={timeFormat === '24h'}
        onValueChange={(enabled) => {
          setTimeFormat(enabled ? '24h' : '12h').catch(() => undefined);
        }}
        divider
      />

      <ValueRow label="Distance units" divider>
        <Segmented
          options={UNIT_OPTIONS}
          value={distanceUnits}
          onChange={(next) => {
            setDistanceUnits(next).catch(() => undefined);
          }}
          style={styles.segment}
        />
      </ValueRow>

      <SectionLabel>Feedback</SectionLabel>

      <ValueRow label="Suggest a feature" onPress={() => router.push('/feature-request')} />

      {adPrivacyOptionsAvailable ? (
        <>
          <SectionLabel>Privacy</SectionLabel>
          <ValueRow
            label="Ad privacy choices"
            onPress={() => {
              void showAdPrivacyOptions().then(() => {
                void hasAdPrivacyOptions().then(setAdPrivacyOptionsAvailable);
              });
            }}
          />
        </>
      ) : null}

      <View style={styles.footer}>
        <MonoLabel>
          Take Me Out · v{version}
          {build ? ` (${build})` : ''}
        </MonoLabel>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  segment: {
    width: 176,
  },
  footer: {
    marginTop: spacing.xxl,
  },
});

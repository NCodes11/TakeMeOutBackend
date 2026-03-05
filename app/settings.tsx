import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { StyleSheet, View } from 'react-native';
import { SegmentedButtons, Switch, Text, TextInput } from 'react-native-paper';
import { AppCard, AppScreen, SecondaryButton } from '@/components/ui';
import { usePreferences } from '@/context/PreferencesContext';
import { exportFeedbackJson } from '@/utils/share';
import { requestNotificationPermissions } from '@/utils/notifications';
import { palette, spacing } from '@/theme/appTheme';

export default function SettingsScreen() {
  // These controls are currently UI-level preferences for beta UX tuning.
  const { timeFormat, setTimeFormat } = usePreferences();
  const [units, setUnits] = useState('miles');
  const [weekStart, setWeekStart] = useState('monday');
  const [quietHours, setQuietHours] = useState('22:00-07:00');
  return (
    <AppScreen title="Settings">
      <AppCard>
        <View style={styles.content}>
          <Text variant="titleMedium" style={styles.header}>Preferences</Text>
          <View style={styles.row}>
            <Text>Use 24-hour time</Text>
            <Switch
              value={timeFormat === '24h'}
              onValueChange={(enabled) => {
                setTimeFormat(enabled ? '24h' : '12h').catch(() => undefined);
              }}
            />
          </View>
          <SegmentedButtons value={units} onValueChange={setUnits} buttons={[{ value: 'miles', label: 'Miles' }, { value: 'km', label: 'KM' }]} />
          <SegmentedButtons value={weekStart} onValueChange={setWeekStart} buttons={[{ value: 'monday', label: 'Mon' }, { value: 'sunday', label: 'Sun' }]} />
          <TextInput label="Quiet hours" mode="outlined" value={quietHours} onChangeText={setQuietHours} />
          <View style={styles.row}>
            <Text>Notifications</Text>
            <Switch value={true} onValueChange={() => requestNotificationPermissions()} />
          </View>
          <SecondaryButton onPress={() => router.push('/feature-request')}>Suggest a Feature</SecondaryButton>
          <SecondaryButton
            onPress={async () => {
              try {
                // Beta helper: one-tap export of locally captured feedback datasets.
                await exportFeedbackJson();
              } catch {
                Alert.alert('Export failed', 'Unable to export feedback right now.');
              }
            }}
          >
            Export data (JSON)
          </SecondaryButton>
          <SecondaryButton>Import data (JSON)</SecondaryButton>
        </View>
      </AppCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    padding: spacing.md,
  },
  header: {
    color: palette.text,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});

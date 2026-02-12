import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SegmentedButtons, Switch, Text, TextInput } from 'react-native-paper';
import { AppCard, AppScreen, SecondaryButton } from '@/components/ui';
import { requestNotificationPermissions } from '@/utils/notifications';
import { palette, spacing } from '@/theme/appTheme';

export default function SettingsScreen() {
  const [units, setUnits] = useState('miles');
  const [weekStart, setWeekStart] = useState('monday');
  const [defaultPace, setDefaultPace] = useState('balanced');
  const [quietHours, setQuietHours] = useState('22:00-07:00');
  return (
    <AppScreen title="Settings" subtitle="Customize how itineraries are generated and displayed.">
      <AppCard>
        <View style={styles.content}>
      <Text variant="titleMedium" style={styles.header}>Preferences</Text>
      <SegmentedButtons value={units} onValueChange={setUnits} buttons={[{ value: 'miles', label: 'Miles' }, { value: 'km', label: 'KM' }]} />
      <SegmentedButtons value={weekStart} onValueChange={setWeekStart} buttons={[{ value: 'monday', label: 'Mon' }, { value: 'sunday', label: 'Sun' }]} />
      <SegmentedButtons value={defaultPace} onValueChange={setDefaultPace} buttons={[{ value: 'relaxed', label: 'Relaxed' }, { value: 'balanced', label: 'Balanced' }, { value: 'packed', label: 'Packed' }]} />
      <TextInput label="Quiet hours" mode="outlined" value={quietHours} onChangeText={setQuietHours} />
      <View style={styles.row}>
        <Text>Notifications</Text>
        <Switch value={true} onValueChange={() => requestNotificationPermissions()} />
      </View>
      <SecondaryButton>Export data (JSON)</SecondaryButton>
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

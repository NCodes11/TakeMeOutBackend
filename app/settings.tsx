import { useState } from 'react';
import { View } from 'react-native';
import { Button, SegmentedButtons, Switch, Text, TextInput } from 'react-native-paper';
import { requestNotificationPermissions } from '@/utils/notifications';

export default function SettingsScreen() {
  const [units, setUnits] = useState('miles');
  const [weekStart, setWeekStart] = useState('monday');
  const [defaultPace, setDefaultPace] = useState('balanced');
  const [quietHours, setQuietHours] = useState('22:00-07:00');
  return (
    <View style={{ padding: 16, gap: 12 }}>
      <Text variant="titleMedium">Preferences</Text>
      <SegmentedButtons value={units} onValueChange={setUnits} buttons={[{ value: 'miles', label: 'Miles' }, { value: 'km', label: 'KM' }]} />
      <SegmentedButtons value={weekStart} onValueChange={setWeekStart} buttons={[{ value: 'monday', label: 'Mon' }, { value: 'sunday', label: 'Sun' }]} />
      <SegmentedButtons value={defaultPace} onValueChange={setDefaultPace} buttons={[{ value: 'relaxed', label: 'Relaxed' }, { value: 'balanced', label: 'Balanced' }, { value: 'packed', label: 'Packed' }]} />
      <TextInput label="Quiet hours" mode="outlined" value={quietHours} onChangeText={setQuietHours} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text>Notifications</Text>
        <Switch value={true} onValueChange={() => requestNotificationPermissions()} />
      </View>
      <Button mode="outlined">Export data (JSON)</Button>
      <Button mode="outlined">Import data (JSON)</Button>
    </View>
  );
}

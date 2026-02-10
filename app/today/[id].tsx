import { useLocalSearchParams } from 'expo-router';
import { Linking, View } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';
import { usePlanStore } from '@/store/usePlanStore';

export default function TodayMode() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const stops = usePlanStore((s) => s.stopsByPlan[id] || []);
  const next = stops[0];
  if (!next) return <Text>No stop data</Text>;

  return (
    <View style={{ padding: 16 }}>
      <Card>
        <Card.Title title="Next Stop" subtitle={next.name} />
        <Card.Content>
          <Text>{next.address}</Text>
          <Text>ETA: {next.etaMin || 10} minutes</Text>
        </Card.Content>
        <Card.Actions>
          <Button onPress={() => Linking.openURL(`http://maps.apple.com/?daddr=${next.lat},${next.lng}`)}>Open Apple Maps</Button>
          <Button onPress={() => {}}>We're leaving now</Button>
        </Card.Actions>
      </Card>
      <Text style={{ marginTop: 12 }}>Offline tip: Saved plans remain available from local SQLite cache.</Text>
    </View>
  );
}

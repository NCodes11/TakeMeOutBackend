import { router } from 'expo-router';
import * as Location from 'expo-location';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Card, Text, TextInput } from 'react-native-paper';

export default function HomeScreen() {
  const [city, setCity] = useState('San Francisco');

  const detect = async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) return;
    const pos = await Location.getCurrentPositionAsync({});
    const reverse = await Location.reverseGeocodeAsync(pos.coords);
    setCity(reverse[0]?.city || reverse[0]?.region || city);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Card>
        <Card.Title title="Build your perfect day" subtitle="Family/date itinerary planner" />
        <Card.Content>
          <TextInput label="City or location" value={city} onChangeText={setCity} mode="outlined" />
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <Button mode="outlined" onPress={detect}>Detect my location</Button>
            <Button mode="contained" onPress={() => router.push({ pathname: '/wizard', params: { city } })}>Start Plan</Button>
          </View>
        </Card.Content>
      </Card>
      <Button mode="text" onPress={() => router.push('/saved')}>Saved Plans</Button>
      <Button mode="text" onPress={() => router.push('/settings')}>Settings</Button>
      <Text variant="bodySmall">Tip: If location access is denied, type your city manually.</Text>
    </ScrollView>
  );
}

import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { Button, Card, SegmentedButtons, TextInput } from 'react-native-paper';
import { usePlanStore } from '@/store/usePlanStore';

export default function SavedPlans() {
  const plans = usePlanStore((s) => s.plans);
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('all');
  const filtered = useMemo(() => plans.filter((p) => (group === 'all' || p.groupType === group) && `${p.city} ${p.date}`.toLowerCase().includes(q.toLowerCase())), [plans, q, group]);

  return (
    <View style={{ padding: 16, gap: 12, flex: 1 }}>
      <TextInput mode="outlined" label="Search city/date" value={q} onChangeText={setQ} />
      <SegmentedButtons value={group} onValueChange={setGroup} buttons={[{ value: 'all', label: 'All' }, { value: 'Date', label: 'Date' }, { value: 'Family', label: 'Family' }, { value: 'Friends', label: 'Friends' }]} />
      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <Card style={{ marginBottom: 10 }}>
            <Card.Title title={item.title} subtitle={`${item.date} · ${item.city}`} />
            <Card.Actions>
              <Button onPress={() => router.push(`/generated/${item.id}`)}>Open</Button>
              <Button onPress={() => router.push({ pathname: '/wizard', params: { city: item.city } })}>Duplicate</Button>
            </Card.Actions>
          </Card>
        )}
      />
    </View>
  );
}

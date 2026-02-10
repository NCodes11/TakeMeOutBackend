import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { Button, Checkbox, Text, TextInput } from 'react-native-paper';
import { usePlanStore } from '@/store/usePlanStore';
import { v4 as uuid } from 'uuid';
import { getChecklist, saveChecklist } from '@/db/sqlite';

export default function PlanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const stops = usePlanStore((s) => s.stopsByPlan[id] || []);
  const reorder = usePlanStore((s) => s.reorderStops);
  const [items, setItems] = useState(getChecklist(id));
  const [newItem, setNewItem] = useState('');

  return (
    <View style={{ padding: 16, gap: 12 }}>
      <Text variant="titleLarge">Reorder Stops</Text>
      {stops.map((s, i) => (
        <View key={s.id} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text>{i + 1}. {s.name} ({s.startTime}-{s.endTime})</Text>
          <View style={{ flexDirection: 'row' }}>
            <Button compact disabled={i === 0} onPress={() => reorder(id, i, i - 1)}>↑</Button>
            <Button compact disabled={i === stops.length - 1} onPress={() => reorder(id, i, i + 1)}>↓</Button>
          </View>
        </View>
      ))}

      <Text variant="titleMedium">Packing checklist</Text>
      <Button mode="text" onPress={() => {
        const familyKit = ['Snacks', 'Water', 'Portable charger', 'Wipes', 'First-aid'];
        const next = [...items, ...familyKit.map((t) => ({ id: uuid(), planId: id, text: t, done: 0 }))];
        setItems(next);
        saveChecklist(next);
      }}>Add family essentials</Button>

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <Checkbox.Item
            label={item.text}
            status={item.done ? 'checked' : 'unchecked'}
            onPress={() => {
              const next = items.map((x) => (x.id === item.id ? { ...x, done: x.done ? 0 : 1 } : x));
              setItems(next);
              saveChecklist(next);
            }}
          />
        )}
      />
      <TextInput label="Add checklist item" value={newItem} onChangeText={setNewItem} mode="outlined" />
      <Button onPress={() => {
        if (!newItem.trim()) return;
        const next = [...items, { id: uuid(), planId: id, text: newItem.trim(), done: 0 }];
        setItems(next);
        saveChecklist(next);
        setNewItem('');
      }}>Add</Button>
    </View>
  );
}

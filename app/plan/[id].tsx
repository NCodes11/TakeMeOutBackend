import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Card, Checkbox, Text, TextInput } from 'react-native-paper';
import { AppCard, AppScreen, PrimaryButton, SecondaryButton } from '@/components/ui';
import { usePlanStore } from '@/store/usePlanStore';
import * as Crypto from 'expo-crypto';
import { getChecklist, saveChecklist } from '@/db/sqlite';
import { palette, spacing } from '@/theme/appTheme';

export default function PlanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const stops = usePlanStore((s) => s.stopsByPlan[id] || []);
  const reorder = usePlanStore((s) => s.reorderStops);
  const [items, setItems] = useState(getChecklist(id));
  const [newItem, setNewItem] = useState('');

  return (
    <AppScreen title="Plan Detail" subtitle="Reorder stops and prepare your checklist.">
      <AppCard>
        <Card.Content style={styles.content}>
      {/* Stop order controls write back through the store so generated/today views stay in sync. */}
      <Text variant="titleLarge">Reorder Stops</Text>
      {stops.map((s, i) => (
        <View key={s.id} style={styles.stopRow}>
          <Text>{i + 1}. {s.name} ({s.startTime}-{s.endTime})</Text>
          <View style={styles.stopActions}>
            <SecondaryButton compact disabled={i === 0} onPress={() => reorder(id, i, i - 1)}>↑</SecondaryButton>
            <SecondaryButton compact disabled={i === stops.length - 1} onPress={() => reorder(id, i, i + 1)}>↓</SecondaryButton>
          </View>
        </View>
      ))}

      <Text variant="titleMedium">Packing checklist</Text>
      <SecondaryButton onPress={() => {
        // Quick starter checklist for family-oriented trips.
        const familyKit = ['Snacks', 'Water', 'Portable charger', 'Wipes', 'First-aid'];
        const next = [...items, ...familyKit.map((t) => ({ id: Crypto.randomUUID(), planId: id, text: t, done: 0 }))];
        setItems(next);
        saveChecklist(next);
      }}>Add family essentials</SecondaryButton>

      <ScrollView style={styles.list}>
        {items.map((item) => (
          <Checkbox.Item
            key={item.id}
            label={item.text}
            status={item.done ? 'checked' : 'unchecked'}
            onPress={() => {
              const next = items.map((x) => (x.id === item.id ? { ...x, done: x.done ? 0 : 1 } : x));
              setItems(next);
              saveChecklist(next);
            }}
          />
        ))}
      </ScrollView>
      <TextInput label="Add checklist item" value={newItem} onChangeText={setNewItem} mode="outlined" />
      <PrimaryButton onPress={() => {
        if (!newItem.trim()) return;
        const next = [...items, { id: Crypto.randomUUID(), planId: id, text: newItem.trim(), done: 0 }];
        setItems(next);
        saveChecklist(next);
        setNewItem('');
      }}>Add</PrimaryButton>
      </Card.Content>
      </AppCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    padding: spacing.md,
  },
  stopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    alignItems: 'center',
  },
  stopActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  list: {
    maxHeight: 280,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    backgroundColor: palette.surface,
  },
});

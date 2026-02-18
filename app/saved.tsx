import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Card, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import { AppCard, AppScreen, PrimaryButton, SecondaryButton } from '@/components/ui';
import { usePlanStore } from '@/store/usePlanStore';
import { palette, spacing } from '@/theme/appTheme';

export default function SavedPlans() {
  const plans = usePlanStore((s) => s.plans);
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('all');
  // Local filter keeps list interactions instant without extra fetches.
  const filtered = useMemo(() => plans.filter((p) => (group === 'all' || p.groupType === group) && `${p.city} ${p.date}`.toLowerCase().includes(q.toLowerCase())), [plans, q, group]);

  return (
    <AppScreen title="Saved Plans" subtitle="Search and reopen your previous itineraries." scroll={false}>
      <TextInput mode="outlined" label="Search city/date" value={q} onChangeText={setQ} />
      <SegmentedButtons value={group} onValueChange={setGroup} buttons={[{ value: 'all', label: 'All' }, { value: 'Date', label: 'Date' }, { value: 'Family', label: 'Family' }, { value: 'Friends', label: 'Friends' }]} />
      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Text variant="titleMedium" style={styles.emptyTitle}>No plans found</Text>
          <Text variant="bodySmall" style={styles.emptyText}>Try a different filter or create a new itinerary.</Text>
        </View>
      ) : null}
      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <AppCard>
            <Card.Title title={item.title} subtitle={`${item.date} · ${item.city}`} />
            <Card.Actions>
              <PrimaryButton onPress={() => router.push(`/generated/${item.id}`)}>Open</PrimaryButton>
              {/* Duplicate routes back through wizard so users can tweak before regenerating. */}
              <SecondaryButton onPress={() => router.push({ pathname: '/wizard', params: { city: item.city } })}>Duplicate</SecondaryButton>
            </Card.Actions>
          </AppCard>
        )}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  listContent: {
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  emptyState: {
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 14,
    backgroundColor: palette.surface,
    marginTop: spacing.sm,
  },
  emptyTitle: {
    color: palette.text,
    marginBottom: spacing.xs,
  },
  emptyText: {
    color: palette.muted,
  },
});

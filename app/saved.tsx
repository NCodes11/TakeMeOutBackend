import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Card, Text, TextInput, useTheme } from 'react-native-paper';
import { AppCard, AppScreen, ChoiceButtonGroup, PrimaryButton, SecondaryButton } from '@/components/ui';
import { GROUP_FILTER_OPTIONS } from '@/constants/groupTypes';
import { usePlanStore } from '@/store/usePlanStore';
import { GroupType } from '@/types/models';
import { spacing } from '@/theme/appTheme';

export default function SavedPlans() {
  const theme = useTheme();
  const plans = usePlanStore((s) => s.plans);
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<'all' | GroupType>('all');
  // Local filter keeps list interactions instant without extra fetches.
  const filtered = useMemo(() => plans.filter((p) => (group === 'all' || p.groupType === group) && `${p.city} ${p.date}`.toLowerCase().includes(q.toLowerCase())), [plans, q, group]);

  return (
    <AppScreen title="Saved Plans" scroll={false}>
      <TextInput mode="outlined" label="Search city/date" value={q} onChangeText={setQ} />
      <ChoiceButtonGroup value={group} onValueChange={setGroup} options={GROUP_FILTER_OPTIONS} />
      {filtered.length === 0 ? (
        <View style={[styles.emptyState, { borderColor: theme.colors.outline, backgroundColor: theme.colors.surface }]}>
          <Text variant="titleMedium" style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>No plans found</Text>
          <Text variant="bodySmall" style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>Try a different filter or create a new itinerary.</Text>
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
    borderRadius: 14,
    marginTop: spacing.sm,
  },
  emptyTitle: {
    marginBottom: spacing.xs,
  },
  emptyText: {},
});

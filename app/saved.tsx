import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  AppScreen,
  formatPlanDate,
  GhostButton,
  PrimaryButton,
  UnderlineInput,
} from '@/components/ui';
import { usePlanStore } from '@/store/usePlanStore';
import { fonts, spacing, useAppPalette } from '@/theme/appTheme';
import { Plan } from '@/types/models';

export default function SavedPlans() {
  const p = useAppPalette();
  const plans = usePlanStore((s) => s.plans);
  const unsavePlan = usePlanStore((s) => s.unsavePlan);
  const stopsByPlan = usePlanStore((s) => s.stopsByPlan);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(false);

  const savedPlans = useMemo(() => plans.filter((pl) => pl.isSaved === 1), [plans]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();

    if (!query) return savedPlans;

    return savedPlans.filter((pl) =>
      `${pl.title} ${pl.city} ${pl.date} ${pl.groupType ?? ''}`.toLowerCase().includes(query),
    );
  }, [savedPlans, q]);

  const getDisplayTitle = (item: Plan) => {
    const rawTitle = item.title?.trim();
    const city = item.city?.trim();

    if (!rawTitle) return city || 'Saved plan';

    const normalizedTitle = rawTitle.toLowerCase();
    const normalizedCity = city?.toLowerCase();

    if (normalizedCity && normalizedTitle.includes(normalizedCity)) {
      return city;
    }

    return rawTitle.replace(/\s+day$/i, '').trim();
  };

  const confirmRemove = (item: Plan) => {
    Alert.alert(
      'Remove saved plan?',
      `"${getDisplayTitle(item)}" will be removed from your saved plans.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => unsavePlan(item.id),
        },
      ],
    );
  };

  const subtitle =
    savedPlans.length === 0
      ? 'Days worth keeping will show up here.'
      : `${savedPlans.length} ${savedPlans.length === 1 ? 'day' : 'days'} worth keeping.`;

  return (
    <AppScreen
      title="Saved plans"
      subtitle={subtitle}
      scroll={false}
      action={
        savedPlans.length > 0 ? (
          <GhostButton onPress={() => setEditing((v) => !v)}>
            {editing ? 'Done' : 'Edit'}
          </GhostButton>
        ) : null
      }
    >
      <UnderlineInput
        placeholder="City, date, or title"
        value={q}
        onChangeText={setQ}
        autoCorrect={false}
        returnKeyType="search"
        containerStyle={styles.search}
        right={<MaterialCommunityIcons name="magnify" size={18} color={p.textLow} />}
      />

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons
              name={savedPlans.length === 0 ? 'bookmark-outline' : 'magnify-close'}
              size={30}
              color={p.violetText}
            />
            <Text style={[styles.emptyTitle, { color: p.textHigh }]}>
              {savedPlans.length === 0 ? 'No saved plans yet' : 'No matching plans'}
            </Text>
            <Text style={[styles.emptyText, { color: p.textMid }]}>
              {savedPlans.length === 0
                ? 'Build a day, then tap Save on the route to keep it.'
                : 'Try a different search.'}
            </Text>
            {savedPlans.length === 0 ? (
              <PrimaryButton onPress={() => router.push('/wizard')} style={styles.emptyCta}>
                Plan a day
              </PrimaryButton>
            ) : null}
          </View>
        }
        renderItem={({ item, index }) => {
          const stopCount = (stopsByPlan[item.id] || []).length;
          const meta = [
            stopCount ? `${stopCount} stop${stopCount === 1 ? '' : 's'}` : null,
            item.groupType,
            item.transport === 'walk' ? 'Walk' : 'Drive',
          ]
            .filter(Boolean)
            .join(' · ');

          return (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/plan/${item.id}`)}
              style={({ pressed }) => [
                styles.row,
                index < filtered.length - 1 && {
                  borderBottomColor: p.line,
                  borderBottomWidth: 1,
                },
                pressed && { opacity: 0.7 },
              ]}
            >
              <View style={styles.rowCopy}>
                <Text style={[styles.rowTitle, { color: p.textHigh }]} numberOfLines={1}>
                  {getDisplayTitle(item)}
                </Text>
                <Text style={[styles.rowCity, { color: p.textMid }]} numberOfLines={1}>
                  {item.city}
                </Text>
                <View style={styles.rowMeta}>
                  <Text style={[styles.rowDate, { color: p.signal }]}>
                    {formatPlanDate(item.date)}
                  </Text>
                  <Text style={[styles.rowMetaText, { color: p.textLow }]}>{meta}</Text>
                </View>
              </View>
              {editing ? (
                <Pressable
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Remove saved plan"
                  onPress={() => confirmRemove(item)}
                  style={[styles.removeButton, { backgroundColor: p.dangerWash }]}
                >
                  <MaterialCommunityIcons name="trash-can-outline" size={18} color={p.danger} />
                </Pressable>
              ) : (
                <MaterialCommunityIcons name="chevron-right" size={20} color={p.textLow} />
              )}
            </Pressable>
          );
        }}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  search: {
    marginTop: 14,
  },
  listContent: {
    paddingTop: 6,
    paddingBottom: spacing.xl,
    flexGrow: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 18,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  rowTitle: {
    fontFamily: fonts.displaySemi,
    fontSize: 18,
    letterSpacing: -0.2,
  },
  rowCity: {
    fontFamily: fonts.body,
    fontSize: 13.5,
  },
  rowMeta: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 2,
  },
  rowDate: {
    fontFamily: fonts.monoSemi,
    fontSize: 11,
  },
  rowMetaText: {
    fontFamily: fonts.mono,
    fontSize: 11,
  },
  removeButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: spacing.lg,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: fonts.displaySemi,
    fontSize: 18,
    marginTop: 6,
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  emptyCta: {
    marginTop: 16,
    alignSelf: 'stretch',
  },
});

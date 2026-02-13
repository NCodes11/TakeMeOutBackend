import { RouteMap } from '@/components/RouteMap';
import { StopCard } from '@/components/StopCard';
import { AppCard, AppScreen, PrimaryButton, SecondaryButton } from '@/components/ui';
import { usePlanStore } from '@/store/usePlanStore';
import { exportIcs, planCode, shareJson } from '@/utils/share';
import { router, useLocalSearchParams } from 'expo-router';
import { Linking, StyleSheet, View } from 'react-native';
import { Card, SegmentedButtons, Text } from 'react-native-paper';
import QRCode from 'react-native-qrcode-svg';
import { useState } from 'react';
import { palette, spacing } from '@/theme/appTheme';
import { buildAppleMapsPinUrl, hasValidCoords } from '@/utils/maps';

const isViewMode = (value: string): value is 'timeline' | 'list' => value === 'timeline' || value === 'list';

export default function GeneratedPlanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const plans = usePlanStore((s) => s.plans);
  const lockStop = usePlanStore((s) => s.lockStop);
  const stops = usePlanStore((s) => s.stopsByPlan[id] || []);
  const warning = usePlanStore((s) => s.warning);
  const [view, setView] = useState<'timeline' | 'list'>('timeline');
  const plan = plans.find((p) => p.id === id);
  const orderedStops = [...stops].sort((a, b) => a.order - b.order);
  if (!plan) return <Text>Plan not found</Text>;

  return (
    <AppScreen title={plan.title} subtitle={`${plan.city} · ${plan.date}`}>
      <SegmentedButtons
        value={view}
        onValueChange={(v) => {
          if (isViewMode(v)) setView(v);
        }}
        buttons={[{ value: 'timeline', label: 'Timeline' }, { value: 'list', label: 'List' }]}
      />
      <RouteMap stops={orderedStops} />
      {orderedStops.length === 0 ? (
        <View style={styles.emptyState}>
          <Text variant="titleMedium" style={styles.emptyTitle}>No stops generated</Text>
          <Text variant="bodySmall" style={styles.emptyText}>Try adjusting your interests or stop count.</Text>
        </View>
      ) : null}
      {warning ? (
        <View style={styles.warningState}>
          <Text variant="bodySmall" style={styles.warningText}>{warning}</Text>
        </View>
      ) : null}
      {view === 'timeline'
        ? orderedStops.map((s) => (
            <StopCard
              key={s.id}
              stop={s}
              onLock={() => lockStop(id, s.id, s.locked !== 1)}
              onOpenMap={
                hasValidCoords({ lat: s.lat, lng: s.lng })
                  ? async () => {
                      const url = buildAppleMapsPinUrl({ lat: s.lat, lng: s.lng }, s.name);
                      console.log('[maps] open_stop_pin', { stop: s.name, destination: { lat: s.lat, lng: s.lng }, url });
                      await Linking.openURL(url);
                    }
                  : undefined
              }
            />
          ))
        : orderedStops.map((s, index) => (
            <AppCard key={s.id}>
              <Card.Title title={`${index + 1}. ${s.name}`} subtitle={`${s.category} · ${s.address}`} />
              <Card.Actions>
                <SecondaryButton
                  onPress={async () => {
                    if (!hasValidCoords({ lat: s.lat, lng: s.lng })) return;
                    const url = buildAppleMapsPinUrl({ lat: s.lat, lng: s.lng }, s.name);
                    await Linking.openURL(url);
                  }}
                >
                  Open in Maps
                </SecondaryButton>
              </Card.Actions>
            </AppCard>
          ))}
      <View style={styles.actions}>
        <SecondaryButton onPress={() => router.push(`/plan/${id}`)}>Plan detail</SecondaryButton>
        <PrimaryButton onPress={() => router.push(`/today/${id}`)}>Today mode</PrimaryButton>
        <SecondaryButton onPress={() => shareJson(plan, stops)}>Share JSON</SecondaryButton>
        <SecondaryButton onPress={() => exportIcs(plan, stops)}>Export .ics</SecondaryButton>
      </View>
      <AppCard>
        <Card.Content style={styles.codeWrap}>
          <Text variant="titleSmall" style={styles.codeTitle}>Plan code: {planCode(plan)}</Text>
          <QRCode value={JSON.stringify({ planId: plan.id, code: planCode(plan) })} size={140} />
        </Card.Content>
      </AppCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  codeWrap: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  codeTitle: {
    color: palette.text,
    fontWeight: '600',
  },
  emptyState: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 14,
    backgroundColor: palette.surface,
    padding: spacing.lg,
  },
  emptyTitle: {
    color: palette.text,
    marginBottom: spacing.xs,
  },
  emptyText: {
    color: palette.muted,
  },
  warningState: {
    borderWidth: 1,
    borderColor: '#fcd34d',
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    padding: spacing.sm,
  },
  warningText: {
    color: '#92400e',
  },
});

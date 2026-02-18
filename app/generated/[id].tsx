import { RouteMap } from '@/components/RouteMap';
import { StopCard } from '@/components/StopCard';
import { AppCard, AppScreen, PrimaryButton, SecondaryButton } from '@/components/ui';
import { usePlanStore } from '@/store/usePlanStore';
import { exportIcs, planCode, shareJson } from '@/utils/share';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Linking, StyleSheet, View } from 'react-native';
import { Card, SegmentedButtons, Text } from 'react-native-paper';
import QRCode from 'react-native-qrcode-svg';
import { useMemo, useState } from 'react';
import { palette, spacing } from '@/theme/appTheme';
import { buildAppleMapsPinUrl, hasValidCoords } from '@/utils/maps';
import { WizardInput } from '@/types/models';

const isViewMode = (value: string): value is 'timeline' | 'list' => value === 'timeline' || value === 'list';

export default function GeneratedPlanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const plans = usePlanStore((s) => s.plans);
  const stops = usePlanStore((s) => s.stopsByPlan[id] || []);
  const warning = usePlanStore((s) => s.warning);
  const rerollStop = usePlanStore((s) => s.rerollStop);

  const [view, setView] = useState<'timeline' | 'list'>('timeline');

  const plan = plans.find((p) => p.id === id);
  const orderedStops = [...stops].sort((a, b) => a.order - b.order);

  const derivedInput: WizardInput | null = useMemo(() => {
    if (!plan) return null;

    let preferences: any = {};
    try {
      preferences = plan.preferencesJSON ? JSON.parse(plan.preferencesJSON) : {};
    } catch {
      preferences = {};
    }

    return {
      city: plan.city,
      date: plan.date,
      startTime: plan.startTime,
      endTime: plan.endTime,
      groupType: plan.groupType,
      transport: plan.transport,
      budget: plan.budget,
      returnToStart: plan.returnToStart,

      startLat: plan.startLat,
      startLng: plan.startLng,

      stopCount: typeof preferences?.stopCount === 'number' ? preferences.stopCount : orderedStops.length,

      adults: typeof preferences?.adults === 'number' ? preferences.adults : 2,
      kids: typeof preferences?.kids === 'number' ? preferences.kids : 0,
      kidAges: Array.isArray(preferences?.kidAges) ? preferences.kidAges : [],

      startLocationMode: typeof preferences?.startLocationMode === 'string' ? preferences.startLocationMode : 'my-location',
      startAddress: typeof preferences?.startAddress === 'string' ? preferences.startAddress : '',

      preferences: {
        interests: Array.isArray(preferences?.interests) ? preferences.interests : [],
        avoid: Array.isArray(preferences?.avoid) ? preferences.avoid : [],
        mustInclude: typeof preferences?.mustInclude === 'string' ? preferences.mustInclude : '',
        maxTravelMinutes: typeof preferences?.maxTravelMinutes === 'number' ? preferences.maxTravelMinutes : undefined,
        kidFriendly: Boolean(preferences?.kidFriendly),
        accessibleFriendly: Boolean(preferences?.accessibleFriendly),
      },
    } as WizardInput;
  }, [plan, orderedStops.length]);

  if (!plan) return <Text>Plan not found</Text>;

  return (
    <AppScreen title={plan.title} subtitle={`${plan.city} · ${plan.date}`}>
      <SegmentedButtons
        value={view}
        onValueChange={(v) => {
          if (isViewMode(v)) setView(v);
        }}
        buttons={[
          { value: 'timeline', label: 'Timeline' },
          { value: 'list', label: 'List' },
        ]}
      />

      <RouteMap stops={orderedStops} />

      {orderedStops.length === 0 ? (
        <View style={styles.emptyState}>
          <Text variant="titleMedium" style={styles.emptyTitle}>
            No stops generated
          </Text>
          <Text variant="bodySmall" style={styles.emptyText}>
            Try adjusting your interests or stop count.
          </Text>
        </View>
      ) : null}

      {warning ? (
        <View style={styles.warningState}>
          <Text variant="bodySmall" style={styles.warningText}>
            {warning}
          </Text>
        </View>
      ) : null}

      {view === 'timeline'
        ? orderedStops.map((s) => (
            <StopCard
              key={s.id}
              stop={s}
              onReroll={() => {
                if (!derivedInput) return;
                rerollStop(id, derivedInput, s.order);
              }}
              onOpenMap={async () => {
                if (!hasValidCoords({ lat: s.lat, lng: s.lng })) {
                  Alert.alert(
                    'Missing location data',
                    'This stop is missing coordinates. Regenerate your plan to refresh place details.',
                  );
                  return;
                }
                const url = buildAppleMapsPinUrl({ lat: s.lat, lng: s.lng }, s.name);
                await Linking.openURL(url);
              }}
            />
          ))
        : orderedStops.map((s, index) => (
            <AppCard key={s.id}>
              <Card.Title title={`${index + 1}. ${s.name}`} subtitle={`${s.category} · ${s.address}`} />
              <Card.Actions>
                <SecondaryButton
                  onPress={async () => {
                    if (!hasValidCoords({ lat: s.lat, lng: s.lng })) {
                      Alert.alert(
                        'Missing location data',
                        'This stop is missing coordinates. Regenerate your plan to refresh place details.',
                      );
                      return;
                    }
                    const url = buildAppleMapsPinUrl({ lat: s.lat, lng: s.lng }, s.name);
                    await Linking.openURL(url);
                  }}
                >
                  Open in Maps
                </SecondaryButton>

                <SecondaryButton
                  onPress={() => {
                    if (!derivedInput) return;
                    rerollStop(id, derivedInput, s.order);
                  }}
                >
                  Reroll
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
          <Text variant="titleSmall" style={styles.codeTitle}>
            Plan code: {planCode(plan)}
          </Text>
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

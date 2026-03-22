import { RouteMap } from '@/components/RouteMap';
import { StopCard } from '@/components/StopCard';
import { FeedbackModal } from '@/components/FeedbackModal';
import { PlaceInfoModal } from '@/components/PlaceInfoModal';
import { GenerationLoadingOverlay } from '@/components/GenerationLoadingOverlay';
import { AppCard, AppScreen, PrimaryButton, SecondaryButton } from '@/components/ui';
import { usePlanStore } from '@/store/usePlanStore';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Linking, Share, StyleSheet, View } from 'react-native';
import { Card, SegmentedButtons, Text, useTheme } from 'react-native-paper';
import { useMemo, useState } from 'react';
import { spacing } from '@/theme/appTheme';
import { buildGoogleMapsPinUrl, hasValidCoords } from '@/utils/maps';
import { resolveDisplayPriceTier } from '@/utils/priceTier';
import { WizardInput, Stop } from '@/types/models';

const isViewMode = (value: string): value is 'timeline' | 'list' =>
  value === 'timeline' || value === 'list';

export default function GeneratedPlanScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const planId = typeof id === 'string' ? id : '';

  const plans = usePlanStore((s) => s.plans);
  const stops = usePlanStore((s) => s.stopsByPlan[planId] || []);
  const routeLegs = usePlanStore((s) => s.routeLegsByPlan[planId] || []);
  const warning = usePlanStore((s) => s.warning);
  const error = usePlanStore((s) => s.error);
  const loading = usePlanStore((s) => s.loading);
  const loadingProgress = usePlanStore((s) => s.loadingProgress);

  const rerollStop = usePlanStore((s) => s.rerollStop);
  const rerollingByPlan = usePlanStore((s) => s.rerollingByPlan);

  const [view, setView] = useState<'timeline' | 'list'>('timeline');
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const [placeInfoVisible, setPlaceInfoVisible] = useState(false);

  const plan = plans.find((p) => p.id === planId);
  const orderedStops = [...stops].sort((a, b) => a.order - b.order);

  const handleOpenPlaceInfo = (stop: Stop) => {
    setSelectedStop(stop);
    setPlaceInfoVisible(true);
  };

  const handleClosePlaceInfo = () => {
    setPlaceInfoVisible(false);
    setSelectedStop(null);
  };

  const derivedInput: WizardInput | null = useMemo(() => {
    if (!plan) return null;

    let preferences: Record<string, unknown> = {};
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
      feelingLucky: Boolean(preferences?.feelingLucky),
      returnToStart: plan.returnToStart,

      startLat: plan.startLat,
      startLng: plan.startLng,

      stopCount:
        typeof preferences?.stopCount === 'number'
          ? preferences.stopCount
          : orderedStops.length,

      adults: typeof preferences?.adults === 'number' ? preferences.adults : 2,
      kids: typeof preferences?.kids === 'number' ? preferences.kids : 0,
      kidAges: Array.isArray(preferences?.kidAges) ? preferences.kidAges : [],

      startLocationMode:
        typeof preferences?.startLocationMode === 'string'
          ? preferences.startLocationMode
          : 'my-location',
      startAddress:
        typeof preferences?.startAddress === 'string'
          ? preferences.startAddress
          : '',

      preferences: {
        interests: Array.isArray(preferences?.interests) ? preferences.interests : [],
        avoid: Array.isArray(preferences?.avoid) ? preferences.avoid : [],
        mustInclude: typeof preferences?.mustInclude === 'string' ? preferences.mustInclude : '',
        maxTravelMinutes:
          typeof preferences?.maxTravelMinutes === 'number'
            ? preferences.maxTravelMinutes
            : undefined,
        accessibleFriendly: Boolean(preferences?.accessibleFriendly),
      },
    } as WizardInput;
  }, [plan, orderedStops.length]);

  if (!plan) return <Text>Plan not found</Text>;

  const handleReroll = (stopOrder: number, rerolling: boolean) => {
    if (rerolling) return;
    if (!derivedInput) return;

    void rerollStop(planId, derivedInput, stopOrder).catch((e) => {
      const message =
        e instanceof Error ? e.message : 'Unable to reroll. Please try again.';
      Alert.alert('Reroll failed', message);
    });
  };

  const handleSharePlan = async () => {
    const stopLines = orderedStops
      .map((stop, index) => `${index + 1}. ${stop.name}`)
      .join('\n');

    const message = [
      `Check out this Take Me Out plan for ${plan.city} on ${plan.date}.`,
      '',
      stopLines || 'No stops added yet.',
    ].join('\n');

    try {
      await Share.share({
        title: `Take Me Out plan for ${plan.city}`,
        message,
      });
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Unable to share this plan right now.';
      Alert.alert('Share failed', message);
    }
  };

  return (
    <>
    <AppScreen>
      <Text variant="headlineSmall" style={[styles.topTitle, { color: theme.colors.onSurface }]}>
        {plan.city} · {plan.date}
      </Text>

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

      <RouteMap stops={orderedStops} routeLegs={routeLegs} />

      {warning ? (
        <View
          style={[
            styles.warningState,
            {
              borderColor: theme.colors.secondary,
              backgroundColor: theme.colors.secondaryContainer,
            },
          ]}
        >
          <Text variant="bodySmall" style={{ color: theme.colors.onSecondaryContainer }}>
            {warning}
          </Text>
        </View>
      ) : null}

      {error ? (
        <View
          style={[
            styles.errorState,
            {
              borderColor: theme.colors.error,
              backgroundColor: theme.colors.errorContainer,
            },
          ]}
        >
          <Text variant="bodySmall" style={{ color: theme.colors.onErrorContainer }}>
            {error}
          </Text>
        </View>
      ) : null}

      {view === 'timeline'
        ? orderedStops.map((s) => {
            const rerolling = Boolean(rerollingByPlan[planId]?.[s.order]);

            return (
              <StopCard
                key={s.id}
                stop={s}
                fallbackBudget={plan.budget}
                rerolling={rerolling}
                onPressInfo={handleOpenPlaceInfo}
                onReroll={() => handleReroll(s.order, rerolling)}
                onOpenMap={async () => {
                  if (!hasValidCoords({ lat: s.lat, lng: s.lng })) {
                    Alert.alert(
                      'Missing location data',
                      'This stop is missing coordinates. Regenerate your plan to refresh place details.',
                    );
                    return;
                  }
                  const url = buildGoogleMapsPinUrl({ lat: s.lat, lng: s.lng });
                  await Linking.openURL(url);
                }}
              />
            );
          })
        : orderedStops.map((s, index) => {
            const rerolling = Boolean(rerollingByPlan[planId]?.[s.order]);

            return (
              <AppCard key={s.id}>
                <Card.Content style={styles.listCardContent}>
                  <Text
                    variant="titleMedium"
                    style={[styles.listCardTitle, { color: theme.colors.onSurface }]}
                    onPress={() => handleOpenPlaceInfo(s)}
                  >
                    {index + 1}. {s.name}
                  </Text>

                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {[s.category, s.address, `Price ${resolveDisplayPriceTier(s.priceLevel, s.costLevel, plan.budget)}`]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </Card.Content>

                <Card.Actions>
                  <SecondaryButton onPress={() => handleOpenPlaceInfo(s)}>
                    Place Info
                  </SecondaryButton>

                  <SecondaryButton
                    disabled={rerolling}
                    loading={rerolling}
                    onPress={() => handleReroll(s.order, rerolling)}
                  >
                    {rerolling ? 'Finding…' : 'Reroll'}
                  </SecondaryButton>
                </Card.Actions>
              </AppCard>
            );
          })}

      <View style={styles.actions}>
        <SecondaryButton onPress={handleSharePlan}>Share Plan</SecondaryButton>
      </View>

      <PrimaryButton onPress={() => setFeedbackVisible(true)}>
        Finish Day
      </PrimaryButton>

      <FeedbackModal
        visible={feedbackVisible}
        plan={plan}
        stops={orderedStops}
        onDismiss={() => setFeedbackVisible(false)}
        onSubmitted={() => {
          setFeedbackVisible(false);
          router.push('/');
        }}
      />

      <PlaceInfoModal
        visible={placeInfoVisible}
        stop={selectedStop}
        onDismiss={handleClosePlaceInfo}
      />
    </AppScreen>
    <GenerationLoadingOverlay visible={loading} progress={loadingProgress} />
    </>
  );
}

const styles = StyleSheet.create({
  topTitle: {
    fontWeight: '700',
    marginBottom: spacing.xs,
    textAlign: 'center',
    width: '100%',
  },
  listCardTitle: {
    textDecorationLine: 'underline',
  },
  listCardContent: {
    gap: spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  warningState: {
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.sm,
  },
  errorState: {
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.sm,
  },
});

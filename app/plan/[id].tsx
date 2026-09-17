import { RouteMap } from '@/components/RouteMap';
import { StopCard } from '@/components/StopCard';
import { FeedbackModal } from '@/components/FeedbackModal';
import { PlaceInfoModal } from '@/components/PlaceInfoModal';
import { GenerationLoadingOverlay } from '@/components/GenerationLoadingOverlay';
import {
  AppScreen,
  Dock,
  GhostButton,
  Notice,
  PrimaryButton,
  RouteHeader,
  RouteListRow,
  SecondaryButton,
  Segmented,
} from '@/components/ui';
import { usePlanStore } from '@/store/usePlanStore';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Linking, Share, StyleSheet, Text, View } from 'react-native';
import { useMemo, useState } from 'react';
import { spacing, useAppPalette } from '@/theme/appTheme';
import { buildGoogleMapsPinUrl, hasValidCoords } from '@/utils/maps';
import { WizardInput, Stop } from '@/types/models';
import { RouteLeg } from '@/providers/routingProvider';

type ViewMode = 'map' | 'list';

const VIEW_OPTIONS = [
  { value: 'map', label: 'Map' },
  { value: 'list', label: 'List' },
] as const;
const EMPTY_STOPS: Stop[] = [];
const EMPTY_ROUTE_LEGS: RouteLeg[] = [];

export default function PlanDetailScreen() {
  const p = useAppPalette();
  const { id } = useLocalSearchParams<{ id: string }>();
  const planId = typeof id === 'string' ? id : '';

  const plans = usePlanStore((s) => s.plans);
  const stops = usePlanStore((s) => s.stopsByPlan[planId] ?? EMPTY_STOPS);
  const routeLegs = usePlanStore((s) => s.routeLegsByPlan[planId] ?? EMPTY_ROUTE_LEGS);
  const warning = usePlanStore((s) => s.warning);
  const error = usePlanStore((s) => s.error);
  const loading = usePlanStore((s) => s.loading);
  const loadingProgress = usePlanStore((s) => s.loadingProgress);

  const rerollStop = usePlanStore((s) => s.rerollStop);
  const rerollingByPlan = usePlanStore((s) => s.rerollingByPlan);

  const [view, setView] = useState<ViewMode>('map');
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const [placeInfoVisible, setPlaceInfoVisible] = useState(false);

  const plan = plans.find((pl) => pl.id === planId);
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
      pace:
        preferences.pace === 'relaxed' || preferences.pace === 'packed'
          ? preferences.pace
          : 'standard',
      feelingLucky: Boolean(preferences?.feelingLucky),
      returnToStart: plan.returnToStart,

      startLat: plan.startLat,
      startLng: plan.startLng,

      stopCount:
        typeof preferences?.stopCount === 'number' ? preferences.stopCount : orderedStops.length,

      adults: typeof preferences?.adults === 'number' ? preferences.adults : 2,
      kids: typeof preferences?.kids === 'number' ? preferences.kids : 0,
      kidAges: Array.isArray(preferences?.kidAges) ? preferences.kidAges : [],

      startLocationMode:
        typeof preferences?.startLocationMode === 'string'
          ? preferences.startLocationMode
          : 'my-location',
      startAddress: typeof preferences?.startAddress === 'string' ? preferences.startAddress : '',

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

  if (!plan) {
    return (
      <AppScreen title="Plan not found">
        <Text style={{ color: p.textMid }}>This plan is no longer available.</Text>
      </AppScreen>
    );
  }

  const handleReroll = (stopOrder: number, rerolling: boolean) => {
    if (rerolling) return;
    if (!derivedInput) return;

    void rerollStop(planId, derivedInput, stopOrder).catch((e) => {
      const message = e instanceof Error ? e.message : 'Unable to reroll. Please try again.';
      Alert.alert('Reroll failed', message);
    });
  };

  const handleSharePlan = async () => {
    const stopLines = orderedStops.map((stop, index) => `${index + 1}. ${stop.name}`).join('\n');

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
      const message = e instanceof Error ? e.message : 'Unable to share this plan right now.';
      Alert.alert('Share failed', message);
    }
  };

  const openInMaps = async (s: Stop) => {
    if (!hasValidCoords({ lat: s.lat, lng: s.lng })) {
      Alert.alert(
        'Missing location data',
        'This stop is missing coordinates. Regenerate your plan to refresh place details.',
      );
      return;
    }
    await Linking.openURL(buildGoogleMapsPinUrl({ lat: s.lat, lng: s.lng }));
  };

  const totalKm = routeLegs.reduce((sum, leg) => sum + leg.distanceKm, 0);
  const totalTravelMin = routeLegs.reduce((sum, leg) => sum + leg.etaMin, 0);

  return (
    <>
      <AppScreen dockSpace>
        <RouteHeader
          eyebrow={plan.title ? plan.title : 'Saved plan'}
          title={plan.city}
          date={plan.date}
          startTime={plan.startTime}
          endTime={plan.endTime}
          stopCount={orderedStops.length}
          distanceKm={routeLegs.length ? totalKm : undefined}
          travelMin={routeLegs.length ? totalTravelMin : undefined}
          transport={plan.transport}
          action={<GhostButton onPress={handleSharePlan}>Share</GhostButton>}
        />

        <Segmented options={VIEW_OPTIONS} value={view} onChange={setView} style={styles.segment} />

        {view === 'map' ? (
          <View style={styles.mapWrap}>
            <RouteMap stops={orderedStops} routeLegs={routeLegs} />
          </View>
        ) : null}

        {warning ? (
          <View style={styles.notice}>
            <Notice tone="signal" title="Heads up">
              {warning}
            </Notice>
          </View>
        ) : null}

        {error ? (
          <View style={styles.notice}>
            <Notice title="Something went wrong">{error}</Notice>
          </View>
        ) : null}

        <View style={styles.stops}>
          {view === 'map'
            ? orderedStops.map((s, index) => {
                const rerolling = Boolean(rerollingByPlan[planId]?.[s.order]);
                return (
                  <StopCard
                    key={s.id}
                    stop={s}
                    rerolling={rerolling}
                    divider={index < orderedStops.length - 1}
                    onPressInfo={handleOpenPlaceInfo}
                    onReroll={() => handleReroll(s.order, rerolling)}
                    onOpenMap={() => void openInMaps(s)}
                  />
                );
              })
            : orderedStops.map((s, index) => {
                const rerolling = Boolean(rerollingByPlan[planId]?.[s.order]);
                return (
                  <RouteListRow
                    key={s.id}
                    stop={s}
                    divider={index < orderedStops.length - 1}
                    onPress={() => handleOpenPlaceInfo(s)}
                    actions={
                      <>
                        <SecondaryButton icon="map-outline" onPress={() => void openInMaps(s)}>
                          Maps
                        </SecondaryButton>
                        <SecondaryButton
                          icon="refresh"
                          disabled={rerolling}
                          loading={rerolling}
                          onPress={() => handleReroll(s.order, rerolling)}
                        >
                          Reroll
                        </SecondaryButton>
                      </>
                    }
                  />
                );
              })}
        </View>

        {orderedStops.length > 0 ? (
          <View style={styles.finishRow}>
            <GhostButton icon="check-circle-outline" onPress={() => setFeedbackVisible(true)}>
              Finish day
            </GhostButton>
          </View>
        ) : null}

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

      <Dock>
        <PrimaryButton
          icon="navigation-variant-outline"
          disabled={orderedStops.length === 0}
          onPress={() => router.push(`/today/${plan.id}`)}
        >
          Start day
        </PrimaryButton>
      </Dock>

      <GenerationLoadingOverlay visible={loading} progress={loadingProgress} />
    </>
  );
}

const styles = StyleSheet.create({
  segment: {
    marginTop: 16,
  },
  mapWrap: {
    marginTop: 14,
  },
  notice: {
    marginTop: 14,
  },
  stops: {
    marginTop: 4,
  },
  finishRow: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
});

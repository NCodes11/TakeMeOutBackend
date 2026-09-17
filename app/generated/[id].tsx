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
  SaveSheet,
  SecondaryButton,
  Segmented,
} from '@/components/ui';
import { usePlanStore } from '@/store/usePlanStore';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Linking, Share, StyleSheet, Text, View } from 'react-native';
import { useMemo, useState } from 'react';
import { spacing, useAppPalette } from '@/theme/appTheme';
import { buildGoogleMapsPinUrl, hasValidCoords } from '@/utils/maps';
import { Plan, Stop, WizardInput } from '@/types/models';
import { RouteLeg } from '@/providers/routingProvider';

type ViewMode = 'map' | 'list';

const VIEW_OPTIONS = [
  { value: 'map', label: 'Map' },
  { value: 'list', label: 'List' },
] as const;
const EMPTY_STOPS: Stop[] = [];
const EMPTY_ROUTE_LEGS: RouteLeg[] = [];

const previewPlan: Plan = {
  id: 'preview',
  title: 'Portsmouth Day',
  city: 'Portsmouth, NH',
  date: '2026-09-14',
  startTime: '09:00',
  endTime: '20:00',
  groupType: 'Date',
  transport: 'walk',
  budget: '$$',
  preferencesJSON: JSON.stringify({
    interests: ['coffee', 'attraction', 'restaurant', 'bar'],
    avoid: [],
    mustInclude: '',
    maxTravelMinutes: 30,
    accessibleFriendly: false,
    feelingLucky: false,
    stopCount: 4,
    adults: 2,
    kids: 0,
    kidAges: [],
    startLocationMode: 'custom',
    startAddress: 'Portsmouth, NH',
    pace: 'standard',
  }),
  createdAt: '2026-09-14T09:00:00.000Z',
  returnToStart: true,
  startLat: 43.077,
  startLng: -70.757,
  isSaved: 0,
};

const previewStops: Stop[] = [
  {
    id: 'preview-1',
    planId: 'preview',
    order: 0,
    name: 'Kaffee Vonsolln',
    category: 'Coffee',
    stopType: 'coffee',
    lat: 43.076,
    lng: -70.758,
    address: '79 Daniel Street, Portsmouth',
    startTime: '09:00',
    endTime: '10:00',
    durationMin: 60,
    costLevel: '$$',
    rating: 4.7,
    reviewCount: 482,
    why: 'A calm independent café that gets the day moving without rushing it.',
    locked: 0,
  },
  {
    id: 'preview-2',
    planId: 'preview',
    order: 1,
    name: 'Strawbery Banke Museum',
    category: 'Arts & Culture',
    stopType: 'arts',
    lat: 43.075,
    lng: -70.753,
    address: '14 Hancock Street, Portsmouth',
    startTime: '10:15',
    endTime: '12:15',
    durationMin: 120,
    costLevel: '$$',
    rating: 4.8,
    reviewCount: 2160,
    etaMin: 8,
    why: 'Historic streets, gardens, and exhibits make this the richest slow-browse stop nearby.',
    locked: 0,
  },
  {
    id: 'preview-3',
    planId: 'preview',
    order: 2,
    name: 'Prescott Park',
    category: 'Outdoors',
    stopType: 'outdoors',
    lat: 43.0738,
    lng: -70.7519,
    address: '105 Marcy Street, Portsmouth',
    startTime: '12:25',
    endTime: '13:25',
    durationMin: 60,
    costLevel: '$',
    rating: 4.8,
    reviewCount: 1880,
    etaMin: 6,
    why: 'A low-key waterfront reset before lunch, with enough room to wander at your own pace.',
    locked: 0,
  },
  {
    id: 'preview-4',
    planId: 'preview',
    order: 3,
    name: 'Moxy',
    category: 'Restaurant',
    stopType: 'restaurant',
    lat: 43.0783,
    lng: -70.7588,
    address: '106 Penhallow Street, Portsmouth',
    startTime: '13:40',
    endTime: '15:10',
    durationMin: 90,
    costLevel: '$$',
    rating: 4.6,
    reviewCount: 940,
    etaMin: 12,
    why: 'Inventive small plates keep the date conversational and make sharing easy.',
    locked: 0,
  },
];

const previewRouteLegs: RouteLeg[] = [
  {
    distanceKm: 0.5,
    etaMin: 8,
    polyline: [
      [43.076, -70.758],
      [43.075, -70.753],
    ],
  },
  {
    distanceKm: 0.3,
    etaMin: 6,
    polyline: [
      [43.075, -70.753],
      [43.0738, -70.7519],
    ],
  },
  {
    distanceKm: 0.8,
    etaMin: 12,
    polyline: [
      [43.0738, -70.7519],
      [43.0783, -70.7588],
    ],
  },
];

export default function GeneratedPlanScreen() {
  const p = useAppPalette();
  const { id, capture } = useLocalSearchParams<{ id: string; capture?: string }>();
  const planId = typeof id === 'string' ? id : '';

  const plans = usePlanStore((s) => s.plans);
  const storedStops = usePlanStore((s) => s.stopsByPlan[planId] ?? EMPTY_STOPS);
  const storedRouteLegs = usePlanStore((s) => s.routeLegsByPlan[planId] ?? EMPTY_ROUTE_LEGS);
  const warning = usePlanStore((s) => s.warning);
  const error = usePlanStore((s) => s.error);
  const loading = usePlanStore((s) => s.loading);
  const loadingProgress = usePlanStore((s) => s.loadingProgress);

  const rerollStop = usePlanStore((s) => s.rerollStop);
  const rerollingByPlan = usePlanStore((s) => s.rerollingByPlan);
  const saveExistingPlan = usePlanStore((s) => s.saveExistingPlan);

  const [view, setView] = useState<ViewMode>('map');
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [placeInfoVisible, setPlaceInfoVisible] = useState(false);
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const [saveSheetVisible, setSaveSheetVisible] = useState(false);

  const isPreview = __DEV__ && planId === 'preview';
  const plan = plans.find((pl) => pl.id === planId) || (isPreview ? previewPlan : undefined);
  const stops = isPreview ? previewStops : storedStops;
  const routeLegs = isPreview ? previewRouteLegs : storedRouteLegs;
  const orderedStops = [...stops].sort((a, b) => a.order - b.order);

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
      feelingLucky: Boolean(preferences.feelingLucky),
      returnToStart: plan.returnToStart,
      startLat: plan.startLat,
      startLng: plan.startLng,
      stopCount:
        typeof preferences.stopCount === 'number' ? preferences.stopCount : orderedStops.length,
      adults: typeof preferences.adults === 'number' ? preferences.adults : 2,
      kids: typeof preferences.kids === 'number' ? preferences.kids : 0,
      kidAges: Array.isArray(preferences.kidAges) ? preferences.kidAges : [],
      startLocationMode:
        typeof preferences.startLocationMode === 'string'
          ? preferences.startLocationMode
          : 'my-location',
      startAddress: typeof preferences.startAddress === 'string' ? preferences.startAddress : '',
      preferences: {
        interests: Array.isArray(preferences.interests) ? preferences.interests : [],
        avoid: Array.isArray(preferences.avoid) ? preferences.avoid : [],
        mustInclude: typeof preferences.mustInclude === 'string' ? preferences.mustInclude : '',
        maxTravelMinutes:
          typeof preferences.maxTravelMinutes === 'number'
            ? preferences.maxTravelMinutes
            : undefined,
        accessibleFriendly: Boolean(preferences.accessibleFriendly),
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
    if (isPreview) return;
    if (rerolling) return;
    if (!derivedInput) return;

    void rerollStop(planId, derivedInput, stopOrder).catch((e) => {
      const message = e instanceof Error ? e.message : 'Unable to reroll. Please try again.';
      Alert.alert('Reroll failed', message);
    });
  };

  const handleSharePlan = async () => {
    const stopLines = orderedStops
      .map((stop, index) => {
        const time = stop.startTime && stop.endTime ? ` (${stop.startTime}–${stop.endTime})` : '';
        return `${index + 1}. ${stop.name}${time}`;
      })
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
      const message = e instanceof Error ? e.message : 'Unable to share this plan right now.';
      Alert.alert('Share failed', message);
    }
  };

  const handleOpenPlaceInfo = (stop: Stop) => {
    setSelectedStop(stop);
    setPlaceInfoVisible(true);
  };

  const handleDismissPlaceInfo = () => {
    setPlaceInfoVisible(false);
    setSelectedStop(null);
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
      <AppScreen dockSpace initialScrollY={__DEV__ && capture === 'stops' ? 570 : undefined}>
        <RouteHeader
          eyebrow="Ready route"
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

        {error ? (
          <View style={styles.notice}>
            <Notice title="Something went wrong">{error}</Notice>
          </View>
        ) : null}

        {warning ? (
          <View style={styles.notice}>
            <Notice tone="signal" title="Heads up">
              {warning}
            </Notice>
          </View>
        ) : null}

        {orderedStops.length === 0 && !error ? (
          <View style={styles.notice}>
            <Notice tone="violet" title="No stops generated">
              Try adjusting your interests or stop count.
            </Notice>
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
                    onReroll={() => handleReroll(s.order, rerolling)}
                    onPressInfo={handleOpenPlaceInfo}
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

        <PlaceInfoModal
          visible={placeInfoVisible}
          stop={selectedStop}
          onDismiss={handleDismissPlaceInfo}
        />

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
      </AppScreen>

      <Dock>
        <View style={styles.dockRow}>
          <SecondaryButton
            icon={plan.isSaved === 1 ? 'bookmark-check' : 'bookmark-outline'}
            disabled={plan.isSaved === 1}
            onPress={() => setSaveSheetVisible(true)}
          >
            {plan.isSaved === 1 ? 'Saved' : 'Save'}
          </SecondaryButton>
          <View style={styles.dockPrimary}>
            <PrimaryButton
              icon="navigation-variant-outline"
              disabled={orderedStops.length === 0}
              onPress={() => router.push(`/today/${plan.id}`)}
              style={styles.startButton}
            >
              Start day
            </PrimaryButton>
          </View>
        </View>
      </Dock>

      <SaveSheet
        visible={saveSheetVisible}
        initialTitle={plan.title || `${plan.city} ${plan.groupType} Day`}
        onDismiss={() => setSaveSheetVisible(false)}
        onSave={(title) => {
          saveExistingPlan(plan.id, title);
          setSaveSheetVisible(false);
        }}
      />

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
  dockRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dockPrimary: {
    flex: 1.4,
  },
  startButton: {
    minHeight: 44,
    borderRadius: 12,
  },
});

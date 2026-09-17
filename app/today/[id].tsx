import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FeedbackModal } from '@/components/FeedbackModal';
import { StopHeroMedia } from '@/components/StopHeroMedia';
import {
  AppScreen,
  Dock,
  GhostButton,
  MonoLabel,
  Notice,
  PrimaryButton,
  SecondaryButton,
  TimeText,
} from '@/components/ui';
import { useLocation } from '@/context/LocationContext';
import { useTimeFormat } from '@/context/PreferencesContext';
import { usePlanStore } from '@/store/usePlanStore';
import { fonts, radius, spacing, useAppPalette } from '@/theme/appTheme';
import { buildAppleMapsDirectionsUrl, hasValidCoords, LatLng } from '@/utils/maps';
import { openMapsOptions } from '@/utils/openMapsOptions';
import { resolvePrimaryPhotoUrl } from '@/utils/stopMedia';
import { formatTimeDisplay } from '@/utils/time';
import { Stop } from '@/types/models';

const EMPTY_STOPS: Stop[] = [];

export default function TodayMode() {
  const p = useAppPalette();
  const timeFormat = useTimeFormat();
  const { id } = useLocalSearchParams<{ id: string }>();
  const location = useLocation();
  const plans = usePlanStore((s) => s.plans);
  const stops = usePlanStore((s) => s.stopsByPlan[id] ?? EMPTY_STOPS);

  const plan = plans.find((pl) => pl.id === id);
  const orderedStops = useMemo(() => [...stops].sort((a, b) => a.order - b.order), [stops]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [feedbackVisible, setFeedbackVisible] = useState(false);

  const current = orderedStops[Math.min(currentIndex, Math.max(orderedStops.length - 1, 0))];
  const previous = currentIndex > 0 ? orderedStops[currentIndex - 1] : undefined;
  const isLast = currentIndex >= orderedStops.length - 1;

  const origin: LatLng | null =
    location.coords &&
    Number.isFinite(location.coords.latitude) &&
    Number.isFinite(location.coords.longitude)
      ? { lat: location.coords.latitude, lng: location.coords.longitude }
      : null;
  const originLoading = location.mode === 'live' && !origin && location.permission !== 'denied';
  const originError =
    location.permission !== 'granted' && location.mode === 'live'
      ? 'Location access is required to open turn-by-turn directions from where you are.'
      : null;

  const destination =
    current && hasValidCoords({ lat: current.lat, lng: current.lng })
      ? { lat: current.lat, lng: current.lng }
      : null;
  const mode = plan?.transport === 'walk' ? 'w' : 'd';

  // Built from live origin + the current stop for direct turn-by-turn handoff.
  const directionsUrl = useMemo(
    () => (origin && destination ? buildAppleMapsDirectionsUrl(origin, destination, mode) : null),
    [destination, mode, origin],
  );

  // All hooks must run before this conditional return (Rules of Hooks).
  if (!plan || !current) {
    return (
      <AppScreen title="Nothing to navigate">
        <Text style={{ color: p.textMid, fontFamily: fonts.body }}>
          This plan has no stops yet.
        </Text>
      </AppScreen>
    );
  }

  const openDirections = async () => {
    if (!directionsUrl || !origin || !destination) return;
    console.log('[maps] open_directions', {
      origin,
      destination,
      stop: { name: current.name, lat: current.lat, lng: current.lng },
      url: directionsUrl,
    });
    await Linking.openURL(directionsUrl);
  };

  const openInMaps = () => {
    if (!destination) return;
    void openMapsOptions({
      name: current.name,
      lat: current.lat,
      lng: current.lng,
    });
  };

  let helperText = '';
  if (originLoading) helperText = 'Getting your current location…';
  else if (!destination)
    helperText = 'This stop is missing coordinates. Try regenerating your plan.';
  else if (originError) helperText = originError;

  const timeRange =
    current.startTime && current.endTime
      ? `${formatTimeDisplay(current.startTime, timeFormat)}–${formatTimeDisplay(current.endTime, timeFormat)}`
      : null;

  const travelHint =
    typeof current.etaMin === 'number' && current.etaMin > 0
      ? `${current.etaMin} min ${plan.transport === 'walk' ? 'walk' : 'drive'}${previous ? ` from ${previous.name}` : ''}`
      : null;

  const subline = [current.address, travelHint].filter(Boolean).join(' · ');

  return (
    <>
      <AppScreen dockSpace>
        <MonoLabel>
          Now · stop {currentIndex + 1} of {orderedStops.length}
        </MonoLabel>
        <Text style={[styles.title, { color: p.textHigh }]} accessibilityRole="header">
          {current.name}
        </Text>

        {timeRange ? (
          <View style={styles.timeRow}>
            <TimeText style={styles.timeBig}>{timeRange}</TimeText>
            {current.endTime ? (
              <Text style={[styles.leaveBy, { color: p.textLow }]}>
                leave by {formatTimeDisplay(current.endTime, timeFormat)}
              </Text>
            ) : null}
          </View>
        ) : null}

        {subline ? <Text style={[styles.subline, { color: p.textMid }]}>{subline}</Text> : null}

        <View style={styles.media}>
          <StopHeroMedia stop={current} uri={resolvePrimaryPhotoUrl(current)} height={180} />
        </View>

        <View style={styles.actions}>
          <SecondaryButton
            icon="navigation-variant-outline"
            disabled={!directionsUrl}
            onPress={() => void openDirections()}
          >
            Directions
          </SecondaryButton>
          <SecondaryButton icon="map-outline" disabled={!destination} onPress={openInMaps}>
            Open in Maps
          </SecondaryButton>
        </View>

        {helperText ? (
          <View style={styles.helper}>
            <Notice tone="signal">{helperText}</Notice>
          </View>
        ) : null}

        <View style={styles.progressHeader}>
          <MonoLabel>Progress</MonoLabel>
          <View style={[styles.rule, { backgroundColor: p.line }]} />
          <MonoLabel>
            {currentIndex} of {orderedStops.length} done
          </MonoLabel>
        </View>
        <View style={styles.progressBar}>
          {orderedStops.map((s, index) => (
            <View
              key={s.id}
              style={[
                styles.progressSeg,
                {
                  backgroundColor:
                    index < currentIndex
                      ? p.violetFill
                      : index === currentIndex
                        ? p.violetDecorative
                        : p.surfacePressed,
                },
              ]}
            />
          ))}
        </View>

        <View style={styles.list}>
          {orderedStops.map((s, index) => {
            const done = index < currentIndex;
            const active = index === currentIndex;
            return (
              <Pressable
                key={s.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setCurrentIndex(index)}
                style={[styles.listRow, { borderBottomColor: p.line }]}
              >
                <Text style={[styles.listIndex, { color: done ? p.textLow : p.violetText }]}>
                  {String(index + 1).padStart(2, '0')}
                </Text>
                <Text
                  style={[
                    styles.listName,
                    { color: done ? p.textLow : p.textHigh },
                    active && styles.listNameActive,
                  ]}
                  numberOfLines={1}
                >
                  {s.name}
                </Text>
                {done ? (
                  <MaterialCommunityIcons name="check" size={16} color={p.textLow} />
                ) : s.startTime ? (
                  <TimeText style={styles.listTime}>
                    {formatTimeDisplay(s.startTime, timeFormat)}
                  </TimeText>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.finishRow}>
          <GhostButton icon="check-circle-outline" onPress={() => setFeedbackVisible(true)}>
            Finish day early
          </GhostButton>
        </View>

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
        {isLast ? (
          <PrimaryButton icon="check-circle-outline" onPress={() => setFeedbackVisible(true)}>
            Finish day
          </PrimaryButton>
        ) : (
          <PrimaryButton icon="arrow-right" onPress={() => setCurrentIndex((i) => i + 1)}>
            Next stop
          </PrimaryButton>
        )}
      </Dock>
    </>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 35,
    letterSpacing: -0.9,
    marginTop: 6,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
    marginTop: 14,
  },
  timeBig: {
    fontSize: 22,
  },
  leaveBy: {
    fontFamily: fonts.mono,
    fontSize: 12,
  },
  subline: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
  },
  media: {
    marginTop: 20,
    borderRadius: radius.media,
    overflow: 'hidden',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  helper: {
    marginTop: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 26,
  },
  rule: {
    flex: 1,
    height: 1,
  },
  progressBar: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
  },
  progressSeg: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  list: {
    marginTop: 14,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 46,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  listIndex: {
    fontFamily: fonts.monoSemi,
    fontSize: 11.5,
    width: 22,
  },
  listName: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 15,
  },
  listNameActive: {
    fontFamily: fonts.bodySemi,
  },
  listTime: {
    fontSize: 12,
  },
  finishRow: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
});

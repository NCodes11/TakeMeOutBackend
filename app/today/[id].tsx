import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Card, Text } from 'react-native-paper';
import { AppCard, AppScreen, PrimaryButton, SecondaryButton } from '@/components/ui';
import { useLocation } from '@/context/LocationContext';
import { usePlanStore } from '@/store/usePlanStore';
import { buildAppleMapsDirectionsUrl, hasValidCoords, LatLng } from '@/utils/maps';
import { palette, spacing } from '@/theme/appTheme';

export default function TodayMode() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const location = useLocation();
  const plans = usePlanStore((s) => s.plans);
  const stops = usePlanStore((s) => s.stopsByPlan[id] || []);

  const plan = plans.find((p) => p.id === id);
  const next = stops[0];
  const routeDestination = stops[stops.length - 1];

  if (!next || !routeDestination) return <Text>No stop data</Text>;

  const origin: LatLng | null =
    location.coords && Number.isFinite(location.coords.latitude) && Number.isFinite(location.coords.longitude)
      ? { lat: location.coords.latitude, lng: location.coords.longitude }
      : null;
  const originLoading = location.mode === 'live' && (!origin || location.permission !== 'granted');
  const originError = location.permission !== 'granted' ? 'Location access is required to open turn-by-turn directions.' : null;
  const destination = hasValidCoords({ lat: routeDestination.lat, lng: routeDestination.lng })
    ? { lat: routeDestination.lat, lng: routeDestination.lng }
    : null;
  const mode = plan?.transport === 'walk' ? 'w' : 'd';
  const directionsUrl = useMemo(
    () => (origin && destination ? buildAppleMapsDirectionsUrl(origin, destination, mode) : null),
    [destination, mode, origin],
  );
  const mapsReady = Boolean(directionsUrl);

  const openAppleMaps = async () => {
    if (!directionsUrl || !origin || !destination) return;
    console.log('[maps] open_directions', {
      origin,
      destination,
      firstStop: { name: next.name, lat: next.lat, lng: next.lng },
      routeDestination: { name: routeDestination.name, lat: routeDestination.lat, lng: routeDestination.lng },
      url: directionsUrl,
    });
    await Linking.openURL(directionsUrl);
  };

  let helperText = '';
  if (originLoading) helperText = 'Getting your current location...';
  else if (!destination) helperText = 'This stop is missing coordinates. Try regenerating your plan.';
  else if (originError) helperText = originError;

  return (
    <AppScreen title="Today Mode" subtitle="Live navigation from your current location.">
      <AppCard>
        <Card.Title title="Next Stop" subtitle={next.name} />
        <Card.Content>
          <Text>{next.address}</Text>
          <Text>ETA: {next.etaMin || 10} minutes</Text>
          {helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}
        </Card.Content>
        <Card.Actions>
          <PrimaryButton disabled={!mapsReady} onPress={openAppleMaps}>
            Open Apple Maps
          </PrimaryButton>
          <SecondaryButton onPress={() => {}}>We're leaving now</SecondaryButton>
        </Card.Actions>
        {originLoading ? <ActivityIndicator style={styles.loader} size="small" color={palette.primary} /> : null}
      </AppCard>
      <View style={styles.tipWrap}>
        <Text variant="bodySmall" style={styles.tipText}>
          Offline tip: Saved plans remain available from local SQLite cache.
        </Text>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  helperText: {
    color: palette.muted,
    marginTop: spacing.sm,
  },
  loader: {
    marginBottom: spacing.md,
  },
  tipWrap: {
    paddingHorizontal: spacing.xs,
  },
  tipText: {
    color: palette.muted,
  },
});

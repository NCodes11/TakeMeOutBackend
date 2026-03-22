import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { Text, useTheme } from 'react-native-paper';
import { Stop } from '@/types/models';
import { RouteLeg } from '@/providers/routingProvider';
import { hasValidCoords } from '@/utils/maps';
import { spacing } from '@/theme/appTheme';

export const RouteMap = ({ stops }: { stops: Stop[]; routeLegs?: RouteLeg[] }) => {
  const theme = useTheme();
  const mapRef = useRef<MapView | null>(null);
  // Ignore stops with missing coordinates so the map never crashes on partial data.
  const points = stops
    .filter((s) => hasValidCoords({ lat: s.lat, lng: s.lng }))
    .map((s) => ({ latitude: s.lat, longitude: s.lng, title: s.name, description: s.category, order: s.order }));
  const coordinates = points.map((point) => ({ latitude: point.latitude, longitude: point.longitude }));

  const region = useMemo(() => {
    if (points.length === 0) return null;
    if (points.length === 1) {
      return {
        latitude: points[0].latitude,
        longitude: points[0].longitude,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
      };
    }
    const lats = points.map((point) => point.latitude);
    const lngs = points.map((point) => point.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max((maxLat - minLat) * 1.4, 0.04),
      longitudeDelta: Math.max((maxLng - minLng) * 1.4, 0.04),
    };
  }, [points]);

  useEffect(() => {
    if (!mapRef.current || coordinates.length < 2) return;
    // Fit all markers after render for a tighter default camera frame.
    mapRef.current.fitToCoordinates(coordinates, {
      edgePadding: { top: 48, right: 48, bottom: 48, left: 48 },
      animated: true,
    });
  }, [coordinates]);

  if (points.length === 0) {
    return (
      <View style={[styles.emptyMap, { borderColor: theme.colors.outline, backgroundColor: theme.colors.surface }]}>
        <Text variant="bodyMedium" style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>Map unavailable</Text>
        <Text variant="bodySmall" style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>No GPS coordinates were found for this plan.</Text>
      </View>
    );
  }

  return (
    <MapView
      ref={mapRef}
      style={styles.map}
      initialRegion={region || undefined}
    >
      {points.map((p, i) => (
        <Marker coordinate={p} key={i} title={p.title} description={p.description}>
          <View style={[styles.pin, { backgroundColor: theme.colors.primary }]}>
            <Text style={styles.pinText}>{p.order + 1}</Text>
          </View>
        </Marker>
      ))}
      <Polyline coordinates={coordinates} strokeWidth={4} strokeColor={theme.colors.primary} />
    </MapView>
  );
};

const styles = StyleSheet.create({
  map: {
    height: 260,
    borderRadius: 12,
  },
  pin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  pinText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyMap: {
    height: 180,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: {
    marginBottom: spacing.xs,
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
  },
});

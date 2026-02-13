import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { Text } from 'react-native-paper';
import { Stop } from '@/types/models';
import { hasValidCoords } from '@/utils/maps';
import { palette, spacing } from '@/theme/appTheme';

export const RouteMap = ({ stops }: { stops: Stop[] }) => {
  const mapRef = useRef<MapView | null>(null);
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
    mapRef.current.fitToCoordinates(coordinates, {
      edgePadding: { top: 48, right: 48, bottom: 48, left: 48 },
      animated: true,
    });
  }, [coordinates]);

  if (points.length === 0) {
    return (
      <View style={styles.emptyMap}>
        <Text variant="bodyMedium" style={styles.emptyTitle}>Map unavailable</Text>
        <Text variant="bodySmall" style={styles.emptyText}>No GPS coordinates were found for this plan.</Text>
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
          <View style={styles.pin}>
            <Text style={styles.pinText}>{p.order + 1}</Text>
          </View>
        </Marker>
      ))}
      <Polyline coordinates={coordinates} strokeWidth={4} strokeColor="#4f46e5" />
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
    backgroundColor: palette.primary,
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
    borderColor: palette.border,
    backgroundColor: palette.surface,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: {
    color: palette.text,
    marginBottom: spacing.xs,
    fontWeight: '600',
  },
  emptyText: {
    color: palette.muted,
    textAlign: 'center',
  },
});

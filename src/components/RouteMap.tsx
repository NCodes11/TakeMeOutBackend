import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { Text } from 'react-native-paper';
import { Stop } from '@/types/models';
import { hasValidCoords } from '@/utils/maps';
import { palette, spacing } from '@/theme/appTheme';

export const RouteMap = ({ stops }: { stops: Stop[] }) => {
  const points = stops
    .filter((s) => hasValidCoords({ lat: s.lat, lng: s.lng }))
    .map((s) => ({ latitude: s.lat, longitude: s.lng, title: s.name, description: s.category }));

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
      style={styles.map}
      initialRegion={{
        latitude: points[0].latitude,
        longitude: points[0].longitude,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      }}
    >
      {points.map((p, i) => (
        <Marker coordinate={p} key={i} title={p.title} description={p.description} />
      ))}
      <Polyline coordinates={points} strokeWidth={4} strokeColor="#4f46e5" />
    </MapView>
  );
};

const styles = StyleSheet.create({
  map: {
    height: 260,
    borderRadius: 12,
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

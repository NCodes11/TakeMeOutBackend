import MapView, { Marker, Polyline } from 'react-native-maps';
import { Stop } from '@/types/models';

export const RouteMap = ({ stops }: { stops: Stop[] }) => {
  const points = stops.map((s) => ({ latitude: s.lat || 37.7749, longitude: s.lng || -122.4194 }));
  return (
    <MapView
      style={{ height: 260, borderRadius: 12 }}
      initialRegion={{
        latitude: points[0]?.latitude || 37.7749,
        longitude: points[0]?.longitude || -122.4194,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      }}
    >
      {points.map((p, i) => (
        <Marker coordinate={p} key={i} title={stops[i].name} description={stops[i].category} />
      ))}
      <Polyline coordinates={points} strokeWidth={4} strokeColor="#4f46e5" />
    </MapView>
  );
};

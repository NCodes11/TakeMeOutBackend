import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { Text } from 'react-native';
import * as Location from 'expo-location';
import { Stop } from '@/types/models';
import { RouteLeg } from '@/providers/routingProvider';
import { hasValidCoords } from '@/utils/maps';
import { fonts, lightPalette, radius, spacing, useAppPalette } from '@/theme/appTheme';

type LatLng = {
  latitude: number;
  longitude: number;
};

type MapPoint = LatLng & {
  title: string;
  description?: string;
  order: number;
  isUser?: boolean;
};

const buildDirectSegment = (a: LatLng, b: LatLng) => [
  { latitude: a.latitude, longitude: a.longitude },
  { latitude: b.latitude, longitude: b.longitude },
];

const fetchSegmentRoute = async (
  start: LatLng,
  end: LatLng,
): Promise<{ latitude: number; longitude: number }[] | null> => {
  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving` +
      `/${start.longitude},${start.latitude};${end.longitude},${end.latitude}` +
      `?overview=full&geometries=geojson&steps=false`;

    const response = await fetch(url);
    if (!response.ok) return null;

    const json = (await response.json()) as {
      code?: string;
      routes?: Array<{
        geometry?: {
          coordinates?: [number, number][];
        };
      }>;
    };

    const coords = json.routes?.[0]?.geometry?.coordinates;
    if (json.code !== 'Ok' || !Array.isArray(coords) || coords.length < 2) {
      return null;
    }

    return coords.map(([lng, lat]) => ({
      latitude: lat,
      longitude: lng,
    }));
  } catch {
    return null;
  }
};

export const RouteMap = ({ stops, routeLegs = [] }: { stops: Stop[]; routeLegs?: RouteLeg[] }) => {
  const p = useAppPalette();
  const mapRef = useRef<MapView | null>(null);

  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [originSegment, setOriginSegment] = useState<
    { latitude: number; longitude: number }[] | null
  >(null);

  useEffect(() => {
    let mounted = true;

    const loadUserLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

        const location = await Location.getCurrentPositionAsync({
          accuracy: Platform.OS === 'android' ? Location.Accuracy.Balanced : Location.Accuracy.High,
        });

        if (!mounted) return;

        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      } catch (error) {
        console.warn('Failed to get user location:', error);
      }
    };

    loadUserLocation();

    return () => {
      mounted = false;
    };
  }, []);

  const stopPoints = useMemo<MapPoint[]>(
    () =>
      stops
        .filter((s) => hasValidCoords({ lat: s.lat, lng: s.lng }))
        .sort((a, b) => a.order - b.order)
        .map((s, index) => ({
          latitude: s.lat,
          longitude: s.lng,
          title: s.name,
          description: s.category,
          order: index + 1,
        })),
    [stops],
  );

  const points = useMemo<MapPoint[]>(() => {
    const result: MapPoint[] = [];

    if (userLocation) {
      result.push({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        title: 'Your location',
        description: 'Start',
        order: 0,
        isUser: true,
      });
    }

    result.push(...stopPoints);

    return result;
  }, [stopPoints, userLocation]);

  const routedSegments = useMemo(
    () =>
      routeLegs
        .map((leg) =>
          (leg.polyline || [])
            .filter(
              (coord): coord is [number, number] =>
                Array.isArray(coord) &&
                coord.length === 2 &&
                Number.isFinite(coord[0]) &&
                Number.isFinite(coord[1]),
            )
            .map(([latitude, longitude]) => ({ latitude, longitude })),
        )
        .filter((segment) => segment.length >= 2),
    [routeLegs],
  );

  const needsOriginSegment =
    !!userLocation &&
    stopPoints.length > 0 &&
    routedSegments.length === Math.max(stopPoints.length - 1, 0);

  useEffect(() => {
    let cancelled = false;

    const loadOriginSegment = async () => {
      if (!userLocation || stopPoints.length === 0) {
        setOriginSegment(null);
        return;
      }

      if (!needsOriginSegment) {
        setOriginSegment(null);
        return;
      }

      const start = userLocation;
      const firstStop = {
        latitude: stopPoints[0].latitude,
        longitude: stopPoints[0].longitude,
      };

      const routed = await fetchSegmentRoute(start, firstStop);

      if (cancelled) return;

      if (routed && routed.length >= 2) {
        setOriginSegment(routed);
      } else {
        setOriginSegment(buildDirectSegment(start, firstStop));
      }
    };

    loadOriginSegment();

    return () => {
      cancelled = true;
    };
  }, [needsOriginSegment, stopPoints, userLocation]);

  const displayedSegments = useMemo(() => {
    if (routedSegments.length > 0) {
      return originSegment ? [originSegment, ...routedSegments] : routedSegments;
    }

    if (points.length < 2) return [];

    return points.slice(0, -1).map((_, index) =>
      buildDirectSegment(
        {
          latitude: points[index].latitude,
          longitude: points[index].longitude,
        },
        {
          latitude: points[index + 1].latitude,
          longitude: points[index + 1].longitude,
        },
      ),
    );
  }, [originSegment, points, routedSegments]);

  const fitCoordinates = useMemo(() => {
    if (displayedSegments.length > 0) {
      return displayedSegments.flat();
    }

    return points.map((point) => ({
      latitude: point.latitude,
      longitude: point.longitude,
    }));
  }, [displayedSegments, points]);

  const region = useMemo(() => {
    if (fitCoordinates.length === 0) return null;

    if (fitCoordinates.length === 1) {
      return {
        latitude: fitCoordinates[0].latitude,
        longitude: fitCoordinates[0].longitude,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
      };
    }

    const lats = fitCoordinates.map((point) => point.latitude);
    const lngs = fitCoordinates.map((point) => point.longitude);

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
  }, [fitCoordinates]);

  useEffect(() => {
    if (!mapRef.current || fitCoordinates.length < 2) return;

    mapRef.current.fitToCoordinates(fitCoordinates, {
      edgePadding: { top: 48, right: 48, bottom: 48, left: 48 },
      animated: true,
    });
  }, [fitCoordinates]);

  if (points.length === 0) {
    return (
      <View style={[styles.emptyMap, { borderColor: p.line, backgroundColor: p.mapBase }]}>
        <Text style={[styles.emptyTitle, { color: p.textHigh }]}>Map unavailable</Text>
        <Text style={[styles.emptyText, { color: p.textMid }]}>
          No GPS coordinates were found for this plan.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.mapWrap, { borderColor: p.line, backgroundColor: p.mapBase }]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={region || undefined}
        showsMyLocationButton
        showsPointsOfInterest={false}
        userInterfaceStyle={p.canvas === lightPalette.canvas ? 'light' : 'dark'}
      >
        {points.map((point, index) => (
          <Marker
            key={`${point.title}-${index}`}
            coordinate={{
              latitude: point.latitude,
              longitude: point.longitude,
            }}
            title={point.title}
            description={point.description}
          >
            <View
              style={[
                styles.pin,
                {
                  backgroundColor: point.isUser ? p.surfaceRaised : p.violetFill,
                  borderColor: point.isUser ? p.violetFill : p.surfaceRaised,
                },
              ]}
            >
              <Text style={[styles.pinText, { color: point.isUser ? p.violetText : p.onFill }]}>
                {point.isUser ? 'S' : point.order}
              </Text>
            </View>
          </Marker>
        ))}

        {displayedSegments.map((segment, index) => (
          <Polyline
            key={`casing-${index}`}
            coordinates={segment}
            strokeWidth={8}
            strokeColor="#FFFFFF"
            lineCap="round"
            lineJoin="round"
          />
        ))}
        {displayedSegments.map((segment, index) => (
          <Polyline
            key={`segment-${index}`}
            coordinates={segment}
            strokeWidth={3}
            strokeColor={p.violetDecorative}
            lineCap="round"
            lineJoin="round"
          />
        ))}
      </MapView>
    </View>
  );
};

const styles = StyleSheet.create({
  mapWrap: {
    height: 220,
    borderRadius: radius.media,
    borderWidth: 1,
    overflow: 'hidden',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  pin: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  pinText: {
    fontFamily: fonts.monoSemi,
    fontSize: 11,
  },
  emptyMap: {
    height: 180,
    borderRadius: radius.media,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    gap: 4,
  },
  emptyTitle: {
    fontFamily: fonts.displaySemi,
    fontSize: 15,
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: 'center',
  },
});

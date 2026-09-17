import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Stop } from '@/types/models';
import { hasValidCoords } from '@/utils/maps';
import { fonts, useAppPalette } from '@/theme/appTheme';
import { CategoryTile } from './StopHeroMedia';

type Props = {
  stop: Stop;
  uri?: string;
  height?: number;
};

/** Photo → static map preview → pastel category tile. */
export function StopHeroMedia({ stop, uri, height = 150 }: Props) {
  const p = useAppPalette();

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.heroImage, { height, backgroundColor: p.surfaceRecessed }]}
        resizeMode="cover"
        accessibilityLabel={stop.name}
      />
    );
  }

  if (hasValidCoords({ lat: stop.lat, lng: stop.lng })) {
    return (
      <View style={[styles.heroImage, { height, backgroundColor: p.mapBase }]}>
        <MapView
          style={StyleSheet.absoluteFill}
          initialRegion={{
            latitude: stop.lat,
            longitude: stop.lng,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          toolbarEnabled={false}
          moveOnMarkerPress={false}
          showsCompass={false}
          showsPointsOfInterest={false}
          showsBuildings={false}
          loadingEnabled
          liteMode
          pointerEvents="none"
        >
          <Marker coordinate={{ latitude: stop.lat, longitude: stop.lng }} title={stop.name}>
            <View
              style={[styles.pin, { backgroundColor: p.violetFill, borderColor: p.surfaceRaised }]}
            />
          </Marker>
        </MapView>
        <View
          style={[styles.badge, { backgroundColor: p.surfaceRaised, borderColor: p.lineStrong }]}
        >
          <Text style={[styles.badgeText, { color: p.textLow }]}>MAP PREVIEW</Text>
        </View>
      </View>
    );
  }

  return <CategoryTile stop={stop} height={height} />;
}

const styles = StyleSheet.create({
  heroImage: {
    width: '100%',
    overflow: 'hidden',
  },
  pin: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  badge: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgeText: {
    fontFamily: fonts.monoSemi,
    fontSize: 9.5,
    letterSpacing: 1.2,
  },
});

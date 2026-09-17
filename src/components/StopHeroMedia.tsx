import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stop } from '@/types/models';
import { fonts, useAppPalette } from '@/theme/appTheme';
import { categoryTile } from '@/utils/categoryTile';

type Props = {
  stop: Stop;
  uri?: string;
  height?: number;
};

/** Photo when we have one; otherwise a soft pastel category tile. */
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

  return <CategoryTile stop={stop} height={height} />;
}

export function CategoryTile({ stop, height }: { stop: Stop; height: number }) {
  const p = useAppPalette();
  const tile = categoryTile(stop, p);

  return (
    <View style={[styles.tile, { height, backgroundColor: tile.background }]}>
      <View style={[styles.blobLarge, { backgroundColor: p.violetDecorative }]} />
      <View style={[styles.blobSmall, { backgroundColor: p.violetDecorative }]} />
      <View style={styles.tileFoot}>
        <MaterialCommunityIcons name={tile.icon} size={18} color={p.textHigh} />
        <Text style={[styles.caption, { color: p.textHigh }]} numberOfLines={1}>
          {tile.label}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heroImage: {
    width: '100%',
  },
  tile: {
    width: '100%',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  blobLarge: {
    position: 'absolute',
    right: -30,
    top: -50,
    width: 150,
    height: 150,
    borderRadius: 75,
    opacity: 0.16,
  },
  blobSmall: {
    position: 'absolute',
    left: -20,
    bottom: -40,
    width: 110,
    height: 110,
    borderRadius: 55,
    opacity: 0.1,
  },
  tileFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  caption: {
    fontFamily: fonts.displaySemi,
    fontSize: 14,
  },
});

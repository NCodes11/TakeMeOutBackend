import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native';
import { RouteLeg } from '@/providers/routingProvider';
import { Stop } from '@/types/models';
import { fonts, radius, spacing, useAppPalette } from '@/theme/appTheme';

export const RouteMap = ({ stops }: { stops: Stop[]; routeLegs?: RouteLeg[] }) => {
  const p = useAppPalette();

  const orderedStops = useMemo(() => [...stops].sort((a, b) => a.order - b.order), [stops]);

  if (orderedStops.length === 0) {
    return (
      <View style={[styles.emptyMap, { borderColor: p.line, backgroundColor: p.mapBase }]}>
        <Text style={[styles.emptyTitle, { color: p.textHigh }]}>Map unavailable</Text>
        <Text style={[styles.emptyText, { color: p.textMid }]}>
          No stops were found for this plan.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.map, { backgroundColor: p.mapBase, borderColor: p.line }]}>
      <View style={[styles.routeLine, { backgroundColor: p.violetDecorative }]} />

      {orderedStops.slice(0, 5).map((stop, index) => (
        <View key={stop.id} style={styles.stopRow}>
          <View
            style={[styles.pin, { backgroundColor: p.violetFill, borderColor: p.surfaceRaised }]}
          >
            <Text style={[styles.pinText, { color: p.onFill }]}>{index + 1}</Text>
          </View>

          <View style={[styles.stopCopy, { backgroundColor: p.surfaceRaised }]}>
            <Text numberOfLines={1} style={[styles.stopName, { color: p.textHigh }]}>
              {stop.name}
            </Text>
            <Text numberOfLines={1} style={[styles.stopMeta, { color: p.textMid }]}>
              {stop.category}
            </Text>
          </View>
        </View>
      ))}

      {orderedStops.length > 5 ? (
        <Text style={[styles.moreText, { color: p.textLow }]}>
          +{orderedStops.length - 5} more stops
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  map: {
    minHeight: 220,
    borderRadius: radius.media,
    borderWidth: 1,
    padding: spacing.lg,
    justifyContent: 'center',
    gap: spacing.sm,
    overflow: 'hidden',
  },
  routeLine: {
    position: 'absolute',
    left: spacing.lg + 15,
    top: spacing.xl,
    bottom: spacing.xl,
    width: 3,
    borderRadius: 3,
    opacity: 0.22,
  },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
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
  stopCopy: {
    flex: 1,
    minWidth: 0,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  stopName: {
    fontFamily: fonts.displaySemi,
    fontSize: 14,
    lineHeight: 18,
  },
  stopMeta: {
    marginTop: 2,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
  },
  moreText: {
    marginLeft: 42,
    fontFamily: fonts.mono,
    fontSize: 11,
  },
  emptyMap: {
    height: 180,
    borderRadius: radius.media,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: {
    marginBottom: spacing.xs,
    fontFamily: fonts.displaySemi,
    fontSize: 15,
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});

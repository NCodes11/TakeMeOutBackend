import React, { useMemo, useState } from 'react';
import {
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MonoLabel, PrimaryButton } from '@/components/ui';
import { Stop } from '@/types/models';
import { AppPalette, fonts, shadows, spacing, useAppPalette } from '@/theme/appTheme';
import { openMapsOptions } from '@/utils/openMapsOptions';
import { resolvePrimaryPhotoUrl } from '@/utils/stopMedia';

type Props = {
  visible: boolean;
  stop?: Stop | null;
  onDismiss: () => void;
};

const { width, height } = Dimensions.get('window');

function isPlusCodeAddress(address?: string | null) {
  if (!address) return false;
  return /^[A-Z0-9]{4,8}\+\w+/i.test(address.trim());
}

function getDisplayAddress(stop: Stop): string | undefined {
  const rawAddress = stop.address?.trim();

  if (!rawAddress) {
    return stop.category || undefined;
  }

  if (!isPlusCodeAddress(rawAddress)) {
    return rawAddress;
  }

  const parts = rawAddress.split(' ').filter(Boolean);

  if (parts.length > 1) {
    const withoutPlusCode = parts.slice(1).join(' ').trim();
    if (withoutPlusCode) {
      return withoutPlusCode;
    }
  }

  return stop.category || undefined;
}

function isDollarLabel(value?: string | null): value is '$' | '$$' | '$$$' | '$$$$' {
  return value === '$' || value === '$$' || value === '$$$' || value === '$$$$';
}

function getDisplayPrice(stop: Stop): string | undefined {
  if (isDollarLabel(stop.costLevel)) {
    return stop.costLevel;
  }

  if (typeof stop.priceLevel === 'number' && Number.isFinite(stop.priceLevel)) {
    const normalized = Math.max(1, Math.min(4, Math.round(stop.priceLevel)));
    return '$'.repeat(normalized);
  }

  return undefined;
}

function getDisplayHours(stop: Stop): string | undefined {
  if (!stop.openingHoursText) return undefined;
  const value = String(stop.openingHoursText).trim();
  return value || undefined;
}

export function PlaceInfoModal({ visible, stop, onDismiss }: Props) {
  const p = useAppPalette();
  const [imageIndex, setImageIndex] = useState(0);

  const images = useMemo(() => {
    if (!stop) return [];

    if (Array.isArray(stop.photos) && stop.photos.length > 0) {
      return stop.photos.map((p) => p.url).filter(Boolean);
    }

    const primary = resolvePrimaryPhotoUrl(stop);
    if (primary) {
      return [primary];
    }

    return [];
  }, [stop]);

  if (!stop) return null;

  const hasCoordinates =
    typeof stop.lat === 'number' &&
    typeof stop.lng === 'number' &&
    Number.isFinite(stop.lat) &&
    Number.isFinite(stop.lng);

  const price = getDisplayPrice(stop);
  const displayAddress = getDisplayAddress(stop);
  const displayHours = getDisplayHours(stop);

  const openInMaps = async () => {
    if (!hasCoordinates) return;

    await openMapsOptions({
      name: stop.name,
      lat: stop.lat,
      lng: stop.lng,
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      presentationStyle="overFullScreen"
      onRequestClose={onDismiss}
    >
      <View style={[styles.container, { backgroundColor: p.backdrop }]}>
        <View style={[styles.sheet, { backgroundColor: p.canvas, borderColor: p.line }]}>
          <View style={styles.closeRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onDismiss}
              hitSlop={8}
              style={[
                styles.closeButton,
                shadows.raised,
                {
                  backgroundColor: p.surfaceRaised,
                  borderColor: p.lineStrong,
                  shadowColor: p.shadowColor,
                },
              ]}
            >
              <MaterialCommunityIcons name="close" size={20} color={p.textHigh} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {images.length > 0 && (
              <View>
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={(e) => {
                    const index = Math.round(e.nativeEvent.contentOffset.x / width);
                    setImageIndex(index);
                  }}
                >
                  {images.map((uri: string, i: number) => (
                    <Image
                      key={`${uri}-${i}`}
                      source={{ uri }}
                      style={[styles.heroImage, { backgroundColor: p.surfaceRecessed }]}
                    />
                  ))}
                </ScrollView>

                {images.length > 1 && (
                  <View style={styles.dots}>
                    {images.map((_: string, i: number) => (
                      <View
                        key={i}
                        style={[
                          styles.dot,
                          {
                            backgroundColor: i === imageIndex ? p.violetFill : p.lineStrong,
                          },
                        ]}
                      />
                    ))}
                  </View>
                )}
              </View>
            )}

            <View style={styles.content}>
              <MonoLabel>{stop.category}</MonoLabel>
              <Text style={[styles.title, { color: p.textHigh }]}>{stop.name}</Text>

              {stop.why ? (
                <View style={[styles.why, { borderLeftColor: p.violetDecorative }]}>
                  <Text style={[styles.whyText, { color: p.textMid }]}>{stop.why}</Text>
                </View>
              ) : null}

              <View style={styles.rows}>
                {displayAddress ? <InfoRow label="Address" value={displayAddress} p={p} /> : null}

                {typeof stop.rating === 'number' ? (
                  <InfoRow
                    label="Rating"
                    value={`${stop.rating.toFixed(1)} ★ ${
                      stop.reviewCount ? `(${stop.reviewCount} reviews)` : ''
                    }`}
                    p={p}
                  />
                ) : null}

                {typeof stop.openNow === 'boolean' ? (
                  <InfoRow label="Status" value={stop.openNow ? 'Open now' : 'Closed now'} p={p} />
                ) : null}

                {price ? <InfoRow label="Price" value={price} p={p} /> : null}

                {typeof stop.durationMin === 'number' ? (
                  <InfoRow
                    label="Suggested stay"
                    value={`${stop.durationMin} minutes`}
                    p={p}
                    time
                  />
                ) : null}

                {typeof stop.etaMin === 'number' ? (
                  <InfoRow label="Travel time" value={`About ${stop.etaMin} minutes`} p={p} time />
                ) : null}

                {typeof stop.distanceKm === 'number' ? (
                  <InfoRow label="Distance" value={`${stop.distanceKm.toFixed(1)} km`} p={p} />
                ) : null}

                {displayHours ? <InfoRow label="Hours" value={displayHours} p={p} /> : null}
              </View>
            </View>
          </ScrollView>

          <View style={[styles.footer, { backgroundColor: p.canvas, borderTopColor: p.line }]}>
            <PrimaryButton icon="directions" onPress={openInMaps} disabled={!hasCoordinates}>
              Open in Maps
            </PrimaryButton>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function InfoRow({
  label,
  value,
  p,
  time = false,
}: {
  label: string;
  value: string;
  p: AppPalette;
  time?: boolean;
}) {
  return (
    <View style={[styles.infoRow, { borderBottomColor: p.line }]}>
      <MonoLabel>{label}</MonoLabel>
      <Text
        style={[
          styles.infoValue,
          { color: time ? p.signal : p.textHigh },
          time && styles.infoValueTime,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    height: '88%',
    borderTopWidth: 1,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
  },
  closeRow: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 5,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: 120,
  },
  heroImage: {
    width,
    height: height * 0.34,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 3,
  },
  content: {
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.lg,
    gap: 8,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 27,
    lineHeight: 32,
    letterSpacing: -0.8,
  },
  why: {
    borderLeftWidth: 2,
    paddingLeft: 12,
    marginTop: 6,
  },
  whyText: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
  },
  rows: {
    marginTop: 12,
  },
  infoRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 4,
  },
  infoValue: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15.5,
    lineHeight: 22,
  },
  infoValueTime: {
    fontFamily: fonts.monoSemi,
    fontSize: 14.5,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.gutter,
    paddingTop: 12,
    paddingBottom: 28,
    borderTopWidth: 1,
  },
});

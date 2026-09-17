import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MonoLabel, SecondaryButton, TimeText } from '@/components/ui';
import { useTimeFormat } from '@/context/PreferencesContext';
import { Stop } from '@/types/models';
import { fonts, radius, spacing, useAppPalette } from '@/theme/appTheme';
import { formatTimeDisplay } from '@/utils/time';
import { resolvePrimaryPhotoUrl } from '@/utils/stopMedia';
import { StopHeroMedia } from '@/components/StopHeroMedia';

type Props = {
  stop: Stop;
  onReroll?: () => void;
  onPressInfo?: (stop: Stop) => void;
  onOpenMap?: () => void;
  rerolling?: boolean;
  /** Draw the trailing hairline (off for the last stop in a list). */
  divider?: boolean;
};

function isPlusCodeAddress(address?: string | null) {
  if (!address) return false;
  return /^[A-Z0-9]{4,8}\+\w+/i.test(address.trim());
}

function getDisplayAddress(stop: Stop): string | undefined {
  const rawAddress = stop.address?.trim();

  if (!rawAddress) {
    return undefined;
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

  return undefined;
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m}` : `${h} h`;
}

function priceLabel(stop: Stop): string | undefined {
  if (stop.costLevel && /^\$+$/.test(stop.costLevel)) return stop.costLevel;
  if (typeof stop.priceLevel === 'number' && Number.isFinite(stop.priceLevel)) {
    return '$'.repeat(Math.max(1, Math.min(4, Math.round(stop.priceLevel))));
  }
  return undefined;
}

export function StopCard({
  stop,
  onReroll,
  onPressInfo,
  onOpenMap,
  rerolling,
  divider = true,
}: Props) {
  const p = useAppPalette();
  const timeFormat = useTimeFormat();

  const timeLabel =
    stop.startTime && stop.endTime
      ? `${formatTimeDisplay(stop.startTime, timeFormat)}–${formatTimeDisplay(stop.endTime, timeFormat)}`
      : undefined;

  const displayAddress = getDisplayAddress(stop);
  const heroUri = resolvePrimaryPhotoUrl(stop);
  const price = priceLabel(stop);

  const facts: string[] = [];
  if (typeof stop.rating === 'number') {
    facts.push(
      typeof stop.reviewCount === 'number'
        ? `${stop.rating.toFixed(1)} ★ · ${stop.reviewCount}`
        : `${stop.rating.toFixed(1)} ★`,
    );
  }
  if (price) facts.push(price);
  if (typeof stop.etaMin === 'number' && stop.order > 0) facts.push(`${stop.etaMin} min travel`);

  return (
    <View style={[styles.wrap, divider && { borderBottomWidth: 1, borderBottomColor: p.line }]}>
      <View style={styles.topRow}>
        <View style={styles.topLeft}>
          <Text style={[styles.index, { color: p.violetText }]}>
            {String(stop.order + 1).padStart(2, '0')}
          </Text>
          <MonoLabel style={styles.category} numberOfLines={1}>
            {stop.category}
          </MonoLabel>
        </View>
        {timeLabel || typeof stop.durationMin === 'number' ? (
          <TimeText style={styles.time}>
            {timeLabel}
            {timeLabel && typeof stop.durationMin === 'number' ? (
              <Text style={{ color: p.textLow }}> · {formatDuration(stop.durationMin)}</Text>
            ) : typeof stop.durationMin === 'number' ? (
              formatDuration(stop.durationMin)
            ) : null}
          </TimeText>
        ) : null}
      </View>

      <View style={styles.media}>
        <StopHeroMedia stop={stop} uri={heroUri} height={150} />
      </View>

      <View style={styles.titleBlock}>
        <Text style={[styles.title, { color: p.textHigh }]}>{stop.name}</Text>
        {displayAddress ? (
          <Text style={[styles.address, { color: p.textMid }]} numberOfLines={2}>
            {displayAddress}
          </Text>
        ) : null}
      </View>

      {stop.why ? (
        <View style={[styles.why, { borderLeftColor: p.violetDecorative }]}>
          <Text style={[styles.whyText, { color: p.textMid }]}>{stop.why}</Text>
        </View>
      ) : null}

      {facts.length > 0 ? (
        <Text style={[styles.facts, { color: p.textLow }]}>{facts.join('    ')}</Text>
      ) : null}

      <View style={styles.actions}>
        <SecondaryButton icon="information-outline" onPress={() => onPressInfo?.(stop)}>
          Info
        </SecondaryButton>
        {onOpenMap ? (
          <SecondaryButton icon="map-outline" onPress={onOpenMap}>
            Maps
          </SecondaryButton>
        ) : null}
        {onReroll ? (
          <SecondaryButton
            icon="refresh"
            disabled={Boolean(rerolling)}
            loading={Boolean(rerolling)}
            onPress={() => {
              if (rerolling) return;
              onReroll();
            }}
          >
            Reroll
          </SecondaryButton>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: 20,
    gap: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  topLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
  },
  index: {
    fontFamily: fonts.monoSemi,
    fontSize: 12,
  },
  category: {
    flexShrink: 1,
  },
  time: {
    fontSize: 12,
    flexShrink: 0,
  },
  media: {
    borderRadius: radius.media,
    overflow: 'hidden',
  },
  titleBlock: {
    gap: 3,
  },
  title: {
    fontFamily: fonts.displaySemi,
    fontSize: 19,
    lineHeight: 24,
    letterSpacing: -0.2,
  },
  address: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
  },
  why: {
    borderLeftWidth: 2,
    paddingLeft: 12,
  },
  whyText: {
    fontFamily: fonts.body,
    fontSize: 13.5,
    lineHeight: 21,
  },
  facts: {
    fontFamily: fonts.mono,
    fontSize: 11,
    lineHeight: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
});

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Text } from 'react-native-paper';
import { SecondaryButton } from '@/components/ui';
import { Stop } from '@/types/models';
import { palette, spacing } from '@/theme/appTheme';

type Props = {
  stop: Stop;
  onReroll?: () => void;
  onOpenMap?: () => void | Promise<void>;
};

export function StopCard({ stop, onReroll, onOpenMap }: Props) {
  const timeLabel =
    stop.startTime && stop.endTime ? `${stop.startTime}–${stop.endTime}` : undefined;

  return (
    <View style={styles.wrap}>
      <Card mode="outlined">
        <Card.Content style={styles.content}>
          <View style={styles.headerRow}>
            <View style={styles.titleCol}>
              <Text variant="titleMedium" style={styles.title}>
                {stop.name}
              </Text>

              <Text variant="bodySmall" style={styles.subTitle}>
                {stop.category}
                {timeLabel ? ` · ${timeLabel}` : ''}
              </Text>

              {stop.address ? (
                <Text variant="bodySmall" style={styles.address}>
                  {stop.address}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.metaRow}>
            {typeof stop.durationMin === 'number' ? (
              <Text variant="bodySmall" style={styles.meta}>
                {stop.durationMin} min
              </Text>
            ) : null}

            {typeof stop.etaMin === 'number' && stop.order > 0 ? (
              <Text variant="bodySmall" style={styles.meta}>
                · {stop.etaMin} min travel
              </Text>
            ) : null}

            {typeof stop.rating === 'number' ? (
              <Text variant="bodySmall" style={styles.meta}>
                · {stop.rating.toFixed(1)}★
              </Text>
            ) : null}

            {typeof stop.reviewCount === 'number' ? (
              <Text variant="bodySmall" style={styles.meta}>
                · {stop.reviewCount}
              </Text>
            ) : null}
          </View>

          {(onOpenMap || onReroll) && (
            <View style={styles.actions}>
              {onOpenMap ? (
                <SecondaryButton onPress={onOpenMap}>Open in Maps</SecondaryButton>
              ) : null}

              {onReroll ? (
                <SecondaryButton onPress={onReroll}>Reroll</SecondaryButton>
              ) : null}
            </View>
          )}
        </Card.Content>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.sm,
  },
  content: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  titleCol: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    color: palette.text,
    fontWeight: '700',
  },
  subTitle: {
    color: palette.muted,
  },
  address: {
    color: palette.muted,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  meta: {
    color: palette.muted,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
});

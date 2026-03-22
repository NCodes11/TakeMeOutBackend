import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';
import { SecondaryButton } from '@/components/ui';
import { useTimeFormat } from '@/context/PreferencesContext';
import { BudgetType, Stop } from '@/types/models';
import { spacing } from '@/theme/appTheme';
import { resolveDisplayPriceTier } from '@/utils/priceTier';
import { formatTimeDisplay } from '@/utils/time';

type Props = {
  stop: Stop;
  fallbackBudget?: BudgetType;
  onPressInfo?: (stop: Stop) => void;
  onReroll?: () => void;
  onOpenMap?: () => void | Promise<void>;
  /**
   * When true, the reroll button shows a spinner and becomes disabled.
   */
  rerolling?: boolean;
};

export function StopCard({ stop, fallbackBudget, onPressInfo, onReroll, onOpenMap, rerolling }: Props) {
  const theme = useTheme();
  const timeFormat = useTimeFormat();
  const timeLabel = stop.startTime && stop.endTime
    ? `${formatTimeDisplay(stop.startTime, timeFormat)}–${formatTimeDisplay(stop.endTime, timeFormat)}`
    : undefined;
  const priceTier = resolveDisplayPriceTier(stop.priceLevel, stop.costLevel, fallbackBudget ?? '$$');
  const metaItems = [
    typeof stop.durationMin === 'number' ? `${stop.durationMin} min` : null,
    `Price ${priceTier}`,
    typeof stop.etaMin === 'number' && stop.order > 0 ? `${stop.etaMin} min travel` : null,
    typeof stop.rating === 'number' ? `${stop.rating.toFixed(1)}★` : null,
    typeof stop.reviewCount === 'number' ? `${stop.reviewCount}` : null,
  ].filter((value): value is string => Boolean(value));

  return (
    <View style={styles.wrap}>
      <Card mode="outlined">
        <Card.Content style={styles.content}>
          <View style={styles.headerRow}>
            <View style={styles.titleCol}>
              <Text variant="titleMedium" style={[styles.title, { color: theme.colors.onSurface }]}>
                {stop.name}
              </Text>

              <Text variant="bodySmall" style={[styles.subTitle, { color: theme.colors.onSurfaceVariant }]}>
                {stop.category}
                {timeLabel ? ` · ${timeLabel}` : ''}
              </Text>

              {stop.address ? (
                <Text variant="bodySmall" style={[styles.address, { color: theme.colors.onSurfaceVariant }]}>
                  {stop.address}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.metaRow}>
            {metaItems.map((item, index) => (
              <Text key={`${stop.id}-${item}`} variant="bodySmall" style={[styles.meta, { color: theme.colors.onSurfaceVariant }]}>
                {index === 0 ? item : `· ${item}`}
              </Text>
            ))}
          </View>

          {(onPressInfo || onOpenMap || onReroll) && (
            <View style={styles.actions}>
              {onPressInfo ? (
                <View style={styles.actionItem}>
                  <SecondaryButton onPress={() => onPressInfo(stop)}>Place Info</SecondaryButton>
                </View>
              ) : null}

              {onOpenMap ? (
                <View style={styles.actionItem}>
                  <SecondaryButton onPress={onOpenMap}>Open in Maps</SecondaryButton>
                </View>
              ) : null}

              {onReroll ? (
                <View style={styles.actionItem}>
                  <SecondaryButton
                    disabled={Boolean(rerolling)}
                    loading={Boolean(rerolling)}
                    onPress={() => {
                      if (rerolling) return;
                      onReroll();
                    }}
                  >
                    Reroll
                  </SecondaryButton>
                </View>
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
    fontWeight: '700',
  },
  subTitle: {},
  address: {},
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  meta: {},

  // Keeps both buttons on the same row.
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },

  // Makes each button take equal space so widths don’t change when loading.
  actionItem: {
    flex: 1,
    minWidth: 120,
  },
});

import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Chip, Text } from 'react-native-paper';
import { SecondaryButton } from '@/components/ui';
import { Stop } from '@/types/models';
import { stopTypeLabel } from '@/constants/stopTypes';
import { palette, spacing } from '@/theme/appTheme';

interface Props {
  stop: Stop;
  onLock: () => void;
  onSwap?: () => void;
  onRemove?: () => void;
  onOpenMap?: () => void;
}

export const StopCard = ({ stop, onLock, onSwap, onRemove, onOpenMap }: Props) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card style={styles.card} mode="contained" onPress={() => setExpanded((value) => !value)}>
      <Card.Title title={`${stop.startTime} · ${stop.name}`} subtitle={`${stop.category} · ${stop.durationMin} min`} />
      <Card.Content>
        <Text variant="bodyMedium">{stop.why}</Text>
        <Text variant="bodySmall" style={styles.address}>{stop.address}</Text>
        <View style={styles.chips}>
          {stop.stopType ? <Chip>{stopTypeLabel(stop.stopType)}</Chip> : null}
          <Chip>{stop.costLevel || 'Unknown'}</Chip>
          <Chip>{stop.openNow ? 'Open now' : 'Hours unknown'}</Chip>
          <Chip>{Math.round((stop.distanceKm || 0) * 10) / 10} km</Chip>
          <Chip>{Math.round(stop.etaMin || 0)} min</Chip>
          {typeof stop.rating === 'number' ? <Chip>Rating {stop.rating.toFixed(1)}</Chip> : null}
        </View>
        {expanded ? (
          <View style={styles.expanded}>
            <Text variant="bodySmall" style={styles.detailText}>
              {stop.openingHoursText || 'Business hours unavailable'}
            </Text>
            <Text variant="bodySmall" style={styles.detailHint}>Tap card to collapse details.</Text>
          </View>
        ) : null}
      </Card.Content>
      <Card.Actions>
        {onOpenMap ? <SecondaryButton onPress={onOpenMap}>Open in Maps</SecondaryButton> : null}
        <SecondaryButton onPress={onLock}>{stop.locked ? 'Unlock' : 'Lock'}</SecondaryButton>
        {onSwap && <SecondaryButton onPress={onSwap}>Swap</SecondaryButton>}
        {onRemove && <SecondaryButton onPress={onRemove}>Remove</SecondaryButton>}
      </Card.Actions>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  address: {
    color: palette.muted,
    marginTop: spacing.xs,
  },
  chips: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    flexWrap: 'wrap',
  },
  expanded: {
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  detailText: {
    color: palette.text,
  },
  detailHint: {
    color: palette.muted,
  },
});

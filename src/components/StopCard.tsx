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

export const StopCard = ({ stop, onLock, onSwap, onRemove, onOpenMap }: Props) => (
  <Card style={styles.card} mode="contained">
    <Card.Title title={`${stop.startTime} · ${stop.name}`} subtitle={`${stop.category} · ${stop.durationMin} min`} />
    <Card.Content>
      <Text variant="bodyMedium">{stop.why}</Text>
      <Text variant="bodySmall" style={styles.address}>{stop.address}</Text>
      <View style={styles.chips}>
        {stop.stopType ? <Chip>{stopTypeLabel(stop.stopType)}</Chip> : null}
        <Chip>{stop.costLevel}</Chip>
        <Chip>{stop.openNow ? 'Open now' : 'Hours unknown'}</Chip>
        <Chip>{stop.distanceKm || 0} km</Chip>
      </View>
    </Card.Content>
    <Card.Actions>
      {onOpenMap ? <SecondaryButton onPress={onOpenMap}>Open in Maps</SecondaryButton> : null}
      <SecondaryButton onPress={onLock}>{stop.locked ? 'Unlock' : 'Lock'}</SecondaryButton>
      {onSwap && <SecondaryButton onPress={onSwap}>Swap</SecondaryButton>}
      {onRemove && <SecondaryButton onPress={onRemove}>Remove</SecondaryButton>}
    </Card.Actions>
  </Card>
);

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
});

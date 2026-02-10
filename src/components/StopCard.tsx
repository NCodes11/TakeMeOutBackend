import { View } from 'react-native';
import { Button, Card, Chip, Text } from 'react-native-paper';
import { Stop } from '@/types/models';

interface Props {
  stop: Stop;
  onLock: () => void;
  onSwap?: () => void;
  onRemove?: () => void;
}

export const StopCard = ({ stop, onLock, onSwap, onRemove }: Props) => (
  <Card style={{ marginBottom: 12 }}>
    <Card.Title title={`${stop.startTime} · ${stop.name}`} subtitle={`${stop.category} · ${stop.durationMin} min`} />
    <Card.Content>
      <Text variant="bodyMedium">{stop.why}</Text>
      <Text variant="bodySmall">{stop.address}</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
        <Chip>{stop.costLevel}</Chip>
        <Chip>{stop.openNow ? 'Open now' : 'Hours unknown'}</Chip>
        <Chip>{stop.distanceKm || 0} km</Chip>
      </View>
    </Card.Content>
    <Card.Actions>
      <Button onPress={onLock}>{stop.locked ? 'Unlock' : 'Lock'}</Button>
      {onSwap && <Button onPress={onSwap}>Swap</Button>}
      {onRemove && <Button onPress={onRemove}>Remove</Button>}
    </Card.Actions>
  </Card>
);

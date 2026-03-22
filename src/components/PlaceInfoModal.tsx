import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { Modal, Portal, Text, useTheme } from 'react-native-paper';
import { SecondaryButton } from '@/components/ui';
import { spacing } from '@/theme/appTheme';
import { Stop } from '@/types/models';
import { buildGoogleMapsPinUrl, hasValidCoords } from '@/utils/maps';
import { resolveDisplayPriceTier } from '@/utils/priceTier';

interface PlaceInfoModalProps {
  visible: boolean;
  stop: Stop | null;
  onDismiss: () => void;
}

const joinParts = (parts: Array<string | null | undefined>) => parts.filter(Boolean).join(' · ');

export const PlaceInfoModal = ({ visible, stop, onDismiss }: PlaceInfoModalProps) => {
  const theme = useTheme();
  const priceTier = stop ? resolveDisplayPriceTier(stop.priceLevel, stop.costLevel, '$$') : '$$';

  const openMaps = async () => {
    if (!stop || !hasValidCoords({ lat: stop.lat, lng: stop.lng })) return;
    await Linking.openURL(buildGoogleMapsPinUrl({ lat: stop.lat, lng: stop.lng }, stop.name));
  };

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}>
        {!stop ? null : (
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.header}>
              <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.onSurface }]}>
                {stop.name}
              </Text>
              <Text variant="bodyMedium" style={[styles.subtle, { color: theme.colors.onSurfaceVariant }]}>
                {joinParts([stop.category, `Price ${priceTier}`])}
              </Text>
            </View>

            {stop.address ? (
              <View style={styles.section}>
                <Text variant="labelLarge" style={[styles.label, { color: theme.colors.onSurface }]}>
                  Address
                </Text>
                <Text variant="bodyMedium" style={[styles.body, { color: theme.colors.onSurfaceVariant }]}>
                  {stop.address}
                </Text>
              </View>
            ) : null}

            <View style={styles.section}>
              <Text variant="labelLarge" style={[styles.label, { color: theme.colors.onSurface }]}>
                Details
              </Text>
              <Text variant="bodyMedium" style={[styles.body, { color: theme.colors.onSurfaceVariant }]}>
                {joinParts([
                  typeof stop.rating === 'number' ? `${stop.rating.toFixed(1)} stars` : undefined,
                  typeof stop.reviewCount === 'number' ? `${stop.reviewCount} reviews` : undefined,
                  typeof stop.durationMin === 'number' ? `${stop.durationMin} min stop` : undefined,
                  typeof stop.etaMin === 'number' && stop.order > 0 ? `${stop.etaMin} min travel` : undefined,
                ]) || 'No extra place details available yet.'}
              </Text>
            </View>

            {stop.openingHoursText ? (
              <View style={styles.section}>
                <Text variant="labelLarge" style={[styles.label, { color: theme.colors.onSurface }]}>
                  Hours
                </Text>
                <Text variant="bodyMedium" style={[styles.body, { color: theme.colors.onSurfaceVariant }]}>
                  {stop.openingHoursText}
                </Text>
              </View>
            ) : null}

            {stop.why ? (
              <View style={styles.section}>
                <Text variant="labelLarge" style={[styles.label, { color: theme.colors.onSurface }]}>
                  Why this stop
                </Text>
                <Text variant="bodyMedium" style={[styles.body, { color: theme.colors.onSurfaceVariant }]}>
                  {stop.why}
                </Text>
              </View>
            ) : null}

            <View style={styles.actions}>
              <SecondaryButton onPress={onDismiss}>Close</SecondaryButton>
              <SecondaryButton disabled={!hasValidCoords({ lat: stop.lat, lng: stop.lng })} onPress={openMaps}>
                Open in Maps
              </SecondaryButton>
            </View>
          </ScrollView>
        )}
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  modal: {
    margin: spacing.lg,
    maxHeight: '80%',
    borderRadius: 20,
  },
  content: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  header: {
    gap: spacing.xs,
  },
  title: {
    fontWeight: '800',
  },
  subtle: {},
  section: {
    gap: spacing.xs,
  },
  label: {
    fontWeight: '700',
  },
  body: {
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
});

import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import { AppCard, AppScreen, GhostButton, PrimaryButton, SecondaryButton } from '@/components/ui';
import { useLocation } from '@/context/LocationContext';
import { palette, spacing } from '@/theme/appTheme';

export default function HomeScreen() {
  const { coords, placeLabel, permission, mode, updatedAt, refreshLocation, setMode, setManualLocation } = useLocation();
  const [manualInput, setManualInput] = useState(placeLabel);
  const [pending, setPending] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === 'manual') setManualInput(placeLabel);
  }, [mode, placeLabel]);

  useFocusEffect(
    useCallback(() => {
      if (mode !== 'live') return () => undefined;
      refreshLocation().catch(() => undefined);
      return () => undefined;
    }, [mode, refreshLocation]),
  );

  const onRefresh = async () => {
    setPending(true);
    setDetectError(null);
    try {
      await refreshLocation();
    } catch (e) {
      setDetectError(e instanceof Error ? e.message : 'Unable to refresh location.');
    } finally {
      setPending(false);
    }
  };

  const onSetManual = async () => {
    setPending(true);
    setDetectError(null);
    try {
      await setManualLocation(manualInput);
    } catch (e) {
      setDetectError(e instanceof Error ? e.message : 'Unable to set manual location.');
    } finally {
      setPending(false);
    }
  };

  return (
    <AppScreen title="Take Me Out" subtitle="Build a real-world day plan in minutes.">
      <AppCard>
        <Card.Title title="Take Me Out" subtitle="Modern date and family itinerary planner" />
        <Card.Content>
          <SegmentedButtons
            value={mode}
            onValueChange={(value) => {
              setPending(true);
              setDetectError(null);
              setMode(value as 'live' | 'manual')
                .catch((e) => setDetectError(e instanceof Error ? e.message : 'Unable to switch location mode.'))
                .finally(() => setPending(false));
            }}
            buttons={[{ value: 'live', label: 'Use Live GPS' }, { value: 'manual', label: 'Use Manual Location' }]}
          />
          <Text variant="bodySmall" style={styles.helperText}>
            {mode === 'live'
              ? `Live GPS • ${updatedAt ? `updated ${new Date(updatedAt).toLocaleTimeString()}` : 'waiting for fix'}`
              : 'Manual mode • enter city or address below'}
          </Text>
          <TextInput
            label="City or location"
            placeholder="Orlando, FL"
            value={mode === 'manual' ? manualInput : placeLabel}
            onChangeText={mode === 'manual' ? setManualInput : undefined}
            editable={mode === 'manual'}
            mode="outlined"
            style={styles.input}
          />
          <Text variant="bodySmall" style={styles.helperText}>
            Use the format `City,ST` for best results.
          </Text>
          <Text variant="bodySmall" style={styles.helperText}>
            Permission: {permission}
          </Text>
          {detectError ? <Text style={styles.errorText}>{detectError}</Text> : null}
          <View style={styles.row}>
            {mode === 'manual' ? (
              <SecondaryButton loading={pending} disabled={pending || !manualInput.trim()} onPress={onSetManual}>
                Set Manual Location
              </SecondaryButton>
            ) : (
              <SecondaryButton loading={pending} disabled={pending} onPress={onRefresh}>
                Refresh Location
              </SecondaryButton>
            )}
            <PrimaryButton
              onPress={() =>
                router.push({
                  pathname: '/wizard',
                  params: {
                    city: placeLabel,
                    originLat: coords?.latitude?.toString(),
                    originLng: coords?.longitude?.toString(),
                  },
                })
              }
              disabled={!coords || !placeLabel}
            >
              Start Plan
            </PrimaryButton>
          </View>
        </Card.Content>
      </AppCard>
      <View style={styles.links}>
        <GhostButton onPress={() => router.push('/saved')}>Saved Plans</GhostButton>
        <GhostButton onPress={() => router.push('/settings')}>Settings</GhostButton>
      </View>
      <Text variant="bodySmall" style={styles.tipText}>
        Tip: If location access is denied, type your city manually.
      </Text>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: palette.surface,
  },
  helperText: {
    color: palette.muted,
    marginTop: spacing.xs,
  },
  errorText: {
    color: palette.danger,
    marginTop: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  links: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'flex-start',
  },
  tipText: {
    color: palette.muted,
  },
});

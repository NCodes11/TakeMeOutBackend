import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Card, Modal, Portal, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import { AppCard, AppScreen, GhostButton, PrimaryButton } from '@/components/ui';
import { useLocation } from '@/context/LocationContext';
import { palette, spacing } from '@/theme/appTheme';

export default function HomeScreen() {
  const { coords, placeLabel, permission, mode, updatedAt, refreshLocation, setMode, setManualLocation } = useLocation();
  const [manualInput, setManualInput] = useState(placeLabel);
  const [pending, setPending] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);
  const [manualPromptVisible, setManualPromptVisible] = useState(false);

  useEffect(() => {
    if (placeLabel) setManualInput(placeLabel);
  }, [placeLabel]);

  useFocusEffect(
    useCallback(() => {
      if (mode !== 'live') return () => undefined;
      // Refresh on focus so "Start Plan" launches with current coordinates.
      refreshLocation().catch(() => undefined);
      return () => undefined;
    }, [mode, refreshLocation]),
  );

  const goToWizard = (next: { latitude: number; longitude: number }, label: string) => {
    // Pass city + origin coords so wizard can prefill and immediately search nearby.
    router.push({
      pathname: '/wizard',
      params: {
        city: label,
        originLat: next.latitude.toString(),
        originLng: next.longitude.toString(),
      },
    });
  };

  const proceedWithLive = async () => {
    await setMode('live');
    const fresh = await refreshLocation();
    if (!fresh.coords) throw new Error('Current location unavailable. Choose a manual location.');
    goToWizard(fresh.coords, fresh.placeLabel || placeLabel || 'Current location');
  };

  const proceedWithManual = async (query: string) => {
    const fresh = await setManualLocation(query);
    goToWizard(fresh.coords, fresh.placeLabel);
  };

  const onStartPlan = async () => {
    setPending(true);
    setDetectError(null);
    try {
      if (mode === 'manual' && manualInput.trim()) {
        // Manual mode uses exactly what user typed, then geocodes before navigation.
        await proceedWithManual(manualInput);
        return;
      }
      if (permission === 'granted' && coords) {
        goToWizard(coords, placeLabel || 'Current location');
        return;
      }
      // If live GPS is unavailable, prompt for a fallback path instead of blocking.
      Alert.alert('Choose location', 'Select how you want to start your plan.', [
        {
          text: 'Use my current location',
          onPress: () => {
            proceedWithLive().catch((e) => setDetectError(e instanceof Error ? e.message : 'Unable to use live location.'));
          },
        },
        {
          text: 'Choose a different location',
          onPress: () => {
            setManualPromptVisible(true);
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    } catch (e) {
      setDetectError(e instanceof Error ? e.message : 'Unable to start plan.');
    } finally {
      setPending(false);
    }
  };

  const onSubmitManualPrompt = async () => {
    setPending(true);
    setDetectError(null);
    try {
      await proceedWithManual(manualInput);
      setManualPromptVisible(false);
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
              : 'Manual mode • Start Plan will use the location you enter below'}
          </Text>
          <TextInput
            label="City or location"
            placeholder="Orlando, FL"
            value={manualInput}
            onChangeText={setManualInput}
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
            <PrimaryButton
              onPress={onStartPlan}
              loading={pending}
              disabled={pending}
            >
              Start Plan
            </PrimaryButton>
          </View>
        </Card.Content>
      </AppCard>
      <Portal>
        <Modal visible={manualPromptVisible} onDismiss={() => setManualPromptVisible(false)} contentContainerStyle={styles.modal}>
          <Text variant="titleMedium" style={styles.modalTitle}>Choose a different location</Text>
          <TextInput
            label="City or address"
            placeholder="Orlando, FL"
            value={manualInput}
            onChangeText={setManualInput}
            mode="outlined"
          />
          <View style={styles.modalActions}>
            <GhostButton onPress={() => setManualPromptVisible(false)}>Cancel</GhostButton>
            <PrimaryButton onPress={onSubmitManualPrompt} loading={pending} disabled={!manualInput.trim() || pending}>
              Continue
            </PrimaryButton>
          </View>
        </Modal>
      </Portal>
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
  modal: {
    margin: spacing.lg,
    padding: spacing.lg,
    borderRadius: 16,
    backgroundColor: palette.surface,
    gap: spacing.md,
  },
  modalTitle: {
    color: palette.text,
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
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

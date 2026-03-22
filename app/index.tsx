import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Card, Modal, Portal, SegmentedButtons, Text, TextInput, useTheme } from 'react-native-paper';
import { AppCard, AppScreen, GhostButton, PrimaryButton } from '@/components/ui';
import { useLocation } from '@/context/LocationContext';
import { useTimeFormat } from '@/context/PreferencesContext';
import { spacing } from '@/theme/appTheme';

export default function HomeScreen() {
  const theme = useTheme();
  const { coords, placeLabel, permission, mode, updatedAt, refreshLocation, setMode, setManualLocation } = useLocation();
  const timeFormat = useTimeFormat();
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
    <AppScreen contentContainerStyle={styles.screenContent} style={styles.screenInner}>
      <View style={styles.mainCluster}>
        <View style={styles.brandWrap}>
          <Text style={[styles.brandTitle, { color: theme.colors.onSurface }]}>TAKE ME OUT</Text>
        </View>
        <AppCard>
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
            <Text variant="bodySmall" style={[styles.helperText, { color: theme.colors.onSurfaceVariant }]}>
              {mode === 'live'
                ? `Live GPS • ${
                    updatedAt
                      ? `updated ${new Date(updatedAt).toLocaleTimeString([], {
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: timeFormat === '12h',
                        })}`
                      : 'waiting for fix'
                  }`
                : 'Manual mode • Start Plan will use the location you enter below'}
            </Text>
            <TextInput
              label="City or location"
              placeholder="Orlando, FL"
              value={manualInput}
              onChangeText={setManualInput}
              editable={mode === 'manual'}
              mode="outlined"
              style={[styles.input, { backgroundColor: theme.colors.surface }]}
            />
            {detectError ? <Text style={[styles.errorText, { color: theme.colors.error }]}>{detectError}</Text> : null}
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
        <View style={styles.links}>
          <GhostButton onPress={() => router.push('/saved')}>Saved Plans</GhostButton>
          <GhostButton onPress={() => router.push('/settings')}>Settings</GhostButton>
        </View>
      </View>
      <Portal>
        <Modal
          visible={manualPromptVisible}
          onDismiss={() => setManualPromptVisible(false)}
          contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}
        >
          <Text variant="titleMedium" style={[styles.modalTitle, { color: theme.colors.onSurface }]}>Choose a different location</Text>
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
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  screenInner: {
    gap: spacing.lg,
  },
  mainCluster: {
    gap: spacing.xl,
  },
  brandWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  brandTitle: {
    fontFamily: 'JosefinSans_700Bold',
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: 3,
    textAlign: 'center',
  },
  input: {
  },
  helperText: {
    marginTop: spacing.xs,
  },
  errorText: {
    marginTop: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    justifyContent: 'center',
  },
  modal: {
    margin: spacing.lg,
    padding: spacing.lg,
    borderRadius: 16,
    gap: spacing.md,
  },
  modalTitle: {
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  links: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'center',
  },
});
